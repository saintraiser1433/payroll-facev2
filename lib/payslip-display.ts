/** Deduction types not shown on the printed payslip (still included in payroll totals). */
export function isPayslipHiddenDeduction(deductionTypeName: string | undefined | null): boolean {
  if (!deductionTypeName) return false
  const n = deductionTypeName.trim().toLowerCase()
  return (
    n === "overload" ||
    n === "getwell" ||
    n === "coop share" ||
    n === "coop loan" ||
    n.includes("coop share") ||
    n.includes("coop loan")
  )
}
