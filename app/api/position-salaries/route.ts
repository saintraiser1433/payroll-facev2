import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createPositionSalarySchema = z.object({
  position: z.string().min(1, "Position is required"),
  description: z.string().optional(),
  salaryRate: z.number().min(0, "Salary rate must be positive"),
  departmentId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
})

const updatePositionSalarySchema = z.object({
  position: z.string().min(1, "Position is required").optional(),
  description: z.string().optional(),
  salaryRate: z.number().min(0, "Salary rate must be positive").optional(),
  isActive: z.boolean().optional(),
})

// GET /api/position-salaries - List position salary rates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const isActive = searchParams.get("isActive")
    const departmentId = searchParams.get("departmentId")

    const skip = (page - 1) * limit

    const where: any = {}
    if (search) {
      where.OR = [
        { position: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    if (isActive !== null && isActive !== undefined && isActive !== "all") {
      where.isActive = isActive === "true"
    }
    if (departmentId) {
      where.departmentId = departmentId
    }

    const [positionSalaries, total] = await Promise.all([
      prisma.positionSalary.findMany({
        where,
        skip,
        take: limit,
        include: {
          department: {
            select: { id: true, name: true },
          },
        },
        orderBy: { position: "asc" },
      }),
      prisma.positionSalary.count({ where }),
    ])

    const positions = positionSalaries.map((p) => p.position)
    const counts = await prisma.employee.groupBy({
      by: ["position"],
      where: { position: { in: positions }, isActive: true },
      _count: { id: true },
    })

    const countMap = new Map(counts.map((c) => [c.position, c._count.id]))

    return NextResponse.json({
      positionSalaries: positionSalaries.map((ps) => ({
        ...ps,
        _count: { employees: countMap.get(ps.position) || 0 },
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching position salaries:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/position-salaries - Create new position salary rate
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createPositionSalarySchema.parse(body)

    const existing = await prisma.positionSalary.findUnique({
      where: { position: data.position },
    })

    if (existing) {
      return NextResponse.json({ error: "Position already exists" }, { status: 400 })
    }

    const created = await prisma.positionSalary.create({ data })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error("Error creating position salary:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

