import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Public kiosk endpoint: returns active employees with registered face images.
export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: {
        employeeId: true,
        firstName: true,
        lastName: true,
        faceSamples: {
          select: { slot: true, imagePath: true },
          orderBy: { slot: "asc" },
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    })

    const enrolled = employees
      .map((e) => ({
        employeeId: e.employeeId,
        firstName: e.firstName,
        lastName: e.lastName,
        faces: e.faceSamples.map((f) => ({ slot: f.slot, imagePath: f.imagePath })),
      }))
      .filter((e) => e.faces.length > 0)

    return NextResponse.json({ enrolled })
  } catch (error) {
    console.error("Error fetching enrolled faces:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

