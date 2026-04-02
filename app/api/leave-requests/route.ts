import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import fs from "node:fs/promises"
import path from "node:path"

const createLeaveSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().optional().nullable(),
})

// POST /api/leave-requests
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "EMPLOYEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const employeeId = session.user.employeeId as string | undefined
    if (!employeeId) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const startDate = formData.get("startDate")
    const endDate = formData.get("endDate")
    const reason = formData.get("reason")
    const attachment = formData.get("attachment")

    const parsed = createLeaveSchema.parse({
      startDate,
      endDate,
      reason,
    })

    let attachmentPath: string | null = null

    if (attachment && typeof attachment !== "string") {
      const file = attachment
      const uploadDir = path.join(process.cwd(), "public", "uploads", "leave")
      await fs.mkdir(uploadDir, { recursive: true })

      const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const fileName = `${Date.now()}_${safeOriginalName}`
      const fullPath = path.join(uploadDir, fileName)

      const bytes = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(fullPath, bytes)

      attachmentPath = `/uploads/leave/${fileName}`
    }

    const created = await prisma.leaveRequest.create({
      data: {
        employeeId,
        startDate: new Date(parsed.startDate),
        endDate: new Date(parsed.endDate),
        reason: parsed.reason ?? null,
        attachmentPath,
        status: "PENDING",
      },
    })

    return NextResponse.json({ leaveRequest: created }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Error creating leave request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

