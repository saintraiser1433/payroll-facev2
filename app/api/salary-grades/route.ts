import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSalaryGradeSchema = z.object({
  grade: z.string().min(1, 'Grade is required'),
  description: z.string().optional(),
  salaryRate: z.number().min(0, 'Salary rate must be positive'),
  isActive: z.boolean().default(true)
})

const updateSalaryGradeSchema = z.object({
  grade: z.string().min(1, 'Grade is required').optional(),
  description: z.string().optional(),
  salaryRate: z.number().min(0, 'Salary rate must be positive').optional(),
  isActive: z.boolean().optional()
})

// GET /api/salary-grades - Get all salary grades
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const isActive = searchParams.get('isActive')

    const skip = (page - 1) * limit

    const where: any = {}
    
    if (search) {
      where.OR = [
        { grade: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (isActive !== null && isActive !== undefined && isActive !== 'all') {
      where.isActive = isActive === 'true'
    }

    const [salaryGrades, total] = await Promise.all([
      prisma.salaryGrade.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: { employees: true }
          }
        },
        orderBy: { grade: 'asc' }
      }),
      prisma.salaryGrade.count({ where })
    ])

    return NextResponse.json({
      salaryGrades,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching salary grades:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/salary-grades - Create new salary grade
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createSalaryGradeSchema.parse(body)

    // Check if grade already exists
    const existingGrade = await prisma.salaryGrade.findUnique({
      where: { grade: data.grade }
    })

    if (existingGrade) {
      return NextResponse.json(
        { error: 'Salary grade already exists' },
        { status: 400 }
      )
    }

    const salaryGrade = await prisma.salaryGrade.create({
      data,
      include: {
        _count: {
          select: { employees: true }
        }
      }
    })

    return NextResponse.json(salaryGrade, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error creating salary grade:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
