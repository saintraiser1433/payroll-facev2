import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const assignBenefitSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  benefitId: z.string().min(1, 'Benefit ID is required'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { employeeId, benefitId, startDate, endDate } = assignBenefitSchema.parse(body)

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Check if benefit exists
    const benefit = await prisma.benefit.findUnique({
      where: { id: benefitId }
    })

    if (!benefit) {
      return NextResponse.json({ error: 'Benefit not found' }, { status: 404 })
    }

    // Check if employee already has this benefit
    const existingBenefit = await prisma.employeeBenefit.findUnique({
      where: {
        employeeId_benefitId: {
          employeeId,
          benefitId
        }
      }
    })

    if (existingBenefit) {
      return NextResponse.json({ error: 'Employee already has this benefit' }, { status: 400 })
    }

    // Create employee benefit assignment
    const employeeBenefit = await prisma.employeeBenefit.create({
      data: {
        employeeId,
        benefitId,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        isActive: true
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true
          }
        },
        benefit: {
          select: {
            id: true,
            name: true,
            type: true,
            employeeContribution: true,
            employerContribution: true
          }
        }
      }
    })

    return NextResponse.json(employeeBenefit, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error assigning benefit:', error)
    return NextResponse.json(
      { error: 'Failed to assign benefit' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')

    const whereClause: any = { isActive: true }
    if (employeeId) {
      whereClause.employeeId = employeeId
    }

    const employeeBenefits = await prisma.employeeBenefit.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true
          }
        },
        benefit: {
          select: {
            id: true,
            name: true,
            type: true,
            employeeContribution: true,
            employerContribution: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ employeeBenefits })
  } catch (error) {
    console.error('Error fetching employee benefits:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee benefits' },
      { status: 500 }
    )
  }
}
