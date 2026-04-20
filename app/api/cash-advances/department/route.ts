import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET /api/cash-advances/department — deprecated for department heads; cash advances are admin-approved only.
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "DEPARTMENT_HEAD") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ cashAdvances: [] }, { status: 200 })
  } catch (e) {
    console.error("department cash advances list:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
