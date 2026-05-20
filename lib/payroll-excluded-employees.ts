/** Employee numbers excluded from payroll runs (e.g. system admin accounts). */
export const PAYROLL_EXCLUDED_EMPLOYEE_NUMBERS = ["ADMIN001"] as const

export function isPayrollExcludedEmployee(employeeId: string): boolean {
  return (PAYROLL_EXCLUDED_EMPLOYEE_NUMBERS as readonly string[]).includes(employeeId)
}

/** Prisma `where` fragment for employees eligible for payroll. */
export function payrollEligibleEmployeeWhere(extra?: Record<string, unknown>) {
  return {
    ...extra,
    employeeId: { notIn: [...PAYROLL_EXCLUDED_EMPLOYEE_NUMBERS] },
  }
}
