import { getMonthlyAbsenceAccrualWindow } from "@/lib/payroll-accrual"
import { creditedOvertimeMinutesForDay } from "@/lib/payroll-overtime"
import { getWorkDaysInPeriod } from "@/lib/payroll-work-days"
import { calculatePhilippineTax } from "@/lib/philippine-tax"

type ScheduleLike = {
  timeIn: string
  timeOut: string
  workingDays: string
} | null

type AttendanceLike = {
  date: Date
  timeIn: Date | null
  timeOut: Date | null
  overtimeMinutes: number | null
}

type LeaveLike = {
  startDate: Date
  endDate: Date
}

type OtRequestLike = {
  requestDate: Date
  approvedMinutes: number | null
}

type BenefitLike = {
  isActive: boolean
  benefit: { isActive: boolean; employeeContribution: number }
}

type CashAdvanceLike = {
  status: string
  isPaid: boolean
  remainingBalance: number | null
  amount: number
  amountPerPeriod: number | null
}

type HolidayLike = {
  date: Date
  payRate: number
}

type PayrollPeriodLike = {
  startDate: Date
  endDate: Date
  deductionsEnabled: boolean
  isThirteenthMonth: boolean
  /** DRAFT uses absence accrual through today; omit or CLOSED uses full period. */
  status?: string
}

function computeLateAndUndertime(
  schedule: ScheduleLike,
  attendance: { timeIn: Date; timeOut: Date },
): { lateMin: number; undertimeMin: number } {
  if (!schedule) return { lateMin: 0, undertimeMin: 0 }
  const [scheduleStartHour, scheduleStartMin] = schedule.timeIn.split(":").map(Number)
  const [scheduleEndHour, scheduleEndMin] = schedule.timeOut.split(":").map(Number)

  const scheduleBase = new Date(attendance.timeIn)
  const scheduleStart = new Date(scheduleBase)
  scheduleStart.setHours(scheduleStartHour, scheduleStartMin, 0, 0)

  const scheduleEnd = new Date(scheduleBase)
  scheduleEnd.setHours(scheduleEndHour, scheduleEndMin, 0, 0)
  if (scheduleEnd < scheduleStart) {
    scheduleEnd.setDate(scheduleEnd.getDate() + 1)
  }

  const lateMin =
    attendance.timeIn > scheduleStart
      ? Math.floor((attendance.timeIn.getTime() - scheduleStart.getTime()) / (1000 * 60))
      : 0
  const undertimeMin =
    attendance.timeOut < scheduleEnd
      ? Math.floor((scheduleEnd.getTime() - attendance.timeOut.getTime()) / (1000 * 60))
      : 0
  return { lateMin: Math.max(0, lateMin), undertimeMin: Math.max(0, undertimeMin) }
}

/**
 * Mirrors the MONTHLY branch of /api/payroll/calculate for draft-period wallet preview
 * when no PayrollItem exists yet.
 */
export function estimateMonthlyWalletForDraftPeriod(input: {
  payrollPeriod: PayrollPeriodLike
  salaryType: string
  salaryRate: number
  schedule: ScheduleLike
  attendances: AttendanceLike[]
  leaveRequests: LeaveLike[]
  overtimeRequests: OtRequestLike[]
  employeeBenefits: BenefitLike[]
  holidays: HolidayLike[]
  cashAdvances: CashAdvanceLike[]
}): { estimatedNet: number; totalEarnings: number; totalDeductions: number } | null {
  if (input.salaryType !== "MONTHLY") return null
  if (input.payrollPeriod.isThirteenthMonth) return null
  if (input.salaryRate <= 0) return null

  const { payrollPeriod } = input
  const workingDaysCsv = input.schedule?.workingDays || "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY"

  const accrualPeriod = {
    startDate: payrollPeriod.startDate,
    endDate: payrollPeriod.endDate,
    status: payrollPeriod.status ?? "DRAFT",
  }
  const fullPeriodExpectedWorkDays = getWorkDaysInPeriod(
    payrollPeriod.startDate,
    payrollPeriod.endDate,
    workingDaysCsv,
  )

  const absenceAccrual = getMonthlyAbsenceAccrualWindow(accrualPeriod)
  const accrualExpectedWorkDays = absenceAccrual
    ? getWorkDaysInPeriod(absenceAccrual.start, absenceAccrual.end, workingDaysCsv)
    : 0

  const attendances = input.attendances
  const workedDays = absenceAccrual
    ? attendances.filter((a) => {
        if (!a.timeIn || !a.timeOut) return false
        const ad = new Date(a.date).getTime()
        return ad >= absenceAccrual.start.getTime() && ad <= absenceAccrual.end.getTime()
      }).length
    : 0

  const halfMonthSalary = input.salaryRate / 2
  const basicPay = halfMonthSalary
  const dailyRate = fullPeriodExpectedWorkDays > 0 ? halfMonthSalary / fullPeriodExpectedWorkDays : 0

  let scheduleDurationMinutes = 8 * 60
  if (input.schedule) {
    const [scheduleStartHour, scheduleStartMin] = input.schedule.timeIn.split(":").map(Number)
    const [scheduleEndHour, scheduleEndMin] = input.schedule.timeOut.split(":").map(Number)
    const scheduleStartMinutes = scheduleStartHour * 60 + scheduleStartMin
    const scheduleEndMinutes = scheduleEndHour * 60 + scheduleEndMin
    let duration = scheduleEndMinutes - scheduleStartMinutes
    if (duration < 0) {
      duration += 24 * 60
    }
    scheduleDurationMinutes = duration
  }

  const scheduleHours = scheduleDurationMinutes / 60
  const hourlyRate = scheduleHours > 0 ? dailyRate / scheduleHours : 0

  const approvedLeaveDays = absenceAccrual
    ? input.leaveRequests.reduce((sum, leave) => {
        const overlapStartMs = Math.max(
          leave.startDate.getTime(),
          payrollPeriod.startDate.getTime(),
          absenceAccrual.start.getTime(),
        )
        const overlapEndMs = Math.min(
          leave.endDate.getTime(),
          payrollPeriod.endDate.getTime(),
          absenceAccrual.end.getTime(),
        )
        if (overlapStartMs > overlapEndMs) return sum
        return sum + getWorkDaysInPeriod(new Date(overlapStartMs), new Date(overlapEndMs), workingDaysCsv)
      }, 0)
    : 0

  const absentDays = Math.max(0, accrualExpectedWorkDays - (workedDays + approvedLeaveDays))
  const absentDeduction = absentDays * dailyRate

  const otApproved = input.overtimeRequests.map((req) => ({
    requestDate: req.requestDate,
    approvedMinutes: req.approvedMinutes || 0,
  }))

  let totalOvertimeHours = 0
  for (const attendance of attendances) {
    if (attendance.timeIn && attendance.timeOut && input.schedule) {
      const creditedOt = creditedOvertimeMinutesForDay(
        new Date(attendance.date),
        attendance.overtimeMinutes || 0,
        otApproved,
      )
      totalOvertimeHours += creditedOt / 60
    }
  }

  let tardyPhp = 0
  let undertimePhp = 0
  for (const attendance of attendances) {
    if (attendance.timeIn && attendance.timeOut && input.schedule) {
      const { lateMin, undertimeMin } = computeLateAndUndertime(input.schedule, {
        timeIn: attendance.timeIn,
        timeOut: attendance.timeOut,
      })
      if (lateMin > 0 && scheduleDurationMinutes > 0) {
        tardyPhp += (lateMin / scheduleDurationMinutes) * dailyRate
      }
      if (undertimeMin > 0 && scheduleDurationMinutes > 0) {
        undertimePhp += (undertimeMin / scheduleDurationMinutes) * dailyRate
      }
    }
  }

  const overtimePay = totalOvertimeHours * hourlyRate * 1.5

  let holidayPay = 0
  for (const holiday of input.holidays) {
    const holidayDate = new Date(holiday.date)
    const isHolidayWorked = attendances.some((a) => {
      if (!a.timeIn || !a.timeOut) return false
      const ad = new Date(a.date)
      return ad.toDateString() === holidayDate.toDateString()
    })
    if (isHolidayWorked) {
      holidayPay += dailyRate * holiday.payRate
    }
  }

  const totalEarnings = Math.max(0, basicPay + overtimePay + holidayPay - absentDeduction)
  const taxableIncomeForWithholding = Math.max(0, totalEarnings - tardyPhp - undertimePhp)

  let totalDeductions = 0
  if (payrollPeriod.deductionsEnabled) {
    totalDeductions += tardyPhp + undertimePhp

    const taxCalculation = calculatePhilippineTax(taxableIncomeForWithholding, input.salaryType)
    if (taxCalculation.monthlyTax > 0) {
      totalDeductions += taxCalculation.monthlyTax
    }

    let benefitDeductions = 0
    let tempTotal = totalDeductions
    for (const employeeBenefit of input.employeeBenefits) {
      if (
        employeeBenefit.isActive &&
        employeeBenefit.benefit.isActive &&
        employeeBenefit.benefit.employeeContribution > 0
      ) {
        const potentialNet = totalEarnings - (tempTotal + employeeBenefit.benefit.employeeContribution)
        if (potentialNet >= 0) {
          benefitDeductions += employeeBenefit.benefit.employeeContribution
          tempTotal += employeeBenefit.benefit.employeeContribution
        }
      }
    }
    totalDeductions += benefitDeductions

    let availableForCashAdvance = Math.max(0, totalEarnings - totalDeductions)
    for (const advance of input.cashAdvances) {
      if (advance.status !== "APPROVED" || advance.isPaid) continue
      const remainingRaw = advance.remainingBalance ?? advance.amount
      const remaining = Math.max(0, remainingRaw)
      if (remaining <= 0) continue
      const per =
        advance.amountPerPeriod != null && advance.amountPerPeriod > 0
          ? advance.amountPerPeriod
          : remaining
      const scheduled = Math.min(per, remaining)
      const take = Math.min(scheduled, availableForCashAdvance)
      if (take <= 0) continue
      totalDeductions += Math.round(take * 100) / 100
      availableForCashAdvance -= take
    }
  }

  const estimatedNet = Math.max(0, Math.round((totalEarnings - totalDeductions) * 100) / 100)
  return {
    estimatedNet,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
  }
}
