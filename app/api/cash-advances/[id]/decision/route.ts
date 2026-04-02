import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const cashAdvanceDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
})

// POST /api/cash-advances/[id]/decision
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "DEPARTMENT_HEAD") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { decision } = cashAdvanceDecisionSchema.parse(body)

    const deptHeadEmployee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: { id: true, departmentId: true },
    })

    if (!deptHeadEmployee || !deptHeadEmployee.departmentId) {
      return NextResponse.json({ error: "Department head not found" }, { status: 404 })
    }

    const cashAdvance = await prisma.cashAdvance.findUnique({
      where: { id: params.id },
      include: { employee: { select: { id: true, departmentId: true } } },
    })

    if (!cashAdvance) {
      return NextResponse.json({ error: "Cash advance not found" }, { status: 404 })
    }

    if (cashAdvance.employee.departmentId !== deptHeadEmployee.departmentId) {
      return NextResponse.json({ error: "Unauthorized to approve this request" }, { status: 403 })
    }

    const updated = await prisma.cashAdvance.update({
      where: { id: params.id },
      data:
        decision === "APPROVE"
          ? { status: "APPROVED", approvedAt: new Date(), approvedById: deptHeadEmployee.id }
          : { status: "REJECTED", approvedAt: new Date(), approvedById: deptHeadEmployee.id, isPaid: false },
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

