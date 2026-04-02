import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const uploadSchema = z.object({
  slot: z.number().int().min(1).max(5),
  dataUrl: z.string().min(1),
})

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(png|jpeg));base64,(.+)$/)
  if (!match) {
    throw new Error("Invalid image data. Expected a base64 PNG/JPEG data URL.")
  }
  const mime = match[1]
  const ext = match[2] === "jpeg" ? "jpg" : match[2]
  const base64 = match[3]
  const buffer = Buffer.from(base64, "base64")
  return { mime, ext, buffer }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const faces = await prisma.employeeFace.findMany({
    where: { employeeId: id },
    select: { id: true, slot: true, imagePath: true, createdAt: true },
    orderBy: { slot: "asc" },
  })

  return NextResponse.json({ faces })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true, employeeId: true } })
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    const body = await request.json()
    const { slot, dataUrl } = uploadSchema.parse(body)
    const { ext, buffer } = decodeDataUrl(dataUrl)

    const relDir = path.posix.join("uploads", "faces", employee.employeeId)
    const absDir = path.join(process.cwd(), "public", "uploads", "faces", employee.employeeId)
    await mkdir(absDir, { recursive: true })

    const filename = `face_${slot}.${ext}`
    const absPath = path.join(absDir, filename)
    await writeFile(absPath, buffer)

    const imagePath = `/${relDir}/${filename}`

    const saved = await prisma.employeeFace.upsert({
      where: { employeeId_slot: { employeeId: employee.id, slot } },
      create: { employeeId: employee.id, slot, imagePath },
      update: { imagePath },
      select: { id: true, slot: true, imagePath: true, createdAt: true },
    })

    const count = await prisma.employeeFace.count({ where: { employeeId: employee.id } })
    return NextResponse.json({ face: saved, count })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

