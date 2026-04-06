import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { isPayslipHiddenDeduction } from '@/lib/payslip-display'

const generatePayslipSchema = z.object({
  payrollItemId: z.string().min(1, 'Payroll item ID is required'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'DEPARTMENT_HEAD', 'EMPLOYEE'].includes(session.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { payrollItemId } = generatePayslipSchema.parse(body)

    // Get payroll item with all related data
    const payrollItem = await prisma.payrollItem.findUnique({
      where: { id: payrollItemId },
      include: {
        employee: {
          include: {
            department: true,
            schedule: true
          }
        },
        payrollPeriod: true,
        deductions: {
          include: {
            deductionType: true
          }
        }
      }
    })

    if (!payrollItem) {
      return NextResponse.json({ error: 'Payroll item not found' }, { status: 404 })
    }

    // For EMPLOYEE role, ensure they can only access their own payroll items
    if (session.user?.role === 'EMPLOYEE') {
      const employee = await prisma.employee.findFirst({
        where: { userId: session.user.id }
      })
      
      if (!employee || employee.id !== payrollItem.employeeId) {
        return NextResponse.json({ error: 'Unauthorized - You can only access your own payslips' }, { status: 403 })
      }
    }

    // Tardy / undertime: use stored payroll deductions (same figures as payroll run)
    const sumByDeductionName = (name: string) =>
      payrollItem.deductions
        .filter((d) => d.deductionType?.name === name)
        .reduce((s, d) => s + d.amount, 0)

    const tardyDeduction = sumByDeductionName('Tardy')
    const undertimeDeduction = sumByDeductionName('Undertime')

    const positionSalary = await prisma.positionSalary.findFirst({
      where: { position: payrollItem.employee.position, isActive: true },
      select: { salaryRate: true },
    })
    const monthlyRate = positionSalary?.salaryRate ?? 0

    const payslipDeductionRows = payrollItem.deductions.filter(
      (d) => !isPayslipHiddenDeduction(d.deductionType?.name),
    )

    // Calculate payslip data
    const payslipData = {
      companyName: 'Glan White Sand Beach Resort',
      companyFullName: '',
      period: {
        ...payrollItem.payrollPeriod,
        isThirteenthMonth: payrollItem.payrollPeriod.isThirteenthMonth
      },
      employee: payrollItem.employee,
      basicPay: payrollItem.basicPay,
      overtimePay: payrollItem.overtimePay,
      holidayPay: payrollItem.holidayPay || 0,
      thirteenthMonthPay: (payrollItem as any).thirteenthMonthPay || 0,
      grossPay: payrollItem.totalEarnings,
      deductions: payslipDeductionRows,
      totalDeductions: payrollItem.totalDeductions,
      netPay: payrollItem.netPay,
      tardyDeduction: tardyDeduction,
      undertimeDeduction: undertimeDeduction,
      monthlyRate,
      payslipDate: payrollItem.payrollPeriod.endDate.toISOString(),
      generatedAt: new Date(),
      isThirteenthMonth: payrollItem.payrollPeriod.isThirteenthMonth || false
    }

    return NextResponse.json({ payslipData })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error generating payslip:', error)
    return NextResponse.json(
      { error: 'Failed to generate payslip' },
      { status: 500 }
    )
  }
}
