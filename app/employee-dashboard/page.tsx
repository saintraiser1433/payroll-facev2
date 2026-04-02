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
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { Payslip } from "@/components/payslip"
import { useToast } from "@/hooks/use-toast"
import { Calendar as CalendarUI } from "@/components/ui/calendar"

interface EmployeeData {
  employee: {
    id: string
    firstName: string
    lastName: string
    position: string
    department: {
      name: string
    }
    schedule: {
      id: string
      name: string
      timeIn: string
      timeOut: string
      workingDays: string
    } | null
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
        status: string
      }
    }>
  }
  stats: {
    presentThisMonth: number
    totalHours: number
    overtimeHours: number
    lastNetPay: number
  }
}

export default function EmployeeDashboard() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [data, setData] = useState<EmployeeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString())
  
  // Table state for pagination, search, and sorting
  const [attendancePage, setAttendancePage] = useState(1)
  const [attendanceSearch, setAttendanceSearch] = useState("")
  const [attendanceSortField, setAttendanceSortField] = useState("date")
  const [attendanceSortDirection, setAttendanceSortDirection] = useState<"asc" | "desc">("desc")
  
  // Date filter state for attendance
  const [attendanceStartDate, setAttendanceStartDate] = useState("")
  const [attendanceEndDate, setAttendanceEndDate] = useState("")
  
  const [payrollPage, setPayrollPage] = useState(1)
  const [payrollSearch, setPayrollSearch] = useState("")
  const [payrollSortField, setPayrollSortField] = useState("period")
  const [payrollSortDirection, setPayrollSortDirection] = useState<"asc" | "desc">("desc")
  
  // Payslip state
  const [isPayslipOpen, setIsPayslipOpen] = useState(false)
  const [payslipData, setPayslipData] = useState<any>(null)
  
  const itemsPerPage = 10

  // Request workflow (OT, Cash Advance, Leave)
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [overtimeRequests, setOvertimeRequests] = useState<any[]>([])
  const [cashAdvances, setCashAdvances] = useState<any[]>([])
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])

  const [otRequestDate, setOtRequestDate] = useState("")
  const [otRequestedMinutes, setOtRequestedMinutes] = useState<number>(60)
  const [otReason, setOtReason] = useState("")

  const [cashAdvanceDateIssued, setCashAdvanceDateIssued] = useState<string>(
    new Date().toISOString().slice(0, 10),
  )
  const [cashAdvanceAmount, setCashAdvanceAmount] = useState<number>(0)
  const [cashAdvanceReason, setCashAdvanceReason] = useState("")

  const [leaveStartDate, setLeaveStartDate] = useState("")
  const [leaveEndDate, setLeaveEndDate] = useState("")
  const [leaveReason, setLeaveReason] = useState("")
  const [leaveAttachment, setLeaveAttachment] = useState<File | null>(null)

  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date())

  useEffect(() => {
    fetchEmployeeData()
    fetchMyRequests()
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchEmployeeData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/employee-dashboard')
      if (!response.ok) {
        throw new Error('Failed to fetch employee data')
      }
      const data = await response.json()
      setData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchMyRequests = async () => {
    try {
      setRequestsLoading(true)
      const [otRes, cashRes, leaveRes] = await Promise.all([
        fetch("/api/overtime-requests/my"),
        fetch("/api/cash-advances/my"),
        fetch("/api/leave-requests/my"),
      ])

      if (otRes.ok) setOvertimeRequests((await otRes.json()).requests || [])
      if (cashRes.ok) setCashAdvances((await cashRes.json()).cashAdvances || [])
      if (leaveRes.ok) setLeaveRequests((await leaveRes.json()).requests || [])
    } catch (err) {
      console.error("Error fetching my requests:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load requests",
        variant: "destructive",
      })
    } finally {
      setRequestsLoading(false)
    }
  }

  const handleSubmitOvertime = async () => {
    try {
      if (!otRequestDate) {
        toast({ title: "Error", description: "Please select request date.", variant: "destructive" })
        return
      }
      if (!otRequestedMinutes || otRequestedMinutes <= 0) {
        toast({ title: "Error", description: "Please enter requested minutes.", variant: "destructive" })
        return
      }

      const res = await fetch("/api/overtime-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestDate: otRequestDate,
          requestedMinutes: otRequestedMinutes,
          reason: otReason || null,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to submit overtime request")

      toast({ title: "Submitted", description: "Overtime request sent to Dept Head." })
      setOtRequestDate("")
      setOtRequestedMinutes(60)
      setOtReason("")
      fetchMyRequests()
    } catch (err) {
      console.error(err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit overtime request",
        variant: "destructive",
      })
    }
  }

  const handleSubmitCashAdvance = async () => {
    try {
      if (!cashAdvanceAmount || cashAdvanceAmount <= 0) {
        toast({ title: "Error", description: "Please enter amount.", variant: "destructive" })
        return
      }

      const res = await fetch("/api/cash-advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: cashAdvanceAmount,
          dateIssued: cashAdvanceDateIssued,
          reason: cashAdvanceReason || null,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to submit cash advance request")

      toast({ title: "Submitted", description: "Cash advance request sent to Dept Head." })
      setCashAdvanceAmount(0)
      setCashAdvanceReason("")
      setCashAdvanceDateIssued(new Date().toISOString().slice(0, 10))
      fetchMyRequests()
    } catch (err) {
      console.error(err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit cash advance request",
        variant: "destructive",
      })
    }
  }

  const handleSubmitLeave = async () => {
    try {
      if (!leaveStartDate || !leaveEndDate) {
        toast({ title: "Error", description: "Please select start/end date.", variant: "destructive" })
        return
      }

      const formData = new FormData()
      formData.append("startDate", leaveStartDate)
      formData.append("endDate", leaveEndDate)
      formData.append("reason", leaveReason || "")
      if (leaveAttachment) formData.append("attachment", leaveAttachment)

      const res = await fetch("/api/leave-requests", { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to submit leave request")

      toast({ title: "Submitted", description: "Leave request sent to Dept Head." })
      setLeaveStartDate("")
      setLeaveEndDate("")
      setLeaveReason("")
      setLeaveAttachment(null)
      fetchMyRequests()
    } catch (err) {
      console.error(err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit leave request",
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

  // Helper function to get attendance pagination data
  const getAttendancePaginationData = () => {
    if (!data?.employee?.attendances) {
      return { paginatedData: [], totalPages: 0, totalItems: 0 }
    }

    const attendanceData = data.employee.attendances.map((record) => ({
      id: record.id,
      date: record.date,
      timeIn: record.timeIn,
      timeOut: record.timeOut,
      status: record.status,
      hours: record.timeIn && record.timeOut 
        ? Math.round((new Date(record.timeOut).getTime() - new Date(record.timeIn).getTime()) / (1000 * 60 * 60) * 10) / 10
        : 0
    }))

    // Apply date range filter
    let filteredAttendanceData = attendanceData
    if (attendanceStartDate || attendanceEndDate) {
      filteredAttendanceData = attendanceData.filter((record) => {
        const recordDate = new Date(record.date)
        const startDate = attendanceStartDate ? new Date(attendanceStartDate) : null
        const endDate = attendanceEndDate ? new Date(attendanceEndDate) : null
        
        if (startDate && endDate) {
          return recordDate >= startDate && recordDate <= endDate
        } else if (startDate) {
          return recordDate >= startDate
        } else if (endDate) {
          return recordDate <= endDate
        }
        return true
      })
    }

    const filteredAndSorted = filterAndSortData(filteredAttendanceData, attendanceSearch, attendanceSortField, attendanceSortDirection)
    return paginateData(filteredAndSorted, attendancePage, itemsPerPage)
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
              <Button onClick={fetchEmployeeData}>Try Again</Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  if (!data) return null

  const scheduleWorkingDaysCsv = data.employee.schedule?.workingDays || "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY"
  const workingDayNames = scheduleWorkingDaysCsv.split(",").map((d) => d.trim().toUpperCase())
  const dayNameByIndex: Record<number, string> = {
    0: "SUNDAY",
    1: "MONDAY",
    2: "TUESDAY",
    3: "WEDNESDAY",
    4: "THURSDAY",
    5: "FRIDAY",
    6: "SATURDAY",
  }

  const monthAnchor = calendarDate ?? new Date()
  const monthStart = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1)
  const monthEnd = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0)

  const workingShiftDates: Date[] = []
  for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
    const dayName = dayNameByIndex[d.getDay()]
    if (workingDayNames.includes(dayName)) workingShiftDates.push(new Date(d))
  }

  // Highlight approved leave days on the calendar.
  const approvedLeaveDates: Date[] = []
  for (const leave of leaveRequests) {
    if (leave?.status !== "APPROVED") continue
    const leaveStart = new Date(leave.startDate)
    const leaveEnd = new Date(leave.endDate)
    for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === monthAnchor.getFullYear() && d.getMonth() === monthAnchor.getMonth()) {
        const dayName = dayNameByIndex[d.getDay()]
        // Only highlight on working days so it directly affects payroll deductions.
        if (workingDayNames.includes(dayName)) approvedLeaveDates.push(new Date(d))
      }
    }
  }

  const selectedDayRecord = data.employee.attendances.find((a) => {
    const day = new Date(a.date)
    return calendarDate ? day.toDateString() === calendarDate.toDateString() : false
  })

  return (
    <DashboardLayout>
      <div>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome back, {data.employee.firstName}!
          </h1>
          <p className="text-gray-600 mt-1">
            {data.employee.position} - {data.employee.department.name}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">This Month</p>
                  <p className="text-2xl font-bold text-gray-900">{data.stats.presentThisMonth}</p>
                  <p className="text-xs text-gray-500">Days Present</p>
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
                  <p className="text-sm font-medium text-gray-600">Total Hours</p>
                  <p className="text-2xl font-bold text-gray-900">{data.stats.totalHours}</p>
                  <p className="text-xs text-gray-500">This Month</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Overtime</p>
                  <p className="text-2xl font-bold text-gray-900">{data.stats.overtimeHours}h</p>
                  <p className="text-xs text-gray-500">This Month</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Net Pay</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.stats.lastNetPay)}</p>
                  <p className="text-xs text-gray-500">Last Month</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* My Attendance */}
          <Card>
            <CardHeader>
              <CardTitle>My Attendance</CardTitle>
              <CardDescription>Your attendance history for the past week</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filters */}
              <div className="space-y-4 mb-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search attendance records..."
                      value={attendanceSearch}
                      onChange={(e) => setAttendanceSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                {/* Date Range Filter */}
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" />
                    <span className="text-sm font-medium">Date Range:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={attendanceStartDate}
                      onChange={(e) => setAttendanceStartDate(e.target.value)}
                      className="w-40"
                      placeholder="Start Date"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="date"
                      value={attendanceEndDate}
                      onChange={(e) => setAttendanceEndDate(e.target.value)}
                      className="w-40"
                      placeholder="End Date"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAttendanceStartDate("")
                        setAttendanceEndDate("")
                      }}
                    >
                      <Filter className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("date", setAttendanceSortField, setAttendanceSortDirection, attendanceSortField, attendanceSortDirection)}
                      >
                        <div className="flex items-center gap-2">
                          Date
                          {getSortIcon("date", attendanceSortField, attendanceSortDirection)}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("timeIn", setAttendanceSortField, setAttendanceSortDirection, attendanceSortField, attendanceSortDirection)}
                      >
                        <div className="flex items-center gap-2">
                          Time In
                          {getSortIcon("timeIn", attendanceSortField, attendanceSortDirection)}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("timeOut", setAttendanceSortField, setAttendanceSortDirection, attendanceSortField, attendanceSortDirection)}
                      >
                        <div className="flex items-center gap-2">
                          Time Out
                          {getSortIcon("timeOut", attendanceSortField, attendanceSortDirection)}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("status", setAttendanceSortField, setAttendanceSortDirection, attendanceSortField, attendanceSortDirection)}
                      >
                        <div className="flex items-center gap-2">
                          Status
                          {getSortIcon("status", attendanceSortField, attendanceSortDirection)}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("hours", setAttendanceSortField, setAttendanceSortDirection, attendanceSortField, attendanceSortDirection)}
                      >
                        <div className="flex items-center gap-2">
                          Hours
                          {getSortIcon("hours", attendanceSortField, attendanceSortDirection)}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const { paginatedData } = getAttendancePaginationData()
                      
                      return paginatedData.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-mono text-sm">
                            {new Date(record.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{formatTime(record.timeIn)}</TableCell>
                          <TableCell className="font-mono text-sm">{formatTime(record.timeOut)}</TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell className="font-medium">
                            {record.hours > 0 ? `${record.hours}h` : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))
                    })()}
                  </TableBody>
                </Table>
                
                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    {(() => {
                      const { totalItems } = getAttendancePaginationData()
                      return `Showing ${((attendancePage - 1) * itemsPerPage) + 1} to ${Math.min(attendancePage * itemsPerPage, totalItems)} of ${totalItems} entries`
                    })()}
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
                      {(() => {
                        const { totalPages } = getAttendancePaginationData()
                        return `Page ${attendancePage} of ${totalPages}`
                      })()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAttendancePage(attendancePage + 1)}
                      disabled={(() => {
                        const { totalPages } = getAttendancePaginationData()
                        return attendancePage >= totalPages
                      })()}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* My Payslips */}
          <Card>
            <CardHeader>
              <CardTitle>My Payslips</CardTitle>
              <CardDescription>Download your recent payslips</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filters */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search payslips..."
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
                        onClick={() => handleSort("period", setPayrollSortField, setPayrollSortDirection, payrollSortField, payrollSortDirection)}
                      >
                        <div className="flex items-center gap-2">
                          Period
                          {getSortIcon("period", payrollSortField, payrollSortDirection)}
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
                        onClick={() => handleSort("status", setPayrollSortField, setPayrollSortDirection, payrollSortField, payrollSortDirection)}
                      >
                        <div className="flex items-center gap-2">
                          Status
                          {getSortIcon("status", payrollSortField, payrollSortDirection)}
                        </div>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const payrollData = data.employee.payrollItems.map((payslip) => ({
                        id: payslip.id,
                        period: payslip.payrollPeriod.name,
                        basicPay: payslip.basicPay,
                        netPay: payslip.netPay,
                        status: payslip.payrollPeriod.status,
                        originalPayroll: payslip // Store original payroll item for payslip generation
                      }))
                      
                      const filteredAndSorted = filterAndSortData(payrollData, payrollSearch, payrollSortField, payrollSortDirection)
                      const { paginatedData, totalPages, totalItems } = paginateData(filteredAndSorted, payrollPage, itemsPerPage)
                      
                      return paginatedData.map((payslip) => (
                        <TableRow key={payslip.id}>
                          <TableCell className="font-medium">{payslip.period}</TableCell>
                          <TableCell>{formatCurrency(payslip.basicPay)}</TableCell>
                          <TableCell className="font-medium text-green-600">
                            {formatCurrency(payslip.netPay)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              {payslip.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleGeneratePayslip(payslip.originalPayroll)}
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
                    Showing {((payrollPage - 1) * itemsPerPage) + 1} to {Math.min(payrollPage * itemsPerPage, data.employee.payrollItems.length)} of {data.employee.payrollItems.length} entries
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
                      Page {payrollPage} of {Math.ceil(data.employee.payrollItems.length / itemsPerPage)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPayrollPage(payrollPage + 1)}
                      disabled={payrollPage >= Math.ceil(data.employee.payrollItems.length / itemsPerPage)}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* My Requests */}
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>My Requests</CardTitle>
              <CardDescription>Overtime, Cash Advance, and Leave applications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="font-semibold">Calendar</p>
                      <p className="text-sm text-muted-foreground">Working days and approved leave</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {monthAnchor.toLocaleString("default", { month: "long", year: "numeric" })}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <CalendarUI
                        mode="single"
                        selected={calendarDate}
                        onSelect={(d) => setCalendarDate(d)}
                        modifiers={{
                          workingShift: workingShiftDates,
                          approvedLeave: approvedLeaveDates,
                        }}
                        modifiersClassNames={{
                          workingShift: "bg-primary/10 text-foreground",
                          approvedLeave: "bg-red-500 text-white",
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Selected Day</p>
                      <p className="text-sm text-muted-foreground">
                        {calendarDate ? calendarDate.toDateString() : "-"}
                      </p>

                      {calendarDate ? (
                        dayNameByIndex[calendarDate.getDay()] && workingDayNames.includes(dayNameByIndex[calendarDate.getDay()]) && data.employee.schedule ? (
                          <p className="text-xs">
                            Shift: <span className="font-medium">{data.employee.schedule.timeIn}</span> -{" "}
                            <span className="font-medium">{data.employee.schedule.timeOut}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">No shift scheduled</p>
                        )
                      ) : null}

                      {selectedDayRecord ? (
                        <div className="pt-2 space-y-1">
                          <p className="text-xs font-medium">DTR</p>
                          <p className="text-xs text-muted-foreground">
                            In: {formatTime(selectedDayRecord.timeIn)} • Out: {formatTime(selectedDayRecord.timeOut)}
                          </p>
                          {getStatusBadge(selectedDayRecord.status)}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground pt-2">No attendance record for this day.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">Overtime</p>
                      <p className="text-sm text-muted-foreground">Apply to Dept Head</p>
                    </div>
                    {requestsLoading && <span className="text-xs text-muted-foreground">Loading...</span>}
                  </div>

                  <div className="space-y-3">
                    <Input type="date" value={otRequestDate} onChange={(e) => setOtRequestDate(e.target.value)} />
                    <Input
                      type="number"
                      min={1}
                      value={otRequestedMinutes}
                      onChange={(e) => setOtRequestedMinutes(parseInt(e.target.value) || 0)}
                      placeholder="Requested minutes"
                    />
                    <textarea
                      value={otReason}
                      onChange={(e) => setOtReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="w-full min-h-[80px] rounded-md border border-border bg-background p-2 text-sm"
                    />
                    <Button onClick={handleSubmitOvertime} className="w-full" disabled={requestsLoading}>
                      Submit Overtime
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Recent</p>
                    {overtimeRequests.slice(0, 4).map((r) => (
                      <div key={r.id} className="text-sm rounded-md border p-2">
                        <div className="font-medium">{new Date(r.requestDate).toLocaleDateString()}</div>
                        <div className="text-muted-foreground">{r.requestedMinutes} min</div>
                        <div className="text-xs mt-1">
                          Status: <span className="font-medium">{r.status}</span>
                        </div>
                      </div>
                    ))}
                    {overtimeRequests.length === 0 && <p className="text-sm text-muted-foreground">No overtime requests yet.</p>}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="font-semibold">Cash Advance</p>
                    <p className="text-sm text-muted-foreground">Apply for funding</p>
                  </div>

                  <div className="space-y-3">
                    <Input type="date" value={cashAdvanceDateIssued} onChange={(e) => setCashAdvanceDateIssued(e.target.value)} />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={cashAdvanceAmount}
                      onChange={(e) => setCashAdvanceAmount(parseFloat(e.target.value) || 0)}
                      placeholder="Amount"
                    />
                    <textarea
                      value={cashAdvanceReason}
                      onChange={(e) => setCashAdvanceReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="w-full min-h-[80px] rounded-md border border-border bg-background p-2 text-sm"
                    />
                    <Button onClick={handleSubmitCashAdvance} className="w-full" disabled={requestsLoading}>
                      Submit Cash Advance
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Recent</p>
                    {cashAdvances.slice(0, 4).map((r) => (
                      <div key={r.id} className="text-sm rounded-md border p-2">
                        <div className="font-medium">{new Date(r.dateIssued).toLocaleDateString()}</div>
                        <div className="text-muted-foreground">{formatCurrency(r.amount)}</div>
                        <div className="text-xs mt-1">
                          Status: <span className="font-medium">{r.status}</span>
                        </div>
                      </div>
                    ))}
                    {cashAdvances.length === 0 && <p className="text-sm text-muted-foreground">No cash advances yet.</p>}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="font-semibold">Leave</p>
                    <p className="text-sm text-muted-foreground">Apply with attachments</p>
                  </div>

                  <div className="space-y-3">
                    <Input type="date" value={leaveStartDate} onChange={(e) => setLeaveStartDate(e.target.value)} />
                    <Input type="date" value={leaveEndDate} onChange={(e) => setLeaveEndDate(e.target.value)} />
                    <textarea
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="w-full min-h-[80px] rounded-md border border-border bg-background p-2 text-sm"
                    />
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setLeaveAttachment(e.target.files?.[0] ?? null)}
                    />
                    <Button onClick={handleSubmitLeave} className="w-full" disabled={requestsLoading}>
                      Submit Leave
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Recent</p>
                    {leaveRequests.slice(0, 4).map((r) => (
                      <div key={r.id} className="text-sm rounded-md border p-2 space-y-1">
                        <div className="font-medium">
                          {new Date(r.startDate).toLocaleDateString()} - {new Date(r.endDate).toLocaleDateString()}
                        </div>
                        <div className="text-xs">
                          Status: <span className="font-medium">{r.status}</span>
                        </div>
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
                    ))}
                    {leaveRequests.length === 0 && <p className="text-sm text-muted-foreground">No leave requests yet.</p>}
                  </div>
                </div>
              </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

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

