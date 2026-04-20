import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import fs from "node:fs/promises"
import path from "node:path"

function mimeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".pdf":
      return "application/pdf"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".png":
      return "image/png"
    case ".gif":
      return "image/gif"
    case ".webp":
      return "image/webp"
    default:
      return "application/octet-stream"
  }
}

// GET /api/leave-requests/[id]/attachment — stream file using session (works when /uploads static is unavailable).
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        employee: {
          select: {
            id: true,
            departmentId: true,
            userId: true,
          },
        },
      },
    })

    if (!leave?.attachmentPath) {
      return NextResponse.json({ error: "No attachment" }, { status: 404 })
    }

    const role = session.user.role
    const viewerEmployeeId = session.user.employeeId as string | undefined

    if (role === "EMPLOYEE" || role === "DEPARTMENT_HEAD") {
      if (viewerEmployeeId && leave.employeeId === viewerEmployeeId) {
        // own request
      } else if (role === "DEPARTMENT_HEAD" && viewerEmployeeId) {
        const head = await prisma.employee.findFirst({
          where: { userId: session.user.id },
          select: { departmentId: true },
        })
        if (!head?.departmentId || head.departmentId !== leave.employee.departmentId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else if (role === "ADMIN") {
      // Admin may review any leave attachment (pending list is filtered elsewhere).
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const rel = leave.attachmentPath.replace(/^\/+/, "")
    if (!rel.startsWith("uploads/leave/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }

    const abs = path.resolve(process.cwd(), "public", rel)
    const root = path.resolve(process.cwd(), "public", "uploads", "leave")
    if (abs !== root && !abs.startsWith(root + path.sep)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let buf: Buffer
    try {
      buf = await fs.readFile(abs)
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const ext = path.extname(abs)
    const filename = path.basename(abs)
    const contentType = mimeForExt(ext)

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (e) {
    console.error("leave attachment GET:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
