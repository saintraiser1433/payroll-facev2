/** Calendar day keys YYYY-MM-DD in local time */
export function toYmdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Each calendar day from start through end (inclusive), local dates */
export function expandLeaveRangeToYmdKeys(startIso: string, endIso: string): Set<string> {
  const keys = new Set<string>()
  const start = new Date(startIso)
  const end = new Date(endIso)
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cur <= last) {
    keys.add(toYmdLocal(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return keys
}

export function mergeApprovedLeaveDayKeys(
  leaves: { startDate: string; endDate: string }[],
): Set<string> {
  const keys = new Set<string>()
  for (const l of leaves) {
    expandLeaveRangeToYmdKeys(l.startDate, l.endDate).forEach((k) => keys.add(k))
  }
  return keys
}

export function ymdFromAttendanceDate(iso: string): string {
  const d = new Date(iso)
  return toYmdLocal(d)
}
