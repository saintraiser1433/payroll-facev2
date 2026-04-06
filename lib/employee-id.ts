import type { PrismaClient } from "@prisma/client"

/** Display / QR employee number prefix (e.g. GWSBR-0001). */
export const EMPLOYEE_NUMBER_PREFIX = "GWSBR-"

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function formatEmployeeNumber(seq: number): string {
  return `${EMPLOYEE_NUMBER_PREFIX}${String(Math.max(1, seq)).padStart(4, "0")}`
}

/**
 * Next sequential ID for new employees, based on existing `GWSBR-####` codes only.
 */
export async function generateNextEmployeeId(prisma: PrismaClient): Promise<string> {
  const rows = await prisma.employee.findMany({
    select: { employeeId: true },
  })
  const re = new RegExp(`^${escapeRegex(EMPLOYEE_NUMBER_PREFIX)}(\\d+)$`, "i")
  let max = 0
  for (const r of rows) {
    const m = r.employeeId.match(re)
    if (m) {
      const n = parseInt(m[1], 10)
      if (!Number.isNaN(n) && n > max) max = n
    }
  }
  return formatEmployeeNumber(max + 1)
}
