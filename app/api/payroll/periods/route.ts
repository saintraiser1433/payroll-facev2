import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const payrollPeriodSchema = z.object({
  name: z.string().min(1, 'Period name is required'),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
  isThirteenthMonth: z.boolean().optional().default(false),
})

// GET /api/payroll/periods - Get all payroll periods
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const minAmount = searchParams.get('minAmount')
    const maxAmount = searchParams.get('maxAmount')
    const minEmployees = searchParams.get('minEmployees')
    const maxEmployees = searchParams.get('maxEmployees')
    const sortField = searchParams.get('sortField')
    const sortDirection = searchParams.get('sortDirection') || 'desc'

    const skip = (page - 1) * limit

    const where: any = {}
    
    // Search filter
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive'
      }
    }
    
    // Status filter
    if (status && status !== 'all') {
      where.status = status
    }

    // Date range filter
    if (startDate || endDate) {
      where.startDate = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) })
      }
    }

    // Determine orderBy clause
    let orderBy: any = { createdAt: 'desc' } // Default sorting
    if (sortField) {
      if (sortField === 'name') {
        orderBy = { name: sortDirection }
      } else if (sortField === 'startDate') {
        orderBy = { startDate: sortDirection }
      } else if (sortField === 'status') {
        orderBy = { status: sortDirection }
      } else if (sortField === 'createdAt') {
        orderBy = { createdAt: sortDirection }
      }
      // Note: employeeCount, totalEarnings, totalDeductions, totalNetPay will be sorted after calculation
    }

    const [periods, total] = await Promise.all([
      prisma.payrollPeriod.findMany({
        where,
        skip,
        take: limit,
        include: {
          payrollItems: {
            include: {
              employee: {
                select: {
                  id: true,
                  employeeId: true,
                  firstName: true,
                  lastName: true,
                  position: true,
                  department: {
                    select: { name: true }
                  }
                }
              }
            }
          }
        },
        orderBy
      }),
      prisma.payrollPeriod.count({ where })
    ])

    // Calculate totals for each period
    let periodsWithTotals = periods.map(period => {
      const totalEarnings = period.payrollItems.reduce((sum, item) => sum + item.totalEarnings, 0)
      const totalDeductions = period.payrollItems.reduce((sum, item) => sum + item.totalDeductions, 0)
      const totalNetPay = period.payrollItems.reduce((sum, item) => sum + item.netPay, 0)

      return {
        ...period,
        totalEarnings,
        totalDeductions,
        totalNetPay,
        employeeCount: period.payrollItems.length
      }
    })

    // Apply amount and employee count filters after calculating totals
    if (minAmount || maxAmount) {
      periodsWithTotals = periodsWithTotals.filter(period => {
        const netPay = period.totalNetPay
        if (minAmount && netPay < parseFloat(minAmount)) return false
        if (maxAmount && netPay > parseFloat(maxAmount)) return false
        return true
      })
    }

    if (minEmployees || maxEmployees) {
      periodsWithTotals = periodsWithTotals.filter(period => {
        const employeeCount = period.employeeCount
        if (minEmployees && employeeCount < parseInt(minEmployees)) return false
        if (maxEmployees && employeeCount > parseInt(maxEmployees)) return false
        return true
      })
    }

    // Apply sorting for calculated fields
    if (sortField && ['employeeCount', 'totalEarnings', 'totalDeductions', 'totalNetPay'].includes(sortField)) {
      periodsWithTotals.sort((a, b) => {
        let aValue: number, bValue: number
        
        switch (sortField) {
          case 'employeeCount':
            aValue = a.employeeCount
            bValue = b.employeeCount
            break
          case 'totalEarnings':
            aValue = a.totalEarnings
            bValue = b.totalEarnings
            break
          case 'totalDeductions':
            aValue = a.totalDeductions
            bValue = b.totalDeductions
            break
          case 'totalNetPay':
            aValue = a.totalNetPay
            bValue = b.totalNetPay
            break
          default:
            return 0
        }
        
        if (sortDirection === 'asc') {
          return aValue - bValue
        } else {
          return bValue - aValue
        }
      })
    }

    return NextResponse.json({
      periods: periodsWithTotals,
      pagination: {
        page,
        limit,
        total: periodsWithTotals.length, // Use filtered count
        pages: Math.ceil(periodsWithTotals.length / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching payroll periods:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/payroll/periods - Create new payroll period
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = payrollPeriodSchema.parse(body)

    // Validate date range
    if (validatedData.endDate <= validatedData.startDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    // Check for overlapping periods - Skip this check for 13th month pay periods
    // 13th month pay can overlap with any other periods (including other 13th month periods)
    if (!validatedData.isThirteenthMonth) {
      const overlappingPeriod = await prisma.payrollPeriod.findFirst({
        where: {
          // Only check conflicts with non-13th-month periods
          isThirteenthMonth: false,
          OR: [
            {
              AND: [
                { startDate: { lte: validatedData.startDate } },
                { endDate: { gte: validatedData.startDate } }
              ]
            },
            {
              AND: [
                { startDate: { lte: validatedData.endDate } },
                { endDate: { gte: validatedData.endDate } }
              ]
            },
            {
              AND: [
                { startDate: { gte: validatedData.startDate } },
                { endDate: { lte: validatedData.endDate } }
              ]
            }
          ]
        }
      })

      if (overlappingPeriod) {
        return NextResponse.json(
          { error: 'Payroll period overlaps with existing period' },
          { status: 400 }
        )
      }
    }

    const period = await prisma.payrollPeriod.create({
      data: {
        ...validatedData,
        isThirteenthMonth: validatedData.isThirteenthMonth || false,
      },
      include: {
        payrollItems: {
          include: {
            employee: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                position: true,
                department: {
                  select: { name: true }
                }
              }
            }
          }
        }
      }
    })

    return NextResponse.json(period, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating payroll period:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

