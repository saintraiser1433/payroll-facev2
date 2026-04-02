import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'DEPARTMENT_HEAD') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the department head's employee record with department info
    const departmentHead = await prisma.employee.findFirst({
      where: {
        userId: session.user.id
      },
      include: {
        attendances: {
          where: {
            date: {
              gte: new Date(new Date().setDate(new Date().getDate() - 30)) // Last 30 days
            }
          },
          orderBy: {
            date: 'desc'
          }
        },
        payrollItems: {
          include: {
            payrollPeriod: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        department: {
          include: {
            employees: {
              include: {
                attendances: {
                  where: {
                    date: {
                      gte: new Date(new Date().setDate(new Date().getDate() - 30)) // Last 30 days
                    }
                  },
                  orderBy: {
                    date: 'desc'
                  }
                },
                payrollItems: {
                  include: {
                    payrollPeriod: true
                  },
                  orderBy: {
                    createdAt: 'desc'
                  },
                  take: 1 // Latest payroll item
                }
              }
            }
          }
        }
      }
    })

    if (!departmentHead || !departmentHead.department) {
      return NextResponse.json({ error: 'Department head not found' }, { status: 404 })
    }

    // Calculate department stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayAttendances = await prisma.attendance.findMany({
      where: {
        employee: {
          departmentId: departmentHead.department.id
        },
        date: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        employee: true
      }
    })

    const departmentStats = {
      totalEmployees: departmentHead.department.employees.length,
      presentToday: todayAttendances.filter(att => att.status === 'PRESENT').length,
      lateToday: todayAttendances.filter(att => att.status === 'LATE').length,
      absentToday: departmentHead.department.employees.length - todayAttendances.length,
      totalOvertime: todayAttendances.reduce((sum, att) => sum + att.overtimeMinutes, 0) / 60 // Convert to hours
    }

    return NextResponse.json({
      employee: {
        id: departmentHead.id,
        firstName: departmentHead.firstName,
        lastName: departmentHead.lastName,
        position: departmentHead.position,
        attendances: departmentHead.attendances.map(att => ({
          id: att.id,
          date: att.date.toISOString(),
          timeIn: att.timeIn?.toISOString() || null,
          timeOut: att.timeOut?.toISOString() || null,
          status: att.status,
          lateMinutes: att.lateMinutes,
          overtimeMinutes: att.overtimeMinutes
        })),
        payrollItems: departmentHead.payrollItems.map(item => ({
          id: item.id,
          basicPay: item.basicPay,
          netPay: item.netPay,
          payrollPeriod: {
            name: item.payrollPeriod.name,
            startDate: item.payrollPeriod.startDate.toISOString(),
            endDate: item.payrollPeriod.endDate.toISOString(),
            status: item.payrollPeriod.status
          }
        })),
        department: {
          id: departmentHead.department.id,
          name: departmentHead.department.name,
          employees: departmentHead.department.employees.map(emp => ({
            id: emp.id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            position: emp.position,
            attendances: emp.attendances.map(att => ({
              id: att.id,
              date: att.date.toISOString(),
              timeIn: att.timeIn?.toISOString() || null,
              timeOut: att.timeOut?.toISOString() || null,
              status: att.status,
              lateMinutes: att.lateMinutes,
              overtimeMinutes: att.overtimeMinutes
            })),
            payrollItems: emp.payrollItems.map(item => ({
              id: item.id,
              basicPay: item.basicPay,
              netPay: item.netPay,
              payrollPeriod: {
                name: item.payrollPeriod.name,
                startDate: item.payrollPeriod.startDate.toISOString(),
                endDate: item.payrollPeriod.endDate.toISOString(),
                status: item.payrollPeriod.status
              }
            }))
          }))
        }
      },
      departmentStats
    })

  } catch (error) {
    console.error('Department head dashboard error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
