import { prisma } from "./prisma"

async function clearPayrollPeriods() {
  const before = await prisma.payrollPeriod.count()
  const result = await prisma.payrollPeriod.deleteMany({})
  const after = await prisma.payrollPeriod.count()

  console.log(
    `Payroll periods cleared (DRAFT/CLOSED). Deleted: ${result.count}. Before: ${before}. After: ${after}.`
  )
}

clearPayrollPeriods()
  .catch((err) => {
    console.error("Failed to clear payroll periods:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
