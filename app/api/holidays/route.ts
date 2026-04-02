import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createHolidaySchema = z.object({
  name: z.string().min(1, 'Holiday name is required'),
  date: z.string().transform((str) => new Date(str)),
  type: z.enum(['REGULAR', 'SPECIAL']),
  payRate: z.number().min(0.1, 'Pay rate must be at least 0.1'),
  description: z.string().optional(),
  isActive: z.boolean().optional()
})

const updateHolidaySchema = z.object({
  name: z.string().min(1, 'Holiday name is required').optional(),
  date: z.string().transform((str) => new Date(str)).optional(),
  type: z.enum(['REGULAR', 'SPECIAL']).optional(),
  payRate: z.number().min(0.1, 'Pay rate must be at least 0.1').optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional()
})

// GET /api/holidays - Get all holidays
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
    const type = searchParams.get('type')
    const year = searchParams.get('year')

    const skip = (page - 1) * limit

    const where: any = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (type && type !== 'all') {
      where.type = type
    }

    if (year) {
      const startDate = new Date(`${year}-01-01`)
      const endDate = new Date(`${year}-12-31`)
      where.date = {
        gte: startDate,
        lte: endDate
      }
    }

    const [holidays, total] = await Promise.all([
      prisma.holiday.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'asc' }
      }),
      prisma.holiday.count({ where })
    ])

    return NextResponse.json({
      holidays,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching holidays:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/holidays - Create new holiday
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createHolidaySchema.parse(body)

    // Check if holiday already exists on the same date
    const existingHoliday = await prisma.holiday.findFirst({
      where: {
        date: data.date,
        isActive: true
      }
    })

    if (existingHoliday) {
      return NextResponse.json(
        { error: 'A holiday already exists on this date' },
        { status: 400 }
      )
    }

    const holiday = await prisma.holiday.create({
      data: {
        ...data,
        isActive: data.isActive ?? true
      }
    })

    return NextResponse.json(holiday, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating holiday:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
