import bcrypt from "bcryptjs"
import { generateNextEmployeeId } from "./employee-id"
import { prisma } from "./prisma"
import {
  assignBenefitsToEmployees,
  getOrCreateITDepartmentSchedule,
  seedMayAttendanceForEmployees,
  seedStandardBenefits,
} from "./seed-may-workforce"

const IT_EMPLOYEE_COUNT = 30

const IT_POSITIONS = [
  "Software Developer",
  "Senior Software Developer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "DevOps Engineer",
  "System Administrator",
  "Network Engineer",
  "Database Administrator",
  "IT Support Specialist",
  "QA Engineer",
  "UI/UX Designer",
  "Software Architect",
  "Technical Lead",
  "IT Project Manager",
]

const FIRST_NAMES = [
  "Michael",
  "Christopher",
  "Jessica",
  "Matthew",
  "Ashley",
  "Jennifer",
  "Joshua",
  "Amanda",
  "Daniel",
  "David",
  "James",
  "Robert",
  "John",
  "Joseph",
  "Andrew",
  "Ryan",
  "Brandon",
  "Jason",
  "Justin",
  "Sarah",
  "William",
  "Jonathan",
  "Stephanie",
  "Brian",
  "Nicole",
  "Nicholas",
  "Anthony",
  "Heather",
  "Eric",
  "Elizabeth",
]

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
  "Thompson",
  "White",
  "Harris",
  "Sanchez",
  "Clark",
  "Ramirez",
  "Lewis",
  "Robinson",
  "Walker",
  "Young",
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export async function seedIT30Employees() {
  console.log(`=== IT department: create ${IT_EMPLOYEE_COUNT} employees ===\n`)

  const itDepartment = await prisma.department.upsert({
    where: { name: "IT" },
    update: {},
    create: {
      name: "IT",
      description: "Information Technology Department",
    },
  })

  const itSchedule = await getOrCreateITDepartmentSchedule()
  console.log(`Schedule: ${itSchedule.name} (${itSchedule.timeIn}–${itSchedule.timeOut})`)

  const itSalaryGrade = await prisma.salaryGrade.upsert({
    where: { grade: "IT001" },
    update: {},
    create: {
      grade: "IT001",
      description: "IT Department Grade",
      salaryRate: 60000,
    },
  })

  await Promise.all(
    IT_POSITIONS.map((position) =>
      prisma.positionSalary.upsert({
        where: { position },
        update: { salaryRate: itSalaryGrade.salaryRate },
        create: {
          position,
          salaryRate: itSalaryGrade.salaryRate,
          description: "IT position salary (seed)",
          departmentId: itDepartment.id,
        },
      }),
    ),
  )

  const defaultPassword = await bcrypt.hash("password123", 12)
  const createdEmployeeNumbers: string[] = []

  for (let n = 0; n < IT_EMPLOYEE_COUNT; n++) {
    const employeeId = await generateNextEmployeeId(prisma)
    const firstName = pick(FIRST_NAMES)
    const lastName = pick(LAST_NAMES)
    const position = pick(IT_POSITIONS)
    const email = `it.${employeeId.toLowerCase().replace(/-/g, "")}@gwsbr.local`

    const existing = await prisma.employee.findUnique({ where: { employeeId } })
    if (existing) {
      console.log(`  Skip ${employeeId} (already exists)`)
      continue
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: defaultPassword,
        role: "EMPLOYEE",
      },
    })

    await prisma.employee.create({
      data: {
        employeeId,
        firstName,
        lastName,
        email,
        phone: `+63 9${randInt(10, 99)} ${randInt(100, 999)} ${randInt(1000, 9999)}`,
        position,
        salaryType: "MONTHLY",
        hireDate: new Date(2025, randInt(0, 11), randInt(1, 28)),
        departmentId: itDepartment.id,
        scheduleId: itSchedule.id,
        salaryGradeId: itSalaryGrade.id,
        userId: user.id,
        isActive: true,
      },
    })

    createdEmployeeNumbers.push(employeeId)
    console.log(`  ${employeeId}: ${firstName} ${lastName} — ${position}`)
  }

  if (createdEmployeeNumbers.length === 0) {
    console.log("\nNo new employees created.")
    return
  }

  console.log(`\nCreated ${createdEmployeeNumbers.length} IT employees.\n`)

  console.log("=== Benefits (SSS, PhilHealth, Pag-IBIG) ===\n")
  await seedStandardBenefits()
  await assignBenefitsToEmployees({ onlyEmployeeNumbers: createdEmployeeNumbers })

  console.log("\n=== May attendance (8 weekdays, late/undertime) ===\n")
  await seedMayAttendanceForEmployees({
    onlyEmployeeNumbers: createdEmployeeNumbers,
    scheduleId: itSchedule.id,
    notes: "Seeded IT dept — May 16–31 (8 weekdays)",
  })

  console.log("\nIT 30-employee seed complete.")
  console.log("Login password for new accounts: password123")
}

if (require.main === module) {
  seedIT30Employees()
    .catch((err) => {
      console.error("Seed failed:", err)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
