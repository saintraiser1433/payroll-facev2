import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const qrScanSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  type: z.enum(['IN', 'OUT', 'BREAK_OUT', 'BREAK_IN']),
  faceDataUrl: z.string().optional(),
})

// Public endpoint for QR code scanning (no authentication required)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { employeeId, type } = qrScanSchema.parse(body)

    // Find employee by employeeId (the QR code contains the employeeId string)
    const employee = await prisma.employee.findUnique({
      where: { employeeId },
      include: { schedule: true }
    })

    if (!employee) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Employee not found',
          message: 'Invalid QR code. Please scan a valid employee QR code.'
        },
        { status: 404 }
      )
    }

    if (!employee.isActive) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Employee is inactive',
          message: 'This employee account is inactive. Please contact your administrator.'
        },
        { status: 400 }
      )
    }

    // Require 5 registered face samples before allowing "face recognition" attendance.
    // (This endpoint is used by the face attendance UI as a drop-in replacement for QR scan.)
    const faceCount = await prisma.employeeFace.count({ where: { employeeId: employee.id } })
    if (faceCount < 5) {
      return NextResponse.json(
        {
          success: false,
          error: "Face registration incomplete",
          message: "Please register 5 face samples first (HR/Admin → Employees → Register Faces).",
          required: 5,
          current: faceCount,
        },
        { status: 400 }
      )
    }

    // Get today's date
    const clockTime = new Date()
    const today = new Date(clockTime.getFullYear(), clockTime.getMonth(), clockTime.getDate())

    // Find or create today's attendance record
    let attendance = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        date: today
      }
    })

    let message = ''
    let status = 'success'

    if (type === 'IN') {
      if (attendance && attendance.timeIn) {
        return NextResponse.json({
          success: false,
          error: 'Already clocked in',
          message: `You already clocked in today at ${new Date(attendance.timeIn).toLocaleTimeString()}`,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          timeIn: attendance.timeIn
        }, { status: 400 })
      }

      // Calculate lateness
      let lateMinutes = 0
      let attendanceStatus = 'PRESENT'

      if (employee.schedule) {
        const [scheduleHour, scheduleMinute] = employee.schedule.timeIn.split(':').map(Number)
        const scheduledTime = new Date(clockTime)
        scheduledTime.setHours(scheduleHour, scheduleMinute, 0, 0)

        if (clockTime > scheduledTime) {
          lateMinutes = Math.floor((clockTime.getTime() - scheduledTime.getTime()) / (1000 * 60))
          attendanceStatus = 'LATE'
        }
      }

      if (attendance) {
        attendance = await prisma.attendance.update({
          where: { id: attendance.id },
          data: {
            timeIn: clockTime,
            status: attendanceStatus as any,
            lateMinutes
          }
        })
      } else {
        attendance = await prisma.attendance.create({
          data: {
            employeeId: employee.id,
            date: today,
            timeIn: clockTime,
            status: attendanceStatus as any,
            lateMinutes
          }
        })
      }

      const timeStr = clockTime.toLocaleTimeString()
      message = lateMinutes > 0 
        ? `✅ Clocked in at ${timeStr} (${lateMinutes} minutes late)`
        : `✅ Clocked in successfully at ${timeStr}`

    } else if (type === 'OUT') {
      if (!attendance || !attendance.timeIn) {
        return NextResponse.json({
          success: false,
          error: 'Must clock in first',
          message: 'Please clock in first before clocking out.',
          employeeName: `${employee.firstName} ${employee.lastName}`
        }, { status: 400 })
      }

      if (attendance.timeOut) {
        return NextResponse.json({
          success: false,
          error: 'Already clocked out',
          message: `You already clocked out today at ${new Date(attendance.timeOut).toLocaleTimeString()}`,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          timeOut: attendance.timeOut
        }, { status: 400 })
      }

      // Calculate overtime and undertime
      let overtimeMinutes = 0
      let undertimeMinutes = 0

      if (employee.schedule) {
        const [scheduleStartHour, scheduleStartMin] = employee.schedule.timeIn.split(':').map(Number)
        const [scheduleEndHour, scheduleEndMin] = employee.schedule.timeOut.split(':').map(Number)
        
        const scheduleStart = new Date(attendance.date)
        scheduleStart.setHours(scheduleStartHour, scheduleStartMin, 0, 0)
        
        const scheduleEnd = new Date(attendance.date)
        scheduleEnd.setHours(scheduleEndHour, scheduleEndMin, 0, 0)
        
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

      const timeStr = clockTime.toLocaleTimeString()
      message = `✅ Clocked out successfully at ${timeStr}`

    } else if (type === 'BREAK_OUT') {
      if (!attendance || !attendance.timeIn) {
        return NextResponse.json({
          success: false,
          error: 'Must clock in first',
          message: 'Please clock in first before taking a break.',
          employeeName: `${employee.firstName} ${employee.lastName}`
        }, { status: 400 })
      }

      if (attendance.breakOut && !attendance.breakIn) {
        return NextResponse.json({
          success: false,
          error: 'Already on break',
          message: 'You are already on break. Please break in first.',
          employeeName: `${employee.firstName} ${employee.lastName}`
        }, { status: 400 })
      }

      if (attendance.timeOut) {
        return NextResponse.json({
          success: false,
          error: 'Cannot take break',
          message: 'Cannot take break after clocking out.',
          employeeName: `${employee.firstName} ${employee.lastName}`
        }, { status: 400 })
      }

      attendance = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          breakOut: clockTime
        }
      })

      const timeStr = clockTime.toLocaleTimeString()
      message = `✅ Break started at ${timeStr}`

    } else if (type === 'BREAK_IN') {
      if (!attendance || !attendance.timeIn) {
        return NextResponse.json({
          success: false,
          error: 'Must clock in first',
          message: 'Please clock in first.',
          employeeName: `${employee.firstName} ${employee.lastName}`
        }, { status: 400 })
      }

      if (!attendance.breakOut) {
        return NextResponse.json({
          success: false,
          error: 'No break started',
          message: 'You must start a break first before breaking in.',
          employeeName: `${employee.firstName} ${employee.lastName}`
        }, { status: 400 })
      }

      if (attendance.breakIn) {
        return NextResponse.json({
          success: false,
          error: 'Already broke in',
          message: 'You have already returned from break.',
          employeeName: `${employee.firstName} ${employee.lastName}`
        }, { status: 400 })
      }

      // Calculate break minutes
      const breakMinutes = Math.floor((clockTime.getTime() - attendance.breakOut.getTime()) / (1000 * 60))

      attendance = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          breakIn: clockTime,
          breakMinutes
        }
      })

      const timeStr = clockTime.toLocaleTimeString()
      message = `✅ Break ended at ${timeStr} (${breakMinutes} minutes)`
    }

    return NextResponse.json({
      success: true,
      message,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeId: employee.employeeId,
      type,
      timestamp: clockTime
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Validation error',
          message: error.errors[0]?.message || 'Invalid request'
        },
        { status: 400 }
      )
    }

    console.error('Error processing QR scan:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: 'An error occurred. Please try again.'
      },
      { status: 500 }
    )
  }
}


