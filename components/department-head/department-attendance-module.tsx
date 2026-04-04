"use client"

import { useState } from "react"
import {
  Search,
  Eye,
  ChevronUp,
  ChevronDown,
  CalendarDays,
  Calendar,
  Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useDepartmentHeadDashboard } from "@/hooks/use-department-head-dashboard"
import { filterAndSortData, paginateData } from "@/lib/dept-head-table-helpers"
import { formatTime, getStatusBadge } from "@/components/employee/employee-ui-helpers"
import { DeptHeadTablePaginationFooter } from "@/components/department-head/dept-head-table-pagination-footer"

const itemsPerPage = 10

export function DepartmentAttendanceModule() {
  const { data, loading, error, refetch } = useDepartmentHeadDashboard()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const [selectedEmployee, setSelectedEmployee] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [filteredAttendance, setFilteredAttendance] = useState<any[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null
    return sortDir === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
  }

  const filterEmployeeAttendance = (employee: any, sd: string, ed: string) => {
    if (!employee || !sd || !ed) return
    setAttendanceLoading(true)
    try {
      const filtered = employee.attendances.filter((att: any) => {
        const attDate = new Date(att.date)
        const start = new Date(sd)
        const end = new Date(ed)
        return attDate >= start && attDate <= end
      })
      setFilteredAttendance(filtered)
    } finally {
      setAttendanceLoading(false)
    }
  }

  const openModal = (emp: any) => {
    setSelectedEmployee(emp)
    setModalOpen(true)
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    const ed = end.toISOString().split("T")[0]
    const sd = start.toISOString().split("T")[0]
    setEndDate(ed)
    setStartDate(sd)
    filterEmployeeAttendance(emp, sd, ed)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => refetch()}>Try again</Button>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const employeeData = data.employee.department.employees.map((emp) => {
    const totalAttendance = emp.attendances.length
    const lastAttendance = emp.attendances.length > 0 ? emp.attendances[0] : null
    return {
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      position: emp.position,
      totalAttendance,
      lastAttendance: lastAttendance?.date || null,
      firstName: emp.firstName,
      lastName: emp.lastName,
      employee: emp,
    }
  })

  const filteredSorted = filterAndSortData(employeeData, search, sortField, sortDir)
  const { paginatedData, totalItems } = paginateData(filteredSorted, page, itemsPerPage)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Department attendance</CardTitle>
          <CardDescription>Manage attendance for all department members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search employees..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-10"
              />
            </div>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("name")}>
                    <div className="flex items-center gap-2">
                      Employee
                      {getSortIcon("name")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("position")}>
                    <div className="flex items-center gap-2">
                      Position
                      {getSortIcon("position")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("totalAttendance")}>
                    <div className="flex items-center gap-2">
                      Total attendance
                      {getSortIcon("totalAttendance")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("lastAttendance")}>
                    <div className="flex items-center gap-2">
                      Last attendance
                      {getSortIcon("lastAttendance")}
                    </div>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                      No employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((emp: any) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {emp.firstName[0]}
                              {emp.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{emp.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{emp.position}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            emp.totalAttendance === 0
                              ? "bg-muted text-muted-foreground"
                              : "bg-blue-100 text-blue-700"
                          }
                        >
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
                        <Button variant="outline" size="sm" onClick={() => openModal(emp.employee)}>
                          <Eye className="w-4 h-4 mr-1" />
                          View attendance
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <DeptHeadTablePaginationFooter
              page={page}
              setPage={setPage}
              itemsPerPage={itemsPerPage}
              totalItems={totalItems}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Attendance records — {selectedEmployee?.firstName} {selectedEmployee?.lastName}
            </DialogTitle>
            <DialogDescription>View and filter attendance records for this employee</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Date range</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
                <span className="text-sm text-muted-foreground">to</span>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
                <Button
                  size="sm"
                  disabled={attendanceLoading}
                  onClick={() => selectedEmployee && filterEmployeeAttendance(selectedEmployee, startDate, endDate)}
                >
                  <Filter className="w-4 h-4 mr-1" />
                  Filter
                </Button>
              </div>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time in</TableHead>
                    <TableHead>Time out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Late minutes</TableHead>
                    <TableHead>Overtime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : filteredAttendance.length > 0 ? (
                    filteredAttendance.map((attendance: any) => (
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
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No attendance records for the selected range
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
