import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updatePositionSalarySchema = z.object({
  position: z.string().min(1, "Position is required").optional(),
  description: z.string().optional(),
  salaryRate: z.number().min(0, "Salary rate must be positive").optional(),
  departmentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

// PUT /api/position-salaries/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = updatePositionSalarySchema.parse(body)

    if (data.position) {
      const existing = await prisma.positionSalary.findFirst({
        where: { position: data.position, id: { not: params.id } },
      })
      if (existing) {
        return NextResponse.json({ error: "Position already exists" }, { status: 400 })
      }
    }

    const updated = await prisma.positionSalary.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error("Error updating position salary:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/position-salaries/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const existing = await prisma.positionSalary.findUnique({
      where: { id: params.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Position salary not found" }, { status: 404 })
    }

    const employeeCount = await prisma.employee.count({
      where: { position: existing.position, isActive: true },
    })

    if (employeeCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete position salary with assigned active employees" },
        { status: 400 }
      )
    }

    await prisma.positionSalary.delete({ where: { id: params.id } })
    return NextResponse.json({ message: "Position salary deleted successfully" })
  } catch (error) {
    console.error("Error deleting position salary:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

