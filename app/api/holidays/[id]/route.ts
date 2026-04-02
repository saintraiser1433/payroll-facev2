import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateHolidaySchema = z.object({
  name: z.string().min(1, 'Holiday name is required').optional(),
  date: z.string().transform((str) => new Date(str)).optional(),
  type: z.enum(['REGULAR', 'SPECIAL']).optional(),
  payRate: z.number().min(0.1, 'Pay rate must be at least 0.1').optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional()
})

// GET /api/holidays/[id] - Get single holiday
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const holiday = await prisma.holiday.findUnique({
      where: { id }
    })

    if (!holiday) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 })
    }

    return NextResponse.json(holiday)
  } catch (error) {
    console.error('Error fetching holiday:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/holidays/[id] - Update holiday
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const data = updateHolidaySchema.parse(body)

    // Check if holiday exists
    const existingHoliday = await prisma.holiday.findUnique({
      where: { id }
    })

    if (!existingHoliday) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 })
    }

    // If date is being updated, check for conflicts
    if (data.date) {
      const conflictingHoliday = await prisma.holiday.findFirst({
        where: {
          date: data.date,
          isActive: true,
          id: { not: id }
        }
      })

      if (conflictingHoliday) {
        return NextResponse.json(
          { error: 'A holiday already exists on this date' },
          { status: 400 }
        )
      }
    }

    const holiday = await prisma.holiday.update({
      where: { id },
      data
    })

    return NextResponse.json(holiday)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating holiday:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/holidays/[id] - Delete holiday
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if holiday exists
    const existingHoliday = await prisma.holiday.findUnique({
      where: { id }
    })

    if (!existingHoliday) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 })
    }

    await prisma.holiday.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Holiday deleted successfully' })
  } catch (error) {
    console.error('Error deleting holiday:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
