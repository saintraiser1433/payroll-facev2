import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/payroll/periods/by-date?date=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const dateParam = request.nextUrl.searchParams.get("date")
    if (!dateParam) {
      return NextResponse.json({ error: "date is required" }, { status: 400 })
    }
    const target = new Date(dateParam)
    if (Number.isNaN(target.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 })
    }
    const dayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0)
    const dayEnd = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59, 999)

    const periods = await prisma.payrollPeriod.findMany({
      where: {
        startDate: { lte: dayEnd },
        endDate: { gte: dayStart },
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
      },
      orderBy: { startDate: "asc" },
    })

    return NextResponse.json({
      periods: periods.map((p) => ({
        ...p,
        startDate: p.startDate.toISOString(),
        endDate: p.endDate.toISOString(),
      })),
    })
  } catch (e) {
    console.error("payroll periods by-date:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

