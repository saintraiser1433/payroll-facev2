"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Download, Printer } from "lucide-react"

interface PayslipData {
  companyName: string
  companyFullName: string
  period: {
    name: string
    startDate: string
    endDate: string
    isThirteenthMonth?: boolean
  }
  employee: {
    firstName: string
    lastName: string
    position: string
    department?: {
      name: string
    }
  }
  basicPay: number
  overtimePay: number
  holidayPay?: number
  thirteenthMonthPay?: number
  grossPay: number
  deductions: Array<{
    deductionType: {
      name: string
    }
    amount: number
  }>
  totalDeductions: number
  netPay: number
  tardyDeduction?: number
  undertimeDeduction?: number
  generatedAt: string
  isThirteenthMonth?: boolean
}

interface PayslipProps {
  isOpen: boolean
  onClose: () => void
  payslipData: PayslipData | null
}

export function Payslip({ isOpen, onClose, payslipData }: PayslipProps) {
  const [isPrinting, setIsPrinting] = useState(false)

  const handlePrint = () => {
    setIsPrinting(true)
    window.print()
    setTimeout(() => setIsPrinting(false), 1000)
  }

  const handleDownload = () => {
    // Create a downloadable version of the payslip
    const printWindow = window.open('', '_blank')
    if (printWindow && payslipData) {
      printWindow.document.write(generatePayslipHTML(payslipData))
      printWindow.document.close()
      printWindow.print()
    }
  }

  if (!payslipData) return null

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount)
  }

  const displayDeductions = payslipData.deductions.filter(
    (d) => d.amount > 0 && d.deductionType?.name,
  )
  const calculatedTotalDeductions = payslipData.totalDeductions
  const calculatedNetPay = payslipData.netPay

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payslip - {payslipData.employee.firstName} {payslipData.employee.lastName}</DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-2 mb-4">
          <Button onClick={handlePrint} disabled={isPrinting} className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            {isPrinting ? 'Printing...' : 'Print'}
          </Button>
          <Button onClick={handleDownload} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>

        <div className="payslip-container bg-white text-black font-mono text-sm">
          <div className="payslip-header border-b-2 border-black pb-2 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-lg font-bold">{payslipData.companyName}</div>
                <div className="text-sm">{payslipData.companyFullName}</div>
                <div className="text-sm font-bold mt-1">
                  {payslipData.isThirteenthMonth || payslipData.period.isThirteenthMonth 
                    ? 'PAYSLIP - 13TH MONTH PAY' 
                    : 'PAYSLIP - SEMI-MONTHLY PAYROLL'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">PERIOD: {formatDate(payslipData.period.startDate)} to {formatDate(payslipData.period.endDate)}</div>
              </div>
            </div>
          </div>

          <div className="employee-info mb-4">
            <div className="flex justify-between">
              <div>
                <div className="mb-1">
                  <span className="font-bold">EMPLOYEE:</span> {payslipData.employee.firstName} {payslipData.employee.lastName}
                </div>
                <div className="mb-1">
                  <span className="font-bold">POSITION:</span> {payslipData.employee.position}
                </div>
              </div>
              <div>
                <div className="mb-1">
                  <span className="font-bold">STATUS:</span> REGULAR
                </div>
              </div>
            </div>
          </div>

          <div className="payroll-breakdown mb-4">
            <div className={`grid gap-4 ${payslipData.isThirteenthMonth || payslipData.period.isThirteenthMonth ? 'grid-cols-3' : 'grid-cols-4'}`}>
              {/* Overtime Section - Hidden for 13th month pay */}
              {!(payslipData.isThirteenthMonth || payslipData.period.isThirteenthMonth) && (
                <div className="border border-black p-2">
                  <div className="text-center font-bold border-b border-black pb-1 mb-2">OVERTIME</div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="font-bold">MIN</div>
                    <div className="font-bold">PAY</div>
                    <div>REGULAR</div>
                    <div className="text-right">{formatCurrency(payslipData.overtimePay)}</div>
                  </div>
                </div>
              )}

              {/* Adjustments Section */}
              <div className="border border-black p-2">
                <div className="text-center font-bold border-b border-black pb-1 mb-2">ADJUSTMENTS</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div className="font-bold">AMOUNT</div>
                  <div></div>
                  {payslipData.isThirteenthMonth || payslipData.period.isThirteenthMonth ? (
                    <>
                      <div>13TH MONTH PAY</div>
                      <div className="text-right">{formatCurrency(payslipData.thirteenthMonthPay || 0)}</div>
                    </>
                  ) : (
                    <>
                      <div>HOLIDAY PAY</div>
                      <div className="text-right">{formatCurrency(payslipData.holidayPay || 0)}</div>
                    </>
                  )}
                </div>
              </div>

            {/* Deductions Section */}
            <div className="border border-black p-2">
              <div className="text-center font-bold border-b border-black pb-1 mb-2">DEDUCTION</div>
              <div className="space-y-1 text-xs">
                {displayDeductions.length > 0 ? (
                  displayDeductions.map((deduction, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{deduction.deductionType.name.toUpperCase()}</span>
                      <span>{formatCurrency(deduction.amount)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground">No deductions</div>
                )}
              </div>
            </div>

              {/* Summary Section */}
              <div className="border border-black p-2">
                <div className="text-center font-bold border-b border-black pb-1 mb-2">SUMMARY</div>
                <div className="space-y-1 text-xs">
                  {payslipData.isThirteenthMonth || payslipData.period.isThirteenthMonth ? (
                    <>
                      <div className="flex justify-between">
                        <span>13TH MONTH PAY:</span>
                        <span>{formatCurrency(payslipData.thirteenthMonthPay || 0)}</span>
                      </div>
                      <div className="flex justify-between border-t border-black pt-1">
                        <span className="font-bold">GROSS PAY:</span>
                        <span className="font-bold">{formatCurrency(payslipData.grossPay)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>BASIC PAY:</span>
                        <span>{formatCurrency(payslipData.basicPay)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>OVERTIME:</span>
                        <span>{formatCurrency(payslipData.overtimePay)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>HOLIDAY PAY:</span>
                        <span>{formatCurrency(payslipData.holidayPay || 0)}</span>
                      </div>
                      <div className="flex justify-between border-t border-black pt-1">
                        <span className="font-bold">GROSS PAY:</span>
                        <span className="font-bold">{formatCurrency(payslipData.grossPay)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span>DEDUCTION:</span>
                    <span>{formatCurrency(calculatedTotalDeductions)}</span>
                  </div>
                  <div className="flex justify-between border-t border-black pt-1">
                    <span className="font-bold">NET PAY:</span>
                    <span className="font-bold">{formatCurrency(calculatedNetPay)}</span>
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-black">
                  <div className="text-xs">
                    <div>RECEIVED BY:</div>
                    <div className="border-b border-black mt-1 h-6"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function generatePayslipHTML(payslipData: PayslipData): string {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount)
  }

  const formatMinutes = (minutes: number) => {
    if (!minutes || minutes === 0) return '0 min'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`
    } else if (hours > 0) {
      return `${hours}h`
    } else {
      return `${mins}m`
    }
  }

  const displayDeductionsHtml = payslipData.deductions.filter(
    (d) => d.amount > 0 && d.deductionType?.name,
  )
  const calculatedTotalDeductions = payslipData.totalDeductions
  const calculatedNetPay = payslipData.netPay

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payslip - ${payslipData.employee.firstName} ${payslipData.employee.lastName}</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; margin: 20px; }
        .payslip-container { max-width: 800px; margin: 0 auto; }
        .payslip-header { border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 20px; }
        .employee-info { margin-bottom: 20px; }
        .payroll-breakdown { margin-bottom: 20px; }
        .grid { display: grid; }
        .grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
        .gap-4 { gap: 16px; }
        .border { border: 1px solid black; }
        .border-black { border-color: black; }
        .p-2 { padding: 8px; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .text-right { text-align: right; }
        .border-b { border-bottom: 1px solid black; }
        .pb-1 { padding-bottom: 4px; }
        .mb-2 { margin-bottom: 8px; }
        .space-y-1 > * + * { margin-top: 4px; }
        .flex { display: flex; }
        .justify-between { justify-content: space-between; }
        .pt-1 { padding-top: 4px; }
        .mt-1 { margin-top: 4px; }
        .mt-4 { margin-top: 16px; }
        .pt-2 { padding-top: 8px; }
        .h-6 { height: 24px; }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="payslip-container">
        <div class="payslip-header">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="font-size: 18px; font-weight: bold;">${payslipData.companyName}</div>
              <div style="font-size: 12px;">${payslipData.companyFullName}</div>
              <div style="font-size: 12px; font-weight: bold; margin-top: 4px;">
                ${payslipData.isThirteenthMonth || payslipData.period.isThirteenthMonth 
                  ? 'PAYSLIP - 13TH MONTH PAY' 
                  : 'PAYSLIP - SEMI-MONTHLY PAYROLL'}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; font-weight: bold;">PERIOD: ${formatDate(payslipData.period.startDate)} to ${formatDate(payslipData.period.endDate)}</div>
            </div>
          </div>
        </div>

        <div class="employee-info">
          <div style="display: flex; justify-content: space-between;">
            <div>
              <div style="margin-bottom: 4px;">
                <span style="font-weight: bold;">EMPLOYEE:</span> ${payslipData.employee.firstName} ${payslipData.employee.lastName}
              </div>
              <div style="margin-bottom: 4px;">
                <span style="font-weight: bold;">POSITION:</span> ${payslipData.employee.position}
              </div>
            </div>
            <div>
              <div style="margin-bottom: 4px;">
                <span style="font-weight: bold;">STATUS:</span> REGULAR
              </div>
            </div>
          </div>
        </div>

        <div class="payroll-breakdown">
          <div class="grid ${payslipData.isThirteenthMonth || payslipData.period.isThirteenthMonth ? 'grid-cols-3' : 'grid-cols-4'} gap-4">
            ${!(payslipData.isThirteenthMonth || payslipData.period.isThirteenthMonth) ? `
            <!-- Overtime Section -->
            <div class="border p-2">
              <div class="text-center font-bold border-b pb-1 mb-2">OVERTIME</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px;">
                <div class="font-bold">MIN</div>
                <div class="font-bold">PAY</div>
                <div>REGULAR</div>
                <div class="text-right">${formatCurrency(payslipData.overtimePay)}</div>
              </div>
            </div>
            ` : ''}

            <!-- Adjustments Section -->
            <div class="border p-2">
              <div class="text-center font-bold border-b pb-1 mb-2">ADJUSTMENTS</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px;">
                <div class="font-bold">AMOUNT</div>
                <div></div>
                ${payslipData.isThirteenthMonth || payslipData.period.isThirteenthMonth ? `
                <div>13TH MONTH PAY</div>
                <div class="text-right">${formatCurrency(payslipData.thirteenthMonthPay || 0)}</div>
                ` : `
                <div>HOLIDAY PAY</div>
                <div class="text-right">${formatCurrency(payslipData.holidayPay || 0)}</div>
                `}
              </div>
            </div>

            <!-- Deductions Section -->
            <div class="border p-2">
              <div class="text-center font-bold border-b pb-1 mb-2">DEDUCTION</div>
              <div style="font-size: 10px;">
                ${displayDeductionsHtml.length > 0
                  ? displayDeductionsHtml
                      .map(
                        (deduction) => `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span>${deduction.deductionType.name.toUpperCase()}</span>
                  <span>${formatCurrency(deduction.amount)}</span>
                </div>`,
                      )
                      .join("")
                  : '<div style="text-align: center; color: #666;">No deductions</div>'}
              </div>
            </div>

            <!-- Summary Section -->
            <div class="border p-2">
              <div class="text-center font-bold border-b pb-1 mb-2">SUMMARY</div>
              <div class="space-y-1" style="font-size: 10px;">
                ${payslipData.isThirteenthMonth || payslipData.period.isThirteenthMonth ? `
                <div class="flex justify-between">
                  <span>13TH MONTH PAY:</span>
                  <span>${formatCurrency(payslipData.thirteenthMonthPay || 0)}</span>
                </div>
                <div class="flex justify-between border-t pt-1">
                  <span class="font-bold">GROSS PAY:</span>
                  <span class="font-bold">${formatCurrency(payslipData.grossPay)}</span>
                </div>
                ` : `
                <div class="flex justify-between">
                  <span>BASIC PAY:</span>
                  <span>${formatCurrency(payslipData.basicPay)}</span>
                </div>
                <div class="flex justify-between">
                  <span>OVERTIME:</span>
                  <span>${formatCurrency(payslipData.overtimePay)}</span>
                </div>
                <div class="flex justify-between">
                  <span>HOLIDAY PAY:</span>
                  <span>${formatCurrency(payslipData.holidayPay || 0)}</span>
                </div>
                <div class="flex justify-between border-t pt-1">
                  <span class="font-bold">GROSS PAY:</span>
                  <span class="font-bold">${formatCurrency(payslipData.grossPay)}</span>
                </div>
                `}
                <div class="flex justify-between">
                  <span>DEDUCTION:</span>
                  <span>${formatCurrency(calculatedTotalDeductions)}</span>
                </div>
                <div class="flex justify-between border-t pt-1">
                  <span class="font-bold">NET PAY:</span>
                  <span class="font-bold">${formatCurrency(calculatedNetPay)}</span>
                </div>
              </div>
              <div style="margin-top: 16px; padding-top: 8px; border-top: 1px solid black;">
                <div style="font-size: 10px;">
                  <div>RECEIVED BY:</div>
                  <div style="border-bottom: 1px solid black; margin-top: 4px; height: 24px;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}
