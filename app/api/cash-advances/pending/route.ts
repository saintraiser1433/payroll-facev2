import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/cash-advances/pending
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Admin approves all pending cash advances (employees and department heads).
    const where: { status: "PENDING" } = { status: "PENDING" }

    const cashAdvances = await prisma.cashAdvance.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        employee: {
          select: { id: true, employeeId: true, firstName: true, lastName: true, position: true, email: true },
        },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json({ cashAdvances }, { status: 200 })
  } catch (error) {
    console.error("Error fetching pending cash advances:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

