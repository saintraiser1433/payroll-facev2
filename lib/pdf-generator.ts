import { jsPDF } from 'jspdf'

export interface PayslipData {
  employee: {
    id: string
    name: string
    position: string
    department: string
  }
  period: {
    name: string
    startDate: string
    endDate: string
  }
  earnings: {
    basicPay: number
    overtimePay: number
    allowances: number
    totalEarnings: number
  }
  deductions: {
    sss: number
    philHealth: number
    pagIbig: number
    tax: number
    totalDeductions: number
  }
  netPay: number
}

export function generatePayslipPDF(data: PayslipData): jsPDF {
  const doc = new jsPDF()
  
  // Company Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('GLAN WHITE SAND BEACH RESORT', 105, 20, { align: 'center' })
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Web-based Payroll Management System for Glan White Sand Beach Resort', 105, 30, { align: 'center' })
  doc.text('123 Business Street, City, Philippines', 105, 46, { align: 'center' })
  
  // Title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('PAYSLIP', 105, 55, { align: 'center' })
  
  // Employee Information
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Employee Information:', 20, 75)
  
  doc.setFont('helvetica', 'normal')
  doc.text(`Employee ID: ${data.employee.id}`, 20, 85)
  doc.text(`Name: ${data.employee.name}`, 20, 95)
  doc.text(`Position: ${data.employee.position}`, 20, 105)
  doc.text(`Department: ${data.employee.department}`, 20, 115)
  
  // Pay Period
  doc.setFont('helvetica', 'bold')
  doc.text('Pay Period:', 120, 75)
  
  doc.setFont('helvetica', 'normal')
  doc.text(`Period: ${data.period.name}`, 120, 85)
  doc.text(`From: ${new Date(data.period.startDate).toLocaleDateString()}`, 120, 95)
  doc.text(`To: ${new Date(data.period.endDate).toLocaleDateString()}`, 120, 105)
  
  // Earnings Section
  doc.setFont('helvetica', 'bold')
  doc.text('EARNINGS', 20, 140)
  doc.line(20, 145, 190, 145)
  
  doc.setFont('helvetica', 'normal')
  doc.text('Basic Pay:', 20, 155)
  doc.text(`₱${data.earnings.basicPay.toLocaleString()}`, 150, 155, { align: 'right' })
  
  doc.text('Overtime Pay:', 20, 165)
  doc.text(`₱${data.earnings.overtimePay.toLocaleString()}`, 150, 165, { align: 'right' })
  
  doc.text('Allowances:', 20, 175)
  doc.text(`₱${data.earnings.allowances.toLocaleString()}`, 150, 175, { align: 'right' })
  
  doc.line(20, 180, 150, 180)
  doc.setFont('helvetica', 'bold')
  doc.text('Total Earnings:', 20, 190)
  doc.text(`₱${data.earnings.totalEarnings.toLocaleString()}`, 150, 190, { align: 'right' })
  
  // Deductions Section
  doc.setFont('helvetica', 'bold')
  doc.text('DEDUCTIONS', 20, 210)
  doc.line(20, 215, 190, 215)
  
  doc.setFont('helvetica', 'normal')
  doc.text('SSS Contribution:', 20, 225)
  doc.text(`₱${data.deductions.sss.toLocaleString()}`, 150, 225, { align: 'right' })
  
  doc.text('PhilHealth:', 20, 235)
  doc.text(`₱${data.deductions.philHealth.toLocaleString()}`, 150, 235, { align: 'right' })
  
  doc.text('Pag-IBIG:', 20, 245)
  doc.text(`₱${data.deductions.pagIbig.toLocaleString()}`, 150, 245, { align: 'right' })
  
  doc.text('Withholding Tax:', 20, 255)
  doc.text(`₱${data.deductions.tax.toLocaleString()}`, 150, 255, { align: 'right' })
  
  doc.line(20, 260, 150, 260)
  doc.setFont('helvetica', 'bold')
  doc.text('Total Deductions:', 20, 270)
  doc.text(`₱${data.deductions.totalDeductions.toLocaleString()}`, 150, 270, { align: 'right' })
  
  // Net Pay
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.rect(15, 280, 160, 20)
  doc.text('NET PAY:', 20, 295)
  doc.text(`₱${data.netPay.toLocaleString()}`, 170, 295, { align: 'right' })
  
  // Footer
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('This is a computer-generated payslip. No signature required.', 105, 320, { align: 'center' })
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 330, { align: 'center' })
  
  return doc
}

export function downloadPayslip(data: PayslipData) {
  const doc = generatePayslipPDF(data)
  const filename = `payslip_${data.employee.id}_${data.period.name.replace(/\s+/g, '_')}.pdf`
  doc.save(filename)
}

export function previewPayslip(data: PayslipData) {
  const doc = generatePayslipPDF(data)
  const pdfBlob = doc.output('blob')
  const url = URL.createObjectURL(pdfBlob)
  window.open(url, '_blank')
}

