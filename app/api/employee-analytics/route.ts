import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
        if (att.status === "PRESENT") bucket.presentDays += 1
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

    const stats = {
      presentThisMonth: currentMonthAttendances.filter((att) => att.status === "PRESENT").length,
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
      lastNetPay: employee.payrollItems[0]?.netPay ?? 0,
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
