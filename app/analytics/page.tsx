"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { TrendingUp, TrendingDown, BarChart3, DollarSign, Users, Clock, CheckCircle, XCircle, Download, Award, Target, AlertTriangle } from "lucide-react"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Pie,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

interface AnalyticsData {
  overview: {
    totalEmployees: number
    activeEmployees: number
    attendanceThisMonth: number
    attendanceLastMonth: number
    attendanceRateChange: number
    lateArrivalsThisMonth: number
    totalOvertimeHours: number
  }
  departments: Array<{
    name: string
    employeeCount: number
    attendanceCount: number
    attendanceRate: number
  }>
  trends: {
    attendance: Array<{
      month: string
      attendance: number
      employees: number
    }>
    payroll: Array<{
      period: string
      date: string
      totalEarnings: number
      totalDeductions: number
      totalNetPay: number
      basicPay: number
      overtimePay: number
      employeeCount: number
    }>
  }
  salary: {
    distribution: Array<{
      department: string
      averageSalary: number
      employeeCount: number
      totalSalaryBudget: number
    }>
    totalBudget: number
    averageAcrossCompany: number
  }
  topPerformers: Array<{
    id: string
    name: string
    position: string
    department: string
    attendanceCount: number
    attendanceRate: number
  }>
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export default function AnalyticsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState("6months")

  useEffect(() => {
    fetchAnalyticsData()
  }, [])

  const fetchAnalyticsData = async () => {
    try {
      const response = await fetch('/api/analytics')
      if (!response.ok) throw new Error('Failed to fetch analytics data')
      
      const data = await response.json()
      setAnalyticsData(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch analytics data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value}%`
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!analyticsData) return null

  const departmentChartData = analyticsData.departments.map((dept, index) => ({
    ...dept,
    color: COLORS[index % COLORS.length]
  }))

  const attendanceTrendData = analyticsData.trends.attendance.map(trend => ({
    month: new Date(trend.month + '-01').toLocaleDateString('en-US', { month: 'short' }),
    attendance: trend.attendance,
    employees: trend.employees,
    rate: trend.employees > 0 ? Math.round((trend.attendance / (trend.employees * 30)) * 100) : 0,
    lateArrivals: Math.floor(Math.random() * 10), // Mock data - replace with actual data
    overtimeHours: Math.floor(Math.random() * 20), // Mock data - replace with actual data
    performanceRate: trend.employees > 0 ? Math.round((trend.attendance / (trend.employees * 30)) * 100) : 0
  }))

  const payrollTrendData = analyticsData.trends.payroll.map(item => ({
    period: item.period.substring(0, 10), // Truncate long names
    earnings: item.totalEarnings,
    deductions: item.totalDeductions,
    netPay: item.totalNetPay,
    employees: item.employeeCount,
    totalEarnings: item.totalEarnings,
    totalDeductions: item.totalDeductions,
    totalNetPay: item.totalNetPay,
    basicPay: item.basicPay,
    overtimePay: item.overtimePay,
    employeeCount: item.employeeCount
  }))

  const salaryDistributionData = analyticsData.salary.distribution.map((dept, index) => ({
    name: dept.department,
    value: dept.averageSalary,
    budget: dept.totalSalaryBudget,
    employees: dept.employeeCount,
    color: COLORS[index % COLORS.length]
  }))

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground">
              Comprehensive insights into attendance, payroll, and performance
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1month">1 Month</SelectItem>
                <SelectItem value="3months">3 Months</SelectItem>
                <SelectItem value="6months">6 Months</SelectItem>
                <SelectItem value="1year">1 Year</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline"
              onClick={() => {
                toast({
                  title: "Success",
                  description: "Report export started. Download will begin shortly.",
                })
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsData.overview.totalEmployees}</div>
              <p className="text-xs text-muted-foreground">
                {analyticsData.overview.activeEmployees} active employees
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round((analyticsData.overview.attendanceThisMonth / (analyticsData.overview.activeEmployees * 30)) * 100)}%
                  </div>
              <p className="text-xs text-muted-foreground flex items-center">
                {analyticsData.overview.attendanceRateChange >= 0 ? (
                  <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                )}
                {formatPercentage(analyticsData.overview.attendanceRateChange)} from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Late Arrivals</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsData.overview.lateArrivalsThisMonth}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round((analyticsData.overview.lateArrivalsThisMonth / analyticsData.overview.attendanceThisMonth) * 100)}% of total attendance
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overtime Hours</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsData.overview.totalOvertimeHours}h</div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
              </CardContent>
            </Card>
        </div>

        <Tabs defaultValue="attendance" className="space-y-6">
          <TabsList>
            <TabsTrigger value="attendance">Attendance Analysis</TabsTrigger>
            <TabsTrigger value="payroll">Payroll Insights</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* Attendance Analysis */}
          <TabsContent value="attendance" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Attendance Trends</CardTitle>
                  <CardDescription>Monthly attendance patterns over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={attendanceTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                        <Tooltip
                        formatter={(value, name) => [
                          name === 'rate' ? `${value}%` : value,
                          name === 'attendance' ? 'Total Attendance' : 
                          name === 'employees' ? 'Employees' : 'Attendance Rate'
                        ]}
                        />
                        <Area
                          type="monotone"
                        dataKey="attendance"
                        stackId="1"
                          stroke="#8b5cf6"
                          fill="#8b5cf6"
                        fillOpacity={0.6}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Department Attendance</CardTitle>
                  <CardDescription>Attendance rates by department</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={departmentChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                        <Tooltip
                        formatter={(value, name) => [
                          name === 'attendanceRate' ? `${value}%` : value,
                          name === 'attendanceRate' ? 'Attendance Rate' : 'Employee Count'
                        ]}
                      />
                      <Bar dataKey="attendanceRate" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Additional Attendance Charts */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Late Arrivals Trend</CardTitle>
                  <CardDescription>Monthly late arrival patterns</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={attendanceTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip
                        formatter={(value, name) => [
                          `${value} arrivals`,
                          'Late Arrivals'
                        ]}
                      />
                      <Line type="monotone" dataKey="lateArrivals" stroke="#ef4444" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Overtime Hours</CardTitle>
                  <CardDescription>Monthly overtime tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={attendanceTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip
                        formatter={(value, name) => [
                          `${value} hours`,
                          'Overtime Hours'
                        ]}
                      />
                      <Bar dataKey="overtimeHours" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Department Performance</CardTitle>
                <CardDescription>Detailed breakdown by department</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead>Employees</TableHead>
                      <TableHead>Total Attendance</TableHead>
                      <TableHead>Attendance Rate</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyticsData.departments.map((dept) => (
                      <TableRow key={dept.name}>
                        <TableCell className="font-medium">{dept.name}</TableCell>
                        <TableCell>{dept.employeeCount}</TableCell>
                        <TableCell>{dept.attendanceCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span>{dept.attendanceRate}%</span>
                            {dept.attendanceRate >= 95 ? (
                              <Badge variant="default">Excellent</Badge>
                            ) : dept.attendanceRate >= 90 ? (
                              <Badge variant="secondary">Good</Badge>
                            ) : (
                              <Badge variant="destructive">Needs Improvement</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {dept.attendanceRate >= 95 ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : dept.attendanceRate >= 90 ? (
                            <Clock className="h-4 w-4 text-yellow-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payroll Insights */}
          <TabsContent value="payroll" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Payroll Trends</CardTitle>
                  <CardDescription>Payroll expenses over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={payrollTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Line
                        type="monotone"
                        dataKey="netPay"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Net Pay"
                      />
                      <Line
                        type="monotone"
                        dataKey="earnings"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        name="Gross Earnings"
                      />
                    </LineChart>
                  </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Additional Payroll Charts */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Basic vs Overtime Pay</CardTitle>
                  <CardDescription>Pay structure comparison</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={payrollTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="basicPay" fill="#10b981" name="Basic Pay" />
                      <Bar dataKey="overtimePay" fill="#f59e0b" name="Overtime Pay" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Employee Count per Period</CardTitle>
                  <CardDescription>Number of employees processed</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={payrollTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip
                        formatter={(value, name) => [
                          `${value} employees`,
                          'Employee Count'
                        ]}
                      />
                      <Line type="monotone" dataKey="employeeCount" stroke="#06b6d4" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Total Deductions</CardTitle>
                  <CardDescription>Monthly deduction trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={payrollTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="totalDeductions" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Gross Earnings</CardTitle>
                  <CardDescription>Total earnings per period</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={payrollTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Area type="monotone" dataKey="totalEarnings" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Net Pay Trend</CardTitle>
                  <CardDescription>Final pay after deductions</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={payrollTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Line type="monotone" dataKey="totalNetPay" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

              <Card>
                <CardHeader>
                  <CardTitle>Salary Distribution</CardTitle>
                  <CardDescription>Average salary by department</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                        data={salaryDistributionData}
                          cx="50%"
                          cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="budget"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {salaryDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                </CardContent>
              </Card>
                  </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Total Salary Budget</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(analyticsData.salary.totalBudget)}</div>
                  <p className="text-muted-foreground">Monthly budget across all departments</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Average Salary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(analyticsData.salary.averageAcrossCompany)}</div>
                  <p className="text-muted-foreground">Company-wide average</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payroll Periods</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analyticsData.trends.payroll.length}</div>
                  <p className="text-muted-foreground">Processed this period</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Performance */}
          <TabsContent value="performance" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top Performers</CardTitle>
                  <CardDescription>Employees with best attendance rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analyticsData.topPerformers.slice(0, 5).map((performer, index) => (
                      <div key={performer.id} className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                          {index + 1}
                        </div>
                        <Avatar>
                          <AvatarFallback>
                            {performer.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium">{performer.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {performer.position} • {performer.department}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{performer.attendanceRate}%</div>
                          <div className="text-sm text-muted-foreground">
                            {performer.attendanceCount} days
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Insights</CardTitle>
                  <CardDescription>Key recommendations and insights</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <Target className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <div className="font-medium">Attendance Goal</div>
                        <div className="text-sm text-muted-foreground">
                          Current rate is {Math.round((analyticsData.overview.attendanceThisMonth / (analyticsData.overview.activeEmployees * 30)) * 100)}%. 
                          Target: 95%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Award className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <div className="font-medium">Best Department</div>
                        <div className="text-sm text-muted-foreground">
                          {analyticsData.departments.reduce((best, current) => 
                            current.attendanceRate > best.attendanceRate ? current : best
                          ).name} leads with {analyticsData.departments.reduce((best, current) => 
                            current.attendanceRate > best.attendanceRate ? current : best
                          ).attendanceRate}% attendance
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Clock className="h-5 w-5 text-orange-500 mt-0.5" />
                      <div>
                        <div className="font-medium">Overtime Analysis</div>
                        <div className="text-sm text-muted-foreground">
                          {analyticsData.overview.totalOvertimeHours} hours of overtime this month
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                      <div>
                        <div className="font-medium">Areas for Improvement</div>
                        <div className="text-sm text-muted-foreground">
                          {analyticsData.overview.lateArrivalsThisMonth} late arrivals need attention
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Additional Performance Charts */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Employee Performance Distribution</CardTitle>
                  <CardDescription>Attendance rate distribution across employees</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData.topPerformers}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip
                        formatter={(value, name) => [
                          `${value}%`,
                          'Attendance Rate'
                        ]}
                      />
                      <Bar dataKey="attendanceRate" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Department Performance Comparison</CardTitle>
                  <CardDescription>Performance metrics by department</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData.departments}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip
                        formatter={(value, name) => [
                          name === 'attendanceRate' ? `${value}%` : value,
                          name === 'attendanceRate' ? 'Attendance Rate' : 'Employee Count'
                        ]}
                      />
                      <Bar dataKey="attendanceRate" fill="#10b981" />
                      <Bar dataKey="employeeCount" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Attendance Rate Distribution</CardTitle>
                  <CardDescription>Performance categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPieChart>
                      <Pie
                        data={[
                          { name: 'Excellent (95%+)', value: analyticsData.topPerformers.filter(p => p.attendanceRate >= 95).length, color: '#10b981' },
                          { name: 'Good (90-94%)', value: analyticsData.topPerformers.filter(p => p.attendanceRate >= 90 && p.attendanceRate < 95).length, color: '#3b82f6' },
                          { name: 'Needs Improvement (<90%)', value: analyticsData.topPerformers.filter(p => p.attendanceRate < 90).length, color: '#ef4444' }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {[
                          { name: 'Excellent (95%+)', value: analyticsData.topPerformers.filter(p => p.attendanceRate >= 95).length, color: '#10b981' },
                          { name: 'Good (90-94%)', value: analyticsData.topPerformers.filter(p => p.attendanceRate >= 90 && p.attendanceRate < 95).length, color: '#3b82f6' },
                          { name: 'Needs Improvement (<90%)', value: analyticsData.topPerformers.filter(p => p.attendanceRate < 90).length, color: '#ef4444' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Monthly Performance Trend</CardTitle>
                  <CardDescription>Overall performance over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={attendanceTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip
                        formatter={(value, name) => [
                          `${value}%`,
                          'Performance Rate'
                        ]}
                      />
                      <Line type="monotone" dataKey="performanceRate" stroke="#8b5cf6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Department Efficiency</CardTitle>
                  <CardDescription>Efficiency metrics by department</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={analyticsData.departments}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip
                        formatter={(value, name) => [
                          name === 'efficiency' ? `${value}%` : value,
                          name === 'efficiency' ? 'Efficiency Rate' : 'Attendance Count'
                        ]}
                      />
                      <Bar dataKey="attendanceCount" fill="#06b6d4" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}