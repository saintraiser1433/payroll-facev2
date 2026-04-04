import type { AttendanceStatus } from "@prisma/client"

type Schedule = { timeIn: string; timeOut: string }

/**
 * Recompute late / overtime / undertime / status from clock times and assigned schedule (same rules as clock IN/OUT).
 */
export function recalculateAttendanceFromSchedule(
  attendanceDate: Date,
  timeIn: Date,
  timeOut: Date,
  schedule: Schedule | null | undefined,
): {
  lateMinutes: number
  overtimeMinutes: number
  undertimeMinutes: number
  status: AttendanceStatus
} {
  if (!schedule?.timeIn || !schedule?.timeOut) {
    return {
      lateMinutes: 0,
      overtimeMinutes: 0,
      undertimeMinutes: 0,
      status: "PRESENT",
    }
  }

  const [scheduleStartHour, scheduleStartMin] = schedule.timeIn.split(":").map(Number)
  const [scheduleEndHour, scheduleEndMin] = schedule.timeOut.split(":").map(Number)

  const scheduleStart = new Date(attendanceDate)
  scheduleStart.setHours(scheduleStartHour, scheduleStartMin, 0, 0)

  const scheduleEnd = new Date(attendanceDate)
  scheduleEnd.setHours(scheduleEndHour, scheduleEndMin, 0, 0)

  let lateMinutes = 0
  let status: AttendanceStatus = "PRESENT"

  if (timeIn > scheduleStart) {
    lateMinutes = Math.floor((timeIn.getTime() - scheduleStart.getTime()) / (1000 * 60))
    status = "LATE"
  }

  let overtimeMinutes = 0
  let undertimeMinutes = 0

  if (timeOut > scheduleEnd) {
    overtimeMinutes = Math.floor((timeOut.getTime() - scheduleEnd.getTime()) / (1000 * 60))
  }
  if (timeOut < scheduleEnd) {
    undertimeMinutes = Math.floor((scheduleEnd.getTime() - timeOut.getTime()) / (1000 * 60))
  }

  return { lateMinutes, overtimeMinutes, undertimeMinutes, status }
}
