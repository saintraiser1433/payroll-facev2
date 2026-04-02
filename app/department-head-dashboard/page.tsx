"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
  Clock,
  Calendar,
  DollarSign,
  Download,
  Play,
  Square,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Users,
  Building2,
  TrendingUp,
  Eye,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Payslip } from "@/components/payslip"
import { useToast } from "@/hooks/use-toast"

interface DepartmentHeadData {
  employee: {
    id: string
    firstName: string
    lastName: string
    position: string
    attendances: Array<{
      id: string
      date: string
      timeIn: string | null
      timeOut: string | null
      status: string
      lateMinutes: number
      overtimeMinutes: number
    }>
    payrollItems: Array<{
      id: string
      basicPay: number
      netPay: number
      payrollPeriod: {
        name: string
        startDate: string
        endDate: string
        status: string
      }
    }>
    department: {
      id: string
      name: string
      employees: Array<{
        id: string
        firstName: string
        lastName: string
        position: string
        attendances: Array<{
          id: string
          date: string
          timeIn: string | null
          timeOut: string | null
          status: string
          lateMinutes: number
          overtimeMinutes: number
        }>
        payrollItems: Array<{
          id: string
          basicPay: number
          netPay: number
          payrollPeriod: {
            name: string
            startDate: string
            endDate: string
            status: string
          }
        }>
      }>
    }
  }
  departmentStats: {
    totalEmployees: number
    presentToday: number
    lateToday: number
    absentToday: number
    totalOvertime: number
  }
}

export default function DepartmentHeadDashboard() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [data, setData] = useState<DepartmentHeadData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString())
  
  // Table state for pagination, search, and sorting
  const [attendancePage, setAttendancePage] = useState(1)
  const [attendanceSearch, setAttendanceSearch] = useState("")
  const [attendanceSortField, setAttendanceSortField] = useState("date")
  const [attendanceSortDirection, setAttendanceSortDirection] = useState<"asc" | "desc">("desc")
  
  const [myAttendancePage, setMyAttendancePage] = useState(1)
  const [myAttendanceSearch, setMyAttendanceSearch] = useState("")
  const [myAttendanceSortField, setMyAttendanceSortField] = useState("date")
  const [myAttendanceSortDirection, setMyAttendanceSortDirection] = useState<"asc" | "desc">("desc")
  
  const [payrollPage, setPayrollPage] = useState(1)
  const [payrollSearch, setPayrollSearch] = useState("")
  const [payrollSortField, setPayrollSortField] = useState("name")
  const [payrollSortDirection, setPayrollSortDirection] = useState<"asc" | "desc">("asc")
  
  const [payslipsPage, setPayslipsPage] = useState(1)
  const [payslipsSearch, setPayslipsSearch] = useState("")
  const [payslipsSortField, setPayslipsSortField] = useState("name")
  const [payslipsSortDirection, setPayslipsSortDirection] = useState<"asc" | "desc">("asc")
  
  const itemsPerPage = 10
  
  // Dept Head request workflows (OT, Cash Advance, Leave)
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [pendingOvertimeRequests, setPendingOvertimeRequests] = useState<any[]>([])
  const [pendingCashAdvances, setPendingCashAdvances] = useState<any[]>([])
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState<any[]>([])

  // Attendance modal state
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null)
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false)
  const [attendanceStartDate, setAttendanceStartDate] = useState("")
  const [attendanceEndDate, setAttendanceEndDate] = useState("")
  const [filteredAttendance, setFilteredAttendance] = useState<any[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  
  // Payslip state
  const [isPayslipOpen, setIsPayslipOpen] = useState(false)
  const [payslipData, setPayslipData] = useState<any>(null)

  useEffect(() => {
    fetchDepartmentHeadData()
    fetchPendingRequests()
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchDepartmentHeadData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/department-head-dashboard')
      if (!response.ok) {
        throw new Error('Failed to fetch department head data')
      }
      const data = await response.json()
      setData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingRequests = async () => {
    try {
      setRequestsLoading(true)
      const [otRes, cashRes, leaveRes] = await Promise.all([
        fetch("/api/overtime-requests/pending"),
        fetch("/api/cash-advances/pending"),
        fetch("/api/leave-requests/pending"),
      ])

      if (otRes.ok) setPendingOvertimeRequests((await otRes.json()).requests || [])
      if (cashRes.ok) setPendingCashAdvances((await cashRes.json()).cashAdvances || [])
      if (leaveRes.ok) setPendingLeaveRequests((await leaveRes.json()).requests || [])
    } catch (err) {
      console.error("Error fetching pending requests:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load pending requests",
        variant: "destructive",
      })
    } finally {
      setRequestsLoading(false)
    }
  }

  const decideOvertimeRequest = async (id: string, decision: "APPROVE" | "REJECT", approvedMinutes?: number) => {
    try {
      const res = await fetch(`/api/overtime-requests/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          approvedMinutes: decision === "APPROVE" ? (approvedMinutes ?? 0) : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to update overtime request")

      toast({ title: "Updated", description: `Overtime request ${decision === "APPROVE" ? "approved" : "rejected"}.` })
      fetchPendingRequests()
    } catch (err) {
      console.error(err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update overtime request",
        variant: "destructive",
      })
    }
  }

  const decideCashAdvance = async (id: string, decision: "APPROVE" | "REJECT") => {
    try {
      const res = await fetch(`/api/cash-advances/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to update cash advance")

      toast({ title: "Updated", description: `Cash advance ${decision === "APPROVE" ? "approved" : "rejected"}.` })
      fetchPendingRequests()
    } catch (err) {
      console.error(err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update cash advance",
        variant: "destructive",
      })
    }
  }

  const decideLeaveRequest = async (id: string, decision: "APPROVE" | "REJECT") => {
    try {
      const res = await fetch(`/api/leave-requests/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to update leave request")

      toast({ title: "Updated", description: `Leave request ${decision === "APPROVE" ? "approved" : "rejected"}.` })
      fetchPendingRequests()
    } catch (err) {
      console.error(err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update leave request",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PRESENT":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3 mr-1" />
            Present
          </Badge>
        )
      case "LATE":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Late
          </Badge>
        )
      case "OVERTIME":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            <Clock className="w-3 h-3 mr-1" />
            Overtime
          </Badge>
        )
      case "ABSENT":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-700">
            <XCircle className="w-3 h-3 mr-1" />
            Absent
          </Badge>
        )
      default:
        return null
    }
  }

  const formatTime = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }

  // Helper functions for table operations
  const handleSort = (field: string, setSortField: (field: string) => void, setSortDirection: (direction: "asc" | "desc") => void, currentField: string, currentDirection: "asc" | "desc") => {
    if (currentField === field) {
      setSortDirection(currentDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const getSortIcon = (field: string, currentField: string, currentDirection: "asc" | "desc") => {
    if (currentField !== field) return null
    return currentDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
  }

  const filterAndSortData = (data: any[], searchTerm: string, sortField: string, sortDirection: "asc" | "desc") => {
    let filtered = data
    
    if (searchTerm) {
      filtered = data.filter(item => 
        Object.values(item).some(value => 
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    }
    
    filtered.sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })
    
    return filtered
  }

  const paginateData = (data: any[], page: number, itemsPerPage: number) => {
    const startIndex = (page - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return {
      paginatedData: data.slice(startIndex, endIndex),
      totalPages: Math.ceil(data.length / itemsPerPage),
      totalItems: data.length
    }
  }

  // Attendance modal functions
  const openAttendanceModal = (employee: any) => {
    setSelectedEmployee(employee)
    setAttendanceModalOpen(true)
    // Set default date range (last 30 days)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)
    
    setAttendanceEndDate(endDate.toISOString().split('T')[0])
    setAttendanceStartDate(startDate.toISOString().split('T')[0])
    
    // Load initial attendance data
    filterEmployeeAttendance(employee, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0])
  }

  const filterEmployeeAttendance = async (employee: any, startDate: string, endDate: string) => {
    if (!employee || !startDate || !endDate) return
    
    setAttendanceLoading(true)
    try {
      // Filter the employee's attendance based on date range
      const filtered = employee.attendances.filter((att: any) => {
        const attDate = new Date(att.date)
        const start = new Date(startDate)
        const end = new Date(endDate)
        return attDate >= start && attDate <= end
      })
      
      setFilteredAttendance(filtered)
    } catch (error) {
      console.error('Error filtering attendance:', error)
    } finally {
      setAttendanceLoading(false)
    }
  }

  const handleDateRangeChange = () => {
    if (selectedEmployee && attendanceStartDate && attendanceEndDate) {
      filterEmployeeAttendance(selectedEmployee, attendanceStartDate, attendanceEndDate)
    }
  }

  // Payslip generation function
  const handleGeneratePayslip = async (payrollItem: any) => {
    if (!payrollItem || !payrollItem.id) {
      toast({
        title: "Error",
        description: "Invalid payroll item",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch('/api/payroll/generate-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payrollItemId: payrollItem.id })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate payslip')
      }

      const data = await response.json()
      setPayslipData(data.payslipData)
      setIsPayslipOpen(true)
      
      toast({
        title: "Success",
        description: `Payslip generated for ${payrollItem?.payrollPeriod?.name || 'payroll period'}`,
      })
    } catch (error) {
      console.error('Error generating payslip:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate payslip",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-80" />
            </div>
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
              <Button onClick={fetchDepartmentHeadData}>Try Again</Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>No Data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">No data available. Please try again.</p>
              <Button onClick={fetchDepartmentHeadData}>Refresh</Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome back, {data.employee.firstName}!
          </h1>
          <p className="text-gray-600 mt-1">
            Department Head Dashboard - {data.employee.department.name}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Department Size</p>
                  <p className="text-2xl font-bold text-gray-900">{data.departmentStats.totalEmployees}</p>
                  <p className="text-xs text-gray-500">Total Employees</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Present Today</p>
                  <p className="text-2xl font-bold text-gray-900">{data.departmentStats.presentToday}</p>
                  <p className="text-xs text-gray-500">Out of {data.departmentStats.totalEmployees}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Late Today</p>
                  <p className="text-2xl font-bold text-gray-900">{data.departmentStats.lateToday}</p>
                  <p className="text-xs text-gray-500">Employees</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Overtime</p>
                  <p className="text-2xl font-bold text-gray-900">{data.departmentStats.totalOvertime}h</p>
                  <p className="text-xs text-gray-500">This Month</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="attendance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="attendance">Department Attendance</TabsTrigger>
            <TabsTrigger value="my-attendance">My Attendance</TabsTrigger>
            <TabsTrigger value="payroll">Department Payroll</TabsTrigger>
            <TabsTrigger value="my-payslips">My Payslips</TabsTrigger>
          </TabsList>

          {/* Department Attendance Tab */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>Department Employees</CardTitle>
                <CardDescription>
                  Manage attendance for all department members
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Search and Filters */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search employees..."
                      value={attendanceSearch}
                      onChange={(e) => setAttendanceSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("name", setAttendanceSortField, setAttendanceSortDirection, attendanceSortField, attendanceSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Employee
                            {getSortIcon("name", attendanceSortField, attendanceSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("position", setAttendanceSortField, setAttendanceSortDirection, attendanceSortField, attendanceSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Position
                            {getSortIcon("position", attendanceSortField, attendanceSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("totalAttendance", setAttendanceSortField, setAttendanceSortDirection, attendanceSortField, attendanceSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Total Attendance
                            {getSortIcon("totalAttendance", attendanceSortField, attendanceSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("lastAttendance", setAttendanceSortField, setAttendanceSortDirection, attendanceSortField, attendanceSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Last Attendance
                            {getSortIcon("lastAttendance", attendanceSortField, attendanceSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const employeeData = data.employee.department.employees.map((emp) => {
                          const totalAttendance = emp.attendances.length
                          const lastAttendance = emp.attendances.length > 0 ? emp.attendances[0] : null
                          
                          return {
                            id: emp.id,
                            name: `${emp.firstName} ${emp.lastName}`,
                            position: emp.position,
                            totalAttendance: totalAttendance,
                            lastAttendance: lastAttendance?.date || null,
                            firstName: emp.firstName,
                            lastName: emp.lastName,
                            employee: emp // Store full employee object for modal
                          }
                        })
                        
                        const filteredAndSorted = filterAndSortData(employeeData, attendanceSearch, attendanceSortField, attendanceSortDirection)
                        const { paginatedData, totalPages, totalItems } = paginateData(filteredAndSorted, attendancePage, itemsPerPage)
                        
                        return paginatedData.map((emp) => (
                          <TableRow key={emp.id}>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>
                                    {emp.firstName[0]}{emp.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{emp.name}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{emp.position}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                {emp.totalAttendance} records
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {emp.lastAttendance ? (
                                <span className="text-sm text-muted-foreground">
                                  {new Date(emp.lastAttendance).toLocaleDateString()}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">No records</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => openAttendanceModal(emp.employee)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View Attendance
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      })()}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="text-sm text-muted-foreground">
                      Showing {((attendancePage - 1) * itemsPerPage) + 1} to {Math.min(attendancePage * itemsPerPage, data.employee.department.employees.length)} of {data.employee.department.employees.length} entries
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAttendancePage(attendancePage - 1)}
                        disabled={attendancePage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {attendancePage} of {Math.ceil(data.employee.department.employees.length / itemsPerPage)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAttendancePage(attendancePage + 1)}
                        disabled={attendancePage >= Math.ceil(data.employee.department.employees.length / itemsPerPage)}
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Attendance Tab */}
          <TabsContent value="my-attendance">
            <Card>
              <CardHeader>
                <CardTitle>My Attendance History</CardTitle>
                <CardDescription>
                  Your personal attendance records
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Search and Filters */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search attendance records..."
                      value={myAttendanceSearch}
                      onChange={(e) => setMyAttendanceSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("date", setMyAttendanceSortField, setMyAttendanceSortDirection, myAttendanceSortField, myAttendanceSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Date
                            {getSortIcon("date", myAttendanceSortField, myAttendanceSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("timeIn", setMyAttendanceSortField, setMyAttendanceSortDirection, myAttendanceSortField, myAttendanceSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Time In
                            {getSortIcon("timeIn", myAttendanceSortField, myAttendanceSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("timeOut", setMyAttendanceSortField, setMyAttendanceSortDirection, myAttendanceSortField, myAttendanceSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Time Out
                            {getSortIcon("timeOut", myAttendanceSortField, myAttendanceSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("status", setMyAttendanceSortField, setMyAttendanceSortDirection, myAttendanceSortField, myAttendanceSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Status
                            {getSortIcon("status", myAttendanceSortField, myAttendanceSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("lateMinutes", setMyAttendanceSortField, setMyAttendanceSortDirection, myAttendanceSortField, myAttendanceSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Late Minutes
                            {getSortIcon("lateMinutes", myAttendanceSortField, myAttendanceSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("overtimeMinutes", setMyAttendanceSortField, setMyAttendanceSortDirection, myAttendanceSortField, myAttendanceSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Overtime
                            {getSortIcon("overtimeMinutes", myAttendanceSortField, myAttendanceSortDirection)}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const attendanceData = data?.employee?.attendances?.map((attendance) => ({
                          id: attendance.id,
                          date: attendance.date,
                          timeIn: attendance.timeIn,
                          timeOut: attendance.timeOut,
                          status: attendance.status,
                          lateMinutes: attendance.lateMinutes,
                          overtimeMinutes: attendance.overtimeMinutes
                        })) || []
                        
                        const filteredAndSorted = filterAndSortData(attendanceData, myAttendanceSearch, myAttendanceSortField, myAttendanceSortDirection)
                        const { paginatedData, totalPages, totalItems } = paginateData(filteredAndSorted, myAttendancePage, itemsPerPage)
                        
                        return paginatedData.map((attendance) => (
                          <TableRow key={attendance.id}>
                            <TableCell className="font-mono text-sm">
                              {new Date(attendance.date).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{formatTime(attendance.timeIn)}</TableCell>
                            <TableCell className="font-mono text-sm">{formatTime(attendance.timeOut)}</TableCell>
                            <TableCell>{getStatusBadge(attendance.status)}</TableCell>
                            <TableCell className="font-medium">{attendance.lateMinutes}m</TableCell>
                            <TableCell className="font-medium">{attendance.overtimeMinutes}m</TableCell>
                          </TableRow>
                        ))
                      })()}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="text-sm text-muted-foreground">
                      Showing {((myAttendancePage - 1) * itemsPerPage) + 1} to {Math.min(myAttendancePage * itemsPerPage, data?.employee?.attendances?.length || 0)} of {data?.employee?.attendances?.length || 0} entries
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMyAttendancePage(myAttendancePage - 1)}
                        disabled={myAttendancePage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {myAttendancePage} of {Math.ceil((data?.employee?.attendances?.length || 0) / itemsPerPage)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMyAttendancePage(myAttendancePage + 1)}
                        disabled={myAttendancePage >= Math.ceil((data?.employee?.attendances?.length || 0) / itemsPerPage)}
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Department Payroll Tab */}
          <TabsContent value="payroll">
            <Card>
              <CardHeader>
                <CardTitle>Department Payroll Overview</CardTitle>
                <CardDescription>
                  Payroll summary for department members
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Search and Filters */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search employees..."
                      value={payrollSearch}
                      onChange={(e) => setPayrollSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("name", setPayrollSortField, setPayrollSortDirection, payrollSortField, payrollSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Employee
                            {getSortIcon("name", payrollSortField, payrollSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("position", setPayrollSortField, setPayrollSortDirection, payrollSortField, payrollSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Position
                            {getSortIcon("position", payrollSortField, payrollSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("basicPay", setPayrollSortField, setPayrollSortDirection, payrollSortField, payrollSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Basic Pay
                            {getSortIcon("basicPay", payrollSortField, payrollSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("netPay", setPayrollSortField, setPayrollSortDirection, payrollSortField, payrollSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Net Pay
                            {getSortIcon("netPay", payrollSortField, payrollSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("period", setPayrollSortField, setPayrollSortDirection, payrollSortField, payrollSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Period
                            {getSortIcon("period", payrollSortField, payrollSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("status", setPayrollSortField, setPayrollSortDirection, payrollSortField, payrollSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Status
                            {getSortIcon("status", payrollSortField, payrollSortDirection)}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const payrollData = data.employee.department.employees.map((emp) => {
                          const latestPayroll = emp.payrollItems[0]
                          return {
                            id: emp.id,
                            name: `${emp.firstName} ${emp.lastName}`,
                            position: emp.position,
                            basicPay: latestPayroll?.basicPay || 0,
                            netPay: latestPayroll?.netPay || 0,
                            period: latestPayroll?.payrollPeriod.name || 'N/A',
                            status: latestPayroll?.payrollPeriod.status || 'N/A',
                            firstName: emp.firstName,
                            lastName: emp.lastName
                          }
                        })
                        
                        const filteredAndSorted = filterAndSortData(payrollData, payrollSearch, payrollSortField, payrollSortDirection)
                        const { paginatedData, totalPages, totalItems } = paginateData(filteredAndSorted, payrollPage, itemsPerPage)
                        
                        return paginatedData.map((emp) => (
                          <TableRow key={emp.id}>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>
                                    {emp.firstName[0]}{emp.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{emp.name}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{emp.position}</TableCell>
                            <TableCell>{formatCurrency(emp.basicPay)}</TableCell>
                            <TableCell className="font-medium text-green-600">
                              {formatCurrency(emp.netPay)}
                            </TableCell>
                            <TableCell>{emp.period}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-green-100 text-green-700">
                                {emp.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      })()}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="text-sm text-muted-foreground">
                      Showing {((payrollPage - 1) * itemsPerPage) + 1} to {Math.min(payrollPage * itemsPerPage, data.employee.department.employees.length)} of {data.employee.department.employees.length} entries
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPayrollPage(payrollPage - 1)}
                        disabled={payrollPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {payrollPage} of {Math.ceil(data.employee.department.employees.length / itemsPerPage)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPayrollPage(payrollPage + 1)}
                        disabled={payrollPage >= Math.ceil(data.employee.department.employees.length / itemsPerPage)}
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Payslips Tab */}
          <TabsContent value="my-payslips">
            <Card>
              <CardHeader>
                <CardTitle>My Payslips</CardTitle>
                <CardDescription>
                  Download your personal payslips
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Search and Filters */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search payslips..."
                      value={payslipsSearch}
                      onChange={(e) => setPayslipsSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("period", setPayslipsSortField, setPayslipsSortDirection, payslipsSortField, payslipsSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Period
                            {getSortIcon("period", payslipsSortField, payslipsSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("basicPay", setPayslipsSortField, setPayslipsSortDirection, payslipsSortField, payslipsSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Basic Pay
                            {getSortIcon("basicPay", payslipsSortField, payslipsSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("netPay", setPayslipsSortField, setPayslipsSortDirection, payslipsSortField, payslipsSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Net Pay
                            {getSortIcon("netPay", payslipsSortField, payslipsSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("status", setPayslipsSortField, setPayslipsSortDirection, payslipsSortField, payslipsSortDirection)}
                        >
                          <div className="flex items-center gap-2">
                            Status
                            {getSortIcon("status", payslipsSortField, payslipsSortDirection)}
                          </div>
                        </TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const payslipsData = data?.employee?.payrollItems?.map((payroll) => ({
                          id: payroll.id,
                          period: payroll.payrollPeriod.name,
                          basicPay: payroll.basicPay,
                          netPay: payroll.netPay,
                          status: payroll.payrollPeriod.status,
                          originalPayroll: payroll // Store original payroll item for payslip generation
                        })) || []
                        
                        const filteredAndSorted = filterAndSortData(payslipsData, payslipsSearch, payslipsSortField, payslipsSortDirection)
                        const { paginatedData, totalPages, totalItems } = paginateData(filteredAndSorted, payslipsPage, itemsPerPage)
                        
                        return paginatedData.map((payroll) => (
                          <TableRow key={payroll.id}>
                            <TableCell className="font-medium">{payroll.period}</TableCell>
                            <TableCell>{formatCurrency(payroll.basicPay)}</TableCell>
                            <TableCell className="font-medium text-green-600">
                              {formatCurrency(payroll.netPay)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-green-100 text-green-700">
                                {payroll.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleGeneratePayslip(payroll.originalPayroll)}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                PDF
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      })()}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="text-sm text-muted-foreground">
                      Showing {((payslipsPage - 1) * itemsPerPage) + 1} to {Math.min(payslipsPage * itemsPerPage, data?.employee?.payrollItems?.length || 0)} of {data?.employee?.payrollItems?.length || 0} entries
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPayslipsPage(payslipsPage - 1)}
                        disabled={payslipsPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {payslipsPage} of {Math.ceil((data?.employee?.payrollItems?.length || 0) / itemsPerPage)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPayslipsPage(payslipsPage + 1)}
                        disabled={payslipsPage >= Math.ceil((data?.employee?.payrollItems?.length || 0) / itemsPerPage)}
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Request Management (OT, Cash Advance, Leave) */}
      <div className="mt-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Overtime Requests</CardTitle>
            <CardDescription>Approve or reject employee overtime applications</CardDescription>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : pendingOvertimeRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending overtime requests.</p>
            ) : (
              <div className="space-y-3">
                {pendingOvertimeRequests.map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-4 rounded-md border p-3">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {r.employee.firstName} {r.employee.lastName} - {r.employee.position}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(r.requestDate).toLocaleDateString()} • {r.requestedMinutes} minutes
                      </p>
                      {r.reason && <p className="text-xs">{r.reason}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => decideOvertimeRequest(r.id, "APPROVE", r.requestedMinutes)}
                        disabled={requestsLoading}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decideOvertimeRequest(r.id, "REJECT")}
                        disabled={requestsLoading}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash Advance Requests</CardTitle>
            <CardDescription>Approve or reject cash advance applications</CardDescription>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : pendingCashAdvances.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending cash advance requests.</p>
            ) : (
              <div className="space-y-3">
                {pendingCashAdvances.map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-4 rounded-md border p-3">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {r.employee.firstName} {r.employee.lastName} - {r.employee.position}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(r.dateIssued).toLocaleDateString()} • {formatCurrency(r.amount)}
                      </p>
                      {r.reason && <p className="text-xs">{r.reason}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decideCashAdvance(r.id, "APPROVE")} disabled={requestsLoading}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => decideCashAdvance(r.id, "REJECT")} disabled={requestsLoading}>
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave Requests</CardTitle>
            <CardDescription>Approve or reject leave applications (with attachments)</CardDescription>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : pendingLeaveRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending leave requests.</p>
            ) : (
              <div className="space-y-3">
                {pendingLeaveRequests.map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-4 rounded-md border p-3">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {r.employee.firstName} {r.employee.lastName} - {r.employee.position}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(r.startDate).toLocaleDateString()} - {new Date(r.endDate).toLocaleDateString()}
                      </p>
                      {r.reason && <p className="text-xs">{r.reason}</p>}
                      {r.attachmentPath && (
                        <a
                          href={r.attachmentPath}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-700 underline break-all"
                        >
                          View Attachment
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decideLeaveRequest(r.id, "APPROVE")} disabled={requestsLoading}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => decideLeaveRequest(r.id, "REJECT")} disabled={requestsLoading}>
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attendance Modal */}
      <Dialog open={attendanceModalOpen} onOpenChange={setAttendanceModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Attendance Records - {selectedEmployee?.firstName} {selectedEmployee?.lastName}
            </DialogTitle>
            <DialogDescription>
              View and filter attendance records for this employee
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Date Range Filter */}
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Date Range:</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={attendanceStartDate}
                  onChange={(e) => setAttendanceStartDate(e.target.value)}
                  className="w-40"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={attendanceEndDate}
                  onChange={(e) => setAttendanceEndDate(e.target.value)}
                  className="w-40"
                />
                <Button 
                  onClick={handleDateRangeChange}
                  size="sm"
                  disabled={attendanceLoading}
                >
                  <Filter className="w-4 h-4 mr-1" />
                  Filter
                </Button>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Time Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Late Minutes</TableHead>
                    <TableHead>Overtime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          Loading attendance records...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredAttendance.length > 0 ? (
                    filteredAttendance.map((attendance) => (
                      <TableRow key={attendance.id}>
                        <TableCell className="font-mono text-sm">
                          {new Date(attendance.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatTime(attendance.timeIn)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatTime(attendance.timeOut)}
                        </TableCell>
                        <TableCell>{getStatusBadge(attendance.status)}</TableCell>
                        <TableCell className="font-medium">
                          {attendance.lateMinutes}m
                        </TableCell>
                        <TableCell className="font-medium">
                          {attendance.overtimeMinutes}m
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No attendance records found for the selected date range
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Summary Stats */}
            {filteredAttendance.length > 0 && (
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {filteredAttendance.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Records</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {filteredAttendance.filter(att => att.status === 'PRESENT').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Present Days</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {filteredAttendance.filter(att => att.status === 'LATE').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Late Days</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {filteredAttendance.filter(att => att.status === 'ABSENT').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Absent Days</div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payslip Modal */}
      {payslipData && (
        <Payslip
          isOpen={isPayslipOpen}
          onClose={() => {
            setIsPayslipOpen(false)
            setPayslipData(null)
          }}
          payslipData={payslipData}
        />
      )}
    </DashboardLayout>
  )
}
