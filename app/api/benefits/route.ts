import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    // Build where clause for search
    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
        { type: { contains: search, mode: 'insensitive' as const } },
      ]
    } : {}

    const [benefits, total] = await Promise.all([
      prisma.benefit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.benefit.count({ where })
    ])
    const pages = Math.ceil(total / limit)

    return NextResponse.json({
      benefits,
      pagination: {
        page,
        limit,
        total,
        pages,
      }
    })
  } catch (error) {
    console.error('Error fetching benefits:', error)
    return NextResponse.json(
      { error: 'Failed to fetch benefits' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, type, coverageAmount, employeeContribution, employerContribution } = body

    // Validate required fields
    if (!name || !type || coverageAmount === undefined || employeeContribution === undefined || employerContribution === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const benefit = await prisma.benefit.create({
      data: {
        name,
        description: description || '',
        type,
        coverageAmount: parseFloat(coverageAmount),
        employeeContribution: parseFloat(employeeContribution),
        employerContribution: parseFloat(employerContribution),
        isActive: true,
      }
    })

    return NextResponse.json(benefit, { status: 201 })
  } catch (error) {
    console.error('Error creating benefit:', error)
    return NextResponse.json(
      { error: 'Failed to create benefit' },
      { status: 500 }
    )
  }
}
