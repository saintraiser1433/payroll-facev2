import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findInvalidTimesheetsForClosingPeriod } from '@/lib/payroll-invalid-attendance-for-close'

const closeBodySchema = (body: unknown) => {
  if (!body || typeof body !== 'object') return { bypassInvalidTimesheets: false }
  const b = body as Record<string, unknown>
  return { bypassInvalidTimesheets: b.bypassInvalidTimesheets === true }
}

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
    const body = await request.json().catch(() => ({}))
    const { bypassInvalidTimesheets } = closeBodySchema(body)

    const payrollPeriod = await prisma.payrollPeriod.findUnique({
      where: { id },
      include: {
        payrollItems: true
      }
    })

    if (!payrollPeriod) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 })
    }

    if (payrollPeriod.status === 'CLOSED') {
      return NextResponse.json({ error: 'Payroll period is already closed' }, { status: 400 })
    }

    if (payrollPeriod.payrollItems.length === 0) {
      return NextResponse.json({ error: 'Cannot close payroll period without payroll items' }, { status: 400 })
    }

    const employeeIds = [...new Set(payrollPeriod.payrollItems.map((p) => p.employeeId))]
    const { invalid: invalidTimesheets, preview } = await findInvalidTimesheetsForClosingPeriod(prisma, {
      startDate: payrollPeriod.startDate,
      endDate: payrollPeriod.endDate,
      employeeIds,
    })

    if (invalidTimesheets.length > 0 && !bypassInvalidTimesheets) {
      return NextResponse.json(
        {
          error:
            'There are invalid timesheets (missing time in/out on scheduled work days). Fix them or confirm close to exclude them from payroll.',
          invalidTimesheets: preview,
          invalidCount: invalidTimesheets.length,
        },
        { status: 400 },
      )
    }

    if (invalidTimesheets.length > 0 && bypassInvalidTimesheets) {
      const origin = new URL(request.url).origin
      const cookie = request.headers.get('cookie') ?? ''
      const calcRes = await fetch(`${origin}/api/payroll/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify({
          payrollPeriodId: id,
          excludeAttendanceIds: invalidTimesheets.map((r) => r.id),
        }),
      })
      if (!calcRes.ok) {
        const err = await calcRes.json().catch(() => ({}))
        return NextResponse.json(
          {
            error:
              (err as { error?: string }).error ||
              'Could not recalculate payroll while excluding incomplete timesheets. Close aborted.',
          },
          { status: 400 },
        )
      }
    }

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

    const totalEarnings = updatedPeriod.payrollItems.reduce((sum, item) => sum + item.totalEarnings, 0)
    const totalDeductions = updatedPeriod.payrollItems.reduce((sum, item) => sum + item.totalDeductions, 0)
    const totalNetPay = updatedPeriod.payrollItems.reduce((sum, item) => sum + item.netPay, 0)

    return NextResponse.json({
      message: 'Payroll period closed successfully',
      excludedAttendanceCount: bypassInvalidTimesheets ? invalidTimesheets.length : 0,
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
