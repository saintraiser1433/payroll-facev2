import type { PrismaClient } from "@prisma/client"
import { expandLeaveRangeToYmdKeys, toYmdLocal } from "@/lib/leave-dates"
import { isScheduledWorkDay } from "@/lib/working-days"

export type InvalidTimesheetPreview = {
  attendanceId: string
  employeeCode: string
  employeeName: string
  date: string
  status: string
}

/**
 * Attendance rows that still have missing punches on a scheduled work day after
 * excusing leave, holidays, non-work days, and ABSENT.
 */
export async function findInvalidTimesheetsForClosingPeriod(
  prisma: PrismaClient,
  params: { startDate: Date; endDate: Date; employeeIds: string[] },
): Promise<{ invalid: { id: string; employeeId: string; date: Date; status: string }[]; preview: InvalidTimesheetPreview[] }> {
  const { startDate, endDate, employeeIds } = params
  if (employeeIds.length === 0) {
    return { invalid: [], preview: [] }
  }

  const [candidates, leaves, holidays, employees] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        employeeId: { in: employeeIds },
        OR: [{ timeIn: null }, { timeOut: null }],
      },
      select: { id: true, employeeId: true, date: true, status: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        employeeId: { in: employeeIds },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { employeeId: true, startDate: true, endDate: true },
    }),
    prisma.holiday.findMany({
      where: {
        isActive: true,
        date: { gte: startDate, lte: endDate },
      },
      select: { date: true },
    }),
    prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        schedule: { select: { workingDays: true } },
      },
    }),
  ])

  const scheduleCsvByEmployeeId = new Map(employees.map((e) => [e.id, e.schedule?.workingDays ?? null] as const))
  const employeeMeta = new Map(
    employees.map((e) => [
      e.id,
      { code: e.employeeId, name: `${e.firstName} ${e.lastName}`.trim() },
    ]),
  )

  const excusedDayKeys = new Set<string>()
  for (const l of leaves) {
    const ymds = expandLeaveRangeToYmdKeys(l.startDate.toISOString(), l.endDate.toISOString())
    for (const ymd of ymds) {
      excusedDayKeys.add(`${l.employeeId}:${ymd}`)
    }
  }

  const holidayYmds = new Set(holidays.map((h) => toYmdLocal(new Date(h.date))))

  const invalid = candidates.filter((c) => {
    const d = new Date(c.date)
    const ymd = toYmdLocal(d)
    const key = `${c.employeeId}:${ymd}`

    if (excusedDayKeys.has(key)) return false
    if (holidayYmds.has(ymd)) return false

    const csv = scheduleCsvByEmployeeId.get(c.employeeId)
    if (!isScheduledWorkDay(d, csv)) return false

    if (c.status === "ABSENT") return false

    return true
  })

  const preview = invalid.slice(0, 25).map((c) => {
    const meta = employeeMeta.get(c.employeeId)
    return {
      attendanceId: c.id,
      employeeCode: meta?.code ?? c.employeeId,
      employeeName: meta?.name ?? "Unknown",
      date: toYmdLocal(new Date(c.date)),
      status: c.status,
    }
  })

  return { invalid, preview }
}
