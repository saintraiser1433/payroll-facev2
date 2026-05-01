import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

async function getOrCreatePolicy() {
  const existing = await prisma.cashAdvancePolicy.findUnique({ where: { id: "default" } })
  if (existing) return existing
  return prisma.cashAdvancePolicy.create({
    data: {
      id: "default",
      maxCashAdvancePercent: 80,
      installmentMaxPeriods: 12,
    },
  })
}

// GET — admin: policy; employee/dept: read-only defaults for forms
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const policy = await getOrCreatePolicy()
    if (!["EMPLOYEE", "DEPARTMENT_HEAD"].includes(session.user.role)) {
      return NextResponse.json({ policy })
    }

    const employee = await prisma.employee.findUnique({
      where: { id: session.user.employeeId },
      select: {
        position: true,
        salaryGrade: {
          select: {
            salaryRate: true,
          },
        },
      },
    })

    if (!employee) {
      return NextResponse.json({ policy, monthlySalary: 0, maxCashAdvanceAmount: 0 })
    }

    const positionSalary = await prisma.positionSalary.findFirst({
      where: {
        position: employee.position,
        isActive: true,
      },
      select: {
        salaryRate: true,
      },
    })

    const monthlySalary = positionSalary?.salaryRate ?? employee.salaryGrade?.salaryRate ?? 0
    const maxCashAdvanceAmount = (monthlySalary * (policy.maxCashAdvancePercent ?? 80)) / 100
    return NextResponse.json({ policy, monthlySalary, maxCashAdvanceAmount })
  } catch (e) {
    console.error("cash-advance-policy GET:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const patchSchema = z.object({
  maxCashAdvancePercent: z.number().min(1).max(100).optional(),
  installmentMaxPeriods: z.number().int().min(1).max(120).optional(),
})

// PATCH — admin only
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await request.json()
    const data = patchSchema.parse(body)
    await getOrCreatePolicy()
    const policy = await prisma.cashAdvancePolicy.update({
      where: { id: "default" },
      data,
    })
    return NextResponse.json({ policy })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("cash-advance-policy PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
