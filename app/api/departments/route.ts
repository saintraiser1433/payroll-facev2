import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const positionSalaryIdsSchema = z.preprocess(
  (value) =>
    Array.isArray(value)
      ? value
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : value,
  z.array(z.string().min(1)).optional()
)

const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  description: z.string().optional(),
  positionSalaryIds: positionSalaryIdsSchema,
})

// GET /api/departments - Get all departments
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const departments = await prisma.department.findMany({
      include: {
        employees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            isActive: true
          }
        },
        head: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            employeeId: true
          }
        }
        ,
        positionSalaries: {
          select: {
            id: true,
            position: true,
            salaryRate: true,
            isActive: true,
          },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(departments)
  } catch (error) {
    console.error('Error fetching departments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/departments - Create new department
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = departmentSchema.parse(body)

    // Check if department name already exists
    const existingDepartment = await prisma.department.findUnique({
      where: { name: validatedData.name }
    })

    if (existingDepartment) {
      return NextResponse.json(
        { error: 'Department name already exists' },
        { status: 400 }
      )
    }

    const department = await prisma.$transaction(async (tx) => {
      const dept = await tx.department.create({
        data: {
          name: validatedData.name,
          description: validatedData.description,
        },
      })

      if (validatedData.positionSalaryIds?.length) {
        await tx.positionSalary.updateMany({
          where: { id: { in: validatedData.positionSalaryIds } },
          data: { departmentId: dept.id },
        })
      }

      return await tx.department.findUnique({
        where: { id: dept.id },
        include: {
          employees: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              position: true,
              isActive: true,
            },
          },
          positionSalaries: {
            select: { id: true, position: true, salaryRate: true, isActive: true },
            orderBy: { position: "asc" },
          },
        },
      })
    })

    return NextResponse.json(department, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating department:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/departments - Update department head
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { departmentId, headId } = body

    if (!departmentId) {
      return NextResponse.json(
        { error: 'Department ID is required' },
        { status: 400 }
      )
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId }
    })

    if (!department) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      )
    }

    // If headId is provided, check if employee exists and is in the department
    if (headId) {
      const employee = await prisma.employee.findUnique({
        where: { id: headId },
        include: { department: true, managedDepartment: true }
      })

      if (!employee) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        )
      }

      if (employee.departmentId !== departmentId) {
        return NextResponse.json(
          { error: 'Employee is not in this department' },
          { status: 400 }
        )
      }

      // Check if employee is already a head of another department
      if (employee.managedDepartment && employee.managedDepartment.id !== departmentId) {
        return NextResponse.json(
          { error: 'Employee is already a head of another department' },
          { status: 400 }
        )
      }
    }

    // Use transaction to handle department head assignment + role synchronization
    const updatedDepartment = await prisma.$transaction(async (tx) => {
      const targetDepartmentBefore = await tx.department.findUnique({
        where: { id: departmentId },
        select: { headId: true },
      })

      // If assigning a new head, first remove them from any other department they might be heading
      if (headId) {
        await tx.department.updateMany({
          where: { headId: headId },
          data: { headId: null }
        })
      }

      // Update the target department
      const updated = await tx.department.update({
        where: { id: departmentId },
        data: { headId: headId || null },
        include: {
          employees: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              position: true,
              isActive: true
            }
          },
          head: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              position: true,
              employeeId: true
            }
          }
        }
      })

      // Promote assigned head user to DEPARTMENT_HEAD (except ADMIN users).
      if (headId) {
        const assignedHeadEmployee = await tx.employee.findUnique({
          where: { id: headId },
          select: { userId: true },
        })

        if (assignedHeadEmployee?.userId) {
          const assignedHeadUser = await tx.user.findUnique({
            where: { id: assignedHeadEmployee.userId },
            select: { role: true },
          })

          if (assignedHeadUser && assignedHeadUser.role !== "ADMIN" && assignedHeadUser.role !== "DEPARTMENT_HEAD") {
            await tx.user.update({
              where: { id: assignedHeadEmployee.userId },
              data: { role: "DEPARTMENT_HEAD" },
            })
          }
        }
      }

      // If previous head was removed from this department, demote back to EMPLOYEE
      // only when they no longer head any department (and are not ADMIN).
      const previousHeadId = targetDepartmentBefore?.headId
      if (previousHeadId && previousHeadId !== headId) {
        const stillHead = await tx.department.findFirst({
          where: { headId: previousHeadId },
          select: { id: true },
        })

        if (!stillHead) {
          const previousHeadEmployee = await tx.employee.findUnique({
            where: { id: previousHeadId },
            select: { userId: true },
          })

          if (previousHeadEmployee?.userId) {
            const previousHeadUser = await tx.user.findUnique({
              where: { id: previousHeadEmployee.userId },
              select: { role: true },
            })

            if (previousHeadUser?.role === "DEPARTMENT_HEAD") {
              await tx.user.update({
                where: { id: previousHeadEmployee.userId },
                data: { role: "EMPLOYEE" },
              })
            }
          }
        }
      }

      return updated
    })

    return NextResponse.json(updatedDepartment)
  } catch (error) {
    console.error('Error updating department head:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

