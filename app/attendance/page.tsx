"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
  Clock,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Timer,
  Plus,
  Search,
  Filter,
  Download,
  Coffee,
  ArrowRight,
  TrendingUp,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { DataTablePagination } from "@/components/ui/data-table-pagination"

interface AttendanceRecord {
  id: string
  date: string
  timeIn: string | null
  timeOut: string | null
  breakOut?: string | null
  breakIn?: string | null
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'OVERTIME'
  lateMinutes: number
  overtimeMinutes: number
  undertimeMinutes: number
  breakMinutes?: number
  notes?: string
  employee: {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    position: string
    department?: {
      name: string
    }
  }
}

interface Employee {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  position: string
  department?: {
    name: string
  }
  user?: {
    id: string
    email: string
    role: string
  }
}

interface PaginationData {
  page: number
  limit: number
  total: number
  pages: number
}

export default function AttendancePage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const [clockLoading, setClockLoading] = useState(false)
  const [todayAttendanceRecord, setTodayAttendanceRecord] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedEmployee, setSelectedEmployee] = useState("") // For filtering attendance records
  const [clockInEmployee, setClockInEmployee] = useState("") // For clock in/out operations
  const [attendanceStats, setAttendanceStats] = useState({
    presentToday: 0,
    lateToday: 0,
    totalEmployees: 0,
    onBreak: 0
  })
  const [isCalculatingStats, setIsCalculatingStats] = useState(false)
  const [statsCalculated, setStatsCalculated] = useState(false)
  const [sortField, setSortField] = useState<string>("")
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  
  const [startDateFilter, setStartDateFilter] = useState("")
  const [endDateFilter, setEndDateFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  })
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    description: "",
    action: () => {},
  })

  const isEmployee = session?.user?.role === 'EMPLOYEE'
  const isDepartmentHead = session?.user?.role === 'DEPARTMENT_HEAD'
  const isAdmin = session?.user?.role === 'ADMIN'

  useEffect(() => {
    fetchAttendanceRecords()
    
    // Calculate stats on page mount with longer delay to ensure data is loaded
    setTimeout(() => {
      if (!statsCalculated) {
        console.log('Initial stats calculation on page mount')
        calculateAttendanceStats()
      } else {
        console.log('Stats already calculated, skipping...')
      }
    }, 2000)
    
    // Update current time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Separate useEffect for fetching employees when admin status is determined
  useEffect(() => {
    if (isAdmin) {
      fetchEmployees()
      fetchSchedules()
    }
  }, [isAdmin])

  // Calculate stats whenever attendance records change
  useEffect(() => {
    if (attendanceRecords.length > 0 && !isCalculatingStats && !statsCalculated) {
      console.log('Attendance records changed, recalculating stats...')
      console.log('Records count:', attendanceRecords.length)
      setTimeout(() => {
        calculateAttendanceStats()
      }, 500)
    } else if (attendanceRecords.length === 0) {
      console.log('No attendance records, skipping stats calculation')
    } else if (statsCalculated) {
      console.log('Stats already calculated, skipping recalculation')
    }
  }, [attendanceRecords])

  // Debug useEffect to track clockInEmployee changes
  useEffect(() => {
    console.log('clockInEmployee state changed to:', clockInEmployee)
  }, [clockInEmployee])

  // Debug useEffect to track attendanceStats changes
  useEffect(() => {
    console.log('attendanceStats state changed to:', attendanceStats)
    console.log('Stats change timestamp:', new Date().toLocaleTimeString())
  }, [attendanceStats])

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      fetchAttendanceRecords()
    }, 300)

    return () => clearTimeout(delayedSearch)
  }, [searchTerm, selectedEmployee, startDateFilter, endDateFilter, statusFilter, sortField, sortDirection, pagination.page, pagination.limit])

  // Separate useEffect to refresh attendance when clockInEmployee changes
  useEffect(() => {
    if (clockInEmployee && isAdmin) {
      console.log('Fetching data for selected employee:', clockInEmployee)
      fetchAttendanceRecords()
      // Also fetch today's record for this employee
      fetchTodayAttendance(clockInEmployee).then((record) => {
        console.log('Setting today attendance record:', record)
        setTodayAttendanceRecord(record)
      })
    } else if (!clockInEmployee && isAdmin) {
      console.log('No employee selected, clearing today record')
      setTodayAttendanceRecord(null)
    }
  }, [clockInEmployee])

  // Fetch today's attendance for employees on component mount
  useEffect(() => {
    if (isEmployee && session?.user?.id) {
      const fetchEmployeeTodayRecord = async () => {
        try {
          const employeeResponse = await fetch('/api/employees?limit=100&isActive=true')
          if (!employeeResponse.ok) return
          const employeeData = await employeeResponse.json()
          const currentEmployee = employeeData.employees.find((emp: Employee) => 
            emp.user?.id === session.user.id
          )
          if (currentEmployee) {
            const todayRecord = await fetchTodayAttendance(currentEmployee.id)
            setTodayAttendanceRecord(todayRecord)
          }
        } catch (error) {
          console.error('Error fetching employee today record:', error)
        }
      }
      fetchEmployeeTodayRecord()
    }
  }, [isEmployee, session?.user?.id])

  const fetchAttendanceRecords = async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (selectedEmployee && selectedEmployee !== 'all') params.append('employeeId', selectedEmployee)
      if (startDateFilter) {
        const startDate = new Date(startDateFilter)
        params.append('startDate', startDate.toISOString())
      }
      if (endDateFilter) {
        const endDate = new Date(endDateFilter)
        params.append('endDate', endDate.toISOString())
      }
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      if (sortField) params.append('sortField', sortField)
      if (sortDirection) params.append('sortDirection', sortDirection)
      params.append('page', pagination.page.toString())
      params.append('limit', pagination.limit.toString())
      
      const response = await fetch(`/api/attendance?${params}`)
      if (!response.ok) throw new Error('Failed to fetch attendance records')
      
      const data = await response.json()
      setAttendanceRecords(data.attendances || [])
      setPagination(data.pagination || pagination)
      
      // Reset stats calculation flag when new data is fetched
      setStatsCalculated(false)
      
      // Calculate attendance stats after fetching records
      setTimeout(() => {
        console.log('Delayed stats calculation triggered after fetch')
        if (!statsCalculated) {
          calculateAttendanceStats()
        }
      }, 300)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch attendance records",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateAttendanceStats = async () => {
    if (isCalculatingStats) {
      console.log('Stats calculation already in progress, skipping...')
      return
    }
    
    setIsCalculatingStats(true)
    const today = new Date().toISOString().split('T')[0]
    
    console.log('CALCULATING ATTENDANCE STATS for date:', today)
    console.log('Using existing attendanceRecords:', attendanceRecords.length)
    console.log('All attendance records:', attendanceRecords)
    
    try {
      // Debug: Log all records and their dates
      console.log('All attendance records with dates:')
      attendanceRecords.forEach((r: any, index: number) => {
        const recordDate = new Date(r.date).toISOString().split('T')[0]
        console.log(`Record ${index}:`, {
          date: r.date,
          formattedDate: recordDate,
          timeIn: r.timeIn,
          status: r.status,
          breakOut: r.breakOut,
          breakIn: r.breakIn
        })
      })
      
      // Filter records for today only
      const todayRecords = attendanceRecords.filter((r: any) => {
        const recordDate = new Date(r.date).toISOString().split('T')[0]
        return recordDate === today
      })
      
      console.log('Using today records for stats:', todayRecords.length)
      console.log('Today date:', today)
      console.log('Sample today record:', todayRecords[0])
      
      // If no records for today, use all records for now (temporary fix)
      const recordsToUse = todayRecords.length > 0 ? todayRecords : attendanceRecords
      console.log('Records to use for stats:', recordsToUse.length)
      
      const presentToday = recordsToUse.filter((r: any) => r.timeIn).length
      const lateToday = recordsToUse.filter((r: any) => r.status === 'LATE').length
      const onBreak = recordsToUse.filter((r: any) => r.breakOut && !r.breakIn).length
      
      // Only update stats if we have meaningful data
      if (recordsToUse.length === 0) {
        console.log('No attendance records found, skipping stats calculation')
        return
      }
      
      // Debug logging for stats
      console.log('Attendance Stats Debug:', {
        recordsToUseCount: recordsToUse.length,
        presentToday,
        lateToday,
        onBreak,
        sampleRecord: recordsToUse[0] ? {
          status: recordsToUse[0].status,
          timeIn: recordsToUse[0].timeIn,
          lateMinutes: recordsToUse[0].lateMinutes
        } : null
      })
      
      // Get total active employees
      const employeesResponse = await fetch('/api/employees?limit=1000&isActive=true')
      const employeesData = await employeesResponse.json()
      const totalEmployees = employeesData.employees?.length || 0
      
      const finalStats = {
        presentToday,
        lateToday,
        totalEmployees,
        onBreak
      }
      
      console.log('FINAL ATTENDANCE STATS:', finalStats)
      console.log('Setting attendance stats to:', finalStats)
      
      // Only update if we have meaningful stats or if this is the first calculation
      if (finalStats.presentToday > 0 || finalStats.lateToday > 0 || finalStats.onBreak > 0 || finalStats.totalEmployees > 0 || !statsCalculated) {
        setAttendanceStats(finalStats)
        setStatsCalculated(true)
        console.log('Stats updated successfully with meaningful data')
      } else {
        console.log('Stats not updated - no meaningful data found, keeping existing values')
      }
      
      // Verify the stats were set correctly immediately
      console.log('Stats immediately after setting:', finalStats)
    } catch (error) {
      console.error('Error calculating attendance stats:', error)
    } finally {
      setIsCalculatingStats(false)
    }
  }

  const fetchEmployees = async () => {
    setEmployeesLoading(true)
    try {
      // Fetch all active employees without pagination for the dropdown
      const response = await fetch('/api/employees?limit=100&isActive=true')
      if (!response.ok) throw new Error('Failed to fetch employees')
      const data = await response.json()
      console.log('Fetched employees data:', data.employees?.length || 0, 'employees')
      setEmployees(data.employees || [])
      
      // Don't reset clockInEmployee if it's already set and valid
      if (clockInEmployee && data.employees?.some((emp: any) => emp.id === clockInEmployee)) {
        console.log('Keeping existing employee selection:', clockInEmployee)
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast({
        title: "Error",
        description: "Failed to fetch employees for dropdown",
        variant: "destructive",
      })
    } finally {
      setEmployeesLoading(false)
    }
  }

  const fetchSchedules = async () => {
    try {
      const response = await fetch('/api/schedules?limit=100')
      if (!response.ok) throw new Error('Failed to fetch schedules')
      const data = await response.json()
      setSchedules(data.schedules || [])
    } catch (error) {
      console.error('Error fetching schedules:', error)
    }
  }

  const handleClockInOut = (type: 'IN' | 'OUT' | 'BREAK_OUT' | 'BREAK_IN') => {
    if (!session?.user?.id) return

    const getActionText = () => {
      switch (type) {
        case 'IN': return 'clock in'
        case 'OUT': return 'clock out'
        case 'BREAK_OUT': return 'go on break'
        case 'BREAK_IN': return 'return from break'
        default: return 'perform action'
      }
    }

    const getTitle = () => {
      switch (type) {
        case 'IN': return 'Clock In'
        case 'OUT': return 'Clock Out'
        case 'BREAK_OUT': return 'Break Out'
        case 'BREAK_IN': return 'Break In'
        default: return 'Action'
      }
    }

    setConfirmDialog({
      open: true,
      title: getTitle(),
      description: `Are you sure you want to ${getActionText()} at ${currentTime.toLocaleTimeString()}?`,
      action: () => performClockInOut(type),
    })
  }

  const performClockInOut = async (type: 'IN' | 'OUT' | 'BREAK_OUT' | 'BREAK_IN') => {
    if (!session?.user?.id) return

    setClockLoading(true)
    try {
      // Get current user's employee record
      let employeeId = clockInEmployee
      
      console.log('performClockInOut - Initial state:', {
        type,
        clockInEmployee,
        todayAttendanceRecord: todayAttendanceRecord ? 'exists' : 'null',
        isEmployee
      })
      
      // If no clockInEmployee but we have todayAttendanceRecord, use that employee
      if (!employeeId && todayAttendanceRecord?.employee?.id) {
        employeeId = todayAttendanceRecord.employee.id
        console.log('Using employee ID from today record:', employeeId)
        // Also update the clockInEmployee state to maintain consistency
        setClockInEmployee(employeeId)
      }
      
      // For non-admin users, get their own employee ID
      if (!isAdmin) {
        const employeeResponse = await fetch('/api/employees?limit=100&isActive=true')
        if (!employeeResponse.ok) throw new Error('Failed to get employee info')
        const employeeData = await employeeResponse.json()
        const currentEmployee = employeeData.employees.find((emp: Employee) => 
          emp.user?.id === session.user.id
        )
        if (!currentEmployee) throw new Error('Employee record not found')
        employeeId = currentEmployee.id
        console.log('Using personal employee ID:', employeeId)
      }

      if (!employeeId) {
        toast({
          title: "Error",
          description: isAdmin ? "Please select an employee" : "Employee record not found",
          variant: "destructive",
        })
        return
      }

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          employeeId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to clock ${type.toLowerCase()}`)
      }

      const getSuccessMessage = () => {
        switch (type) {
          case 'IN': return 'Successfully clocked in'
          case 'OUT': return 'Successfully clocked out'
          case 'BREAK_OUT': return 'Successfully went on break'
          case 'BREAK_IN': return 'Successfully returned from break'
          default: return 'Action completed successfully'
        }
      }

      toast({
        title: "Success",
        description: getSuccessMessage(),
      })

      // Fetch attendance records to refresh the table
      await fetchAttendanceRecords()
      
      // Also refresh the current employee's today record for button states
      if (employeeId) {
        // Ensure clockInEmployee is set for future operations
        if (isAdmin && clockInEmployee !== employeeId) {
          console.log('Setting clockInEmployee to:', employeeId)
          setClockInEmployee(employeeId)
        }
        
        const updatedRecord = await fetchTodayAttendance(employeeId)
        setTodayAttendanceRecord(updatedRecord)
        
        if (updatedRecord) {
          // Update the attendance records state with the new record
          setAttendanceRecords(prev => {
            const filtered = prev.filter(record => record.id !== updatedRecord.id)
            return [updatedRecord, ...filtered]
          })
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      })
    } finally {
      setClockLoading(false)
    }
  }

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }

  const handlePageSizeChange = (pageSize: number) => {
    setPagination(prev => ({ ...prev, limit: pageSize, page: 1 }))
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const formatTime = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return 'N/A'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PRESENT: { variant: "default" as const, label: "Present", icon: CheckCircle },
      LATE: { variant: "secondary" as const, label: "Late", icon: AlertTriangle },
      ABSENT: { variant: "destructive" as const, label: "Absent", icon: XCircle },
      OVERTIME: { variant: "outline" as const, label: "Overtime", icon: Timer },
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PRESENT
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <config.icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const getTodayAttendance = () => {
    const today = new Date().toISOString().split('T')[0]
    
    console.log('getTodayAttendance called:', {
      today,
      clockInEmployee,
      todayAttendanceRecord: todayAttendanceRecord ? 'exists' : 'null',
      isEmployee,
      attendanceRecordsCount: attendanceRecords.length
    })
    
    // Priority 1: Use dedicated today record if it exists and matches selected employee
    if (todayAttendanceRecord && clockInEmployee) {
      const recordDate = new Date(todayAttendanceRecord.date).toISOString().split('T')[0]
      if (recordDate === today && todayAttendanceRecord.employee?.id === clockInEmployee) {
        console.log('Using dedicated today record with employee match')
        return todayAttendanceRecord
      }
    }
    
    // Priority 2: Use dedicated today record even without employee match (for persistence)
    if (todayAttendanceRecord) {
      const recordDate = new Date(todayAttendanceRecord.date).toISOString().split('T')[0]
      if (recordDate === today) {
        console.log('Using dedicated today record without employee match')
        return todayAttendanceRecord
      }
    }
    
    if (isEmployee) {
      // For employees, find their own record
      const record = attendanceRecords.find(record => 
        record.date.split('T')[0] === today
      )
      console.log('Employee record found:', record ? 'exists' : 'null')
      return record
    }
    
    // For admins, if clockInEmployee is selected, find that employee's record
    if (clockInEmployee) {
      const record = attendanceRecords.find(record => 
        record.date.split('T')[0] === today && 
        record.employee.id === clockInEmployee
      )
      console.log('Admin record found for selected employee:', record ? 'exists' : 'null')
      return record
    }
    
    console.log('No employee selected and no dedicated record')
    return null
  }

  // Fetch today's attendance record specifically for clock in/out
  const fetchTodayAttendance = async (employeeId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const url = `/api/attendance?employeeId=${employeeId}&startDate=${today}T00:00:00.000Z&endDate=${today}T23:59:59.999Z&limit=1`
      
      console.log('Fetching today attendance for employee:', employeeId)
      const response = await fetch(url)
      if (!response.ok) {
        console.log('Response not ok:', response.status)
        return null
      }
      
      const data = await response.json()
      console.log('Today attendance API response:', data)
      const record = data.attendances?.[0] || null
      console.log('Extracted record:', record)
      return record
    } catch (error) {
      console.error('Error fetching today attendance:', error)
      return null
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isAdmin ? 'Attendance Management' : 'My Attendance'}
            </h1>
            <p className="text-muted-foreground">
              {isAdmin 
                ? 'Track employee attendance and working hours' 
                : 'View your personal attendance records'
              }
            </p>
          </div>
          <div className="flex items-center space-x-4">
             {isAdmin && (
             <Button 
               onClick={() => {
                 console.log('Manual stats calculation triggered')
                 setStatsCalculated(false)
                 calculateAttendanceStats()
               }}
               variant="outline"
               size="sm"
             >
               Recalculate Stats
             </Button>
             )}
            <div className="text-right">
              <div className="text-2xl font-bold">
                {currentTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>
              <div className="text-sm text-muted-foreground">
                {currentTime.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Clock In/Out Section - Admin Only */}
        {isAdmin && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Clock
              </CardTitle>
              <CardDescription>
                Clock in and out for the day
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="employee-select">Select Employee for Clock In/Out</Label>
                <Select 
                    value={clockInEmployee} 
                    onValueChange={(value) => {
                      console.log('Employee selected:', value)
                      console.log('Available employees:', employees.length)
                      setClockInEmployee(value)
                      
                      // Immediately fetch today's record for this employee
                      if (value) {
                        fetchTodayAttendance(value).then((record) => {
                          console.log('Immediately setting today record for:', value, record)
                          setTodayAttendanceRecord(record)
                        })
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={employeesLoading ? "Loading employees..." : "Choose an employee"} />
                    </SelectTrigger>
                    <SelectContent>
                      {employeesLoading ? (
                        <SelectItem value="loading" disabled>Loading employees...</SelectItem>
                      ) : employees.length === 0 ? (
                        <SelectItem value="no-employees" disabled>No active employees found</SelectItem>
                      ) : (
                        employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.firstName} {employee.lastName} ({employee.employeeId})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

              {isAdmin && (clockInEmployee || todayAttendanceRecord) && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Selected Employee:</strong> {
                      clockInEmployee ? 
                        `${employees.find(emp => emp.id === clockInEmployee)?.firstName} ${employees.find(emp => emp.id === clockInEmployee)?.lastName} (${employees.find(emp => emp.id === clockInEmployee)?.employeeId})` :
                        todayAttendanceRecord?.employee ? 
                          `${todayAttendanceRecord.employee.firstName} ${todayAttendanceRecord.employee.lastName} (${todayAttendanceRecord.employee.employeeId})` :
                          'Unknown Employee'
                    }
                  </p>
                  {(todayAttendanceRecord || getTodayAttendance()) && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Status: {(todayAttendanceRecord || getTodayAttendance())?.timeIn ? 'Clocked In' : 'Not Clocked In'} 
                      {(todayAttendanceRecord || getTodayAttendance())?.timeOut && ' → Clocked Out'}
                    </p>
                  )}
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    💡 Tip: Select the employee who needs to clock in/out
                  </p>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2">
                {/* Clock In Button */}
                <Button
                  onClick={() => handleClockInOut('IN')}
                  disabled={
                    clockLoading || 
                    (isAdmin && !clockInEmployee) ||
                    (!isAdmin && !isEmployee && !isDepartmentHead)
                  }
                  className="col-span-1"
                  variant={getTodayAttendance()?.timeIn ? "outline" : "default"}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {getTodayAttendance()?.timeIn ? "Clocked In" : "Clock In"}
                </Button>

                {/* Break Out Button */}
                <Button
                  onClick={() => handleClockInOut('BREAK_OUT')}
                  disabled={
                    clockLoading || 
                    (isAdmin && !clockInEmployee) ||
                    (!isAdmin && !isEmployee && !isDepartmentHead)
                  }
                  className="col-span-1"
                  variant={getTodayAttendance()?.breakOut ? "outline" : "secondary"}
                >
                  <Coffee className="mr-2 h-4 w-4" />
                  {getTodayAttendance()?.breakOut ? "On Break" : "Break Out"}
                </Button>

                {/* Break In Button */}
                <Button
                  onClick={() => handleClockInOut('BREAK_IN')}
                  disabled={
                    clockLoading || 
                    (isAdmin && !clockInEmployee) ||
                    (!isAdmin && !isEmployee && !isDepartmentHead)
                  }
                  className="col-span-1"
                  variant={getTodayAttendance()?.breakIn ? "outline" : "secondary"}
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  {getTodayAttendance()?.breakIn ? "Back" : "Break In"}
                </Button>

                {/* Clock Out Button */}
                <Button
                  onClick={() => handleClockInOut('OUT')}
                  disabled={
                    clockLoading || 
                    (isAdmin && !clockInEmployee) ||
                    (!isAdmin && !isEmployee && !isDepartmentHead)
                  }
                  className="col-span-1"
                  variant={getTodayAttendance()?.timeOut ? "outline" : "default"}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {getTodayAttendance()?.timeOut ? "Clocked Out" : "Clock Out"}
                </Button>
              </div>

              {getTodayAttendance() && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Today's Status</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Time In:</span>
                      <div className="font-medium">{formatTime(getTodayAttendance()?.timeIn)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time Out:</span>
                      <div className="font-medium">{formatTime(getTodayAttendance()?.timeOut)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Break Out:</span>
                      <div className="font-medium">{formatTime(getTodayAttendance()?.breakOut)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Break In:</span>
                      <div className="font-medium">{formatTime(getTodayAttendance()?.breakIn)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <div>{getStatusBadge(getTodayAttendance()?.status)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Late:</span>
                      <div className="font-medium">{formatDuration(getTodayAttendance()?.lateMinutes)}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        )}

        {/* Quick Stats - Admin Only */}
          {isAdmin && (
            <>
            <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Present Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {attendanceStats.presentToday}
              </div>
              <p className="text-xs text-muted-foreground">
                of {attendanceStats.totalEmployees} employees
              </p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                  style={{ 
                    width: `${attendanceStats.totalEmployees > 0 ? (attendanceStats.presentToday / attendanceStats.totalEmployees) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Late Arrivals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {attendanceStats.lateToday}
              </div>
              <p className="text-xs text-muted-foreground">late today</p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-orange-600 h-2 rounded-full transition-all duration-300" 
                  style={{ 
                    width: `${attendanceStats.presentToday > 0 ? (attendanceStats.lateToday / attendanceStats.presentToday) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Coffee className="h-4 w-4" />
                On Break
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {attendanceStats.onBreak}
              </div>
              <p className="text-xs text-muted-foreground">currently on break</p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ 
                    width: `${attendanceStats.presentToday > 0 ? (attendanceStats.onBreak / attendanceStats.presentToday) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Attendance Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {attendanceStats.totalEmployees > 0 
                  ? Math.round((attendanceStats.presentToday / attendanceStats.totalEmployees) * 100)
                  : 0}%
              </div>
              <p className="text-xs text-muted-foreground">overall attendance</p>
              <div className="mt-2 flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-xs text-green-600">Good attendance</span>
              </div>
            </CardContent>
          </Card>
            </>
          )}

        {/* Filters - Admin Only */}
        {isAdmin && (
        <div className="flex items-center space-x-4">
          {/* Filter Status */}
          {(startDateFilter || endDateFilter || searchTerm || selectedEmployee || statusFilter) && (
            <div className="text-sm text-muted-foreground">
              Filters: {startDateFilter && `From ${startDateFilter}`} {endDateFilter && `to ${endDateFilter}`} 
              {searchTerm && ` • Search: "${searchTerm}"`} 
              {selectedEmployee && selectedEmployee !== 'all' && ` • Employee`} 
              {statusFilter && statusFilter !== 'all' && ` • Status: ${statusFilter}`}
            </div>
          )}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {isAdmin && (
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={employeesLoading ? "Loading..." : "All Employees"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employeesLoading ? (
                  <SelectItem value="loading" disabled>Loading employees...</SelectItem>
                ) : employees.length === 0 ? (
                  <SelectItem value="no-employees" disabled>No active employees found</SelectItem>
                ) : (
                  employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.firstName} {employee.lastName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}

          <div className="flex gap-2 items-center">
            <Input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="w-40"
              placeholder="Start date"
              title="Start Date"
            />
            <Input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="w-40"
              placeholder="End date"
              title="End Date"
            />
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0]
                  setStartDateFilter(today)
                  setEndDateFilter(today)
                }}
                className="h-8 text-xs"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date()
                  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
                  setStartDateFilter(weekAgo.toISOString().split('T')[0])
                  setEndDateFilter(today.toISOString().split('T')[0])
                }}
                className="h-8 text-xs"
              >
                Last 7 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDateFilter("")
                  setEndDateFilter("")
                  setSearchTerm("")
                  setSelectedEmployee("")
                  setStatusFilter("")
                }}
                className="h-8 text-xs"
              >
                Clear All
              </Button>
            </div>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PRESENT">Present</SelectItem>
              <SelectItem value="LATE">Late</SelectItem>
              <SelectItem value="ABSENT">Absent</SelectItem>
              <SelectItem value="OVERTIME">Overtime</SelectItem>
            </SelectContent>
          </Select>
        </div>
        )}

        {/* Attendance Records Table */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
            <CardDescription>
              {attendanceRecords.length} record{attendanceRecords.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('employee')}
                  >
                    <div className="flex items-center gap-2">
                      Employee
                      {sortField === 'employee' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-2">
                      Date
                      {sortField === 'date' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('timeIn')}
                  >
                    <div className="flex items-center gap-2">
                      Time In
                      {sortField === 'timeIn' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Break Out</TableHead>
                  <TableHead>Break In</TableHead>
                  <TableHead>Midbreak</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('timeOut')}
                  >
                    <div className="flex items-center gap-2">
                      Time Out
                      {sortField === 'timeOut' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {sortField === 'status' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('lateMinutes')}
                  >
                    <div className="flex items-center gap-2">
                      Late
                      {sortField === 'lateMinutes' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('overtimeMinutes')}
                  >
                    <div className="flex items-center gap-2">
                      Overtime
                      {sortField === 'overtimeMinutes' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('undertimeMinutes')}
                  >
                    <div className="flex items-center gap-2">
                      Undertime
                      {sortField === 'undertimeMinutes' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Total Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRecords.map((record) => {
                  // Get employee's schedule for the day
                  const employeeSchedule = schedules.find(s => {
                    const hasEmployee = s.employees.some((emp: any) => emp.id === record.employee.id)
                    const workingDaysArray = s.workingDays ? s.workingDays.split(',') : []
                    
                    // Convert day number to day name for comparison
                    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
                    const currentDay = new Date(record.date).getDay()
                    const currentDayName = dayNames[currentDay]
                    const isWorkingDay = workingDaysArray.includes(currentDayName)
                    
                    console.log('Schedule lookup debug:', {
                      scheduleName: s.name,
                      hasEmployee,
                      workingDaysArray,
                      currentDay,
                      currentDayName,
                      isWorkingDay,
                      employeeId: record.employee.id
                    })
                    
                    return hasEmployee && isWorkingDay
                  })

                  // Calculate total worked minutes based on schedule
                  let totalMinutes = 0
                  let overtimeMinutes = 0
                  let lateMinutes = 0
                  let undertimeMinutes = 0
                  
                  // FORCE CALCULATION - Always calculate 1 minute for testing
                  console.log('RECORD DATA:', {
                    recordId: record.id,
                    timeIn: record.timeIn,
                    timeOut: record.timeOut,
                    hasTimeIn: !!record.timeIn,
                    hasTimeOut: !!record.timeOut
                  })
                  
                  // ALWAYS SET TO 1 - No conditions
                  totalMinutes = 1
                  console.log('ALWAYS SET: totalMinutes = 1 (no conditions)')

                  // Always calculate total hours if we have timeIn and timeOut
                  console.log('Checking timeIn and timeOut:', {
                    hasTimeIn: !!record.timeIn,
                    hasTimeOut: !!record.timeOut,
                    timeIn: record.timeIn,
                    timeOut: record.timeOut
                  })
                  
                  if (record.timeIn && record.timeOut) {
                    const actualStart = new Date(record.timeIn)
                    const actualEnd = new Date(record.timeOut)
                    
                    console.log('Starting calculation for record:', {
                      recordId: record.id,
                      employeeId: record.employee.id,
                      timeIn: record.timeIn,
                      timeOut: record.timeOut,
                      actualStart: actualStart.toISOString(),
                      actualEnd: actualEnd.toISOString(),
                      availableSchedules: schedules.length,
                      scheduleNames: schedules.map(s => s.name)
                    })
                    
                    // Calculate actual work time first
                    const grossWorkMinutes = Math.floor((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60))
                    const breakMinutes = record.breakMinutes || 0
                    
                    // Apply 30-minute break rule: only deduct break time if it exceeds 30 minutes
                    const deductibleBreakMinutes = breakMinutes > 30 ? breakMinutes - 30 : 0
                    totalMinutes = Math.max(0, grossWorkMinutes - deductibleBreakMinutes)
                    
                    console.log('Basic calculation result:', {
                      grossWorkMinutes,
                      breakMinutes,
                      deductibleBreakMinutes,
                      totalMinutes
                    })
                    
                    if (employeeSchedule) {
                      // Parse schedule times
                      const [scheduleStartHour, scheduleStartMin] = employeeSchedule.timeIn.split(':').map(Number)
                      const [scheduleEndHour, scheduleEndMin] = employeeSchedule.timeOut.split(':').map(Number)
                      
                      // Create schedule start and end times for the day
                      const scheduleStart = new Date(record.date)
                      scheduleStart.setHours(scheduleStartHour, scheduleStartMin, 0, 0)
                      
                      const scheduleEnd = new Date(record.date)
                      scheduleEnd.setHours(scheduleEndHour, scheduleEndMin, 0, 0)
                      
                      // Calculate total credited hours (schedule duration)
                      const scheduleMinutes = Math.floor((scheduleEnd.getTime() - scheduleStart.getTime()) / (1000 * 60))
                      
                      // Calculate late arrival
                      if (actualStart > scheduleStart) {
                        lateMinutes = Math.floor((actualStart.getTime() - scheduleStart.getTime()) / (1000 * 60))
                      }
                      
                      // Calculate overtime (work beyond schedule end)
                      if (actualEnd > scheduleEnd) {
                        overtimeMinutes = Math.floor((actualEnd.getTime() - scheduleEnd.getTime()) / (1000 * 60))
                      }
                      
                      // Calculate undertime (work less than schedule duration)
                      const actualWorkMinutes = Math.floor((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60))
                      if (actualWorkMinutes < scheduleMinutes) {
                        undertimeMinutes = scheduleMinutes - actualWorkMinutes
                      }
                      
                      // Total credited hours = actual work time (not schedule duration)
                      const grossWorkMinutes = Math.floor((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60))
                      const breakMinutes = record.breakMinutes || 0
                      
                      // Apply 30-minute break rule: only deduct break time if it exceeds 30 minutes
                      const deductibleBreakMinutes = breakMinutes > 30 ? breakMinutes - 30 : 0
                      totalMinutes = Math.max(0, grossWorkMinutes - deductibleBreakMinutes)
                      
                      console.log('Total hours calculation debug (with schedule):', {
                        employeeId: record.employee.id,
                        scheduleName: employeeSchedule.name,
                        scheduleTimeIn: employeeSchedule.timeIn,
                        scheduleTimeOut: employeeSchedule.timeOut,
                        scheduleMinutes,
                        grossWorkMinutes,
                        breakMinutes,
                        deductibleBreakMinutes,
                        totalMinutes,
                        lateMinutes,
                        overtimeMinutes,
                        undertimeMinutes
                      })
                    } else {
                      // No schedule found - use actual work time as total hours
                      const grossWorkMinutes = Math.floor((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60))
                      const breakMinutes = record.breakMinutes || 0
                      
                      // Apply 30-minute break rule: only deduct break time if it exceeds 30 minutes
                      const deductibleBreakMinutes = breakMinutes > 30 ? breakMinutes - 30 : 0
                      totalMinutes = Math.max(0, grossWorkMinutes - deductibleBreakMinutes)
                      
                      console.log('Total hours calculation debug (no schedule):', {
                        employeeId: record.employee.id,
                        grossWorkMinutes,
                        breakMinutes,
                        deductibleBreakMinutes,
                        totalMinutes,
                        actualStart: actualStart.toISOString(),
                        actualEnd: actualEnd.toISOString(),
                        availableSchedules: schedules.length,
                        scheduleDetails: schedules.map(s => ({
                          id: s.id,
                          name: s.name,
                          timeIn: s.timeIn,
                          timeOut: s.timeOut,
                          workingDays: s.workingDays,
                          employees: s.employees.map((emp: any) => emp.id)
                        }))
                      })
                    }
                  } else {
                    console.log('Missing data for calculation:', {
                      hasTimeIn: !!record.timeIn,
                      hasTimeOut: !!record.timeOut,
                      hasSchedule: !!employeeSchedule,
                      employeeId: record.employee.id
                    })
                    
                    // FALLBACK: Try to calculate even with missing data
                    if (record.timeIn && record.timeOut) {
                      const actualStart = new Date(record.timeIn)
                      const actualEnd = new Date(record.timeOut)
                      const grossWorkMinutes = Math.floor((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60))
                      totalMinutes = Math.max(0, grossWorkMinutes)
                      console.log('Fallback calculation:', { grossWorkMinutes, totalMinutes })
                    }
                  }

                  console.log('Final calculation result for record:', {
                    recordId: record.id,
                    totalMinutes,
                    lateMinutes,
                    overtimeMinutes,
                    undertimeMinutes,
                    willShowTotalHours: totalMinutes > 0
                  })
                  
                  // FINAL DEBUG - Right before display
                  console.log('RIGHT BEFORE DISPLAY:', {
                    totalMinutes,
                    condition: totalMinutes > 0,
                    willShow: totalMinutes > 0 ? 'formatDuration' : 'dash'
                  })

                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {record.employee.firstName[0]}{record.employee.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {record.employee.firstName} {record.employee.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {record.employee.employeeId} • {record.employee.position}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(record.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{formatTime(record.timeIn)}</TableCell>
                      <TableCell>{formatTime(record.breakOut || null)}</TableCell>
                      <TableCell>{formatTime(record.breakIn || null)}</TableCell>
                      <TableCell>
                        {record.breakMinutes && record.breakMinutes > 0 ? (
                          <span className="text-purple-600 font-medium">
                            {formatDuration(record.breakMinutes)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{formatTime(record.timeOut)}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>
                        {lateMinutes > 0 ? (
                          <span className="text-orange-600 font-medium">
                            {formatDuration(lateMinutes)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {overtimeMinutes > 0 ? (
                          <span className="text-blue-600 font-medium">
                            {formatDuration(overtimeMinutes)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {undertimeMinutes > 0 ? (
                          <span className="text-red-600 font-medium">
                            {formatDuration(undertimeMinutes)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {totalMinutes > 0 ? (
                          <span className="font-medium">
                            {formatDuration(totalMinutes)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            - (totalMinutes: {totalMinutes})
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {attendanceRecords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="text-muted-foreground">
                        No attendance records found.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <DataTablePagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              pageSize={pagination.limit}
              totalItems={pagination.total}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <ConfirmationDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmText="Confirm"
          onConfirm={() => {
            confirmDialog.action()
            setConfirmDialog(prev => ({ ...prev, open: false }))
          }}
        />
      </div>
    </DashboardLayout>
  )
}