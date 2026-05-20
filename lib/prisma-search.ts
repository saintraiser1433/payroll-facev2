import type { Prisma } from "@prisma/client"

/**
 * String `contains` filter for Prisma.
 * SQLite does not support `mode: "insensitive"` (Postgres does).
 */
export function prismaContains(search: string) {
  return { contains: search }
}

function caseVariants(term: string): string[] {
  const t = term.trim()
  if (!t) return []
  const lower = t.toLowerCase()
  const upper = t.toUpperCase()
  const title = lower.replace(/\b\w/g, (c) => c.toUpperCase())
  return [...new Set([t, lower, upper, title])]
}

/**
 * Employee text search for payroll items, employees list, etc.
 * Supports "First Last" and case variants (SQLite-safe).
 */
export function employeeSearchWhere(search: string): Prisma.EmployeeWhereInput {
  const term = search.trim()
  if (!term) return {}

  const parts = term.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const first = parts[0]
    const last = parts.slice(1).join(" ")
    const firstVariants = caseVariants(first)
    const lastVariants = caseVariants(last)
    return {
      OR: firstVariants.flatMap((f) =>
        lastVariants.map((l) => ({
          AND: [{ firstName: prismaContains(f) }, { lastName: prismaContains(l) }],
        })),
      ),
    }
  }

  const variants = caseVariants(term)
  return {
    OR: variants.flatMap((v) => [
      { firstName: prismaContains(v) },
      { lastName: prismaContains(v) },
      { employeeId: prismaContains(v) },
      { position: prismaContains(v) },
    ]),
  }
}

/** Combine employee search with department / position filters without breaking Prisma queries. */
export function buildEmployeePayrollFilter(options: {
  search?: string | null
  department?: string | null
  position?: string | null
}): Prisma.EmployeeWhereInput | undefined {
  const parts: Prisma.EmployeeWhereInput[] = []

  if (options.search?.trim()) {
    parts.push(employeeSearchWhere(options.search))
  }
  if (options.department && options.department !== "all") {
    parts.push({ departmentId: options.department })
  }
  if (options.position && options.position !== "all") {
    parts.push({ position: options.position })
  }

  if (parts.length === 0) return undefined
  if (parts.length === 1) return parts[0]
  return { AND: parts }
}
