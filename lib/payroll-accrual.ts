/**
 * For DRAFT payroll periods, absence should only accrue through "today" so future
 * scheduled days in the period are not treated as already absent (which was
 * zeroing net pay while basic pay still showed the full half-month amount).
 */
export function getMonthlyAbsenceAccrualWindow(
  payrollPeriod: { startDate: Date; endDate: Date; status: string },
  reference: Date = new Date(),
): { start: Date; end: Date } | null {
  const startOfDay = (d: Date) => {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
  }
  const endOfDay = (d: Date) => {
    const x = new Date(d)
    x.setHours(23, 59, 59, 999)
    return x
  }

  const ps = startOfDay(payrollPeriod.startDate)
  const pe = endOfDay(payrollPeriod.endDate)

  if (payrollPeriod.status === "CLOSED") {
    return { start: ps, end: pe }
  }

  const todayEnd = endOfDay(reference)
  const accEnd = pe.getTime() <= todayEnd.getTime() ? pe : todayEnd

  if (accEnd.getTime() < ps.getTime()) {
    return null
  }

  return { start: ps, end: accEnd }
}
