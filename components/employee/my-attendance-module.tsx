"use client"

import { useState } from "react"
import { Search, CalendarDays, Filter, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useEmployeeDashboard } from "@/hooks/use-employee-dashboard"
import {
  filterAndSortData,
  formatTime,
  getSortIcon,
  getStatusBadge,
  handleSort,
  paginateData,
} from "@/components/employee/employee-ui-helpers"
import { mergeApprovedLeaveDayKeys, ymdFromAttendanceDate } from "@/lib/leave-dates"
import { cn } from "@/lib/utils"

const itemsPerPage = 10

export function MyAttendanceModule() {
  const { data, loading, error, refetch } = useEmployeeDashboard()
  const [attendancePage, setAttendancePage] = useState(1)
  const [attendanceSearch, setAttendanceSearch] = useState("")
  const [attendanceSortField, setAttendanceSortField] = useState("date")
  const [attendanceSortDirection, setAttendanceSortDirection] = useState<"asc" | "desc">("desc")
  const [attendanceStartDate, setAttendanceStartDate] = useState("")
  const [attendanceEndDate, setAttendanceEndDate] = useState("")

  const getAttendancePaginationData = () => {
    if (!data?.employee?.attendances) {
      return { paginatedData: [] as any[], totalPages: 0, totalItems: 0 }
    }

    const leaveDays = mergeApprovedLeaveDayKeys(data.employee.approvedLeaves ?? [])
    const attendanceData: any[] = []
    const seenYmd = new Set<string>()

    for (const record of data.employee.attendances) {
      const ymd = ymdFromAttendanceDate(record.date)
      seenYmd.add(ymd)
      const onLeave = leaveDays.has(ymd)
      attendanceData.push({
        id: record.id,
        date: record.date,
        timeIn: record.timeIn,
        timeOut: record.timeOut,
        status: onLeave ? "LEAVE" : record.status,
        hours:
          record.timeIn && record.timeOut
            ? Math.round(
                ((new Date(record.timeOut).getTime() - new Date(record.timeIn).getTime()) / (1000 * 60 * 60)) * 10,
              ) / 10
            : 0,
        isLeaveDay: onLeave,
      })
    }

    for (const ymd of leaveDays) {
      if (seenYmd.has(ymd)) continue
      attendanceData.push({
        id: `leave-${ymd}`,
        date: new Date(`${ymd}T12:00:00`).toISOString(),
        timeIn: null,
        timeOut: null,
        status: "LEAVE",
        hours: 0,
        isLeaveDay: true,
      })
    }

    attendanceData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    let filteredAttendanceData = attendanceData
    if (attendanceStartDate || attendanceEndDate) {
      filteredAttendanceData = attendanceData.filter((record) => {
        const recordDate = new Date(record.date)
        const startDate = attendanceStartDate ? new Date(attendanceStartDate) : null
        const endDate = attendanceEndDate ? new Date(attendanceEndDate) : null

        if (startDate && endDate) {
          return recordDate >= startDate && recordDate <= endDate
        }
        if (startDate) return recordDate >= startDate
        if (endDate) return recordDate <= endDate
        return true
      })
    }

    const filteredAndSorted = filterAndSortData(
      filteredAttendanceData,
      attendanceSearch,
      attendanceSortField,
      attendanceSortDirection,
    )
    return paginateData(filteredAndSorted, attendancePage, itemsPerPage)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My Attendance</h1>
        <p className="text-muted-foreground mt-1">Your attendance history and filters</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Records</CardTitle>
          <CardDescription>Search, sort, and filter by date range</CardDescription>
        </CardHeader>
        <CardContent>
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

            <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                <span className="text-sm font-medium">Date range</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                    onClick={() =>
                      handleSort(
                        "date",
                        setAttendanceSortField,
                        setAttendanceSortDirection,
                        attendanceSortField,
                        attendanceSortDirection,
                      )
                    }
                  >
                    <div className="flex items-center gap-2">
                      Date
                      {getSortIcon("date", attendanceSortField, attendanceSortDirection)}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted"
                    onClick={() =>
                      handleSort(
                        "timeIn",
                        setAttendanceSortField,
                        setAttendanceSortDirection,
                        attendanceSortField,
                        attendanceSortDirection,
                      )
                    }
                  >
                    <div className="flex items-center gap-2">
                      Time in
                      {getSortIcon("timeIn", attendanceSortField, attendanceSortDirection)}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted"
                    onClick={() =>
                      handleSort(
                        "timeOut",
                        setAttendanceSortField,
                        setAttendanceSortDirection,
                        attendanceSortField,
                        attendanceSortDirection,
                      )
                    }
                  >
                    <div className="flex items-center gap-2">
                      Time out
                      {getSortIcon("timeOut", attendanceSortField, attendanceSortDirection)}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted"
                    onClick={() =>
                      handleSort(
                        "status",
                        setAttendanceSortField,
                        setAttendanceSortDirection,
                        attendanceSortField,
                        attendanceSortDirection,
                      )
                    }
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {getSortIcon("status", attendanceSortField, attendanceSortDirection)}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted"
                    onClick={() =>
                      handleSort(
                        "hours",
                        setAttendanceSortField,
                        setAttendanceSortDirection,
                        attendanceSortField,
                        attendanceSortDirection,
                      )
                    }
                  >
                    <div className="flex items-center gap-2">
                      Hours
                      {getSortIcon("hours", attendanceSortField, attendanceSortDirection)}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getAttendancePaginationData().paginatedData.map((record) => (
                  <TableRow
                    key={record.id}
                    className={cn(record.isLeaveDay && "bg-red-100 dark:bg-red-950/40")}
                  >
                    <TableCell className="font-mono text-sm">{new Date(record.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono text-sm">{formatTime(record.timeIn)}</TableCell>
                    <TableCell className="font-mono text-sm">{formatTime(record.timeOut)}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="font-medium">{record.hours > 0 ? `${record.hours}h` : "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

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
                  Page {attendancePage} of {getAttendancePaginationData().totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAttendancePage(attendancePage + 1)}
                  disabled={attendancePage >= getAttendancePaginationData().totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
