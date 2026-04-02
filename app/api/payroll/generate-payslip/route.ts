import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const generatePayslipSchema = z.object({
  payrollItemId: z.string().min(1, 'Payroll item ID is required'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'DEPARTMENT_HEAD', 'EMPLOYEE'].includes(session.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { payrollItemId } = generatePayslipSchema.parse(body)

    // Get payroll item with all related data
    const payrollItem = await prisma.payrollItem.findUnique({
      where: { id: payrollItemId },
      include: {
        employee: {
          include: {
            department: true,
            schedule: true
          }
        },
        payrollPeriod: true,
        deductions: {
          include: {
            deductionType: true
          }
        }
      }
    })

    if (!payrollItem) {
      return NextResponse.json({ error: 'Payroll item not found' }, { status: 404 })
    }

    // For EMPLOYEE role, ensure they can only access their own payroll items
    if (session.user?.role === 'EMPLOYEE') {
      const employee = await prisma.employee.findFirst({
        where: { userId: session.user.id }
      })
      
      if (!employee || employee.id !== payrollItem.employeeId) {
        return NextResponse.json({ error: 'Unauthorized - You can only access your own payslips' }, { status: 403 })
      }
    }

    // Fetch attendance records for the payroll period to calculate tardy and undertime deductions
    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId: payrollItem.employeeId,
        date: {
          gte: payrollItem.payrollPeriod.startDate,
          lte: payrollItem.payrollPeriod.endDate
        }
      }
    })

    // Calculate tardy and undertime deduction amounts
    // Need to calculate daily rate and schedule duration similar to payroll calculation
    let tardyDeduction = 0
    let undertimeDeduction = 0

    if (payrollItem.employee.schedule) {
      // Calculate expected work days for the payroll period (same logic as payroll calculation)
      const expectedWorkDays = getWorkDaysInPeriod(
        payrollItem.payrollPeriod.startDate,
        payrollItem.payrollPeriod.endDate,
        payrollItem.employee.schedule.workingDays || 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY'
      )
      const halfMonthSalary = payrollItem.basicPay
      const dailyRate = halfMonthSalary / expectedWorkDays

      // Calculate schedule duration
      const [scheduleStartHour, scheduleStartMin] = payrollItem.employee.schedule.timeIn.split(':').map(Number)
      const [scheduleEndHour, scheduleEndMin] = payrollItem.employee.schedule.timeOut.split(':').map(Number)
      const scheduleStartMinutes = scheduleStartHour * 60 + scheduleStartMin
      const scheduleEndMinutes = scheduleEndHour * 60 + scheduleEndMin
      let scheduleDurationMinutes = scheduleEndMinutes - scheduleStartMinutes
      if (scheduleDurationMinutes < 0) {
        scheduleDurationMinutes += 24 * 60 // Handle night shifts
      }

      // Calculate deduction amounts day by day
      for (const attendance of attendances) {
        if (attendance.timeIn && attendance.timeOut) {
          // Calculate tardy deduction for this day
          if (attendance.lateMinutes > 0) {
            const dayTardyDeduction = (attendance.lateMinutes / scheduleDurationMinutes) * dailyRate
            tardyDeduction += dayTardyDeduction
          }
          
          // Calculate undertime deduction for this day
          if (attendance.undertimeMinutes > 0) {
            const dayUndertimeDeduction = (attendance.undertimeMinutes / scheduleDurationMinutes) * dailyRate
            undertimeDeduction += dayUndertimeDeduction
          }
        }
      }
    }

    // Calculate payslip data
    const payslipData = {
      companyName: 'Web-based Payroll Management System for Glan White Sand Beach Resort',
      companyFullName: 'Glan White Sand Beach Resort',
      period: {
        ...payrollItem.payrollPeriod,
        isThirteenthMonth: payrollItem.payrollPeriod.isThirteenthMonth
      },
      employee: payrollItem.employee,
      basicPay: payrollItem.basicPay,
      overtimePay: payrollItem.overtimePay,
      holidayPay: payrollItem.holidayPay || 0,
      thirteenthMonthPay: (payrollItem as any).thirteenthMonthPay || 0,
      grossPay: payrollItem.totalEarnings,
      deductions: payrollItem.deductions,
      totalDeductions: payrollItem.totalDeductions,
      netPay: payrollItem.netPay,
      tardyDeduction: tardyDeduction,
      undertimeDeduction: undertimeDeduction,
      generatedAt: new Date(),
      isThirteenthMonth: payrollItem.payrollPeriod.isThirteenthMonth || false
    }

    return NextResponse.json({ payslipData })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error generating payslip:', error)
    return NextResponse.json(
      { error: 'Failed to generate payslip' },
      { status: 500 }
    )
  }
}

// Helper function to calculate work days in a period (same as in payroll calculate route)
function getWorkDaysInPeriod(startDate: Date, endDate: Date, workingDays: string): number {
  const workDays = workingDays.split(',').map(day => day.trim().toUpperCase())
  const dayMap: { [key: string]: number } = {
    'SUNDAY': 0,
    'MONDAY': 1,
    'TUESDAY': 2,
    'WEDNESDAY': 3,
    'THURSDAY': 4,
    'FRIDAY': 5,
    'SATURDAY': 6
  }

  let count = 0
  const current = new Date(startDate)
  
  while (current <= endDate) {
    const dayName = Object.keys(dayMap).find(key => dayMap[key] === current.getDay())
    if (dayName && workDays.includes(dayName)) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }

  return count
}
