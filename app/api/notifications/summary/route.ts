import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role

    if (role === "DEPARTMENT_HEAD") {
      const deptHead = await prisma.employee.findFirst({
        where: { userId: session.user.id },
        select: { departmentId: true },
      })
      if (!deptHead?.departmentId) {
        return NextResponse.json({
          overtime: 0,
          leave: 0,
          cashAdvance: 0,
        })
      }
      const deptId = deptHead.departmentId
      const [overtime, leave, cashAdvance] = await Promise.all([
        prisma.overtimeRequest.count({
          where: {
            status: "PENDING",
            employee: { departmentId: deptId },
          },
        }),
        prisma.leaveRequest.count({
          where: {
            status: "PENDING",
            employee: { departmentId: deptId },
          },
        }),
        Promise.resolve(0),
      ])
      return NextResponse.json({ overtime, leave, cashAdvance })
    }

    if (role === "EMPLOYEE") {
      const employeeId = session.user.employeeId
      if (!employeeId) {
        return NextResponse.json({
          overtime: 0,
          leave: 0,
          cashAdvance: 0,
          decisionAlerts: [],
        })
      }
      const [overtime, leave, cashAdvance, otDec, leaveDec, cashDec] = await Promise.all([
        prisma.overtimeRequest.count({
          where: { status: "PENDING", employeeId },
        }),
        prisma.leaveRequest.count({
          where: { status: "PENDING", employeeId },
        }),
        prisma.cashAdvance.count({
          where: { status: "PENDING", employeeId },
        }),
        prisma.overtimeRequest.findMany({
          where: {
            employeeId,
            status: { in: ["APPROVED", "REJECTED"] },
          },
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: { id: true, status: true },
        }),
        prisma.leaveRequest.findMany({
          where: {
            employeeId,
            status: { in: ["APPROVED", "REJECTED"] },
          },
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: { id: true, status: true },
        }),
        prisma.cashAdvance.findMany({
          where: {
            employeeId,
            status: { in: ["APPROVED", "REJECTED"] },
          },
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: { id: true, status: true },
        }),
      ])

      const decisionAlerts = [
        ...otDec.map((r) => ({
          id: r.id,
          kind: "overtime" as const,
          status: r.status,
        })),
        ...leaveDec.map((r) => ({
          id: r.id,
          kind: "leave" as const,
          status: r.status,
        })),
        ...cashDec.map((r) => ({
          id: r.id,
          kind: "cashAdvance" as const,
          status: r.status,
        })),
      ]

      return NextResponse.json({
        overtime,
        leave,
        cashAdvance,
        decisionAlerts,
      })
    }

    if (role === "ADMIN") {
      const [overtime, leave, cashAdvance, draftPeriods] = await Promise.all([
        prisma.overtimeRequest.count({
          where: { status: "PENDING", employee: { user: { role: "DEPARTMENT_HEAD" } } },
        }),
        prisma.leaveRequest.count({
          where: { status: "PENDING", employee: { user: { role: "DEPARTMENT_HEAD" } } },
        }),
        prisma.cashAdvance.count({
          where: { status: "PENDING" },
        }),
        prisma.payrollPeriod.count({
          where: { status: "DRAFT" },
        }),
      ])
      return NextResponse.json({
        overtime,
        leave,
        cashAdvance,
        draftPeriods,
      })
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  } catch (e) {
    console.error("notifications summary:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
