import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/payroll/items - Get payroll items
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const payrollPeriodId = searchParams.get('payrollPeriodId')
    const employeeId = searchParams.get('employeeId')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const department = searchParams.get('department')
    const position = searchParams.get('position')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const minAmount = searchParams.get('minAmount')
    const maxAmount = searchParams.get('maxAmount')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const skip = (page - 1) * limit

    const where: any = {}
    
    if (payrollPeriodId) {
      where.payrollPeriodId = payrollPeriodId
    }

    if (employeeId) {
      where.employeeId = employeeId
    }

    if (search) {
      where.employee = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { employeeId: { contains: search, mode: 'insensitive' } },
          { position: { contains: search, mode: 'insensitive' } },
        ]
      }
    }

    // Status filter
    if (status && status !== 'all') {
      where.payrollPeriod = {
        ...where.payrollPeriod,
        status: status
      }
    }

    // Department filter
    if (department && department !== 'all') {
      where.employee = {
        ...where.employee,
        departmentId: department
      }
    }

    // Position filter
    if (position && position !== 'all') {
      where.employee = {
        ...where.employee,
        position: position
      }
    }

    // Date range filter
    if (startDate || endDate) {
      where.payrollPeriod = {
        ...where.payrollPeriod,
        ...(startDate && { startDate: { gte: new Date(startDate) } }),
        ...(endDate && { endDate: { lte: new Date(endDate) } })
      }
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      where.netPay = {
        ...(minAmount && { gte: parseFloat(minAmount) }),
        ...(maxAmount && { lte: parseFloat(maxAmount) })
      }
    }

    // If user is an employee, only show their own payroll items
    if (session.user.role === 'EMPLOYEE') {
      const employee = await prisma.employee.findFirst({
        where: { userId: session.user.id }
      })
      if (employee) {
        where.employeeId = employee.id
      }
    }

    // Use include instead of select to avoid Prisma client type issues
    // This will work even if the Prisma client hasn't been regenerated yet
    const [payrollItems, total] = await Promise.all([
      prisma.payrollItem.findMany({
        where,
        skip,
        take: limit,
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              position: true,
              salaryGrade: {
                select: {
                  id: true,
                  grade: true,
                  salaryRate: true
                }
              },
              salaryType: true,
              department: {
                select: { name: true }
              }
            }
          },
          payrollPeriod: true,
          deductions: {
            include: {
              deductionType: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  isFixed: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payrollItem.count({ where })
    ])

    // Process items and ensure all fields are present
    // Handle cases where Prisma client might not recognize new fields yet
    const processedPayrollItems = payrollItems.map(item => {
      // Use type assertion to access fields that might exist in DB but not in Prisma client types yet
      const itemAny = item as any
      return {
        id: item.id,
        basicPay: item.basicPay ?? 0,
        overtimePay: item.overtimePay ?? 0,
        holidayPay: item.holidayPay ?? 0,
        thirteenthMonthPay: itemAny.thirteenthMonthPay ?? 0,
        totalEarnings: item.totalEarnings ?? 0,
        totalDeductions: item.totalDeductions ?? 0,
        netPay: item.netPay ?? 0,
        createdAt: item.createdAt,
        employee: item.employee,
        payrollPeriod: {
          id: item.payrollPeriod.id,
          name: item.payrollPeriod.name,
          startDate: item.payrollPeriod.startDate,
          endDate: item.payrollPeriod.endDate,
          status: item.payrollPeriod.status,
          isThirteenthMonth: (item.payrollPeriod as any).isThirteenthMonth ?? false
        },
        deductions: item.deductions.map(deduction => ({
          id: deduction.id,
          amount: deduction.amount,
          deductionType: deduction.deductionType
        }))
      }
    })

    return NextResponse.json({
      payrollItems: processedPayrollItems,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching payroll items:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', { errorMessage, errorStack })
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}
