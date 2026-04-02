import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/dashboard - Get dashboard statistics
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)

    // Get basic counts
    const [
      totalEmployees,
      activeEmployees,
      totalDepartments,
      todayAttendance,
      thisMonthAttendance,
      lastMonthAttendance,
      recentAttendance,
      departmentStats,
      payrollStats
    ] = await Promise.all([
      // Total employees
      prisma.employee.count(),
      
      // Active employees
      prisma.employee.count({ where: { isActive: true } }),
      
      // Total departments
      prisma.department.count(),
      
      // Today's attendance
      prisma.attendance.count({
        where: {
          date: today,
          timeIn: { not: null }
        }
      }),
      
      // This month's attendance
      prisma.attendance.count({
        where: {
          date: { gte: thisMonth },
          timeIn: { not: null }
        }
      }),
      
      // Last month's attendance
      prisma.attendance.count({
        where: {
          date: { gte: lastMonth, lt: thisMonth },
          timeIn: { not: null }
        }
      }),
      
      // Recent attendance records
      prisma.attendance.findMany({
        take: 10,
        where: {
          timeIn: { not: null }
        },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              position: true,
              department: { select: { name: true } }
            }
          }
        },
        orderBy: { timeIn: 'desc' }
      }),
      
      // Department statistics
      prisma.department.findMany({
        include: {
          employees: {
            where: { isActive: true },
            select: { id: true }
          }
        }
      }),
      
      // Payroll statistics (current month)
      prisma.payrollPeriod.findFirst({
        where: {
          startDate: { lte: today },
          endDate: { gte: today }
        },
        include: {
          payrollItems: {
            select: {
              totalEarnings: true,
              totalDeductions: true,
              netPay: true
            }
          }
        }
      })
    ])

    // Calculate attendance rate
    const attendanceRate = activeEmployees > 0 
      ? Math.round((todayAttendance / activeEmployees) * 100) 
      : 0

    // Calculate month-over-month attendance change
    const attendanceChange = lastMonthAttendance > 0 
      ? Math.round(((thisMonthAttendance - lastMonthAttendance) / lastMonthAttendance) * 100)
      : 0

    // Process department statistics
    const departmentData = departmentStats.map(dept => ({
      name: dept.name,
      employeeCount: dept.employees.length,
      id: dept.id
    }))

    // Calculate payroll totals
    let totalPayroll = 0
    let totalDeductions = 0
    let totalNetPay = 0

    if (payrollStats?.payrollItems) {
      payrollStats.payrollItems.forEach(item => {
        totalPayroll += item.totalEarnings
        totalDeductions += item.totalDeductions
        totalNetPay += item.netPay
      })
    }

    // Get attendance trends for the last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      return date
    }).reverse()

    const attendanceTrends = await Promise.all(
      last7Days.map(async (date) => {
        const count = await prisma.attendance.count({
          where: {
            date: {
              gte: date,
              lt: new Date(date.getTime() + 24 * 60 * 60 * 1000)
            },
            timeIn: { not: null }
          }
        })
        return {
          date: date.toISOString().split('T')[0],
          count
        }
      })
    )

    // Get late arrivals today
    const lateArrivals = await prisma.attendance.count({
      where: {
        date: today,
        status: 'LATE'
      }
    })

    // Get overtime hours this month
    const overtimeRecords = await prisma.attendance.findMany({
      where: {
        date: { gte: thisMonth },
        overtimeMinutes: { gt: 0 }
      },
      select: { overtimeMinutes: true }
    })

    const totalOvertimeHours = overtimeRecords.reduce(
      (total, record) => total + (record.overtimeMinutes / 60), 
      0
    )

    return NextResponse.json({
      overview: {
        totalEmployees,
        activeEmployees,
        totalDepartments,
        attendanceRate,
        attendanceChange,
        lateArrivals,
        totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10
      },
      attendance: {
        today: todayAttendance,
        thisMonth: thisMonthAttendance,
        trends: attendanceTrends
      },
      payroll: {
        totalEarnings: totalPayroll,
        totalDeductions,
        totalNetPay,
        periodActive: !!payrollStats
      },
      departments: departmentData,
      recentActivity: recentAttendance.map(record => ({
        id: record.id,
        employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
        position: record.employee.position,
        department: record.employee.department?.name || 'N/A',
        timeIn: record.timeIn,
        timeOut: record.timeOut,
        status: record.status,
        date: record.date
      }))
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

