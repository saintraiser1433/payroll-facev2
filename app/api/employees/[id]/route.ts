import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import QRCode from 'qrcode'

const employeeUpdateSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required').optional(),
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  email: z.string().email('Valid email is required').optional(),
  password: z.string().optional().transform(val => val === '' ? undefined : val).refine(val => !val || val.length >= 6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
  address: z.string().optional(),
  position: z.string().min(1, 'Position is required').optional(),
  jobDescription: z.string().optional(),
  salaryGradeId: z.string().optional().transform(val => val === '' ? undefined : val),
  salaryType: z.enum(['HOURLY', 'DAILY', 'MONTHLY']).optional(),
  hireDate: z.string().optional().transform(str => str === '' ? undefined : str ? new Date(str) : undefined),
  departmentId: z.string().optional().transform(val => val === '' ? undefined : val),
  scheduleId: z.string().optional().transform(val => val === '' ? undefined : val),
  role: z.enum(['EMPLOYEE', 'DEPARTMENT_HEAD']).optional(),
  isActive: z.boolean().optional(),
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

// GET /api/employees/[id] - Get single employee
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        schedule: true,
        user: {
          select: { id: true, email: true, role: true }
        },
        attendances: {
          take: 10,
          orderBy: { date: 'desc' }
        },
        payrollItems: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            payrollPeriod: true
          }
        }
      }
    })

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(employee)
  } catch (error) {
    console.error('Error fetching employee:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/employees/[id] - Update employee
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = employeeUpdateSchema.parse(body)

    console.log('Employee update request:', {
      employeeId: id,
      receivedData: {
        email: validatedData.email,
        password: validatedData.password ? '***PROVIDED***' : 'NOT_PROVIDED',
        passwordLength: validatedData.password?.length || 0,
        role: validatedData.role
      }
    })

    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, role: true }
        }
      }
    })

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    console.log('Existing employee data:', {
      employeeId: existingEmployee.id,
      email: existingEmployee.email,
      userId: existingEmployee.userId,
      userEmail: existingEmployee.user?.email,
      userRole: existingEmployee.user?.role
    })

    // Check if employee ID already exists (if being updated)
    if (validatedData.employeeId && validatedData.employeeId !== existingEmployee.employeeId) {
      const duplicateEmployeeId = await prisma.employee.findUnique({
        where: { employeeId: validatedData.employeeId }
      })

      if (duplicateEmployeeId) {
        return NextResponse.json(
          { error: 'Employee ID already exists' },
          { status: 400 }
        )
      }
    }

    // Check if email already exists in users table (if being updated)
    if (validatedData.email && validatedData.email !== existingEmployee.email) {
      const duplicateUser = await prisma.user.findUnique({
        where: { email: validatedData.email }
      })

      if (duplicateUser) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        )
      }
    }

    // Prepare employee data (exclude password and role from employee update)
    const { password, role, ...employeeData } = validatedData

    // Handle QR code generation/removal based on isActive status
    const finalIsActive = validatedData.isActive !== undefined 
      ? validatedData.isActive 
      : existingEmployee.isActive

    // Determine if we need to generate or remove QR code
    let qrCodeUpdate: { qrCode?: string | null } = {}
    
    if (finalIsActive) {
      // Employee is active - generate/regenerate QR code
      const employeeIdToUse = validatedData.employeeId || existingEmployee.employeeId
      const qrCode = await generateQRCode(employeeIdToUse)
      if (qrCode) {
        qrCodeUpdate.qrCode = qrCode
      }
    } else if (validatedData.isActive === false && existingEmployee.isActive) {
      // Employee is being deactivated - remove QR code
      qrCodeUpdate.qrCode = null
    }
    // If employee is already inactive and staying inactive, don't change QR code

    // Update employee and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update employee
      const employee = await tx.employee.update({
        where: { id },
        data: {
          ...employeeData,
          ...qrCodeUpdate,
        },
        include: {
          department: true,
          schedule: true,
          user: {
            select: { id: true, email: true, role: true }
          }
        }
      })

      // Handle user creation/update if password, role, or email is provided
      if (password || role || validatedData.email) {
        if (existingEmployee.userId) {
          // Update existing user
          const userUpdateData: any = {}
          
          if (password) {
            const hashedPassword = await bcrypt.hash(password, 12)
            userUpdateData.password = hashedPassword
            console.log('Password update:', { 
              userId: existingEmployee.userId, 
              email: existingEmployee.email,
              passwordLength: password.length,
              hashedPasswordLength: hashedPassword.length 
            })
          }
          
          if (role) {
            userUpdateData.role = role
          }

          // Update email if it's different from the current user email
          if (validatedData.email && validatedData.email !== existingEmployee.user?.email) {
            userUpdateData.email = validatedData.email
            console.log('Email update:', {
              userId: existingEmployee.userId,
              oldEmail: existingEmployee.user?.email,
              newEmail: validatedData.email
            })
          }

          const updatedUser = await tx.user.update({
            where: { id: existingEmployee.userId },
            data: userUpdateData
          })
          
          console.log('User updated successfully:', { 
            userId: updatedUser.id, 
            email: updatedUser.email,
            role: updatedUser.role 
          })
        } else {
          // Create new user for employee
          console.log('Creating new user for employee:', {
            employeeId: existingEmployee.id,
            email: validatedData.email || existingEmployee.email,
            role: role || 'EMPLOYEE'
          })

          const hashedPassword = password ? await bcrypt.hash(password, 12) : await bcrypt.hash('default123', 12)
          
          const newUser = await tx.user.create({
            data: {
              email: validatedData.email || existingEmployee.email,
              password: hashedPassword,
              role: role || 'EMPLOYEE',
            }
          })

          // Update employee with new userId
          await tx.employee.update({
            where: { id: existingEmployee.id },
            data: { userId: newUser.id }
          })

          console.log('New user created successfully:', { 
            userId: newUser.id, 
            email: newUser.email,
            role: newUser.role,
            employeeId: existingEmployee.id
          })
        }
      }

      return employee
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating employee:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/employees/[id] - Delete employee
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id }
    })

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Soft delete by setting isActive to false
    const employee = await prisma.employee.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ message: 'Employee deleted successfully' })
  } catch (error) {
    console.error('Error deleting employee:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
