import { prisma } from "./prisma"
import {
  MAY_2026_ATTENDANCE_DAYS,
  SCHEDULE_SNAPSHOT,
  SCHEDULE_TIME_IN,
  SCHEDULE_TIME_OUT,
  buildAttendancePayload,
  localDate,
} from "./seed-attendance-helpers"

const EXCLUDE_ATTENDANCE_EMPLOYEE_IDS = ["GWSBR-0001"]

type BenefitSeed = {
  name: string
  description: string
  type: "HEALTH" | "RETIREMENT" | "OTHER"
  coverageAmount: number
  employeeContribution: number
  employerContribution: number
}

const STANDARD_BENEFITS: BenefitSeed[] = [
  {
    name: "SSS",
    description: "Social Security System — employee share (seed)",
    type: "RETIREMENT",
    coverageAmount: 20000,
    employeeContribution: 1200,
    employerContribution: 2400,
  },
  {
    name: "PhilHealth",
    description: "Philippine Health Insurance — employee share (seed)",
    type: "HEALTH",
    coverageAmount: 100000,
    employeeContribution: 500,
    employerContribution: 500,
  },
  {
    name: "Pag-IBIG",
    description: "Home Development Mutual Fund — employee share (seed)",
    type: "OTHER",
    coverageAmount: 50000,
    employeeContribution: 100,
    employerContribution: 100,
  },
]

async function getOrCreateDayShiftSchedule() {
  let schedule = await prisma.schedule.findFirst({
    where: { timeIn: SCHEDULE_TIME_IN, timeOut: SCHEDULE_TIME_OUT },
  })
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
  return schedule
}

export async function seedStandardBenefits() {
  const benefitIds: string[] = []
  for (const b of STANDARD_BENEFITS) {
    const existing = await prisma.benefit.findFirst({ where: { name: b.name } })
    const row = existing
      ? await prisma.benefit.update({
          where: { id: existing.id },
          data: {
            description: b.description,
            type: b.type,
            coverageAmount: b.coverageAmount,
            employeeContribution: b.employeeContribution,
            employerContribution: b.employerContribution,
            isActive: true,
          },
        })
      : await prisma.benefit.create({
          data: {
            name: b.name,
            description: b.description,
            type: b.type,
            coverageAmount: b.coverageAmount,
            employeeContribution: b.employeeContribution,
            employerContribution: b.employerContribution,
            isActive: true,
          },
        })
    benefitIds.push(row.id)
    console.log(`  Benefit: ${b.name} (employee ₱${b.employeeContribution}/period)`)
  }
  return benefitIds
}

export async function assignBenefitsToEmployees(options?: {
  excludeEmployeeNumbers?: string[]
}) {
  const exclude = new Set(options?.excludeEmployeeNumbers ?? [])
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, employeeId: true, firstName: true, lastName: true },
  })

  const benefits = await prisma.benefit.findMany({
    where: { name: { in: STANDARD_BENEFITS.map((b) => b.name) }, isActive: true },
  })

  if (benefits.length === 0) {
    throw new Error("No standard benefits found. Run seedStandardBenefits first.")
  }

  let assigned = 0
  let skipped = 0

  for (const emp of employees) {
    if (exclude.has(emp.employeeId)) continue

    for (const benefit of benefits) {
      const existing = await prisma.employeeBenefit.findUnique({
        where: {
          employeeId_benefitId: {
            employeeId: emp.id,
            benefitId: benefit.id,
          },
        },
      })
      if (existing) {
        skipped++
        continue
      }
      await prisma.employeeBenefit.create({
        data: {
          employeeId: emp.id,
          benefitId: benefit.id,
          startDate: new Date(2026, 0, 1),
          isActive: true,
        },
      })
      assigned++
    }
  }

  console.log(
    `Benefits: ${assigned} assignments created, ${skipped} skipped (already assigned).`,
  )
  console.log(`  Employees covered: ${employees.filter((e) => !exclude.has(e.employeeId)).length}`)
}

export async function seedMayAttendanceForEmployees(options?: {
  excludeEmployeeNumbers?: string[]
  notes?: string
}) {
  const exclude = new Set(options?.excludeEmployeeNumbers ?? EXCLUDE_ATTENDANCE_EMPLOYEE_IDS)
  const schedule = await getOrCreateDayShiftSchedule()

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, employeeId: true, scheduleId: true },
  })

  const targets = employees.filter((e) => !exclude.has(e.employeeId))
  if (targets.length === 0) {
    console.log("No employees to seed attendance for.")
    return { created: 0, skipped: 0, employees: 0 }
  }

  let created = 0
  let skipped = 0

  for (const emp of targets) {
    if (emp.scheduleId !== schedule.id) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: { scheduleId: schedule.id },
      })
    }

    for (const day of MAY_2026_ATTENDANCE_DAYS) {
      const date = localDate(day.year, day.month, day.day)
      if (date.getDay() === 0 || date.getDay() === 6) continue

      const existing = await prisma.attendance.findUnique({
        where: { employeeId_date: { employeeId: emp.id, date } },
      })
      if (existing) {
        skipped++
        continue
      }

      const payload = buildAttendancePayload(day)
      await prisma.attendance.create({
        data: {
          employeeId: emp.id,
          ...payload,
          overtimeMinutes: 0,
          newScheduleTime: SCHEDULE_SNAPSHOT,
          notes: options?.notes ?? "Seeded May 16–31 attendance (8 weekdays)",
        },
      })
      created++
    }
  }

  console.log(
    `Attendance: ${created} records created, ${skipped} skipped across ${targets.length} employees.`,
  )
  console.log(`  Excluded: ${[...exclude].join(", ") || "(none)"}`)
  console.log(`  Schedule: ${SCHEDULE_TIME_IN}–${SCHEDULE_TIME_OUT}`)

  return { created, skipped, employees: targets.length }
}

export async function seedMayWorkforce() {
  console.log("=== Seeding standard benefits (SSS, PhilHealth, Pag-IBIG) ===\n")
  await seedStandardBenefits()

  console.log("\n=== Assigning benefits to all active employees ===\n")
  await assignBenefitsToEmployees()

  console.log("\n=== Seeding May attendance (all except GWSBR-0001) ===\n")
  await seedMayAttendanceForEmployees({
    excludeEmployeeNumbers: EXCLUDE_ATTENDANCE_EMPLOYEE_IDS,
  })

  console.log("\nMay workforce seed complete.")
}

if (require.main === module) {
  seedMayWorkforce()
    .catch((err) => {
      console.error("Seed failed:", err)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
