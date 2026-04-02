import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/payroll/periods/[id]/close - Close a payroll period
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if payroll period exists
    const payrollPeriod = await prisma.payrollPeriod.findUnique({
      where: { id },
      include: {
        payrollItems: true
      }
    })

    if (!payrollPeriod) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 })
    }

    // Check if already closed
    if (payrollPeriod.status === 'CLOSED') {
      return NextResponse.json({ error: 'Payroll period is already closed' }, { status: 400 })
    }

    // Check if there are payroll items
    if (payrollPeriod.payrollItems.length === 0) {
      return NextResponse.json({ error: 'Cannot close payroll period without payroll items' }, { status: 400 })
    }

    // Close the payroll period
    const updatedPeriod = await prisma.payrollPeriod.update({
      where: { id },
      data: {
        status: 'CLOSED',
        updatedAt: new Date()
      },
      include: {
        payrollItems: {
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
        }
      }
    })

    // Calculate totals
    const totalEarnings = updatedPeriod.payrollItems.reduce((sum, item) => sum + item.totalEarnings, 0)
    const totalDeductions = updatedPeriod.payrollItems.reduce((sum, item) => sum + item.totalDeductions, 0)
    const totalNetPay = updatedPeriod.payrollItems.reduce((sum, item) => sum + item.netPay, 0)

    return NextResponse.json({
      message: 'Payroll period closed successfully',
      period: {
        ...updatedPeriod,
        totalEarnings,
        totalDeductions,
        totalNetPay,
        employeeCount: updatedPeriod.payrollItems.length
      }
    })
  } catch (error) {
    console.error('Error closing payroll period:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
