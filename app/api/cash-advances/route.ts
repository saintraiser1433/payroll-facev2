import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const cashAdvanceCreateSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  dateIssued: z.string().min(1, "Date is required"),
  reason: z.string().optional().nullable(),
})

// POST /api/cash-advances
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
    const { amount, dateIssued, reason } = cashAdvanceCreateSchema.parse(body)

    const created = await prisma.cashAdvance.create({
      data: {
        employeeId,
        amount,
        reason: reason ?? null,
        dateIssued: new Date(dateIssued),
        status: "PENDING",
        isPaid: false,
      },
    })

    return NextResponse.json({ cashAdvance: created }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Error creating cash advance:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

