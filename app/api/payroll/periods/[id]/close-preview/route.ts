import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { findInvalidTimesheetsForClosingPeriod } from "@/lib/payroll-invalid-attendance-for-close"

// GET /api/payroll/periods/[id]/close-preview — timesheet issues before closing (no mutation)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const payrollPeriod = await prisma.payrollPeriod.findUnique({
      where: { id },
      include: { payrollItems: true },
    })

    if (!payrollPeriod) {
      return NextResponse.json({ error: "Payroll period not found" }, { status: 404 })
    }

    if (payrollPeriod.status === "CLOSED") {
      return NextResponse.json({ error: "Payroll period is already closed" }, { status: 400 })
    }

    if (payrollPeriod.payrollItems.length === 0) {
      return NextResponse.json({
        invalidCount: 0,
        invalidTimesheets: [],
        hasBlockingIssues: false,
        message: "No payroll items in this period yet.",
      })
    }

    const employeeIds = [...new Set(payrollPeriod.payrollItems.map((p) => p.employeeId))]
    const { invalid, preview } = await findInvalidTimesheetsForClosingPeriod(prisma, {
      startDate: payrollPeriod.startDate,
      endDate: payrollPeriod.endDate,
      employeeIds,
    })

    return NextResponse.json({
      invalidCount: invalid.length,
      invalidTimesheets: preview,
      hasBlockingIssues: invalid.length > 0,
    })
  } catch (e) {
    console.error("close-preview:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
