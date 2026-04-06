export interface EmployeeData {
  employee: {
    id: string
    firstName: string
    lastName: string
    position: string
    department: {
      name: string
    }
    schedule: {
      id: string
      name: string
      timeIn: string
      timeOut: string
      workingDays: string
    } | null
    attendances: Array<{
      id: string
      date: string
      timeIn: string | null
      timeOut: string | null
      status: string
      lateMinutes: number
      overtimeMinutes: number
    }>
    approvedLeaves: Array<{
      id: string
      startDate: string
      endDate: string
      reason: string | null
    }>
    payrollItems: Array<{
      id: string
      basicPay: number
      netPay: number
      payrollPeriod: {
        name: string
        status: string
      }
    }>
  }
  stats: {
    presentThisMonth: number
    totalHours: number
    overtimeHours: number
    lastNetPay: number
  }
}
