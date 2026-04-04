import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { recalculateAttendanceFromSchedule } from "@/lib/recalculate-attendance-from-schedule"

const patchSchema = z.object({
  timeIn: z.string().optional().nullable(),
  timeOut: z.string().optional().nullable(),
  breakOut: z.string().optional().nullable(),
  breakIn: z.string().optional().nullable(),
  breakMinutes: z.number().int().min(0).optional(),
  status: z.enum(["PRESENT", "LATE", "ABSENT", "OVERTIME"]).optional(),
  notes: z.string().optional().nullable(),
  recalculateFromSchedule: z.boolean().optional(),
})

const attendanceInclude = {
  employee: {
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      position: true,
      department: { select: { name: true } },
      schedule: { select: { timeIn: true, timeOut: true, name: true } },
      faceSamples: {
        where: { slot: 1 },
        select: { imagePath: true, slot: true },
      },
    },
  },
} as const

// PATCH /api/attendance/[id] — Admin only
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = patchSchema.parse(body)

    const existing = await prisma.attendance.findUnique({
      where: { id },
      include: { employee: { include: { schedule: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: "Attendance not found" }, { status: 404 })
    }

    const nextTimeIn =
      parsed.timeIn !== undefined ? (parsed.timeIn ? new Date(parsed.timeIn) : null) : existing.timeIn
    const nextTimeOut =
      parsed.timeOut !== undefined ? (parsed.timeOut ? new Date(parsed.timeOut) : null) : existing.timeOut
    const nextBreakOut =
      parsed.breakOut !== undefined ? (parsed.breakOut ? new Date(parsed.breakOut) : null) : existing.breakOut
    const nextBreakIn =
      parsed.breakIn !== undefined ? (parsed.breakIn ? new Date(parsed.breakIn) : null) : existing.breakIn
    const nextBreakMinutes =
      parsed.breakMinutes !== undefined ? parsed.breakMinutes : existing.breakMinutes

    let lateMinutes = existing.lateMinutes
    let overtimeMinutes = existing.overtimeMinutes
    let undertimeMinutes = existing.undertimeMinutes
    let status = parsed.status !== undefined ? parsed.status : existing.status

    const shouldRecalc =
      parsed.recalculateFromSchedule !== false &&
      nextTimeIn &&
      nextTimeOut &&
      existing.employee.schedule

    if (shouldRecalc) {
      const r = recalculateAttendanceFromSchedule(
        new Date(existing.date),
        nextTimeIn,
        nextTimeOut,
        existing.employee.schedule,
      )
      lateMinutes = r.lateMinutes
      overtimeMinutes = r.overtimeMinutes
      undertimeMinutes = r.undertimeMinutes
      if (parsed.status === undefined) {
        status = r.status
      }
    }

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        ...(parsed.timeIn !== undefined && { timeIn: nextTimeIn }),
        ...(parsed.timeOut !== undefined && { timeOut: nextTimeOut }),
        ...(parsed.breakOut !== undefined && { breakOut: nextBreakOut }),
        ...(parsed.breakIn !== undefined && { breakIn: nextBreakIn }),
        ...(parsed.breakMinutes !== undefined && { breakMinutes: nextBreakMinutes }),
        ...(parsed.notes !== undefined && { notes: parsed.notes }),
        lateMinutes,
        overtimeMinutes,
        undertimeMinutes,
        status,
      },
      include: attendanceInclude,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("PATCH attendance:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/attendance/[id] — Admin only
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    await prisma.attendance.delete({
      where: { id },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE attendance:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
