import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSalaryGradeSchema = z.object({
  grade: z.string().min(1, 'Grade is required').optional(),
  description: z.string().optional(),
  salaryRate: z.number().min(0, 'Salary rate must be positive').optional(),
  isActive: z.boolean().optional()
})

// GET /api/salary-grades/[id] - Get salary grade by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const salaryGrade = await prisma.salaryGrade.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { employees: true }
        }
      }
    })

    if (!salaryGrade) {
      return NextResponse.json({ error: 'Salary grade not found' }, { status: 404 })
    }

    return NextResponse.json(salaryGrade)
  } catch (error) {
    console.error('Error fetching salary grade:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/salary-grades/[id] - Update salary grade
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = updateSalaryGradeSchema.parse(body)

    // Check if grade already exists (excluding current record)
    if (data.grade) {
      const existingGrade = await prisma.salaryGrade.findFirst({
        where: { 
          grade: data.grade,
          id: { not: params.id }
        }
      })

      if (existingGrade) {
        return NextResponse.json(
          { error: 'Salary grade already exists' },
          { status: 400 }
        )
      }
    }

    const salaryGrade = await prisma.salaryGrade.update({
      where: { id: params.id },
      data,
      include: {
        _count: {
          select: { employees: true }
        }
      }
    })

    return NextResponse.json(salaryGrade)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error updating salary grade:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/salary-grades/[id] - Delete salary grade
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if salary grade has employees
    const employeeCount = await prisma.employee.count({
      where: { salaryGradeId: params.id }
    })

    if (employeeCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete salary grade with assigned employees' },
        { status: 400 }
      )
    }

    await prisma.salaryGrade.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Salary grade deleted successfully' })
  } catch (error) {
    console.error('Error deleting salary grade:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
