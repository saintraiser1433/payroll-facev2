"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
  Users,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  ChevronDown,
  Filter,
  Eye,
  MoreHorizontal,
  Building2,
} from "lucide-react"
import { AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, BarChart, Bar } from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"

interface DashboardData {
  overview: {
    totalEmployees: number
    activeEmployees: number
    totalDepartments: number
    attendanceRate: number
    attendanceChange: number
    lateArrivals: number
    totalOvertimeHours: number
  }
  attendance: {
    today: number
    thisMonth: number
    trends: Array<{ date: string; count: number }>
  }
  payroll: {
    totalEarnings: number
    totalDeductions: number
    totalNetPay: number
    periodActive: boolean
  }
  departments: Array<{
    name: string
    employeeCount: number
    id: string
  }>
  recentActivity: Array<{
    id: string
    employeeName: string
    position: string
    department: string
    timeIn: string | null
    timeOut: string | null
    status: string
    date: string
  }>
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard')
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }
      const data = await response.json()
      setDashboardData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }

  const formatTime = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PRESENT: { variant: "default" as const, label: "Present" },
      LATE: { variant: "secondary" as const, label: "Late" },
      ABSENT: { variant: "destructive" as const, label: "Absent" },
      OVERTIME: { variant: "outline" as const, label: "Overtime" },
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PRESENT
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchDashboardData}>Try Again</Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  if (!dashboardData) return null

  const metricsData = [
    {
      label: "Total Employees",
      value: dashboardData.overview.totalEmployees.toString(),
      change: `${dashboardData.overview.activeEmployees} active`,
      trend: "neutral" as const,
      icon: Users,
    },
    {
      label: "Present Today",
      value: dashboardData.attendance.today.toString(),
      change: `${dashboardData.overview.attendanceRate}% rate`,
      trend: dashboardData.overview.attendanceChange >= 0 ? "up" as const : "down" as const,
      icon: CheckCircle,
    },
    {
      label: "Late Arrivals",
      value: dashboardData.overview.lateArrivals.toString(),
      change: "today",
      trend: "neutral" as const,
      icon: AlertTriangle,
    },
    {
      label: "Monthly Payroll",
      value: formatCurrency(dashboardData.payroll.totalNetPay),
      change: dashboardData.payroll.periodActive ? "active period" : "no active period",
      trend: "neutral" as const,
      icon: DollarSign,
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
      {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back, {session?.user?.name || 'User'}!
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening with your team today.
            </p>
          </div>
          <Button asChild>
            <Link href="/employees">
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Link>
          </Button>
        </div>

        {/* Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {metricsData.map((metric, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
                <metric.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                <p className="text-xs text-muted-foreground flex items-center">
                  {metric.trend === "up" && <TrendingUp className="mr-1 h-3 w-3 text-green-500" />}
                  {metric.trend === "down" && <TrendingDown className="mr-1 h-3 w-3 text-red-500" />}
                      {metric.change}
                </p>
                </CardContent>
              </Card>
            ))}
          </div>

        <div className="grid gap-6 lg:grid-cols-7">
          {/* Attendance Chart */}
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Attendance Trends</CardTitle>
              <CardDescription>Daily attendance for the last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dashboardData.attendance.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { weekday: 'short' })}
                  />
                  <YAxis />
                        <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value) => [`${value} employees`, 'Present']}
                        />
                        <Area
                          type="monotone"
                    dataKey="count"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
              </Card>

          {/* Department Overview */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Departments</CardTitle>
              <CardDescription>Employee distribution by department</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.departments.map((dept) => (
                  <div key={dept.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{dept.name}</span>
                    </div>
                    <Badge variant="secondary">{dept.employeeCount}</Badge>
                  </div>
                ))}
                {dashboardData.departments.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    No departments found
                  </p>
                )}
              </div>
                </CardContent>
              </Card>
            </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest attendance records</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/attendance">View All</Link>
            </Button>
                </CardHeader>
                <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Time Out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboardData.recentActivity.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                            <AvatarFallback>
                            {record.employeeName.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                        <div>
                          <div className="font-medium">{record.employeeName}</div>
                          <div className="text-sm text-muted-foreground">{record.position}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{record.department}</TableCell>
                    <TableCell>{formatTime(record.timeIn)}</TableCell>
                    <TableCell>{formatTime(record.timeOut)}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell>
                      {new Date(record.date).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {dashboardData.recentActivity.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      No recent activity found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
                </CardContent>
              </Card>
      </div>
    </DashboardLayout>
  )
}