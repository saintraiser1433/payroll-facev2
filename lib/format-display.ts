const UPPER_MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const

/** e.g. MAR-04-2026 (local calendar date) */
export function formatAttendanceTableDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d
  const m = UPPER_MONTHS[date.getMonth()]
  const day = String(date.getDate()).padStart(2, "0")
  const y = date.getFullYear()
  return `${m}-${day}-${y}`
}

/** "20:00" / "08:00" → "8:00pm" / "8:00am" */
export function formatTime24to12(time24: string): string {
  const trimmed = time24.trim()
  const [hRaw, rest] = trimmed.split(":")
  let h = parseInt(hRaw, 10)
  const m = parseInt(rest?.slice(0, 2) ?? "0", 10) || 0
  if (Number.isNaN(h)) return trimmed
  const ap = h >= 12 ? "pm" : "am"
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, "0")}${ap}`
}

/**
 * Stored snapshots like "08:00 – 18:00" or "08:00 - 18:00" → "8:00am - 6:00pm"
 */
export function formatScheduleSnapshot12h(s: string | null | undefined): string | null {
  if (!s?.trim()) return null
  const sep = /\s*[–-]\s*/
  const parts = s.split(sep).map((p) => p.trim()).filter(Boolean)
  if (parts.length !== 2) return s.trim()
  return `${formatTime24to12(parts[0])} - ${formatTime24to12(parts[1])}`
}
