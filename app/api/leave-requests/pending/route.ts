import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/leave-requests/pending
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "DEPARTMENT_HEAD") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const deptHeadEmployee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: { id: true, departmentId: true },
    })

    if (!deptHeadEmployee || !deptHeadEmployee.departmentId) {
      return NextResponse.json({ error: "Department head not found" }, { status: 404 })
    }

    const requests = await prisma.leaveRequest.findMany({
      where: {
        status: "PENDING",
        employee: { departmentId: deptHeadEmployee.departmentId },
      },
      orderBy: { createdAt: "desc" },
      include: {
        employee: {
          select: { id: true, employeeId: true, firstName: true, lastName: true, position: true, departmentId: true },
        },
      },
    })

    return NextResponse.json({ requests }, { status: 200 })
  } catch (error) {
    console.error("Error fetching pending leave requests:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

