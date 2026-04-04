type Schedule = { timeIn: string; timeOut: string }

function normalizeTimeTo24h(t: string): string | null {
  const trimmed = t.trim()
  const lower = trimmed.toLowerCase()
  if (lower.includes("am") || lower.includes("pm")) {
    const isPm = lower.includes("pm")
    const without = lower.replace(/am|pm/g, "").trim()
    const [hStr, rest] = without.split(":")
    let h = parseInt(hStr, 10)
    const m = parseInt(rest?.slice(0, 2) ?? "0", 10) || 0
    if (Number.isNaN(h)) return null
    if (isPm && h !== 12) h += 12
    if (!isPm && h === 12) h = 0
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }
  const [hStr, rest] = trimmed.split(":")
  const h = parseInt(hStr, 10)
  const m = parseInt(rest?.slice(0, 2) ?? "0", 10) || 0
  if (Number.isNaN(h)) return null
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Snapshot strings like "08:00 – 18:00" or "8:00am - 6:00pm" */
function parseScheduleSnapshotToSchedule(s: string | null | undefined): Schedule | null {
  if (!s?.trim()) return null
  const sep = /\s*[–-]\s*/
  const parts = s.split(sep).map((p) => p.trim()).filter(Boolean)
  if (parts.length !== 2) return null
  const t1 = normalizeTimeTo24h(parts[0])
  const t2 = normalizeTimeTo24h(parts[1])
  if (!t1 || !t2) return null
  return { timeIn: t1, timeOut: t2 }
}

export type AttendanceMetricInput = {
  date: string
  timeIn: string | null
  timeOut: string | null
  breakOut?: string | null
  breakIn?: string | null
  breakMinutes?: number
  lateMinutes: number
  overtimeMinutes: number
  undertimeMinutes: number
  status: string
  oldScheduleTime?: string | null
  newScheduleTime?: string | null
  employee: {
    schedule?: Schedule | null
  }
}

/**
 * Display metrics for attendance table. Uses DB fields when set; otherwise derives from schedule + times.
 */
export function computeAttendanceDisplayMetrics(record: AttendanceMetricInput) {
  const sched =
    record.employee.schedule?.timeIn && record.employee.schedule?.timeOut
      ? record.employee.schedule
      : parseScheduleSnapshotToSchedule(record.newScheduleTime) ??
        parseScheduleSnapshotToSchedule(record.oldScheduleTime)
  let computedLate = 0
  let computedOt = 0
  let computedUt = 0
  let midbreakMin = 0
  let totalWorkMin = 0

  if (record.breakOut && record.breakIn) {
    midbreakMin = Math.max(
      0,
      Math.floor(
        (new Date(record.breakIn).getTime() - new Date(record.breakOut).getTime()) / (1000 * 60),
      ),
    )
  }
  if (record.breakMinutes != null && record.breakMinutes > 0) {
    midbreakMin = record.breakMinutes
  }

  if (record.timeIn && record.timeOut && sched?.timeIn && sched?.timeOut) {
    const day = new Date(record.date)
    const [sh, sm] = sched.timeIn.split(":").map(Number)
    const [eh, em] = sched.timeOut.split(":").map(Number)
    const scheduleStart = new Date(day)
    scheduleStart.setHours(sh, sm, 0, 0)
    const scheduleEnd = new Date(day)
    scheduleEnd.setHours(eh, em, 0, 0)
    const actualStart = new Date(record.timeIn)
    const actualEnd = new Date(record.timeOut)

    const scheduleMinutes = Math.floor(
      (scheduleEnd.getTime() - scheduleStart.getTime()) / (1000 * 60),
    )

    if (actualStart > scheduleStart) {
      computedLate = Math.floor((actualStart.getTime() - scheduleStart.getTime()) / (1000 * 60))
    }
    if (actualEnd > scheduleEnd) {
      computedOt = Math.floor((actualEnd.getTime() - scheduleEnd.getTime()) / (1000 * 60))
    }

    const grossWork = Math.floor((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60))
    const br = record.breakMinutes || 0
    const deductibleBreak = br > 30 ? br - 30 : 0
    totalWorkMin = Math.max(0, grossWork - deductibleBreak)

    if (actualEnd < scheduleEnd) {
      computedUt = Math.floor((scheduleEnd.getTime() - actualEnd.getTime()) / (1000 * 60))
    } else {
      const actualWorkLessThanSchedule = grossWork < scheduleMinutes
      if (actualWorkLessThanSchedule) {
        computedUt = Math.max(0, scheduleMinutes - grossWork)
      }
    }
  } else if (record.timeIn && record.timeOut) {
    const actualStart = new Date(record.timeIn)
    const actualEnd = new Date(record.timeOut)
    const grossWork = Math.floor((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60))
    const br = record.breakMinutes || 0
    const deductibleBreak = br > 30 ? br - 30 : 0
    totalWorkMin = Math.max(0, grossWork - deductibleBreak)
  }

  const lateMin = record.lateMinutes > 0 ? record.lateMinutes : computedLate
  const otMin = record.overtimeMinutes > 0 ? record.overtimeMinutes : computedOt
  const utMin = record.undertimeMinutes > 0 ? record.undertimeMinutes : computedUt

  return {
    lateMin,
    otMin,
    utMin,
    midbreakMin,
    totalWorkMin,
  }
}
