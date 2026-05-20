import { prisma } from "./prisma"

const EMPLOYEE_NUMBER = "GWSBR-0001"
const SCHEDULE_TIME_IN = "08:00"
const SCHEDULE_TIME_OUT = "18:00"
const SCHEDULE_SNAPSHOT = "08:00-18:00"

/** Local calendar date (noon) to avoid timezone day shifts in SQLite. */
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function clockOnDate(
  base: Date,
  hour: number,
  minute: number,
): Date {
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    hour,
    minute,
    0,
    0,
  )
}

type DaySeed = {
  year: number
  month: number
  day: number
  /** Minutes after 8:00 AM schedule start */
  lateMinutes: number
  /** Minutes before 6:00 PM schedule end */
  undertimeMinutes?: number
  breakOutHour?: number
  breakOutMinute?: number
  breakInHour?: number
  breakInMinute?: number
}

const MAY_2026_DAYS: DaySeed[] = [
  { year: 2026, month: 5, day: 19, lateMinutes: 25 },
  { year: 2026, month: 5, day: 20, lateMinutes: 0 },
  { year: 2026, month: 5, day: 21, lateMinutes: 40 },
  { year: 2026, month: 5, day: 22, lateMinutes: 0, undertimeMinutes: 30 },
  { year: 2026, month: 5, day: 29, lateMinutes: 15 },
  { year: 2026, month: 5, day: 26, lateMinutes: 0 },
  { year: 2026, month: 5, day: 27, lateMinutes: 35 },
  { year: 2026, month: 5, day: 28, lateMinutes: 0 },
]

export async function seedGWSBR0001MayAttendance() {
  const employee = await prisma.employee.findUnique({
    where: { employeeId: EMPLOYEE_NUMBER },
    include: { schedule: true },
  })

  if (!employee) {
    throw new Error(
      `Employee ${EMPLOYEE_NUMBER} not found. Create the employee first, then run: npm run db:seed:gwsbr-may`,
    )
  }

  let schedule = employee.schedule
  if (!schedule) {
    schedule = await prisma.schedule.findFirst({
      where: { timeIn: SCHEDULE_TIME_IN, timeOut: SCHEDULE_TIME_OUT },
    })
  }
  if (!schedule) {
    schedule = await prisma.schedule.create({
      data: {
        name: "Day shift 8AM–6PM",
        timeIn: SCHEDULE_TIME_IN,
        timeOut: SCHEDULE_TIME_OUT,
        workingDays: "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY",
      },
    })
  }

  if (
    employee.scheduleId !== schedule.id ||
    schedule.timeIn !== SCHEDULE_TIME_IN ||
    schedule.timeOut !== SCHEDULE_TIME_OUT
  ) {
    await prisma.employee.update({
      where: { id: employee.id },
      data: { scheduleId: schedule.id },
    })
    console.log(`Assigned schedule ${SCHEDULE_TIME_IN}–${SCHEDULE_TIME_OUT} to ${EMPLOYEE_NUMBER}`)
  }

  let created = 0
  let skipped = 0

  for (const day of MAY_2026_DAYS) {
    const date = localDate(day.year, day.month, day.day)
    const dow = date.getDay()
    if (dow === 0 || dow === 6) {
      console.warn(`Skipping weekend: ${day.year}-${day.month}-${day.day}`)
      continue
    }

    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date,
        },
      },
    })
    if (existing) {
      skipped++
      continue
    }

    const lateMinutes = day.lateMinutes
    const undertimeMinutes = day.undertimeMinutes ?? 0
    const timeIn = clockOnDate(date, 8, lateMinutes)
    const breakOut = clockOnDate(
      date,
      day.breakOutHour ?? 12,
      day.breakOutMinute ?? 0,
    )
    const breakIn = clockOnDate(date, day.breakInHour ?? 13, day.breakInMinute ?? 0)
    const timeOut = clockOnDate(date, 18, 0)
    if (undertimeMinutes > 0) {
      timeOut.setMinutes(timeOut.getMinutes() - undertimeMinutes)
    }

    const breakMinutes = Math.max(
      0,
      Math.floor((breakIn.getTime() - breakOut.getTime()) / (1000 * 60)),
    )

    const status = lateMinutes > 0 ? "LATE" : "PRESENT"

    await prisma.attendance.create({
      data: {
        employeeId: employee.id,
        date,
        timeIn,
        breakOut,
        breakIn,
        timeOut,
        status,
        lateMinutes,
        undertimeMinutes,
        overtimeMinutes: 0,
        breakMinutes,
        newScheduleTime: SCHEDULE_SNAPSHOT,
        notes: "Seeded May 16–31 attendance (GWSBR-0001)",
      },
    })
    created++
    console.log(
      `  ${date.toLocaleDateString("en-CA")} ${status} in=${timeIn.toLocaleTimeString()} out=${timeOut.toLocaleTimeString()} late=${lateMinutes}m`,
    )
  }

  console.log(
    `\nDone. ${EMPLOYEE_NUMBER}: ${created} created, ${skipped} skipped (already existed).`,
  )
  console.log(`Range: 8 weekdays in May 2026 (May 16–31 window), schedule ${SCHEDULE_TIME_IN}–${SCHEDULE_TIME_OUT}.`)
}

if (require.main === module) {
  seedGWSBR0001MayAttendance()
    .catch((err) => {
      console.error("Seed failed:", err)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
