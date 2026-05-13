import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { estimateMonthlyWalletForDraftPeriod } from "@/lib/employee-wallet-estimate"

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function labelForMonthKey(key: string) {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "EMPLOYEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      include: {
        department: { select: { name: true } },
        salaryGrade: { select: { salaryRate: true } },
        schedule: true,
        attendances: {
          where: {
            date: {
              gte: (() => {
                const d = new Date()
                d.setMonth(d.getMonth() - 6)
                d.setDate(1)
                d.setHours(0, 0, 0, 0)
                return d
              })(),
            },
          },
          orderBy: { date: "asc" },
        },
        leaveRequests: {
          where: { status: "APPROVED" },
          orderBy: { startDate: "desc" },
          take: 100,
        },
        overtimeRequests: {
          where: { status: "APPROVED" },
          orderBy: { requestDate: "desc" },
          take: 200,
        },
        employeeBenefits: {
          where: { isActive: true },
          include: { benefit: true },
        },
        cashAdvances: {
          where: {
            status: "APPROVED",
            isPaid: false,
            OR: [{ remainingBalance: { gt: 0 } }, { remainingBalance: null }],
          },
          orderBy: { approvedAt: "asc" },
        },
        payrollItems: {
          include: { payrollPeriod: true },
          orderBy: { createdAt: "desc" },
          take: 24,
        },
      },
    })

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    const monthKeys: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      monthKeys.push(monthKey(d))
    }

    const monthly = new Map<
      string,
      { presentDays: number; hoursWorked: number; overtimeHours: number }
    >()
    for (const k of monthKeys) {
      monthly.set(k, { presentDays: 0, hoursWorked: 0, overtimeHours: 0 })
    }

    const statusCounts = new Map<string, number>()

    for (const att of employee.attendances) {
      const key = monthKey(new Date(att.date))
      const bucket = monthly.get(key)
      if (bucket) {
        if (att.status === "PRESENT" || att.status === "LATE") bucket.presentDays += 1
        if (att.timeIn && att.timeOut) {
          const hours =
            (new Date(att.timeOut).getTime() - new Date(att.timeIn).getTime()) / (1000 * 60 * 60)
          bucket.hoursWorked += hours
        }
        bucket.overtimeHours += att.overtimeMinutes / 60
      }
      statusCounts.set(att.status, (statusCounts.get(att.status) || 0) + 1)
    }

    const monthlyAttendance = monthKeys.map((k) => {
      const b = monthly.get(k)!
      return {
        monthKey: k,
        label: labelForMonthKey(k),
        presentDays: b.presentDays,
        hoursWorked: Math.round(b.hoursWorked * 10) / 10,
        overtimeHours: Math.round(b.overtimeHours * 10) / 10,
      }
    })

    const payrollItemsChrono = [...employee.payrollItems].reverse()
    const payrollTrend = payrollItemsChrono.map((item) => ({
      period: item.payrollPeriod.name,
      netPay: item.netPay,
      basicPay: item.basicPay,
      status: item.payrollPeriod.status,
    }))

    const statusBreakdown = Array.from(statusCounts.entries()).map(([name, value]) => ({
      name,
      value,
    }))

    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)
    const nextMonth = new Date(currentMonth)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    const currentMonthAttendances = employee.attendances.filter((att) => {
      const attDate = new Date(att.date)
      return attDate >= currentMonth && attDate < nextMonth
    })

    const positionSalaryRow = await prisma.positionSalary.findFirst({
      where: { position: employee.position, isActive: true },
      select: { salaryRate: true },
    })
    const baseMonthlySalary =
      positionSalaryRow?.salaryRate ?? employee.salaryGrade?.salaryRate ?? 0

    const now = new Date()
    const activeDraftPeriod = await prisma.payrollPeriod.findFirst({
      where: {
        status: "DRAFT",
        isThirteenthMonth: false,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { startDate: "desc" },
    })

    let lastNetPay = employee.payrollItems[0]?.netPay ?? 0
    let walletMode: "last_payout" | "current_period" | "running_estimate" = employee.payrollItems[0]
      ? "last_payout"
      : "last_payout"
    let walletPeriodName: string | null = null

    if (activeDraftPeriod) {
      walletPeriodName = activeDraftPeriod.name
      const periodItem = await prisma.payrollItem.findUnique({
        where: {
          employeeId_payrollPeriodId: {
            employeeId: employee.id,
            payrollPeriodId: activeDraftPeriod.id,
          },
        },
      })

      // Draft periods: always show a live accrual estimate for the wallet when possible.
      // Storing PayrollItem early (e.g. net ₱0 from an old full-period absence run) must not
      // hide the corrected preview through "today" (May 1–15 while today is May 13, etc.).
      let draftEstimate: { estimatedNet: number } | null = null
      if (employee.salaryType === "MONTHLY" && baseMonthlySalary > 0) {
        const ps = activeDraftPeriod.startDate
        const pe = activeDraftPeriod.endDate
        const attendancesInPeriod = employee.attendances.filter((a) => {
          const d = new Date(a.date)
          return d >= ps && d <= pe
        })
        const otInPeriod = employee.overtimeRequests.filter((r) => {
          const d = new Date(r.requestDate)
          return d >= ps && d <= pe
        })
        const leavesInPeriod = employee.leaveRequests.filter((lr) => {
          return lr.startDate <= pe && lr.endDate >= ps
        })
        const holidays = await prisma.holiday.findMany({
          where: {
            date: { gte: ps, lte: pe },
            isActive: true,
          },
        })
        const benefitsForPeriod = employee.employeeBenefits.filter(
          (eb) => !eb.endDate || eb.endDate >= ps,
        )
        draftEstimate = estimateMonthlyWalletForDraftPeriod({
          payrollPeriod: activeDraftPeriod,
          salaryType: employee.salaryType,
          salaryRate: baseMonthlySalary,
          schedule: employee.schedule,
          attendances: attendancesInPeriod,
          leaveRequests: leavesInPeriod,
          overtimeRequests: otInPeriod,
          employeeBenefits: benefitsForPeriod,
          holidays,
          cashAdvances: employee.cashAdvances,
        })
      }

      if (draftEstimate) {
        lastNetPay = draftEstimate.estimatedNet
        walletMode = "running_estimate"
      } else if (periodItem) {
        lastNetPay = periodItem.netPay
        walletMode = "current_period"
      }
    }

    const stats = {
      presentThisMonth: currentMonthAttendances.filter(
        (att) => att.status === "PRESENT" || att.status === "LATE",
      ).length,
      totalHours: currentMonthAttendances.reduce((sum, att) => {
        if (att.timeIn && att.timeOut) {
          return (
            sum +
            (new Date(att.timeOut).getTime() - new Date(att.timeIn).getTime()) / (1000 * 60 * 60)
          )
        }
        return sum
      }, 0),
      overtimeHours: currentMonthAttendances.reduce((sum, att) => sum + att.overtimeMinutes, 0) / 60,
      monthlySalary: baseMonthlySalary,
      lastNetPay,
      walletMode,
      walletPeriodName,
    }

    return NextResponse.json({
      employee: {
        firstName: employee.firstName,
        lastName: employee.lastName,
        position: employee.position,
        departmentName: employee.department?.name || "No Department",
      },
      monthlyAttendance,
      payrollTrend,
      statusBreakdown,
      stats,
    })
  } catch (error) {
    console.error("Employee analytics error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
