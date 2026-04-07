import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/overtime-requests/pending
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["DEPARTMENT_HEAD", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let where: any = { status: "PENDING" }
    if (session.user.role === "DEPARTMENT_HEAD") {
      const deptHeadEmployee = await prisma.employee.findFirst({
        where: { userId: session.user.id },
        select: { id: true, departmentId: true },
      })
      if (!deptHeadEmployee || !deptHeadEmployee.departmentId) {
        return NextResponse.json({ error: "Department head not found" }, { status: 404 })
      }
      where.employee = { departmentId: deptHeadEmployee.departmentId }
    } else {
      where.employee = { user: { role: "DEPARTMENT_HEAD" } }
    }

    const requests = await prisma.overtimeRequest.findMany({
      where,
      orderBy: { requestDate: "desc" },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            position: true,
            email: true,
            departmentId: true,
          },
        },
      },
    })

    return NextResponse.json({ requests }, { status: 200 })
  } catch (error) {
    console.error("Error fetching pending overtime requests:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

