import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/leave-requests/my
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "EMPLOYEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const employeeId = session.user.employeeId as string | undefined
    if (!employeeId) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    const requests = await prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
      include: {
        approvedBy: {
          select: { id: true, firstName: true, lastName: true, position: true },
        },
      },
    })

    return NextResponse.json({ requests }, { status: 200 })
  } catch (error) {
    console.error("Error fetching my leave requests:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

