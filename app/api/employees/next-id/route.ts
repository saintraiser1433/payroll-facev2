import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateNextEmployeeId } from "@/lib/employee-id"

// GET /api/employees/next-id — preview next auto-assigned employee number (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const nextEmployeeId = await generateNextEmployeeId(prisma)
    return NextResponse.json({ nextEmployeeId })
  } catch (e) {
    console.error("next-id:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
