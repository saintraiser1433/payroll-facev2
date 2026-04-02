import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import * as XLSX from 'xlsx'

const exportReportSchema = z.object({
  payrollPeriodId: z.string().min(1, 'Payroll period ID is required'),
  format: z.enum(['excel', 'csv']).default('excel')
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { payrollPeriodId, format } = exportReportSchema.parse(body)

    // Get payroll period with all related data
    const payrollPeriod = await prisma.payrollPeriod.findUnique({
      where: { id: payrollPeriodId },
      include: {
        payrollItems: {
          include: {
            employee: {
              include: {
                department: true,
                schedule: true
              }
            },
            deductions: {
              include: {
                deductionType: true
              }
            }
          }
        }
      }
    })

    if (!payrollPeriod) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 })
    }

    // Prepare data for export
    const exportData = payrollPeriod.payrollItems.map((item, index) => {
      const deductions = item.deductions.map(d => ({
        name: d.deductionType.name,
        amount: d.amount
      }))

      return {
        'No.': index + 1,
        'Employee ID': item.employee.employeeId,
        'Employee Name': `${item.employee.firstName} ${item.employee.lastName}`,
        'Position': item.employee.position,
        'Department': item.employee.department?.name || 'N/A',
        'Basic Pay': item.basicPay,
        'Overtime Pay': item.overtimePay,
        'Gross Pay': item.totalEarnings,
        'Total Deductions': item.totalDeductions,
        'Net Pay': item.netPay,
        'Deductions': deductions.map(d => `${d.name}: ₱${d.amount}`).join(', ') || 'None',
        'Period': payrollPeriod.name,
        'Start Date': new Date(payrollPeriod.startDate).toLocaleDateString(),
        'End Date': new Date(payrollPeriod.endDate).toLocaleDateString(),
        'Status': payrollPeriod.status
      }
    })

    // Create workbook
    const workbook = XLSX.utils.book_new()
    
    // Add main data sheet
    const worksheet = XLSX.utils.json_to_sheet(exportData)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payroll Report')

    // Add summary sheet
    const summaryData = [
      {
        'Period': payrollPeriod.name,
        'Start Date': new Date(payrollPeriod.startDate).toLocaleDateString(),
        'End Date': new Date(payrollPeriod.endDate).toLocaleDateString(),
        'Status': payrollPeriod.status,
        'Total Employees': payrollPeriod.payrollItems.length,
        'Total Basic Pay': payrollPeriod.payrollItems.reduce((sum, item) => sum + item.basicPay, 0),
        'Total Overtime': payrollPeriod.payrollItems.reduce((sum, item) => sum + item.overtimePay, 0),
        'Total Gross Pay': payrollPeriod.payrollItems.reduce((sum, item) => sum + item.totalEarnings, 0),
        'Total Deductions': payrollPeriod.payrollItems.reduce((sum, item) => sum + item.totalDeductions, 0),
        'Total Net Pay': payrollPeriod.payrollItems.reduce((sum, item) => sum + item.netPay, 0)
      }
    ]
    
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary')

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Set headers for file download
    const headers = new Headers()
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    headers.set('Content-Disposition', `attachment; filename="payroll_report_${payrollPeriod.name.replace(/\s+/g, '_')}.xlsx"`)

    return new NextResponse(buffer, {
      status: 200,
      headers
    })

  } catch (error) {
    console.error('Export report error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to export report' },
      { status: 500 }
    )
  }
}
