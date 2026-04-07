import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { expandLeaveRangeToYmdKeys, toYmdLocal } from '@/lib/leave-dates'

function formatScheduleSnapshot(
  schedule: { timeIn: string; timeOut: string } | null | undefined
): string | null {
  if (!schedule?.timeIn || !schedule?.timeOut) return null
  return `${schedule.timeIn} – ${schedule.timeOut}`
}

const attendanceSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  date: z.string().transform((str) => new Date(str)),
  timeIn: z.string().optional().transform((str) => str ? new Date(str) : undefined),
  timeOut: z.string().optional().transform((str) => str ? new Date(str) : undefined),
  status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'OVERTIME']).default('PRESENT'),
  notes: z.string().optional(),
})

const timeInOutSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  type: z.enum(['IN', 'OUT', 'BREAK_OUT', 'BREAK_IN']),
})

async function isDateInClosedPeriod(date: Date) {
  const row = await prisma.payrollPeriod.findFirst({
    where: {
      status: "CLOSED",
      startDate: { lte: date },
      endDate: { gte: date },
    },
    select: { id: true },
  })
  return Boolean(row)
}

// GET /api/attendance - Get attendance records
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const employeeId = searchParams.get('employeeId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status')
    const sortField = searchParams.get('sortField')
    const sortDirection = searchParams.get('sortDirection') as 'asc' | 'desc' || 'asc'

    const skip = (page - 1) * limit

    const where: any = {}

    if (employeeId) {
      where.employeeId = employeeId
    }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        where.date.gte = new Date(startDate)
      }
      if (endDate) {
        where.date.lte = new Date(endDate)
      }
    }

    if (status && status !== "LEAVE") {
      where.status = status
    }

    // If user is an employee or department head, only show their own attendance
    if (session.user.role === 'EMPLOYEE' || session.user.role === 'DEPARTMENT_HEAD') {
      const employee = await prisma.employee.findFirst({
        where: { userId: session.user.id }
      })
      if (employee) {
        where.employeeId = employee.id
      }
    }

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({
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
              department: {
                select: { name: true }
              },
              schedule: {
                select: { timeIn: true, timeOut: true, name: true },
              },
              faceSamples: {
                where: { slot: 1 },
                select: { imagePath: true, slot: true },
              },
            }
          }
        },
        orderBy: sortField && sortField !== "department" ? { [sortField]: sortDirection } : { date: 'desc' }
      }),
      prisma.attendance.count({ where })
    ])

    const closedPeriods = await prisma.payrollPeriod.findMany({
      where: { status: "CLOSED" },
      select: { startDate: true, endDate: true },
    })
    const isLocked = (date: Date) =>
      closedPeriods.some((p) => p.startDate <= date && p.endDate >= date)

    const ymdSeen = new Set(
      attendances.map((a) => `${a.employeeId}:${toYmdLocal(new Date(a.date))}`),
    )

    const employeeIdsForLeaves = Array.from(new Set(attendances.map((a) => a.employeeId)))
    let effectiveStart = startDate ? new Date(startDate) : null
    let effectiveEnd = endDate ? new Date(endDate) : null
    if (!effectiveStart || !effectiveEnd) {
      if (attendances.length > 0) {
        const times = attendances.map((a) => new Date(a.date).getTime())
        const minT = Math.min(...times)
        const maxT = Math.max(...times)
        if (!effectiveStart) effectiveStart = new Date(minT)
        if (!effectiveEnd) effectiveEnd = new Date(maxT)
      } else {
        const today = new Date()
        if (!effectiveStart) effectiveStart = new Date(today.getFullYear(), today.getMonth(), 1)
        if (!effectiveEnd) effectiveEnd = today
      }
    }

    const approvedLeaves = employeeIdsForLeaves.length
      ? await prisma.leaveRequest.findMany({
          where: {
            status: "APPROVED",
            employeeId: { in: employeeIdsForLeaves },
            startDate: { lte: effectiveEnd! },
            endDate: { gte: effectiveStart! },
          },
          include: {
            employee: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                position: true,
                department: { select: { name: true } },
                schedule: { select: { timeIn: true, timeOut: true, name: true } },
                faceSamples: {
                  where: { slot: 1 },
                  select: { imagePath: true, slot: true },
                },
              },
            },
          },
        })
      : []

    const leaveRows = approvedLeaves.flatMap((lr) => {
      const keys = Array.from(expandLeaveRangeToYmdKeys(lr.startDate.toISOString(), lr.endDate.toISOString()))
      return keys
        .filter((ymd) => {
          const day = new Date(`${ymd}T12:00:00`)
          if (effectiveStart && day < effectiveStart) return false
          if (effectiveEnd && day > effectiveEnd) return false
          return !ymdSeen.has(`${lr.employeeId}:${ymd}`)
        })
        .map((ymd) => ({
          id: `leave-${lr.id}-${ymd}`,
          date: new Date(`${ymd}T12:00:00`),
          timeIn: null,
          timeOut: null,
          breakOut: null,
          breakIn: null,
          status: "LEAVE",
          lateMinutes: 0,
          overtimeMinutes: 0,
          undertimeMinutes: 0,
          breakMinutes: 0,
          notes: lr.reason ?? null,
          oldScheduleTime: null,
          newScheduleTime: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          employeeId: lr.employeeId,
          employee: lr.employee,
          isLocked: isLocked(new Date(`${ymd}T12:00:00`)),
        }))
    })

    let merged = [
      ...attendances.map((a) => ({ ...a, isLocked: isLocked(new Date(a.date)) })),
      ...leaveRows,
    ]

    if (status === "LEAVE") {
      merged = merged.filter((a) => a.status === "LEAVE")
    }
    if (sortField === "department") {
      merged.sort((a: any, b: any) => {
        const av = a.employee?.department?.name ?? ""
        const bv = b.employee?.department?.name ?? ""
        return sortDirection === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    } else if (!sortField || sortField === "date") {
      merged.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }
    return NextResponse.json({
      attendances: merged,
      pagination: {
        page,
        limit,
        total: Math.max(total, merged.length),
        pages: Math.ceil(Math.max(total, merged.length) / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/attendance - Create attendance record or clock in/out
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Check if this is a time in/out request
    if (body.type === 'IN' || body.type === 'OUT' || body.type === 'BREAK_OUT' || body.type === 'BREAK_IN') {
      console.log('Processing attendance request:', { type: body.type, employeeId: body.employeeId })
      
      try {
        const { employeeId, type } = timeInOutSchema.parse(body)
        console.log('Schema validation passed:', { employeeId, type })
      
      // Verify employee access - only employees can clock themselves in/out
      if (session.user.role === 'EMPLOYEE') {
        const employee = await prisma.employee.findFirst({
          where: { userId: session.user.id }
        })
        if (!employee || employee.id !== employeeId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
      } else if (session.user.role === 'DEPARTMENT_HEAD') {
        // Department heads can only clock themselves in/out, not others
        const employee = await prisma.employee.findFirst({
          where: { userId: session.user.id }
        })
        if (!employee || employee.id !== employeeId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
      }

      // Get today's date in UTC to avoid timezone issues
      const clockTime = new Date()
      const today = new Date(clockTime.getFullYear(), clockTime.getMonth(), clockTime.getDate())

      // Find or create today's attendance record
      let attendance = await prisma.attendance.findFirst({
        where: {
          employeeId,
          date: today
        }
      })

      if (type === 'IN') {
        if (attendance && attendance.timeIn) {
          return NextResponse.json(
            { error: 'Already clocked in today' },
            { status: 400 }
          )
        }

        // Get employee schedule to calculate lateness
        const employee = await prisma.employee.findUnique({
          where: { id: employeeId },
          include: { schedule: true }
        })

        let lateMinutes = 0
        let status = 'PRESENT'

        console.log('Late calculation debug:', {
          hasEmployee: !!employee,
          hasSchedule: !!employee?.schedule,
          scheduleTimeIn: employee?.schedule?.timeIn,
          clockTime: clockTime.toISOString(),
          employeeId
        })

        if (employee?.schedule) {
          const [scheduleHour, scheduleMinute] = employee.schedule.timeIn.split(':').map(Number)
          const scheduledTime = new Date(clockTime)
          scheduledTime.setHours(scheduleHour, scheduleMinute, 0, 0)

          console.log('Schedule comparison:', {
            scheduledTime: scheduledTime.toISOString(),
            clockTime: clockTime.toISOString(),
            isLate: clockTime > scheduledTime
          })

          if (clockTime > scheduledTime) {
            lateMinutes = Math.floor((clockTime.getTime() - scheduledTime.getTime()) / (1000 * 60))
            status = 'LATE'
            console.log('Employee is LATE:', { lateMinutes, status })
          }
        } else {
          console.log('No schedule found for employee, defaulting to PRESENT')
        }

        const newScheduleTime = formatScheduleSnapshot(employee?.schedule ?? undefined)
        let oldScheduleTime: string | null = null
        if (newScheduleTime) {
          const prevAttendance = await prisma.attendance.findFirst({
            where: {
              employeeId,
              date: { lt: today },
            },
            orderBy: { date: 'desc' },
            select: { newScheduleTime: true },
          })
          oldScheduleTime = prevAttendance?.newScheduleTime ?? null
        }

        if (attendance) {
          attendance = await prisma.attendance.update({
            where: { id: attendance.id },
            data: {
              timeIn: clockTime,
              status: status as any,
              lateMinutes,
              ...(newScheduleTime != null && {
                newScheduleTime,
                oldScheduleTime,
              }),
            }
          })
        } else {
          attendance = await prisma.attendance.create({
            data: {
              employeeId,
              date: today,
              timeIn: clockTime,
              status: status as any,
              lateMinutes,
              newScheduleTime: newScheduleTime ?? undefined,
              oldScheduleTime: oldScheduleTime ?? undefined,
            }
          })
        }
      } else if (type === 'OUT') {
        if (!attendance || !attendance.timeIn) {
          return NextResponse.json(
            { error: 'Must clock in first' },
            { status: 400 }
          )
        }

        if (attendance.timeOut) {
          return NextResponse.json(
            { error: 'Already clocked out today' },
            { status: 400 }
          )
        }

        // Calculate overtime and undertime
        const employee = await prisma.employee.findUnique({
          where: { id: employeeId },
          include: { schedule: true }
        })

        let overtimeMinutes = 0
        let undertimeMinutes = 0

        if (employee?.schedule) {
          // Parse schedule times
          const [scheduleStartHour, scheduleStartMin] = employee.schedule.timeIn.split(':').map(Number)
          const [scheduleEndHour, scheduleEndMin] = employee.schedule.timeOut.split(':').map(Number)
          
          // Create schedule start and end times for the day
          const scheduleStart = new Date(attendance.date)
          scheduleStart.setHours(scheduleStartHour, scheduleStartMin, 0, 0)
          
          const scheduleEnd = new Date(attendance.date)
          scheduleEnd.setHours(scheduleEndHour, scheduleEndMin, 0, 0)
          
          // Calculate overtime (work beyond schedule end time)
          if (clockTime > scheduleEnd) {
            overtimeMinutes = Math.floor((clockTime.getTime() - scheduleEnd.getTime()) / (1000 * 60))
          }
          
          // Calculate undertime (clock out before schedule end time)
          // Undertime = schedule end time - actual clock out time
          // Example: Schedule 9am-7pm, clock out at 6:30pm = 30 minutes undertime
          if (clockTime < scheduleEnd) {
            undertimeMinutes = Math.floor((scheduleEnd.getTime() - clockTime.getTime()) / (1000 * 60))
          } else {
            undertimeMinutes = 0
          }
        }

        attendance = await prisma.attendance.update({
          where: { id: attendance.id },
          data: {
            timeOut: clockTime,
            overtimeMinutes,
            undertimeMinutes
          }
        })
      } else if (type === 'BREAK_OUT') {
        console.log('BREAK_OUT attempt:', {
          hasAttendance: !!attendance,
          hasTimeIn: !!attendance?.timeIn,
          hasBreakOut: !!attendance?.breakOut,
          hasBreakIn: !!attendance?.breakIn,
          hasTimeOut: !!attendance?.timeOut
        })

        if (!attendance || !attendance.timeIn) {
          console.log('BREAK_OUT rejected: No attendance or timeIn')
          return NextResponse.json(
            { error: 'Must clock in first before taking a break' },
            { status: 400 }
          )
        }

        if (attendance.breakOut && !attendance.breakIn) {
          console.log('BREAK_OUT rejected: Already on break')
          return NextResponse.json(
            { error: 'Already on break' },
            { status: 400 }
          )
        }

        if (attendance.timeOut) {
          console.log('BREAK_OUT rejected: Already clocked out')
          return NextResponse.json(
            { error: 'Cannot take break after clocking out' },
            { status: 400 }
          )
        }

        console.log('BREAK_OUT approved, updating record')
        attendance = await prisma.attendance.update({
          where: { id: attendance.id },
          data: {
            breakOut: clockTime
          }
        })
      } else if (type === 'BREAK_IN') {
        console.log('BREAK_IN attempt:', {
          hasAttendance: !!attendance,
          hasTimeIn: !!attendance?.timeIn,
          hasBreakOut: !!attendance?.breakOut,
          hasBreakIn: !!attendance?.breakIn,
          hasTimeOut: !!attendance?.timeOut
        })

        if (!attendance || !attendance.timeIn) {
          console.log('BREAK_IN rejected: No attendance or timeIn')
          return NextResponse.json(
            { error: 'Must clock in first' },
            { status: 400 }
          )
        }

        if (!attendance.breakOut) {
          console.log('BREAK_IN rejected: No breakOut record')
          return NextResponse.json(
            { error: 'Must go on break first' },
            { status: 400 }
          )
        }

        if (attendance.breakIn) {
          console.log('BREAK_IN rejected: Already returned from break')
          return NextResponse.json(
            { error: 'Already returned from break' },
            { status: 400 }
          )
        }

        if (attendance.timeOut) {
          console.log('BREAK_IN rejected: Already clocked out')
          return NextResponse.json(
            { error: 'Cannot return from break after clocking out' },
            { status: 400 }
          )
        }

        // Calculate break duration
        const breakMinutes = Math.floor((clockTime.getTime() - attendance.breakOut!.getTime()) / (1000 * 60))

        console.log('BREAK_IN approved, updating record with breakMinutes:', breakMinutes)
        attendance = await prisma.attendance.update({
          where: { id: attendance.id },
          data: {
            breakIn: clockTime,
            breakMinutes
          }
        })
      }

      return NextResponse.json(attendance)
      } catch (schemaError) {
        console.error('Schema validation error:', schemaError)
        return NextResponse.json(
          { error: 'Invalid request data: ' + (schemaError instanceof Error ? schemaError.message : 'Unknown error') },
          { status: 400 }
        )
      }
    }

    // Regular attendance record creation (Admin only)
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const validatedData = attendanceSchema.parse(body)

    // Check if attendance record already exists for this employee and date
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: validatedData.employeeId,
        date: validatedData.date
      }
    })

    if (existingAttendance) {
      return NextResponse.json(
        { error: 'Attendance record already exists for this date' },
        { status: 400 }
      )
    }

    if (await isDateInClosedPeriod(validatedData.date)) {
      return NextResponse.json(
        { error: "Cannot add attendance inside a closed payroll period." },
        { status: 400 },
      )
    }

    const attendance = await prisma.attendance.create({
      data: validatedData,
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
    })

    return NextResponse.json(attendance, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating attendance:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
