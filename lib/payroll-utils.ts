// Payroll calculation utilities

export interface AttendanceRecord {
  date: string
  timeIn?: string
  timeOut?: string
  hoursWorked: number
  overtimeHours: number
  lateMinutes: number
}

export interface EmployeePayrollData {
  employeeId: string
  basicSalary: number
  salaryType: 'MONTHLY'
  attendanceRecords: AttendanceRecord[]
}

export interface DeductionRates {
  sss: number // percentage
  philHealth: number // percentage
  pagIbig: number // fixed amount
  tax: number // percentage
}

export interface PayrollCalculation {
  basicPay: number
  overtimePay: number
  totalEarnings: number
  sssDeduction: number
  philHealthDeduction: number
  pagIbigDeduction: number
  taxDeduction: number
  totalDeductions: number
  netPay: number
}

// Default deduction rates (Philippines)
export const DEFAULT_DEDUCTION_RATES: DeductionRates = {
  sss: 4.5, // 4.5%
  philHealth: 2.75, // 2.75%
  pagIbig: 100, // Fixed ₱100
  tax: 15, // 15% (simplified)
}

/**
 * Calculate basic pay based on salary type and attendance
 */
export function calculateBasicPay(
  basicSalary: number,
  salaryType: 'MONTHLY',
  attendanceRecords: AttendanceRecord[]
): number {
  switch (salaryType) {
    case 'MONTHLY':
      return basicSalary

    default:
      return 0
  }
}

/**
 * Calculate overtime pay
 */
export function calculateOvertimePay(
  basicSalary: number,
  salaryType: 'MONTHLY',
  attendanceRecords: AttendanceRecord[]
): number {
  const totalOvertimeHours = attendanceRecords.reduce((sum, record) => sum + record.overtimeHours, 0)
  
  let hourlyRate: number
  
  switch (salaryType) {
    case 'MONTHLY':
      hourlyRate = basicSalary / (22 * 8) // Assuming 22 working days, 8 hours per day
      break
    default:
      hourlyRate = 0
  }
  
  // Overtime rate is typically 1.25x regular rate
  return totalOvertimeHours * hourlyRate * 1.25
}

/**
 * Calculate SSS deduction
 */
export function calculateSSSDeduction(basicPay: number, rate: number = DEFAULT_DEDUCTION_RATES.sss): number {
  return (basicPay * rate) / 100
}

/**
 * Calculate PhilHealth deduction
 */
export function calculatePhilHealthDeduction(basicPay: number, rate: number = DEFAULT_DEDUCTION_RATES.philHealth): number {
  return (basicPay * rate) / 100
}

/**
 * Calculate Pag-IBIG deduction
 */
export function calculatePagIbigDeduction(amount: number = DEFAULT_DEDUCTION_RATES.pagIbig): number {
  return amount
}

/**
 * Calculate withholding tax (simplified)
 */
export function calculateTaxDeduction(taxableIncome: number, rate: number = DEFAULT_DEDUCTION_RATES.tax): number {
  // This is a simplified tax calculation
  // In reality, Philippines uses a progressive tax system
  return (taxableIncome * rate) / 100
}

/**
 * Calculate complete payroll for an employee
 */
export function calculateEmployeePayroll(
  employeeData: EmployeePayrollData,
  deductionRates: DeductionRates = DEFAULT_DEDUCTION_RATES
): PayrollCalculation {
  const basicPay = calculateBasicPay(
    employeeData.basicSalary,
    employeeData.salaryType,
    employeeData.attendanceRecords
  )
  
  const overtimePay = calculateOvertimePay(
    employeeData.basicSalary,
    employeeData.salaryType,
    employeeData.attendanceRecords
  )
  
  const totalEarnings = basicPay + overtimePay
  
  const sssDeduction = calculateSSSDeduction(basicPay, deductionRates.sss)
  const philHealthDeduction = calculatePhilHealthDeduction(basicPay, deductionRates.philHealth)
  const pagIbigDeduction = calculatePagIbigDeduction(deductionRates.pagIbig)
  
  // Tax is calculated on earnings minus mandatory contributions
  const taxableIncome = totalEarnings - sssDeduction - philHealthDeduction - pagIbigDeduction
  const taxDeduction = calculateTaxDeduction(taxableIncome, deductionRates.tax)
  
  const totalDeductions = sssDeduction + philHealthDeduction + pagIbigDeduction + taxDeduction
  const netPay = totalEarnings - totalDeductions
  
  return {
    basicPay: Math.round(basicPay * 100) / 100,
    overtimePay: Math.round(overtimePay * 100) / 100,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    sssDeduction: Math.round(sssDeduction * 100) / 100,
    philHealthDeduction: Math.round(philHealthDeduction * 100) / 100,
    pagIbigDeduction: Math.round(pagIbigDeduction * 100) / 100,
    taxDeduction: Math.round(taxDeduction * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netPay: Math.round(netPay * 100) / 100,
  }
}

/**
 * Calculate working hours between two times
 */
export function calculateWorkingHours(timeIn: string, timeOut: string): number {
  const [inHours, inMinutes] = timeIn.split(':').map(Number)
  const [outHours, outMinutes] = timeOut.split(':').map(Number)
  
  let totalMinutes = (outHours * 60 + outMinutes) - (inHours * 60 + inMinutes)
  
  // Handle overnight shifts
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60
  }
  
  return totalMinutes / 60
}

/**
 * Calculate lateness in minutes
 */
export function calculateLateness(actualTimeIn: string, scheduledTimeIn: string): number {
  const [actualHours, actualMinutes] = actualTimeIn.split(':').map(Number)
  const [scheduledHours, scheduledMinutes] = scheduledTimeIn.split(':').map(Number)
  
  const actualTotalMinutes = actualHours * 60 + actualMinutes
  const scheduledTotalMinutes = scheduledHours * 60 + scheduledMinutes
  
  const lateness = actualTotalMinutes - scheduledTotalMinutes
  
  return lateness > 0 ? lateness : 0
}

/**
 * Calculate overtime hours
 */
export function calculateOvertimeHours(
  actualHours: number,
  scheduledHours: number = 8
): number {
  const overtime = actualHours - scheduledHours
  return overtime > 0 ? overtime : 0
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Format time for display
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

