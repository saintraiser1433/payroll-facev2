import { prisma } from "@/lib/prisma"

export async function getOrCreateDeductionType(name: string, description?: string) {
  const existing = await prisma.deductionType.findFirst({ where: { name } })
  if (existing) return existing
  return prisma.deductionType.create({
    data: {
      name,
      description: description ?? `${name} (auto)`,
      isFixed: false,
    },
  })
}
