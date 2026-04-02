import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the employee's record with attendance and payroll data
    const employee = await prisma.employee.findFirst({
      where: {
        userId: session.user.id
      },
      include: {
        department: {
          select: {
            name: true
          }
        },
        schedule: {
          select: {
            id: true,
            name: true,
            timeIn: true,
            timeOut: true,
            workingDays: true,
          }
        },
        attendances: {
          orderBy: {
            date: 'desc'
          },
          take: 30 // Last 30 days
        },
        payrollItems: {
          include: {
            payrollPeriod: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Calculate stats for current month
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)
    
    const nextMonth = new Date(currentMonth)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    const currentMonthAttendances = employee.attendances.filter(att => {
      const attDate = new Date(att.date)
      return attDate >= currentMonth && attDate < nextMonth
    })

    const stats = {
      presentThisMonth: currentMonthAttendances.filter(att => att.status === 'PRESENT').length,
      totalHours: currentMonthAttendances.reduce((sum, att) => {
        if (att.timeIn && att.timeOut) {
          const hours = (new Date(att.timeOut).getTime() - new Date(att.timeIn).getTime()) / (1000 * 60 * 60)
          return sum + hours
        }
        return sum
      }, 0),
      overtimeHours: currentMonthAttendances.reduce((sum, att) => sum + att.overtimeMinutes, 0) / 60,
      lastNetPay: employee.payrollItems[0]?.netPay || 0
    }

    return NextResponse.json({
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        position: employee.position,
        department: {
          name: employee.department?.name || 'No Department'
        },
        schedule: employee.schedule
          ? {
              id: employee.schedule.id,
              name: employee.schedule.name,
              timeIn: employee.schedule.timeIn,
              timeOut: employee.schedule.timeOut,
              workingDays: employee.schedule.workingDays,
            }
          : null,
        attendances: employee.attendances.map(att => ({
          id: att.id,
          date: att.date.toISOString(),
          timeIn: att.timeIn?.toISOString() || null,
          timeOut: att.timeOut?.toISOString() || null,
          status: att.status,
          lateMinutes: att.lateMinutes,
          overtimeMinutes: att.overtimeMinutes
        })),
        payrollItems: employee.payrollItems.map(item => ({
          id: item.id,
          basicPay: item.basicPay,
          netPay: item.netPay,
          payrollPeriod: {
            name: item.payrollPeriod.name,
            status: item.payrollPeriod.status
          }
        }))
      },
      stats
    })

  } catch (error) {
    console.error('Employee dashboard error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
