import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const decisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
})

// POST /api/leave-requests/[id]/decision
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["DEPARTMENT_HEAD", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { decision } = decisionSchema.parse(body)

    const actorEmployee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: { id: true, departmentId: true, user: { select: { role: true } } },
    })
    if (!actorEmployee) {
      return NextResponse.json({ error: "Approver employee not found" }, { status: 404 })
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: { employee: { select: { id: true, departmentId: true, userId: true } } },
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }

    if (session.user.role === "DEPARTMENT_HEAD") {
      if (leaveRequest.employee.departmentId !== actorEmployee.departmentId) {
        return NextResponse.json({ error: "Unauthorized to approve this request" }, { status: 403 })
      }
    } else {
      const reqUser = await prisma.user.findUnique({
        where: { id: leaveRequest.employee.userId ?? "" },
        select: { role: true },
      })
      if (reqUser?.role !== "DEPARTMENT_HEAD") {
        return NextResponse.json(
          { error: "Admin approval here is for department-head requests only." },
          { status: 403 },
        )
      }
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: params.id },
      data:
        decision === "APPROVE"
          ? { status: "APPROVED", approvedAt: new Date(), approvedById: actorEmployee.id }
          : { status: "REJECTED", approvedAt: new Date(), approvedById: actorEmployee.id },
    })

    return NextResponse.json({ leaveRequest: updated }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Error deciding leave request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

