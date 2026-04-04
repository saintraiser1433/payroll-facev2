import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const cashAdvanceCreateSchema = z
  .object({
    amount: z.number().positive("Amount must be greater than 0"),
    dateIssued: z.string().min(1, "Date is required"),
    reason: z.string().optional().nullable(),
    repaymentType: z.enum(["FULL", "INSTALLMENT"]),
    installmentCount: z.number().int().min(1).optional().nullable(),
    interestRate: z.number().min(0).default(0),
  })
  .superRefine((data, ctx) => {
    if (data.repaymentType === "INSTALLMENT") {
      if (!data.installmentCount || data.installmentCount < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Installment count is required (2 or more) for installment repayment",
          path: ["installmentCount"],
        })
      }
    }
  })

// POST /api/cash-advances
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

    const body = await request.json()
    const parsed = cashAdvanceCreateSchema.parse(body)
    const { amount, dateIssued, reason, repaymentType, installmentCount, interestRate } = parsed

    await prisma.cashAdvancePolicy.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        fullPaymentInterestRate: 0,
        installmentInterestRate: 0,
        installmentMaxPeriods: 12,
      },
      update: {},
    })
    const policy = await prisma.cashAdvancePolicy.findUnique({ where: { id: "default" } })
    const maxInstall = policy?.installmentMaxPeriods ?? 12
    if (repaymentType === "INSTALLMENT" && installmentCount && installmentCount > maxInstall) {
      return NextResponse.json(
        { error: `Installment periods cannot exceed ${maxInstall}` },
        { status: 400 },
      )
    }

    const created = await prisma.cashAdvance.create({
      data: {
        employeeId,
        amount,
        reason: reason ?? null,
        dateIssued: new Date(dateIssued),
        status: "PENDING",
        isPaid: false,
        repaymentType,
        installmentCount: repaymentType === "INSTALLMENT" ? installmentCount : null,
        interestRate,
      },
    })

    return NextResponse.json({ cashAdvance: created }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Error creating cash advance:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

