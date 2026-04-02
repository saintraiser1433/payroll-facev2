import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if employee benefit exists
    const employeeBenefit = await prisma.employeeBenefit.findUnique({
      where: { id }
    })

    if (!employeeBenefit) {
      return NextResponse.json({ error: 'Employee benefit not found' }, { status: 404 })
    }

    // Deactivate the benefit instead of deleting
    await prisma.employeeBenefit.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ message: 'Benefit removed successfully' })
  } catch (error) {
    console.error('Error removing employee benefit:', error)
    return NextResponse.json(
      { error: 'Failed to remove benefit' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { startDate, endDate, isActive } = body

    // Check if employee benefit exists
    const employeeBenefit = await prisma.employeeBenefit.findUnique({
      where: { id }
    })

    if (!employeeBenefit) {
      return NextResponse.json({ error: 'Employee benefit not found' }, { status: 404 })
    }

    // Update the benefit assignment
    const updatedBenefit = await prisma.employeeBenefit.update({
      where: { id },
      data: {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        isActive: isActive !== undefined ? isActive : undefined
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true
          }
        },
        benefit: {
          select: {
            id: true,
            name: true,
            type: true,
            employeeContribution: true,
            employerContribution: true
          }
        }
      }
    })

    return NextResponse.json(updatedBenefit)
  } catch (error) {
    console.error('Error updating employee benefit:', error)
    return NextResponse.json(
      { error: 'Failed to update benefit' },
      { status: 500 }
    )
  }
}
