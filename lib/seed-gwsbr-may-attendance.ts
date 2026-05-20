import { prisma } from "./prisma"
import {
  MAY_2026_ATTENDANCE_DAYS,
  SCHEDULE_SNAPSHOT,
  SCHEDULE_TIME_IN,
  SCHEDULE_TIME_OUT,
  buildAttendancePayload,
  localDate,
} from "./seed-attendance-helpers"

const EMPLOYEE_NUMBER = "GWSBR-0001"

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

  if (employee.scheduleId !== schedule.id) {
    await prisma.employee.update({
      where: { id: employee.id },
      data: { scheduleId: schedule.id },
    })
    console.log(`Assigned schedule ${SCHEDULE_TIME_IN}–${SCHEDULE_TIME_OUT} to ${EMPLOYEE_NUMBER}`)
  }

  let created = 0
  let skipped = 0

  for (const day of MAY_2026_ATTENDANCE_DAYS) {
    const date = localDate(day.year, day.month, day.day)
    if (date.getDay() === 0 || date.getDay() === 6) continue

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date } },
    })
    if (existing) {
      skipped++
      continue
    }

    const payload = buildAttendancePayload(day)
    await prisma.attendance.create({
      data: {
        employeeId: employee.id,
        ...payload,
        overtimeMinutes: 0,
        newScheduleTime: SCHEDULE_SNAPSHOT,
        notes: "Seeded May 16–31 attendance (GWSBR-0001)",
      },
    })
    created++
    console.log(
      `  ${date.toLocaleDateString("en-CA")} ${payload.status} late=${payload.lateMinutes}m`,
    )
  }

  console.log(`\nDone. ${EMPLOYEE_NUMBER}: ${created} created, ${skipped} skipped.`)
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
