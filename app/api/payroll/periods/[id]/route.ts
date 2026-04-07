import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updatePayrollPeriodSchema = z.object({
  name: z.string().min(1, "Period name is required"),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
  isThirteenthMonth: z.boolean().optional().default(false),
})

// PUT /api/payroll/periods/[id] - Edit payroll period (draft only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updatePayrollPeriodSchema.parse(body)

    if (validatedData.endDate <= validatedData.startDate) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 },
      )
    }

    const existing = await prisma.payrollPeriod.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Payroll period not found" }, { status: 404 })
    }
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Closed payroll periods are not editable." },
        { status: 400 },
      )
    }

    const overlap = await prisma.payrollPeriod.findFirst({
      where: {
        id: { not: id },
        startDate: { lte: validatedData.endDate },
        endDate: { gte: validatedData.startDate },
      },
      select: { name: true },
    })
    if (overlap) {
      return NextResponse.json(
        { error: `Payroll period overlaps with existing period "${overlap.name}".` },
        { status: 400 },
      )
    }

    const updated = await prisma.payrollPeriod.update({
      where: { id },
      data: {
        name: validatedData.name,
        startDate: validatedData.startDate,
        endDate: validatedData.endDate,
        isThirteenthMonth: validatedData.isThirteenthMonth || false,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 },
      )
    }
    console.error("Error updating payroll period:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

