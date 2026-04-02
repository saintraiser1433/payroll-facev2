import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const scheduleUpdateSchema = z.object({
  name: z.string().min(1, 'Schedule name is required').optional(),
  timeIn: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
  timeOut: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
  workingDays: z.string().min(1, 'Working days are required').optional(),
})

// GET /api/schedules/[id] - Get single schedule
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: {
        employees: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            position: true,
            isActive: true,
            department: {
              select: { name: true }
            }
          }
        }
      }
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...schedule,
      workingDaysArray: schedule.workingDays.split(',')
    })
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/schedules/[id] - Update schedule
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = scheduleUpdateSchema.parse(body)

    // Check if schedule exists
    const existingSchedule = await prisma.schedule.findUnique({
      where: { id: params.id }
    })

    if (!existingSchedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Check if schedule name already exists (if being updated)
    if (validatedData.name && validatedData.name !== existingSchedule.name) {
      const duplicateName = await prisma.schedule.findFirst({
        where: { 
          name: validatedData.name,
          id: { not: params.id }
        }
      })

      if (duplicateName) {
        return NextResponse.json(
          { error: 'Schedule name already exists' },
          { status: 400 }
        )
      }
    }

    const schedule = await prisma.schedule.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        employees: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            position: true,
            isActive: true,
            department: {
              select: { name: true }
            }
          }
        }
      }
    })

    return NextResponse.json({
      ...schedule,
      workingDaysArray: schedule.workingDays.split(',')
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/schedules/[id] - Delete schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if schedule exists
    const existingSchedule = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: {
        employees: true
      }
    })

    if (!existingSchedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Check if schedule is being used by employees
    if (existingSchedule.employees.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete schedule that is assigned to employees' },
        { status: 400 }
      )
    }

    await prisma.schedule.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Schedule deleted successfully' })
  } catch (error) {
    console.error('Error deleting schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

