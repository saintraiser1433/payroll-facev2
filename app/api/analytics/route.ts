import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/analytics - Get analytics data
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last6Months = new Date(now.getFullYear(), now.getMonth() - 6, 1)
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Get attendance analytics
    const [
      totalEmployees,
      activeEmployees,
      attendanceThisMonth,
      attendanceLastMonth,
      lateArrivalsThisMonth,
      overtimeHoursThisMonth,
      departmentAttendance,
      monthlyAttendanceTrends,
      payrollAnalytics,
      salaryDistribution,
      positionSalaries
    ] = await Promise.all([
      // Basic employee counts
      prisma.employee.count(),
      prisma.employee.count({ where: { isActive: true } }),

      // Attendance counts
      prisma.attendance.count({
        where: {
          date: { gte: currentMonth },
          timeIn: { not: null }
        }
      }),
      prisma.attendance.count({
        where: {
          date: { gte: lastMonth, lt: currentMonth },
          timeIn: { not: null }
        }
      }),

      // Late arrivals this month
      prisma.attendance.count({
        where: {
          date: { gte: currentMonth },
          status: 'LATE'
        }
      }),

      // Overtime hours this month
      prisma.attendance.aggregate({
        where: {
          date: { gte: currentMonth },
          overtimeMinutes: { gt: 0 }
        },
        _sum: { overtimeMinutes: true }
      }),

      // Department-wise attendance
      prisma.department.findMany({
        include: {
          employees: {
            where: { isActive: true },
            include: {
              attendances: {
                where: {
                  date: { gte: currentMonth },
                  timeIn: { not: null }
                }
              }
            }
          }
        }
      }),

      // Monthly attendance trends (last 6 months)
      prisma.$queryRaw`
        SELECT 
          strftime('%Y-%m', date) as month,
          COUNT(*) as attendance_count,
          COUNT(DISTINCT employeeId) as unique_employees
        FROM attendances 
        WHERE date >= ${last6Months} AND timeIn IS NOT NULL
        GROUP BY strftime('%Y-%m', date)
        ORDER BY month
      `,

      // Payroll analytics
      prisma.payrollPeriod.findMany({
        where: {
          createdAt: { gte: last6Months }
        },
        include: {
          payrollItems: {
            select: {
              totalEarnings: true,
              totalDeductions: true,
              netPay: true,
              basicPay: true,
              overtimePay: true
            }
          }
        }
      }),

      // Salary distribution by department
      prisma.department.findMany({
        include: {
          employees: {
            where: { isActive: true },
            select: {
              position: true
            }
          }
        }
      })
      ,
      prisma.positionSalary.findMany({
        where: { isActive: true },
        select: { position: true, salaryRate: true }
      })
    ])

    // Process department attendance data
    const departmentStats = departmentAttendance.map(dept => {
      const totalAttendance = dept.employees.reduce(
        (sum, emp) => sum + emp.attendances.length, 0
      )
      const totalEmployees = dept.employees.length
      const attendanceRate = totalEmployees > 0 ? (totalAttendance / (totalEmployees * 30)) * 100 : 0

      return {
        name: dept.name,
        employeeCount: totalEmployees,
        attendanceCount: totalAttendance,
        attendanceRate: Math.round(attendanceRate)
      }
    })

    // Process monthly trends
    const attendanceTrends = (monthlyAttendanceTrends as any[]).map(trend => ({
      month: trend.month,
      attendance: parseInt(trend.attendance_count),
      employees: parseInt(trend.unique_employees)
    }))

    // Process payroll analytics
    const payrollTrends = payrollAnalytics.map(period => {
      const totalEarnings = period.payrollItems.reduce((sum, item) => sum + item.totalEarnings, 0)
      const totalDeductions = period.payrollItems.reduce((sum, item) => sum + item.totalDeductions, 0)
      const totalNetPay = period.payrollItems.reduce((sum, item) => sum + item.netPay, 0)
      const basicPay = period.payrollItems.reduce((sum, item) => sum + item.basicPay, 0)
      const overtimePay = period.payrollItems.reduce((sum, item) => sum + item.overtimePay, 0)

      return {
        period: period.name,
        date: period.startDate,
        totalEarnings,
        totalDeductions,
        totalNetPay,
        basicPay,
        overtimePay,
        employeeCount: period.payrollItems.length
      }
    })

    // Calculate salary distribution
    const positionSalaryMap = new Map(positionSalaries.map((ps) => [ps.position, ps.salaryRate]))

    const salaryStats = salaryDistribution.map(dept => {
      const avgSalary = dept.employees.length > 0 
        ? dept.employees.reduce((sum, emp) => sum + (positionSalaryMap.get(emp.position) || 0), 0) / dept.employees.length
        : 0

      return {
        department: dept.name,
        averageSalary: avgSalary,
        employeeCount: dept.employees.length,
        totalSalaryBudget: dept.employees.reduce((sum, emp) => sum + (positionSalaryMap.get(emp.position) || 0), 0)
      }
    })

    // Calculate attendance rate change
    const attendanceRateChange = attendanceLastMonth > 0 
      ? Math.round(((attendanceThisMonth - attendanceLastMonth) / attendanceLastMonth) * 100)
      : 0

    // Calculate overtime hours
    const totalOvertimeHours = overtimeHoursThisMonth._sum.overtimeMinutes 
      ? Math.round((overtimeHoursThisMonth._sum.overtimeMinutes / 60) * 10) / 10
      : 0

    // Get top performers (employees with best attendance)
    const topPerformers = await prisma.employee.findMany({
      where: { isActive: true },
      include: {
        attendances: {
          where: {
            date: { gte: currentMonth },
            timeIn: { not: null }
          }
        },
        department: {
          select: { name: true }
        }
      },
      take: 5
    })

    const performersWithStats = topPerformers.map(emp => ({
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      position: emp.position,
      department: emp.department?.name || 'N/A',
      attendanceCount: emp.attendances.length,
      attendanceRate: Math.round((emp.attendances.length / 30) * 100)
    })).sort((a, b) => b.attendanceRate - a.attendanceRate)

    return NextResponse.json({
      overview: {
        totalEmployees,
        activeEmployees,
        attendanceThisMonth,
        attendanceLastMonth,
        attendanceRateChange,
        lateArrivalsThisMonth,
        totalOvertimeHours
      },
      departments: departmentStats,
      trends: {
        attendance: attendanceTrends,
        payroll: payrollTrends
      },
      salary: {
        distribution: salaryStats,
        totalBudget: salaryStats.reduce((sum, dept) => sum + dept.totalSalaryBudget, 0),
        averageAcrossCompany: salaryStats.length > 0 
          ? salaryStats.reduce((sum, dept) => sum + dept.averageSalary, 0) / salaryStats.length
          : 0
      },
      topPerformers: performersWithStats
    })
  } catch (error) {
    console.error('Error fetching analytics data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
