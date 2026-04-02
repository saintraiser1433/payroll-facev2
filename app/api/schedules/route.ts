import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const scheduleSchema = z.object({
  name: z.string().min(1, 'Schedule name is required'),
  timeIn: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  timeOut: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  workingDays: z.string().min(1, 'Working days are required'),
})

// GET /api/schedules - Get all schedules
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    const where: any = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [schedules, total] = await Promise.all([
      prisma.schedule.findMany({
        where,
        skip,
        take: limit,
        include: {
          employees: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              position: true,
              isActive: true
            }
          }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.schedule.count({ where })
    ])

    // Parse working days for each schedule
    const schedulesWithParsedDays = schedules.map(schedule => ({
      ...schedule,
      workingDaysArray: schedule.workingDays.split(',')
    }))

    return NextResponse.json({
      schedules: schedulesWithParsedDays,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching schedules:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/schedules - Create new schedule
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = scheduleSchema.parse(body)

    // Check if schedule name already exists
    const existingSchedule = await prisma.schedule.findFirst({
      where: { name: validatedData.name }
    })

    if (existingSchedule) {
      return NextResponse.json(
        { error: 'Schedule name already exists' },
        { status: 400 }
      )
    }

    const schedule = await prisma.schedule.create({
      data: validatedData,
      include: {
        employees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            isActive: true
          }
        }
      }
    })

    return NextResponse.json({
      ...schedule,
      workingDaysArray: schedule.workingDays.split(',')
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
