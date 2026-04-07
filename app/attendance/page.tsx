"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Timer,
  Search,
  Coffee,
  TrendingUp,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
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
import { DashboardLayout } from "@/components/dashboard-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  formatAttendanceTableDate,
  formatScheduleSnapshot12h,
} from "@/lib/format-display"
import { computeAttendanceDisplayMetrics } from "@/lib/attendance-row-metrics"

interface AttendanceRecord {
  id: string
  date: string
  timeIn: string | null
  timeOut: string | null
  breakOut?: string | null
  breakIn?: string | null
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'OVERTIME' | 'LEAVE'
  lateMinutes: number
  overtimeMinutes: number
  undertimeMinutes: number
  breakMinutes?: number
  notes?: string
  oldScheduleTime?: string | null
  newScheduleTime?: string | null
  employee: {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    position: string
    department?: {
      name: string
    }
    schedule?: {
      timeIn: string
      timeOut: string
      name?: string
    } | null
    faceSamples?: { slot: number; imagePath: string }[]
  }
  isLocked?: boolean
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
  const [loading, setLoading] = useState(true)
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedEmployee, setSelectedEmployee] = useState("") // For filtering attendance records
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
  const isAdmin = session?.user?.role === 'ADMIN'

  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null)
  const [editForm, setEditForm] = useState({
    timeIn: "",
    timeOut: "",
    breakOut: "",
    breakIn: "",
    notes: "",
    status: "PRESENT" as AttendanceRecord["status"],
  })
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRecord | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualForm, setManualForm] = useState({
    employeeId: "",
    date: "",
    timeIn: "",
    timeOut: "",
    status: "PRESENT" as AttendanceRecord["status"],
    notes: "",
  })

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
    if (!dateString) return '—'
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
      LEAVE: { variant: "destructive" as const, label: "Leave", icon: AlertTriangle },
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PRESENT
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <config.icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const face1Src = (record: AttendanceRecord) =>
    record.employee.faceSamples?.find((f) => f.slot === 1)?.imagePath

  const toDatetimeLocalValue = (iso: string | null) => {
    if (!iso) return ""
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const fromDatetimeLocalValue = (local: string): string | null => {
    const t = local.trim()
    if (!t) return null
    const d = new Date(t)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString()
  }

  const openEdit = (record: AttendanceRecord) => {
    if (record.isLocked) {
      toast({
        title: "Locked",
        description: "Attendance within a closed payroll period cannot be edited.",
        variant: "destructive",
      })
      return
    }
    setEditRecord(record)
    setEditForm({
      timeIn: toDatetimeLocalValue(record.timeIn),
      timeOut: toDatetimeLocalValue(record.timeOut),
      breakOut: toDatetimeLocalValue(record.breakOut ?? null),
      breakIn: toDatetimeLocalValue(record.breakIn ?? null),
      notes: record.notes ?? "",
      status: record.status,
    })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editRecord) return
    setEditSaving(true)
    try {
      const body: Record<string, unknown> = {
        timeIn: fromDatetimeLocalValue(editForm.timeIn),
        timeOut: fromDatetimeLocalValue(editForm.timeOut),
        breakOut: fromDatetimeLocalValue(editForm.breakOut),
        breakIn: fromDatetimeLocalValue(editForm.breakIn),
        status: editForm.status,
        notes: editForm.notes.trim() || null,
        recalculateFromSchedule: true,
      }
      const res = await fetch(`/api/attendance/${editRecord.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Update failed")
      }
      toast({ title: "Saved", description: "Attendance updated." })
      setEditOpen(false)
      setEditRecord(null)
      await fetchAttendanceRecords()
      await recalculatePayrollForAttendanceDate(editRecord.date)
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to save",
        variant: "destructive",
      })
    } finally {
      setEditSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/attendance/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      toast({ title: "Deleted", description: "Attendance record removed." })
      await recalculatePayrollForAttendanceDate(deleteTarget.date)
      setDeleteTarget(null)
      await fetchAttendanceRecords()
    } catch {
      toast({ title: "Error", description: "Failed to delete record", variant: "destructive" })
    } finally {
      setDeleteLoading(false)
    }
  }

  const recalculatePayrollForAttendanceDate = async (_attendanceDateIso: string) => {
    if (!isAdmin) return
    try {
      const periodsRes = await fetch("/api/payroll/periods?status=DRAFT&page=1&limit=200")
      if (!periodsRes.ok) return
      const json = await periodsRes.json()
      const draftPeriods = (json.periods || []).filter((p: any) => p.status === "DRAFT")
      for (const p of draftPeriods) {
        await fetch("/api/payroll/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payrollPeriodId: p.id }),
        })
      }
      toast({ title: "Payroll synced", description: "Draft payroll periods were recalculated." })
    } catch {
      // non-blocking background sync
    }
  }

  const createManualAttendance = async () => {
    if (!manualForm.employeeId || !manualForm.date) {
      toast({ title: "Error", description: "Employee and date are required.", variant: "destructive" })
      return
    }
    setManualSaving(true)
    try {
      const payload: any = {
        employeeId: manualForm.employeeId,
        date: new Date(`${manualForm.date}T12:00:00`).toISOString(),
        status: manualForm.status,
        notes: manualForm.notes || undefined,
      }
      if (manualForm.timeIn) {
        payload.timeIn = new Date(`${manualForm.date}T${manualForm.timeIn}:00`).toISOString()
      }
      if (manualForm.timeOut) {
        payload.timeOut = new Date(`${manualForm.date}T${manualForm.timeOut}:00`).toISOString()
      }

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const err = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(err.error || "Failed to create attendance")
      toast({ title: "Created", description: "Manual attendance added." })
      setManualOpen(false)
      setManualForm({
        employeeId: "",
        date: "",
        timeIn: "",
        timeOut: "",
        status: "PRESENT",
        notes: "",
      })
      await fetchAttendanceRecords()
      await recalculatePayrollForAttendanceDate(payload.date)
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to create attendance",
        variant: "destructive",
      })
    } finally {
      setManualSaving(false)
    }
  }

  const scheduleTimeCell = (record: AttendanceRecord) => {
    const oldFmt = formatScheduleSnapshot12h(record.oldScheduleTime ?? null)
    const newFmt =
      formatScheduleSnapshot12h(record.newScheduleTime ?? null) ||
      formatScheduleSnapshot12h(
        record.employee.schedule?.timeIn && record.employee.schedule?.timeOut
          ? `${record.employee.schedule.timeIn} – ${record.employee.schedule.timeOut}`
          : null,
      )
    const current = newFmt || null
    const previous = oldFmt || null
    if (previous && current && previous !== current) {
      return (
        <div className="text-xs space-y-0.5 max-w-[220px]">
          <div>
            <span className="text-muted-foreground">Was: </span>
            {previous}
          </div>
          <div>
            <span className="text-muted-foreground">Now: </span>
            {current}
          </div>
        </div>
      )
    }
    return <span className="text-sm">{current || previous || "—"}</span>
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
              <>
                <Button
                  onClick={() => setManualOpen(true)}
                  size="sm"
                >
                  Add Attendance
                </Button>
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
              </>
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

        {/* Quick Stats - Admin Only */}
          {isAdmin && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
            </div>
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
              <SelectItem value="LEAVE">Leave</SelectItem>
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
                  {isAdmin && (
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("department")}
                    >
                      <div className="flex items-center gap-2">
                        Department
                        {sortField === 'department' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                        ) : (
                          <ArrowUpDown className="h-4 w-4 opacity-50" />
                        )}
                      </div>
                    </TableHead>
                  )}
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
                  <TableHead>Schedule time</TableHead>
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
                  <TableHead>Midbreak</TableHead>
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
                  {isAdmin && <TableHead className="text-right w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRecords.map((record) => {
                  const m = computeAttendanceDisplayMetrics({
                    date: record.date,
                    timeIn: record.timeIn,
                    timeOut: record.timeOut,
                    breakOut: record.breakOut,
                    breakIn: record.breakIn,
                    breakMinutes: record.breakMinutes,
                    lateMinutes: record.lateMinutes,
                    overtimeMinutes: record.overtimeMinutes,
                    undertimeMinutes: record.undertimeMinutes,
                    status: record.status,
                    oldScheduleTime: record.oldScheduleTime,
                    newScheduleTime: record.newScheduleTime,
                    employee: record.employee,
                  })
                  return (
                    <TableRow key={record.id} className={record.status === "LEAVE" ? "bg-red-100/80 dark:bg-red-950/40" : ""}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={face1Src(record)} />
                            <AvatarFallback>
                              {record.employee.firstName[0]}
                              {record.employee.lastName[0]}
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
                      {isAdmin && (
                        <TableCell>
                          {record.employee.department?.name || "—"}
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-sm">
                        {formatAttendanceTableDate(record.date)}
                      </TableCell>
                      <TableCell className="max-w-[220px]">{scheduleTimeCell(record)}</TableCell>
                      <TableCell>{formatTime(record.timeIn)}</TableCell>
                      <TableCell>{formatTime(record.breakOut || null)}</TableCell>
                      <TableCell>{formatTime(record.breakIn || null)}</TableCell>
                      <TableCell>{formatTime(record.timeOut)}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>
                        {m.midbreakMin > 0 ? (
                          <span className="text-purple-600 font-medium">
                            {formatDuration(m.midbreakMin)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {m.lateMin > 0 ? (
                          <span className="text-orange-600 font-medium">
                            {formatDuration(m.lateMin)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {m.otMin > 0 ? (
                          <span className="text-blue-600 font-medium">
                            {formatDuration(m.otMin)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {m.utMin > 0 ? (
                          <span className="text-red-600 font-medium">
                            {formatDuration(m.utMin)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {m.totalWorkMin > 0 ? (
                          <span className="font-medium">{formatDuration(m.totalWorkMin)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(record)}
                              aria-label="Edit attendance"
                              disabled={record.isLocked}
                              title={record.isLocked ? "Locked: period is closed" : "Edit attendance"}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(record)}
                              aria-label="Delete attendance"
                              disabled={record.isLocked}
                              title={record.isLocked ? "Locked: period is closed" : "Delete attendance"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
                {attendanceRecords.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={isAdmin ? 15 : 13}
                      className="text-center py-8"
                    >
                      <div className="text-muted-foreground">No attendance records found.</div>
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

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit attendance</DialogTitle>
            </DialogHeader>
            {editRecord && (
              <div className="grid gap-4 py-2">
                <p className="text-sm text-muted-foreground">
                  {editRecord.employee.firstName} {editRecord.employee.lastName} ·{" "}
                  {formatAttendanceTableDate(editRecord.date)}
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="edit-timeIn">Time in</Label>
                  <Input
                    id="edit-timeIn"
                    type="datetime-local"
                    value={editForm.timeIn}
                    onChange={(e) => setEditForm((f) => ({ ...f, timeIn: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-timeOut">Time out</Label>
                  <Input
                    id="edit-timeOut"
                    type="datetime-local"
                    value={editForm.timeOut}
                    onChange={(e) => setEditForm((f) => ({ ...f, timeOut: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-breakOut">Break out</Label>
                  <Input
                    id="edit-breakOut"
                    type="datetime-local"
                    value={editForm.breakOut}
                    onChange={(e) => setEditForm((f) => ({ ...f, breakOut: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-breakIn">Break in</Label>
                  <Input
                    id="edit-breakIn"
                    type="datetime-local"
                    value={editForm.breakIn}
                    onChange={(e) => setEditForm((f) => ({ ...f, breakIn: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Break minutes are auto-calculated from Break out and Break in.
                </p>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(v) =>
                      setEditForm((f) => ({ ...f, status: v as AttendanceRecord["status"] }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRESENT">Present</SelectItem>
                      <SelectItem value="LATE">Late</SelectItem>
                      <SelectItem value="ABSENT">Absent</SelectItem>
                      <SelectItem value="OVERTIME">Overtime</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea
                    id="edit-notes"
                    value={editForm.notes}
                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={saveEdit} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add manual attendance</DialogTitle>
              <DialogDescription>Create an attendance record for an employee.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-2">
                <Label>Employee</Label>
                <Select
                  value={manualForm.employeeId}
                  onValueChange={(v) => setManualForm((f) => ({ ...f, employeeId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.firstName} {e.lastName} ({e.employeeId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={manualForm.date}
                    onChange={(e) => setManualForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Time in</Label>
                  <Input
                    type="time"
                    value={manualForm.timeIn}
                    onChange={(e) => setManualForm((f) => ({ ...f, timeIn: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Time out</Label>
                  <Input
                    type="time"
                    value={manualForm.timeOut}
                    onChange={(e) => setManualForm((f) => ({ ...f, timeOut: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={manualForm.status}
                  onValueChange={(v) => setManualForm((f) => ({ ...f, status: v as AttendanceRecord["status"] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="LATE">Late</SelectItem>
                    <SelectItem value="ABSENT">Absent</SelectItem>
                    <SelectItem value="OVERTIME">Overtime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea
                  rows={3}
                  value={manualForm.notes}
                  onChange={(e) => setManualForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setManualOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createManualAttendance} disabled={manualSaving}>
                {manualSaving ? "Saving..." : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmationDialog
          open={!!deleteTarget}
          onOpenChange={(o) => {
            if (!o) setDeleteTarget(null)
          }}
          title="Delete attendance?"
          description={
            deleteTarget
              ? `Remove record for ${deleteTarget.employee.firstName} ${deleteTarget.employee.lastName} on ${formatAttendanceTableDate(deleteTarget.date)}?`
              : ""
          }
          confirmText={deleteLoading ? "Deleting…" : "Delete"}
          variant="destructive"
          onConfirm={confirmDelete}
        />

      </div>
    </DashboardLayout>
  )
}