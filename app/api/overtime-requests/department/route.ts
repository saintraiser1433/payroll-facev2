import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { RequestStatus } from "@prisma/client"

// GET /api/overtime-requests/department?status=all|pending|approved|rejected
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "DEPARTMENT_HEAD") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const deptHead = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: { departmentId: true },
    })
    if (!deptHead?.departmentId) {
      return NextResponse.json({ requests: [] })
    }

    const raw = request.nextUrl.searchParams.get("status") || "all"
    const tab = raw.toLowerCase()

    const statusFilter: RequestStatus | undefined =
      tab === "pending"
        ? "PENDING"
        : tab === "approved"
          ? "APPROVED"
          : tab === "rejected"
            ? "REJECTED"
            : undefined

    const requests = await prisma.overtimeRequest.findMany({
      where: {
        employee: { departmentId: deptHead.departmentId },
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: { requestDate: "desc" },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        requestDate: r.requestDate.toISOString(),
        requestedMinutes: r.requestedMinutes,
        reason: r.reason,
        status: r.status,
        employee: r.employee,
      })),
    })
  } catch (e) {
    console.error("department overtime list:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
