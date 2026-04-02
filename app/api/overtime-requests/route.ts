import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createOvertimeRequestSchema = z.object({
  requestDate: z.string().min(1, "Request date is required"),
  requestedMinutes: z.number().int().positive("Requested minutes must be greater than 0"),
  reason: z.string().optional().nullable(),
})

// POST /api/overtime-requests
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "EMPLOYEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const employeeId = session.user.employeeId as string | undefined
    if (!employeeId) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    const body = await request.json()
    const { requestDate, requestedMinutes, reason } = createOvertimeRequestSchema.parse(body)

    const created = await prisma.overtimeRequest.create({
      data: {
        employeeId,
        requestDate: new Date(requestDate),
        requestedMinutes,
        reason: reason ?? null,
      },
    })

    return NextResponse.json({ overtimeRequest: created }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    console.error("Error creating overtime request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

