import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/payroll/cash-advance-payments - list advances and repayment status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get("status") || "all").toUpperCase()

    const rows = await prisma.cashAdvance.findMany({
      where: {
        ...(status === "PAID"
          ? { isPaid: true }
          : status === "UNPAID"
            ? { isPaid: false, status: "APPROVED" }
            : {}),
      },
      orderBy: { approvedAt: "desc" },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            position: true,
            department: { select: { name: true } },
          },
        },
      },
    })

    return NextResponse.json({
      cashAdvancePayments: rows.map((r) => ({
        id: r.id,
        employee: r.employee,
        dateIssued: r.dateIssued.toISOString(),
        approvedAt: r.approvedAt?.toISOString() ?? null,
        amount: r.amount,
        status: r.status,
        isPaid: r.isPaid,
        repaymentType: r.repaymentType,
        installmentCount: r.installmentCount,
        interestRate: r.interestRate,
        totalRepayable: r.totalRepayable,
        remainingBalance: r.remainingBalance,
        amountPerPeriod: r.amountPerPeriod,
      })),
    })
  } catch (e) {
    console.error("cash-advance-payments:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

