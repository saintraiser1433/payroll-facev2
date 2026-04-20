import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const cashAdvanceDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
})

function computeRepayment(ca: {
  amount: number
  repaymentType: "FULL" | "INSTALLMENT"
  installmentCount: number | null
  interestRate: number
}) {
  const principal = ca.amount
  const rate = ca.interestRate ?? 0
  const totalRepayable = principal * (1 + rate / 100)
  if (ca.repaymentType === "INSTALLMENT") {
    const n = Math.max(1, ca.installmentCount ?? 1)
    return {
      totalRepayable,
      remainingBalance: totalRepayable,
      amountPerPeriod: totalRepayable / n,
      installmentCount: n,
    }
  }
  return {
    totalRepayable,
    remainingBalance: totalRepayable,
    amountPerPeriod: totalRepayable,
    installmentCount: 1,
  }
}

// POST /api/cash-advances/[id]/decision
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { decision } = cashAdvanceDecisionSchema.parse(body)

    const actorEmployee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: { id: true, departmentId: true },
    })

    if (!actorEmployee) {
      return NextResponse.json({ error: "Approver employee not found" }, { status: 404 })
    }

    const cashAdvance = await prisma.cashAdvance.findUnique({
      where: { id },
      include: { employee: { select: { id: true, departmentId: true, userId: true } } },
    })

    if (!cashAdvance) {
      return NextResponse.json({ error: "Cash advance not found" }, { status: 404 })
    }

    if (decision === "REJECT") {
      const updated = await prisma.cashAdvance.update({
        where: { id },
        data: {
          status: "REJECTED",
          approvedAt: new Date(),
          approvedById: actorEmployee.id,
          isPaid: false,
        },
      })
      return NextResponse.json({ cashAdvance: updated }, { status: 200 })
    }

    const rep = computeRepayment({
      amount: cashAdvance.amount,
      repaymentType: cashAdvance.repaymentType,
      installmentCount: cashAdvance.installmentCount,
      interestRate: cashAdvance.interestRate ?? 0,
    })

    const updated = await prisma.cashAdvance.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: actorEmployee.id,
        isPaid: false,
        totalRepayable: rep.totalRepayable,
        remainingBalance: rep.remainingBalance,
        amountPerPeriod: rep.amountPerPeriod,
        installmentCount: rep.installmentCount,
      },
    })

    return NextResponse.json({ cashAdvance: updated }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Error deciding cash advance:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
