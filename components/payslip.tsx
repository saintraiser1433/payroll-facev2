"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Download, Printer } from "lucide-react"
import { isPayslipHiddenDeduction } from "@/lib/payslip-display"

export interface PayslipData {
  companyName: string
  companyFullName?: string
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
    employeeId?: string
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
  monthlyRate?: number
  /** Usually payroll period end date */
  payslipDate?: string
}

interface PayslipProps {
  isOpen: boolean
  onClose: () => void
  payslipData: PayslipData | null
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatPayslipHeaderDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatPeriodRange(startDate: string, endDate: string) {
  const a = new Date(startDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
  const b = new Date(endDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
  return `${a} – ${b}`
}

export function Payslip({ isOpen, onClose, payslipData }: PayslipProps) {
  const [isPrinting, setIsPrinting] = useState(false)

  const handlePrint = () => {
    setIsPrinting(true)
    window.print()
    setTimeout(() => setIsPrinting(false), 1000)
  }

  const handleDownload = () => {
    const printWindow = window.open("", "_blank")
    if (printWindow && payslipData) {
      printWindow.document.write(generatePayslipHTML(payslipData))
      printWindow.document.close()
      printWindow.print()
    }
  }

  if (!payslipData) return null

  const displayDeductions = payslipData.deductions.filter(
    (d) => d.amount > 0 && d.deductionType?.name && !isPayslipHiddenDeduction(d.deductionType.name),
  )

  const isThirteenth = payslipData.isThirteenthMonth || payslipData.period.isThirteenthMonth
  const headerDate = payslipData.payslipDate || payslipData.period.endDate
  const monthlyRate = payslipData.monthlyRate ?? 0
  const emp = payslipData.employee
  const nameLine = `${emp.lastName}, ${emp.firstName}`

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:max-w-none print:border-0 print:shadow-none">
        <DialogHeader className="no-print">
          <DialogTitle>
            Payslip — {emp.firstName} {emp.lastName}
          </DialogTitle>
        </DialogHeader>

        <div className="no-print flex gap-2 mb-4">
          <Button onClick={handlePrint} disabled={isPrinting} className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            {isPrinting ? "Printing…" : "Print"}
          </Button>
          <Button onClick={handleDownload} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>

        <div className="payslip-container bg-white text-black font-mono text-[13px] leading-snug print:p-2">
          <div className="text-center border-b-2 border-black pb-2 mb-3">
            <img
              src="/gwbrlogo.png"
              alt="Glan White Sand Beach Resort logo"
              className="mx-auto mb-2 h-12 w-auto object-contain"
            />
            <div className="text-[15px] font-bold tracking-tight">{payslipData.companyName}</div>
          </div>

          <div className="flex justify-between gap-6 mb-3 text-sm">
            <div className="space-y-1">
              <div>
                <span className="font-bold">Name:</span> {nameLine}
              </div>
              <div>
                <span className="font-bold">Monthly Rate:</span> {formatCurrency(monthlyRate)}
              </div>
            </div>
            <div className="text-right space-y-1">
              <div>
                <span className="font-bold">Date:</span> {formatPayslipHeaderDate(headerDate)}
              </div>
              <div>
                <span className="font-bold">ID No.:</span> {emp.employeeId?.trim() || "—"}
              </div>
            </div>
          </div>

          {!isThirteenth ? (
            <>
              <div className="text-xs text-center mb-1 text-muted-foreground">
                Period: {formatPeriodRange(payslipData.period.startDate, payslipData.period.endDate)}
              </div>

              <div className="grid grid-cols-2 border border-black">
                <div className="border-r border-black p-2">
                  <div className="font-bold border-b border-black pb-1 mb-2 text-center">Earnings</div>
                  <div className="space-y-1">
                    <PayslipRow label="Basic Pay" value={payslipData.basicPay} />
                    <PayslipRow label="13th Month" value={null} empty />
                    <PayslipRow label="Undertime(hr)" value={null} empty />
                    <PayslipRow
                      label="OT - Regular"
                      value={payslipData.overtimePay > 0 ? payslipData.overtimePay : null}
                      empty={payslipData.overtimePay <= 0}
                    />
                    <PayslipRow label="OT - Rest Day" value={null} empty />
                    <PayslipRow label="OT - Special Holiday" value={null} empty />
                    <PayslipRow
                      label="Adjustment"
                      value={payslipData.holidayPay && payslipData.holidayPay > 0 ? payslipData.holidayPay : null}
                      empty={!payslipData.holidayPay}
                    />
                    <div className="flex justify-between border-t border-black pt-1 mt-1 font-bold">
                      <span>Gross Pay</span>
                      <span>{formatCurrency(payslipData.grossPay)}</span>
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  <div className="font-bold border-b border-black pb-1 mb-2 text-center">Deductions</div>
                  <div className="space-y-1 min-h-[200px]">
                    {displayDeductions.length > 0 ? (
                      displayDeductions.map((d, i) => (
                        <div key={i} className="flex justify-between gap-2">
                          <span className="uppercase">{d.deductionType.name}</span>
                          <span>{formatCurrency(d.amount)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground text-center py-4">—</div>
                    )}
                    <div className="flex justify-between border-t border-black pt-1 mt-2 font-bold">
                      <span>Total Deductions</span>
                      <span>{formatCurrency(payslipData.totalDeductions)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-end border-t-2 border-black pt-2">
                <div className="text-base font-bold">
                  Net Pay: {formatCurrency(payslipData.netPay)}
                </div>
              </div>
            </>
          ) : (
            <div className="border border-black p-3 space-y-2">
              <div className="font-bold text-center border-b border-black pb-2">13th month pay</div>
              <div className="flex justify-between">
                <span>13th month pay</span>
                <span>{formatCurrency(payslipData.thirteenthMonthPay || 0)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-black pt-2">
                <span>Net Pay</span>
                <span>{formatCurrency(payslipData.netPay)}</span>
              </div>
            </div>
          )}

          <div className="mt-6 text-xs space-y-6">
            <p className="text-center max-w-md mx-auto">
              I acknowledge to have received the amount as full compensation of services rendered
            </p>
            <div>
              <span className="font-bold">Employee Signature:</span>
              <span className="inline-block min-w-[200px] border-b border-black ml-2 align-bottom" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PayslipRow({
  label,
  value,
  empty,
}: {
  label: string
  value: number | null
  empty?: boolean
}) {
  const show = empty || value === null ? "—" : formatCurrency(value)
  return (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <span className="tabular-nums">{show}</span>
    </div>
  )
}

function generatePayslipHTML(payslipData: PayslipData): string {
  const formatCurrencyHtml = (amount: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(amount)

  const formatPayslipHeaderDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })

  const formatPeriodRange = (startDate: string, endDate: string) => {
    const a = new Date(startDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
    const b = new Date(endDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
    return `${a} – ${b}`
  }

  const displayDeductions = payslipData.deductions.filter(
    (d) => d.amount > 0 && d.deductionType?.name && !isPayslipHiddenDeduction(d.deductionType.name),
  )

  const isThirteenth = payslipData.isThirteenthMonth || payslipData.period.isThirteenthMonth
  const headerDate = payslipData.payslipDate || payslipData.period.endDate
  const monthlyRate = payslipData.monthlyRate ?? 0
  const emp = payslipData.employee
  const nameLine = `${emp.lastName}, ${emp.firstName}`

  function rowHtml(label: string, value: number) {
    return `<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>${label}</span><span>${formatCurrencyHtml(value)}</span></div>`
  }

  function rowHtmlEmpty(label: string) {
    return `<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>${label}</span><span>—</span></div>`
  }

  const deductionsRows =
    displayDeductions.length > 0
      ? displayDeductions
          .map(
            (d) => `
        <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;">
          <span>${String(d.deductionType.name).toUpperCase()}</span>
          <span>${formatCurrencyHtml(d.amount)}</span>
        </div>`,
          )
          .join("")
      : `<div style="text-align:center;color:#666;padding:16px;">—</div>`

  const regularBody = `
    <div style="font-size:11px;text-align:center;margin-bottom:6px;color:#444;">
      Period: ${formatPeriodRange(payslipData.period.startDate, payslipData.period.endDate)}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;">
      <div style="border-right:1px solid #000;padding:8px;">
        <div style="font-weight:bold;border-bottom:1px solid #000;padding-bottom:4px;margin-bottom:8px;text-align:center;">Earnings</div>
        <div style="font-size:12px;">
          ${rowHtml("Basic Pay", payslipData.basicPay)}
          ${rowHtmlEmpty("13th Month")}
          ${rowHtmlEmpty("Undertime(hr)")}
          ${
            payslipData.overtimePay > 0
              ? rowHtml("OT - Regular", payslipData.overtimePay)
              : rowHtmlEmpty("OT - Regular")
          }
          ${rowHtmlEmpty("OT - Rest Day")}
          ${rowHtmlEmpty("OT - Special Holiday")}
          ${
            payslipData.holidayPay && payslipData.holidayPay > 0
              ? rowHtml("Adjustment", payslipData.holidayPay)
              : rowHtmlEmpty("Adjustment")
          }
          <div style="display:flex;justify-content:space-between;border-top:1px solid #000;padding-top:4px;margin-top:4px;font-weight:bold;">
            <span>Gross Pay</span><span>${formatCurrencyHtml(payslipData.grossPay)}</span>
          </div>
        </div>
      </div>
      <div style="padding:8px;">
        <div style="font-weight:bold;border-bottom:1px solid #000;padding-bottom:4px;margin-bottom:8px;text-align:center;">Deductions</div>
        <div style="font-size:12px;min-height:200px;">
          ${deductionsRows}
          <div style="display:flex;justify-content:space-between;border-top:1px solid #000;padding-top:8px;margin-top:8px;font-weight:bold;">
            <span>Total Deductions</span><span>${formatCurrencyHtml(payslipData.totalDeductions)}</span>
          </div>
        </div>
      </div>
    </div>
    <div style="margin-top:12px;text-align:right;border-top:2px solid #000;padding-top:8px;font-size:15px;font-weight:bold;">
      Net Pay: ${formatCurrencyHtml(payslipData.netPay)}
    </div>
  `

  const thirteenthBody = `
    <div style="border:1px solid #000;padding:12px;">
      <div style="font-weight:bold;text-align:center;border-bottom:1px solid #000;padding-bottom:8px;">13th month pay</div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;">
        <span>13th month pay</span><span>${formatCurrencyHtml(payslipData.thirteenthMonthPay || 0)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-weight:bold;border-top:1px solid #000;padding-top:8px;margin-top:8px;">
        <span>Net Pay</span><span>${formatCurrencyHtml(payslipData.netPay)}</span>
      </div>
    </div>
  `

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payslip — ${emp.firstName} ${emp.lastName}</title>
      <style>
        body { font-family: 'Courier New', Courier, monospace; font-size: 13px; margin: 20px; color: #000; }
        @media print { body { margin: 12px; } }
      </style>
    </head>
    <body>
      <div style="max-width:640px;margin:0 auto;">
        <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px;">
          <img src="/gwbrlogo.png" alt="Glan White Sand Beach Resort logo" style="height:48px;width:auto;object-fit:contain;margin:0 auto 8px auto;" />
          <div style="font-size:15px;font-weight:bold;">${payslipData.companyName}</div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:24px;margin-bottom:12px;font-size:13px;">
          <div>
            <div><strong>Name:</strong> ${nameLine}</div>
            <div><strong>Monthly Rate:</strong> ${formatCurrencyHtml(monthlyRate)}</div>
          </div>
          <div style="text-align:right;">
            <div><strong>Date:</strong> ${formatPayslipHeaderDate(headerDate)}</div>
            <div><strong>ID No.:</strong> ${emp.employeeId?.trim() || "—"}</div>
          </div>
        </div>
        ${isThirteenth ? thirteenthBody : regularBody}
        <div style="margin-top:24px;font-size:11px;">
          <p style="text-align:center;max-width:360px;margin:0 auto 24px auto;">
            I acknowledge to have received the amount as full compensation of services rendered
          </p>
          <div><strong>Employee Signature:</strong><span style="display:inline-block;min-width:200px;border-bottom:1px solid #000;margin-left:8px;"></span></div>
        </div>
      </div>
    </body>
    </html>
  `
}
