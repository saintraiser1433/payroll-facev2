import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const decisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  approvedMinutes: z.number().int().nonnegative().optional(),
})

// POST /api/overtime-requests/[id]/decision
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "DEPARTMENT_HEAD") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { decision, approvedMinutes } = decisionSchema.parse(body)

    const deptHeadEmployee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: { id: true, departmentId: true },
    })
    if (!deptHeadEmployee || !deptHeadEmployee.departmentId) {
      return NextResponse.json({ error: "Department head not found" }, { status: 404 })
    }

    const overtimeRequest = await prisma.overtimeRequest.findUnique({
      where: { id: params.id },
      include: {
        employee: {
          select: { id: true, departmentId: true },
        },
      },
    })

    if (!overtimeRequest) {
      return NextResponse.json({ error: "Overtime request not found" }, { status: 404 })
    }

    if (overtimeRequest.employee.departmentId !== deptHeadEmployee.departmentId) {
      return NextResponse.json({ error: "Unauthorized to approve this request" }, { status: 403 })
    }

    const updated = await prisma.overtimeRequest.update({
      where: { id: params.id },
      data:
        decision === "APPROVE"
          ? {
              status: "APPROVED",
              approvedAt: new Date(),
              approvedById: deptHeadEmployee.id,
              approvedMinutes: approvedMinutes ?? overtimeRequest.requestedMinutes,
            }
          : {
              status: "REJECTED",
              approvedAt: new Date(),
              approvedById: deptHeadEmployee.id,
              approvedMinutes: 0,
            },
    })

    return NextResponse.json({ overtimeRequest: updated }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Error deciding overtime request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

