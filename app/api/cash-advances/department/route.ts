import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { RequestStatus } from "@prisma/client"

// GET /api/cash-advances/department?status=all|pending|approved|rejected
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
      return NextResponse.json({ cashAdvances: [] })
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

    const cashAdvances = await prisma.cashAdvance.findMany({
      where: {
        employee: { departmentId: deptHead.departmentId },
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: { dateIssued: "desc" },
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
      cashAdvances: cashAdvances.map((r) => ({
        id: r.id,
        amount: r.amount,
        dateIssued: r.dateIssued.toISOString(),
        reason: r.reason,
        status: r.status,
        repaymentType: r.repaymentType,
        installmentCount: r.installmentCount,
        interestRate: r.interestRate,
        totalRepayable: r.totalRepayable,
        remainingBalance: r.remainingBalance,
        amountPerPeriod: r.amountPerPeriod,
        isPaid: r.isPaid,
        approvedAt: r.approvedAt?.toISOString() ?? null,
        employee: r.employee,
      })),
    })
  } catch (e) {
    console.error("department cash advances list:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
