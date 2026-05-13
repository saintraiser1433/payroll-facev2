/** Count scheduled work days between two dates (inclusive). */
export function getWorkDaysInPeriod(startDate: Date, endDate: Date, workingDays: string): number {
  const workDays = workingDays.split(",").map((day) => day.trim().toUpperCase())
  const dayMap: { [key: string]: number } = {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
  }

  let count = 0
  const current = new Date(startDate)

  while (current <= endDate) {
    const dayName = Object.keys(dayMap).find((key) => dayMap[key] === current.getDay())
    if (dayName && workDays.includes(dayName)) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }

  return count
}
