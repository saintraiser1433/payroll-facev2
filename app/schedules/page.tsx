"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
  Calendar,
  Clock,
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  MoreHorizontal,
  CalendarDays,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { DataTablePagination } from "@/components/ui/data-table-pagination"

interface Schedule {
  id: string
  name: string
  timeIn: string
  timeOut: string
  workingDays: string
  workingDaysArray: string[]
  createdAt: string
  updatedAt: string
  employees: Array<{
    id: string
    employeeId: string
    firstName: string
    lastName: string
    position: string
    isActive: boolean
    department?: {
      name: string
    }
  }>
}

const DAYS_OF_WEEK = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' },
  { value: 'SUNDAY', label: 'Sunday' },
]

interface PaginationData {
  page: number
  limit: number
  total: number
  pages: number
}

export default function SchedulesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
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
  const [formData, setFormData] = useState({
    name: "",
    timeIn: "",
    timeOut: "",
    workingDays: [] as string[],
  })

  useEffect(() => {
    fetchSchedules()
  }, [searchTerm, pagination.page, pagination.limit])

  const fetchSchedules = async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      params.append('page', pagination.page.toString())
      params.append('limit', pagination.limit.toString())
      
      const response = await fetch(`/api/schedules?${params}`)
      if (!response.ok) throw new Error('Failed to fetch schedules')
      
      const data = await response.json()
      setSchedules(data.schedules || [])
      setPagination(data.pagination || pagination)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch schedules",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.workingDays.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one working day",
        variant: "destructive",
      })
      return
    }

    try {
      const url = selectedSchedule ? `/api/schedules/${selectedSchedule.id}` : '/api/schedules'
      const method = selectedSchedule ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          workingDays: formData.workingDays.join(','),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save schedule')
      }

      toast({
        title: "Success",
        description: `Schedule ${selectedSchedule ? 'updated' : 'created'} successfully`,
      })

      setIsAddDialogOpen(false)
      setIsEditDialogOpen(false)
      resetForm()
      fetchSchedules()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      })
    }
  }

  const handleDelete = (schedule: Schedule) => {
    if (schedule.employees.length > 0) {
      toast({
        title: "Error",
        description: "Cannot delete schedule that is assigned to employees",
        variant: "destructive",
      })
      return
    }

    setConfirmDialog({
      open: true,
      title: "Delete Schedule",
      description: `Are you sure you want to delete "${schedule.name}"? This action cannot be undone.`,
      action: () => performDelete(schedule.id),
    })
  }

  const performDelete = async (scheduleId: string) => {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete schedule')

      toast({
        title: "Success",
        description: "Schedule deleted successfully",
      })

      fetchSchedules()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete schedule",
        variant: "destructive",
      })
    }
  }

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }

  const handlePageSizeChange = (pageSize: number) => {
    setPagination(prev => ({ ...prev, limit: pageSize, page: 1 }))
  }

  const resetForm = () => {
    setFormData({
      name: "",
      timeIn: "",
      timeOut: "",
      workingDays: [],
    })
    setSelectedSchedule(null)
  }

  const openEditDialog = (schedule: Schedule) => {
    setSelectedSchedule(schedule)
    setFormData({
      name: schedule.name,
      timeIn: schedule.timeIn,
      timeOut: schedule.timeOut,
      workingDays: schedule.workingDaysArray,
    })
    setIsEditDialogOpen(true)
  }

  const handleWorkingDayChange = (day: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        workingDays: [...prev.workingDays, day]
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        workingDays: prev.workingDays.filter(d => d !== day)
      }))
    }
  }

  const formatWorkingDays = (days: string[]) => {
    return days.map(day => day.charAt(0) + day.slice(1).toLowerCase()).join(', ')
  }

  const calculateWorkingHours = (timeIn: string, timeOut: string) => {
    const [inHour, inMinute] = timeIn.split(':').map(Number)
    const [outHour, outMinute] = timeOut.split(':').map(Number)
    
    const inMinutes = inHour * 60 + inMinute
    const outMinutes = outHour * 60 + outMinute
    
    const diffMinutes = outMinutes - inMinutes
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    
    return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`
  }

  const formatTimeTo12Hour = (time24: string) => {
    const [hours, minutes] = time24.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  // Server-side filtering is now handled by the API
  const filteredSchedules = schedules

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

  const isAdmin = session?.user?.role === 'ADMIN'

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Schedules</h1>
            <p className="text-muted-foreground">
              Manage work schedules and assign them to employees
            </p>
          </div>
          {isAdmin && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Schedule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Schedule</DialogTitle>
                  <DialogDescription>
                    Create a new work schedule for employees
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Schedule Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Regular Day Shift"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="timeIn">Time In</Label>
                      <Input
                        id="timeIn"
                        type="time"
                        value={formData.timeIn}
                        onChange={(e) => setFormData({ ...formData, timeIn: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="timeOut">Time Out</Label>
                      <Input
                        id="timeOut"
                        type="time"
                        value={formData.timeOut}
                        onChange={(e) => setFormData({ ...formData, timeOut: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Working Days</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <div key={day.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={day.value}
                            checked={formData.workingDays.includes(day.value)}
                            onCheckedChange={(checked) => 
                              handleWorkingDayChange(day.value, checked as boolean)
                            }
                          />
                          <Label htmlFor={day.value} className="text-sm">
                            {day.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Add Schedule</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search schedules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Schedules Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSchedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">{schedule.name}</CardTitle>
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(schedule)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDelete(schedule)}
                        className="text-destructive"
                        disabled={schedule.employees.length > 0}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {formatTimeTo12Hour(schedule.timeIn)} - {formatTimeTo12Hour(schedule.timeOut)}
                      </span>
                    </div>
                    <Badge variant="outline">
                      {calculateWorkingHours(schedule.timeIn, schedule.timeOut)}
                    </Badge>
                  </div>

                  <div className="flex items-start space-x-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                      {formatWorkingDays(schedule.workingDaysArray)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {schedule.employees.length} employee{schedule.employees.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {schedule.employees.length > 0 && (
                      <Badge variant="secondary">
                        In Use
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredSchedules.length === 0 && (
            <div className="col-span-full text-center py-8">
              <div className="text-muted-foreground">
                No schedules found. {isAdmin && "Create your first schedule to get started."}
              </div>
            </div>
          )}
        </div>

        {/* Schedules Table */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule Details</CardTitle>
            <CardDescription>
              Detailed view of all schedules and assigned employees
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Schedule Name</TableHead>
                  <TableHead>Working Hours</TableHead>
                  <TableHead>Working Days</TableHead>
                  <TableHead>Assigned Employees</TableHead>
                  <TableHead>Created</TableHead>
                  {isAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">{schedule.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{formatTimeTo12Hour(schedule.timeIn)} - {formatTimeTo12Hour(schedule.timeOut)}</span>
                        <Badge variant="outline" className="ml-2">
                          {calculateWorkingHours(schedule.timeIn, schedule.timeOut)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatWorkingDays(schedule.workingDaysArray)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{schedule.employees.length}</span>
                        {schedule.employees.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            ({schedule.employees.map(emp => `${emp.firstName} ${emp.lastName}`).join(', ')})
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(schedule.createdAt).toLocaleDateString()}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(schedule)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(schedule)}
                              className="text-destructive"
                              disabled={schedule.employees.length > 0}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
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

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Schedule</DialogTitle>
              <DialogDescription>
                Update schedule information
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Schedule Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Regular Day Shift"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-timeIn">Time In</Label>
                  <Input
                    id="edit-timeIn"
                    type="time"
                    value={formData.timeIn}
                    onChange={(e) => setFormData({ ...formData, timeIn: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-timeOut">Time Out</Label>
                  <Input
                    id="edit-timeOut"
                    type="time"
                    value={formData.timeOut}
                    onChange={(e) => setFormData({ ...formData, timeOut: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Working Days</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-${day.value}`}
                        checked={formData.workingDays.includes(day.value)}
                        onCheckedChange={(checked) => 
                          handleWorkingDayChange(day.value, checked as boolean)
                        }
                      />
                      <Label htmlFor={`edit-${day.value}`} className="text-sm">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update Schedule</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <ConfirmationDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmText="Delete"
          variant="destructive"
          onConfirm={() => {
            confirmDialog.action()
            setConfirmDialog(prev => ({ ...prev, open: false }))
          }}
        />
      </div>
    </DashboardLayout>
  )
}