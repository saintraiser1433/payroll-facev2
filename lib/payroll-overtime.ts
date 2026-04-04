/** Same calendar day in local date parts (attendance date vs OT request date). */
export function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export type ApprovedOtRow = { requestDate: Date; approvedMinutes: number }

/**
 * Payroll OT credit: min(actual OT on attendance, sum of approved OT minutes for that calendar day).
 * If there is no approved OT on that day, nothing is credited (OT pay requires approval).
 */
export function creditedOvertimeMinutesForDay(
  attendanceDate: Date,
  actualOvertimeMinutes: number,
  approvedRequests: ApprovedOtRow[],
): number {
  const approvedSameDay = approvedRequests
    .filter((r) => sameCalendarDay(new Date(r.requestDate), attendanceDate))
    .reduce((s, r) => s + (r.approvedMinutes || 0), 0)
  if (approvedSameDay <= 0) return 0
  return Math.min(Math.max(0, actualOvertimeMinutes || 0), approvedSameDay)
}
