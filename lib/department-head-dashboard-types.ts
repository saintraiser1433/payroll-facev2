export interface DepartmentHeadData {
  employee: {
    id: string
    firstName: string
    lastName: string
    position: string
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
        startDate: string
        endDate: string
        status: string
      }
    }>
    department: {
      id: string
      name: string
      employees: Array<{
        id: string
        firstName: string
        lastName: string
        position: string
        attendances: Array<{
          id: string
          date: string
          timeIn: string | null
          timeOut: string | null
          status: string
          lateMinutes: number
          overtimeMinutes: number
        }>
        payrollItems: Array<{
          id: string
          basicPay: number
          netPay: number
          payrollPeriod: {
            name: string
            startDate: string
            endDate: string
            status: string
          }
        }>
      }>
    }
  }
  departmentStats: {
    totalEmployees: number
    presentToday: number
    lateToday: number
    absentToday: number
    totalOvertime: number
  }
}
