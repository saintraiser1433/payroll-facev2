import { toYmdLocal } from "@/lib/leave-dates"

const DAY_INDEX_TO_NAME: Record<number, string> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
}

const DEFAULT_WORKING_DAYS = "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY"

/** Whether `date` (local calendar day) is a scheduled work day for the employee. */
export function isScheduledWorkDay(date: Date, workingDaysCsv: string | null | undefined): boolean {
  const csv = (workingDaysCsv?.trim() || DEFAULT_WORKING_DAYS).toUpperCase()
  const allowed = csv.split(",").map((d) => d.trim()).filter(Boolean)
  const dayName = DAY_INDEX_TO_NAME[date.getDay()]
  return allowed.includes(dayName)
}

export function ymdKeyForDate(d: Date): string {
  return toYmdLocal(d)
}
