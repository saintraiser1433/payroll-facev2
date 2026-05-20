import type { AttendanceStatus } from "@prisma/client"

export const SCHEDULE_TIME_IN = "08:00"
export const SCHEDULE_TIME_OUT = "18:00"
export const SCHEDULE_SNAPSHOT = "08:00-18:00"

export type DaySeed = {
  year: number
  month: number
  day: number
  lateMinutes: number
  undertimeMinutes?: number
  breakOutHour?: number
  breakOutMinute?: number
  breakInHour?: number
  breakInMinute?: number
}

/** 8 weekdays in the May 16–31 window (2026), with late/undertime for deductions. */
export const MAY_2026_ATTENDANCE_DAYS: DaySeed[] = [
  { year: 2026, month: 5, day: 19, lateMinutes: 25 },
  { year: 2026, month: 5, day: 20, lateMinutes: 0 },
  { year: 2026, month: 5, day: 21, lateMinutes: 40 },
  { year: 2026, month: 5, day: 22, lateMinutes: 0, undertimeMinutes: 30 },
  { year: 2026, month: 5, day: 26, lateMinutes: 0 },
  { year: 2026, month: 5, day: 27, lateMinutes: 35 },
  { year: 2026, month: 5, day: 28, lateMinutes: 0 },
  { year: 2026, month: 5, day: 29, lateMinutes: 15 },
]

export function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function clockOnDate(base: Date, hour: number, minute: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute, 0, 0)
}

export function buildAttendancePayload(day: DaySeed) {
  const date = localDate(day.year, day.month, day.day)
  const lateMinutes = day.lateMinutes
  const undertimeMinutes = day.undertimeMinutes ?? 0
  const timeIn = clockOnDate(date, 8, lateMinutes)
  const breakOut = clockOnDate(date, day.breakOutHour ?? 12, day.breakOutMinute ?? 0)
  const breakIn = clockOnDate(date, day.breakInHour ?? 13, day.breakInMinute ?? 0)
  const timeOut = clockOnDate(date, 18, 0)
  if (undertimeMinutes > 0) {
    timeOut.setMinutes(timeOut.getMinutes() - undertimeMinutes)
  }
  const breakMinutes = Math.max(
    0,
    Math.floor((breakIn.getTime() - breakOut.getTime()) / (1000 * 60)),
  )
  const status: AttendanceStatus = lateMinutes > 0 ? "LATE" : "PRESENT"
  return {
    date,
    timeIn,
    breakOut,
    breakIn,
    timeOut,
    status,
    lateMinutes,
    undertimeMinutes,
    breakMinutes,
  }
}
