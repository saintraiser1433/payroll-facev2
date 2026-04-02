import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateDepartmentSchema = z.object({
  name: z.string().min(1, "Department name is required").optional(),
  description: z.string().optional(),
  positionSalaryIds: z.array(z.string().min(1)).optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validated = updateDepartmentSchema.parse(body)

    const existing = await prisma.department.findUnique({
      where: { id },
      include: { positionSalaries: { select: { id: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }

    const incomingIds = validated.positionSalaryIds ?? null

    const updated = await prisma.$transaction(async (tx) => {
      const dept = await tx.department.update({
        where: { id },
        data: {
          name: validated.name,
          description: validated.description,
        },
      })

      if (incomingIds) {
        // Unassign any currently-linked positions that are no longer selected.
        await tx.positionSalary.updateMany({
          where: {
            departmentId: id,
            id: { notIn: incomingIds.length ? incomingIds : ["__none__"] },
          },
          data: { departmentId: null },
        })

        // Assign selected positions to this department (can reassign from other departments).
        if (incomingIds.length) {
          await tx.positionSalary.updateMany({
            where: { id: { in: incomingIds } },
            data: { departmentId: id },
          })
        }
      }

      const full = await tx.department.findUnique({
        where: { id: dept.id },
        include: {
          employees: {
            select: { id: true, firstName: true, lastName: true, position: true, isActive: true },
          },
          head: {
            select: { id: true, firstName: true, lastName: true, position: true, employeeId: true },
          },
          positionSalaries: {
            select: { id: true, position: true, salaryRate: true, isActive: true },
            orderBy: { position: "asc" },
          },
        },
      })

      return full
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Error updating department:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

