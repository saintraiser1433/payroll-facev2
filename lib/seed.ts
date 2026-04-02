import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

// Helper function to generate random employee names
const firstNames = [
  "Michael", "Christopher", "Jessica", "Matthew", "Ashley", "Jennifer", "Joshua", 
  "Amanda", "Daniel", "David", "James", "Robert", "John", "Joseph", "Andrew",
  "Ryan", "Brandon", "Jason", "Justin", "Sarah", "William", "Jonathan", 
  "Stephanie", "Brian", "Nicole", "Nicholas", "Anthony", "Heather", "Eric",
  "Elizabeth", "Adam", "Megan", "Melissa", "Kevin", "Steven", "Thomas",
  "Timothy", "Christina", "Kyle", "Rachel", "Laura", "Lauren", "Amber",
  "Brittany", "Danielle", "Richard", "Kimberly", "Jeffrey", "Amy", "Angela"
]

const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres",
  "Nguyen", "Hill", "Flores", "Green", "Adams", "Nelson", "Baker",
  "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts", "Gomez"
]

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Function to seed IT employees and their attendance
export async function seedITEmployees() {
  try {
    console.log("Starting IT employee seeding...")

    // Get or create IT department
    const itDepartment = await prisma.department.upsert({
      where: { name: "IT" },
      update: {},
      create: {
        name: "IT",
        description: "Information Technology Department",
      },
    })

    // Create or get schedule for 8:00 AM to 6:00 PM
    let itSchedule = await prisma.schedule.findFirst({
      where: { 
        timeIn: "08:00",
        timeOut: "18:00"
      }
    })

    if (!itSchedule) {
      itSchedule = await prisma.schedule.create({
        data: {
          name: "IT Department Schedule",
          timeIn: "08:00",
          timeOut: "18:00",
          workingDays: "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY",
        },
      })
    }

    // Get or create salary grade for IT employees
    const itSalaryGrade = await prisma.salaryGrade.upsert({
      where: { grade: "IT001" },
      update: {},
      create: {
        grade: "IT001",
        description: "IT Department Grade",
        salaryRate: 60000,
      },
    })

    // IT positions
    const positions = [
      "Software Developer", "Senior Software Developer", "Frontend Developer",
      "Backend Developer", "Full Stack Developer", "DevOps Engineer",
      "System Administrator", "Network Engineer", "Database Administrator",
      "IT Support Specialist", "QA Engineer", "UI/UX Designer",
      "Software Architect", "Technical Lead", "IT Project Manager"
    ]

    // Create/update position-based salary rates (used by payroll).
    // For this seed, all IT positions share the IT salary grade base rate.
    await Promise.all(
      positions.map((pos) =>
        prisma.positionSalary.upsert({
          where: { position: pos },
          update: { salaryRate: itSalaryGrade.salaryRate },
          create: {
            position: pos,
            salaryRate: itSalaryGrade.salaryRate,
            description: "Seed position salary rate",
          },
        })
      )
    )

    // Create 50 IT employees
    const employees = []
    const defaultPassword = await bcrypt.hash("password123", 12)

    for (let i = 1; i <= 50; i++) {
      const firstName = getRandomElement(firstNames)
      const lastName = getRandomElement(lastNames)
      const employeeId = `IT${String(i).padStart(3, "0")}`
      const email = `it.employee${i}@pyrol.com`
      const position = getRandomElement(positions)

      // Check if employee already exists
      const existingEmployee = await prisma.employee.findUnique({
        where: { employeeId }
      })

      if (existingEmployee) {
        console.log(`Employee ${employeeId} already exists, skipping...`)
        employees.push(existingEmployee)
        continue
      }

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: defaultPassword,
          role: "EMPLOYEE",
        },
      })

      // Create employee
      const employee = await prisma.employee.create({
        data: {
          employeeId,
          firstName,
          lastName,
          email,
          phone: `+63 9${getRandomInt(10, 99)} ${getRandomInt(100, 999)} ${getRandomInt(1000, 9999)}`,
          position,
          salaryType: "MONTHLY",
          hireDate: new Date(2024, getRandomInt(0, 11), getRandomInt(1, 28)),
          departmentId: itDepartment.id,
          scheduleId: itSchedule.id,
          salaryGradeId: itSalaryGrade.id,
          userId: user.id,
        },
      })

      employees.push(employee)
      console.log(`Created employee ${employeeId}: ${firstName} ${lastName}`)
    }

    console.log(`Created ${employees.length} IT employees`)

    // Create attendance records for Dec 1-15, 2024
    const startDate = new Date(2024, 11, 1) // December 1, 2024 (month is 0-indexed)
    const endDate = new Date(2024, 11, 15) // December 15, 2024

    console.log("Creating attendance records from Dec 1-15, 2024...")

    for (const employee of employees) {
      const currentDate = new Date(startDate)

      while (currentDate <= endDate) {
        // Skip weekends (Saturday = 6, Sunday = 0)
        const dayOfWeek = currentDate.getDay()
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          currentDate.setDate(currentDate.getDate() + 1)
          continue
        }

        // Check if attendance already exists
        const existingAttendance = await prisma.attendance.findUnique({
          where: {
            employeeId_date: {
              employeeId: employee.id,
              date: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
            }
          }
        })

        if (existingAttendance) {
          currentDate.setDate(currentDate.getDate() + 1)
          continue
        }

        // Schedule: 8:00 AM to 6:00 PM
        const scheduledTimeIn = 8 // 8:00 AM
        const scheduledTimeOut = 18 // 6:00 PM (18:00)

        // Random late arrival: 0-60 minutes after 8:00 AM (30% chance of being late)
        const isLate = Math.random() < 0.3
        const lateMinutes = isLate ? getRandomInt(5, 60) : 0
        const timeInMinutes = lateMinutes
        const timeInHour = scheduledTimeIn + Math.floor(timeInMinutes / 60)
        const timeInMinute = timeInMinutes % 60

        // Break out: around 12:00 PM (11:45 AM - 12:15 PM)
        const breakOutOffset = getRandomInt(-15, 15) // -15 to +15 minutes
        let breakOutHour = 12
        let breakOutMinute = breakOutOffset
        if (breakOutMinute < 0) {
          breakOutHour = 11
          breakOutMinute = 60 + breakOutMinute // e.g., -15 becomes 45
        }

        // Break in: around 1:00 PM (12:45 PM - 1:15 PM) - 1 hour lunch break
        const breakInOffset = getRandomInt(-15, 15) // -15 to +15 minutes
        let breakInHour = 13
        let breakInMinute = breakInOffset
        if (breakInMinute < 0) {
          breakInHour = 12
          breakInMinute = 60 + breakInMinute // e.g., -15 becomes 45
        }

        // Random undertime: 0-60 minutes before 6:00 PM (25% chance of undertime)
        const hasUndertime = Math.random() < 0.25
        const undertimeMinutes = hasUndertime ? getRandomInt(15, 60) : 0
        const timeOutTotalMinutes = scheduledTimeOut * 60 - undertimeMinutes // 6:00 PM = 1080 minutes
        const timeOutHour = Math.floor(timeOutTotalMinutes / 60)
        const timeOutMinute = timeOutTotalMinutes % 60

        // Create date objects
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
        const timeIn = new Date(date.getFullYear(), date.getMonth(), date.getDate(), timeInHour, timeInMinute)
        const breakOut = new Date(date.getFullYear(), date.getMonth(), date.getDate(), breakOutHour, breakOutMinute)
        const breakIn = new Date(date.getFullYear(), date.getMonth(), date.getDate(), breakInHour, breakInMinute)
        const timeOut = new Date(date.getFullYear(), date.getMonth(), date.getDate(), timeOutHour, timeOutMinute)

        // Calculate break minutes
        const breakMinutes = Math.floor((breakIn.getTime() - breakOut.getTime()) / (1000 * 60))

        // Determine status
        let status: "PRESENT" | "LATE" = "PRESENT"
        if (lateMinutes > 0) {
          status = "LATE"
        }

        // Create attendance record
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
          },
        })

        currentDate.setDate(currentDate.getDate() + 1)
      }
    }

    console.log("Attendance records created successfully!")
    console.log(`Created attendance for ${employees.length} employees from Dec 1-15, 2024`)
    console.log("Schedule: 8:00 AM - 6:00 PM")
    console.log("Includes random late arrivals and undertime")

  } catch (error) {
    console.error("Error seeding IT employees:", error)
    throw error
  }
}

export async function seedDatabase() {
  try {
    // Create admin user
    const adminPassword = await bcrypt.hash("admin123", 12)
    const admin = await prisma.user.upsert({
      where: { email: "admin@pyrol.com" },
      update: {},
      create: {
        email: "admin@pyrol.com",
        password: adminPassword,
        role: "ADMIN",
      },
    })

    // Create department head user
    const deptHeadPassword = await bcrypt.hash("dept123", 12)
    const deptHeadUser = await prisma.user.upsert({
      where: { email: "depthead@pyrol.com" },
      update: {},
      create: {
        email: "depthead@pyrol.com",
        password: deptHeadPassword,
        role: "DEPARTMENT_HEAD",
      },
    })

    // Create employee user
    const employeePassword = await bcrypt.hash("emp123", 12)
    const employeeUser = await prisma.user.upsert({
      where: { email: "employee@pyrol.com" },
      update: {},
      create: {
        email: "employee@pyrol.com",
        password: employeePassword,
        role: "EMPLOYEE",
      },
    })

    // Create departments
    const itDepartment = await prisma.department.upsert({
      where: { name: "IT" },
      update: {},
      create: {
        name: "IT",
        description: "Information Technology Department",
      },
    })

    const hrDepartment = await prisma.department.upsert({
      where: { name: "HR" },
      update: {},
      create: {
        name: "HR",
        description: "Human Resources Department",
      },
    })

    // Create schedules
    let regularSchedule = await prisma.schedule.findFirst({
      where: { name: "Regular Day Shift" }
    })
    
    if (!regularSchedule) {
      regularSchedule = await prisma.schedule.create({
        data: {
          name: "Regular Day Shift",
          timeIn: "08:00",
          timeOut: "17:00",
          workingDays: "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY",
        },
      })
    }

    // Create salary grades
    const adminSalaryGrade = await prisma.salaryGrade.upsert({
      where: { grade: "A1" },
      update: {},
      create: {
        grade: "A1",
        description: "Administrative Grade 1",
        salaryRate: 80000,
      },
    })

    const empSalaryGrade = await prisma.salaryGrade.upsert({
      where: { grade: "B1" },
      update: {},
      create: {
        grade: "B1",
        description: "Employee Grade 1",
        salaryRate: 50000,
      },
    })

    // Create/update position-based salary rates (used by payroll).
    await Promise.all([
      prisma.positionSalary.upsert({
        where: { position: "System Administrator" },
        update: { salaryRate: adminSalaryGrade.salaryRate },
        create: { position: "System Administrator", salaryRate: adminSalaryGrade.salaryRate, description: "Seed position salary rate" },
      }),
      prisma.positionSalary.upsert({
        where: { position: "IT Department Head" },
        update: { salaryRate: adminSalaryGrade.salaryRate },
        create: { position: "IT Department Head", salaryRate: adminSalaryGrade.salaryRate, description: "Seed position salary rate" },
      }),
      prisma.positionSalary.upsert({
        where: { position: "Software Developer" },
        update: { salaryRate: empSalaryGrade.salaryRate },
        create: { position: "Software Developer", salaryRate: empSalaryGrade.salaryRate, description: "Seed position salary rate" },
      }),
    ])

    // Create admin employee profile
    await prisma.employee.upsert({
      where: { employeeId: "ADMIN001" },
      update: {},
      create: {
        employeeId: "ADMIN001",
        firstName: "System",
        lastName: "Administrator",
        email: "admin@pyrol.com",
        phone: "+63 912 345 6789",
        position: "System Administrator",
        salaryType: "MONTHLY",
        hireDate: new Date("2023-01-01"),
        userId: admin.id,
        departmentId: itDepartment.id,
        scheduleId: regularSchedule.id,
        salaryGradeId: adminSalaryGrade.id,
      },
    })

    // Create department head employee profile
    const deptHeadEmployee = await prisma.employee.upsert({
      where: { employeeId: "DEPT001" },
      update: {},
      create: {
        employeeId: "DEPT001",
        firstName: "Jane",
        lastName: "Smith",
        email: "depthead@pyrol.com",
        phone: "+63 912 345 6791",
        position: "IT Department Head",
        salaryType: "MONTHLY",
        hireDate: new Date("2023-02-01"),
        userId: deptHeadUser.id,
        departmentId: itDepartment.id,
        scheduleId: regularSchedule.id,
        salaryGradeId: adminSalaryGrade.id,
      },
    })

    // Update IT department to have a head
    await prisma.department.update({
      where: { id: itDepartment.id },
      data: { headId: deptHeadEmployee.id },
    })

    // Create employee profile
    await prisma.employee.upsert({
      where: { employeeId: "EMP001" },
      update: {},
      create: {
        employeeId: "EMP001",
        firstName: "John",
        lastName: "Doe",
        email: "employee@pyrol.com",
        phone: "+63 912 345 6790",
        position: "Software Developer",
        salaryType: "MONTHLY",
        hireDate: new Date("2023-06-01"),
        userId: employeeUser.id,
        departmentId: itDepartment.id,
        scheduleId: regularSchedule.id,
        salaryGradeId: empSalaryGrade.id,
      },
    })

    // Create deduction types
    await prisma.deductionType.upsert({
      where: { name: "SSS Contribution" },
      update: {},
      create: {
        name: "SSS Contribution",
        description: "Social Security System contribution",
        isFixed: false,
        amount: 4.5, // 4.5%
      },
    })

    await prisma.deductionType.upsert({
      where: { name: "PhilHealth" },
      update: {},
      create: {
        name: "PhilHealth",
        description: "Philippine Health Insurance Corporation",
        isFixed: false,
        amount: 2.75, // 2.75%
      },
    })

    await prisma.deductionType.upsert({
      where: { name: "Pag-IBIG" },
      update: {},
      create: {
        name: "Pag-IBIG",
        description: "Home Development Mutual Fund",
        isFixed: true,
        amount: 100, // Fixed ₱100
      },
    })

    await prisma.deductionType.upsert({
      where: { name: "Withholding Tax" },
      update: {},
      create: {
        name: "Withholding Tax",
        description: "Income tax withholding",
        isFixed: false,
        amount: 15, // 15%
      },
    })

    // Create sample attendance records
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const employees = await prisma.employee.findMany()
    
    for (const employee of employees) {
      // Yesterday's attendance
      await prisma.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: yesterday
          }
        },
        update: {},
        create: {
          employeeId: employee.id,
          date: yesterday,
          timeIn: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 8, 0),
          timeOut: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 17, 0),
          status: 'PRESENT',
          lateMinutes: 0,
          overtimeMinutes: 0,
          undertimeMinutes: 0,
        }
      })

      // Today's attendance (only time in for some employees)
      const timeInHour = Math.random() > 0.3 ? 8 : 9 // 70% on time, 30% late
      const lateMinutes = timeInHour > 8 ? (timeInHour - 8) * 60 : 0
      
      await prisma.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: today
          }
        },
        update: {},
        create: {
          employeeId: employee.id,
          date: today,
          timeIn: new Date(today.getFullYear(), today.getMonth(), today.getDate(), timeInHour, 0),
          status: lateMinutes > 0 ? 'LATE' : 'PRESENT',
          lateMinutes,
          overtimeMinutes: 0,
          undertimeMinutes: 0,
        }
      })
    }

    // Create sample payroll periods and items
    const currentMonth = new Date()
    const lastMonth = new Date(currentMonth)
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    
    // Create payroll period for last month
    const payrollPeriod = await prisma.payrollPeriod.create({
      data: {
        name: `${lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Payroll`,
        startDate: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
        endDate: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0),
        status: 'CLOSED'
      }
    })

    // Create payroll items for each employee
    for (const employee of employees) {
      const basicPay = employee.salaryGrade?.salaryRate || 25000 // Default salary
      const sssDeduction = basicPay * 0.045 // 4.5%
      const philhealthDeduction = basicPay * 0.0275 // 2.75%
      const pagibigDeduction = basicPay * 0.02 // 2%
      const totalDeductions = sssDeduction + philhealthDeduction + pagibigDeduction
      const netPay = basicPay - totalDeductions

      await prisma.payrollItem.create({
        data: {
          employeeId: employee.id,
          payrollPeriodId: payrollPeriod.id,
          basicPay: basicPay,
          overtimePay: 0,
          holidayPay: 0,
          totalEarnings: basicPay,
          totalDeductions: totalDeductions,
          netPay: netPay
        }
      })
    }

    console.log("Database seeded successfully!")
    console.log("Demo accounts created:")
    console.log("Admin: admin@pyrol.com / admin123")
    console.log("Department Head: depthead@pyrol.com / dept123")
    console.log("Employee: employee@pyrol.com / emp123")
    console.log("Sample attendance records created for testing")
    console.log("Sample payroll data created for testing")

    // Seed IT employees and attendance
    await seedITEmployees()

  } catch (error) {
    console.error("Error seeding database:", error)
    throw error
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log("Seeding completed")
      process.exit(0)
    })
    .catch((error) => {
      console.error("Seeding failed:", error)
      process.exit(1)
    })
}
