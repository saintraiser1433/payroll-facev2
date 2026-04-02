import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const benefit = await prisma.benefit.findUnique({
      where: { id }
    })

    if (!benefit) {
      return NextResponse.json({ error: 'Benefit not found' }, { status: 404 })
    }

    return NextResponse.json(benefit)
  } catch (error) {
    console.error('Error fetching benefit:', error)
    return NextResponse.json(
      { error: 'Failed to fetch benefit' },
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
    const { name, description, type, coverageAmount, employeeContribution, employerContribution } = body

    // Validate required fields
    if (!name || !type || coverageAmount === undefined || employeeContribution === undefined || employerContribution === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const benefit = await prisma.benefit.update({
      where: { id },
      data: {
        name,
        description: description || '',
        type,
        coverageAmount: parseFloat(coverageAmount),
        employeeContribution: parseFloat(employeeContribution),
        employerContribution: parseFloat(employerContribution),
        updatedAt: new Date(),
      }
    })

    return NextResponse.json(benefit)
  } catch (error) {
    console.error('Error updating benefit:', error)
    return NextResponse.json(
      { error: 'Failed to update benefit' },
      { status: 500 }
    )
  }
}

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

    // Check if benefit is assigned to any employees
    const employeeCount = await prisma.employeeBenefit.count({
      where: { benefitId: id }
    })

    if (employeeCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete benefit that is assigned to employees' },
        { status: 400 }
      )
    }

    await prisma.benefit.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Benefit deleted successfully' })
  } catch (error) {
    console.error('Error deleting benefit:', error)
    return NextResponse.json(
      { error: 'Failed to delete benefit' },
      { status: 500 }
    )
  }
}
