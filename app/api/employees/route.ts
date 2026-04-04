import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import QRCode from 'qrcode'

const employeeSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
  address: z.string().optional(),
  position: z.string().min(1, 'Position is required'),
  jobDescription: z.string().optional(),
  salaryType: z.enum(['MONTHLY']),
  hireDate: z.string().transform((str) => new Date(str)),
  departmentId: z.string().optional(),
  scheduleId: z.string().optional(),
  role: z.enum(['EMPLOYEE', 'DEPARTMENT_HEAD']).default('EMPLOYEE'),
  isActive: z.boolean().default(true),
})

// Helper function to generate QR code
async function generateQRCode(employeeId: string): Promise<string | null> {
  try {
    // Generate QR code with employee ID
    const qrCodeDataUrl = await QRCode.toDataURL(employeeId, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 300,
    })
    return qrCodeDataUrl
  } catch (error) {
    console.error('Error generating QR code:', error)
    return null
  }
}

// GET /api/employees - Get all employees
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const departmentId = searchParams.get('departmentId')
    const isActive = searchParams.get('isActive')

    const skip = (page - 1) * limit

    const where: any = {}
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
        { position: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (departmentId) {
      where.departmentId = departmentId
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        include: {
          department: true,
          schedule: true,
          salaryGrade: true,
          user: {
            select: { id: true, email: true, role: true }
          },
          faceSamples: {
            where: { slot: 1 },
            select: { slot: true, imagePath: true },
          },
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.employee.count({ where })
    ])

    // Generate QR codes for active employees that don't have one
    const employeesWithQR = await Promise.all(
      employees.map(async (employee) => {
        if (employee.isActive && !employee.qrCode) {
          // Generate QR code for active employee without one
          const qrCode = await generateQRCode(employee.employeeId)
          if (qrCode) {
            // Update employee with QR code
            await prisma.employee.update({
              where: { id: employee.id },
              data: { qrCode }
            })
            return { ...employee, qrCode }
          }
        }
        return employee
      })
    )

    return NextResponse.json({
      employees: employeesWithQR,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching employees:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/employees - Create new employee
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = employeeSchema.parse(body)

    // Check if employee ID already exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { employeeId: validatedData.employeeId }
    })

    if (existingEmployee) {
      return NextResponse.json(
        { error: 'Employee ID already exists' },
        { status: 400 }
      )
    }

    // Check if email already exists in users table
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      )
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12)

    // Generate QR code only for active employees
    let qrCode: string | null = null
    if (validatedData.isActive) {
      qrCode = await generateQRCode(validatedData.employeeId)
    }

    // Create user and employee in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user first
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          password: hashedPassword,
          role: validatedData.role,
        }
      })

      // Create employee with user reference
      const employee = await tx.employee.create({
        data: {
          employeeId: validatedData.employeeId,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          email: validatedData.email,
          phone: validatedData.phone,
          address: validatedData.address,
          position: validatedData.position,
          jobDescription: validatedData.jobDescription,
          salaryType: validatedData.salaryType,
          hireDate: validatedData.hireDate,
          departmentId: validatedData.departmentId,
          scheduleId: validatedData.scheduleId,
          isActive: validatedData.isActive,
          qrCode: qrCode,
          userId: user.id,
        },
        include: {
          department: true,
          schedule: true,
          user: {
            select: { id: true, email: true, role: true }
          }
        }
      })

      return employee
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating employee:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

