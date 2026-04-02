import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const toggleDeductionsSchema = z.object({
  payrollPeriodId: z.string().min(1, 'Payroll period ID is required'),
  deductionsEnabled: z.boolean()
})

// PUT /api/payroll/periods/toggle-deductions - Toggle deductions for a payroll period
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = toggleDeductionsSchema.parse(body)

    // Check if payroll period exists
    const payrollPeriod = await prisma.payrollPeriod.findUnique({
      where: { id: validatedData.payrollPeriodId }
    })

    if (!payrollPeriod) {
      return NextResponse.json(
        { error: 'Payroll period not found' },
        { status: 404 }
      )
    }

    // Update the deductions enabled status
    const updatedPeriod = await prisma.payrollPeriod.update({
      where: { id: validatedData.payrollPeriodId },
      data: { deductionsEnabled: validatedData.deductionsEnabled },
      include: {
        payrollItems: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true,
                position: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      payrollPeriod: updatedPeriod,
      message: `Deductions ${validatedData.deductionsEnabled ? 'enabled' : 'disabled'} for payroll period "${updatedPeriod.name}"`
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error toggling deductions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
