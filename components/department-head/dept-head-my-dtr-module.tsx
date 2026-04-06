"use client"

import { useState } from "react"
import { Search, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useDepartmentHeadDashboard } from "@/hooks/use-department-head-dashboard"
import { filterAndSortData, paginateData } from "@/lib/dept-head-table-helpers"
import { formatTime, getStatusBadge } from "@/components/employee/employee-ui-helpers"
import { mergeApprovedLeaveDayKeys, ymdFromAttendanceDate } from "@/lib/leave-dates"
import { cn } from "@/lib/utils"
import { DeptHeadTablePaginationFooter } from "@/components/department-head/dept-head-table-pagination-footer"

const itemsPerPage = 10

export function DeptHeadMyDtrModule() {
  const { data, loading, error, refetch } = useDepartmentHeadDashboard()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

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

  const leaveDays = mergeApprovedLeaveDayKeys(data.employee.approvedLeaves ?? [])
  const attendanceData: any[] = []
  const seenYmd = new Set<string>()

  for (const a of data.employee.attendances ?? []) {
    const ymd = ymdFromAttendanceDate(a.date)
    seenYmd.add(ymd)
    const onLeave = leaveDays.has(ymd)
    attendanceData.push({
      id: a.id,
      date: a.date,
      timeIn: a.timeIn,
      timeOut: a.timeOut,
      status: onLeave ? "LEAVE" : a.status,
      lateMinutes: a.lateMinutes,
      overtimeMinutes: a.overtimeMinutes,
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
      lateMinutes: 0,
      overtimeMinutes: 0,
      isLeaveDay: true,
    })
  }

  attendanceData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const filteredSorted = filterAndSortData(attendanceData, search, sortField, sortDir)
  const { paginatedData, totalItems } = paginateData(filteredSorted, page, itemsPerPage)

  return (
    <Card>
      <CardHeader>
        <CardTitle>My DTR</CardTitle>
        <CardDescription>Your personal daily time records</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search attendance records..."
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
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("date")}>
                  <div className="flex items-center gap-2">
                    Date
                    {getSortIcon("date")}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("timeIn")}>
                  <div className="flex items-center gap-2">
                    Time in
                    {getSortIcon("timeIn")}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("timeOut")}>
                  <div className="flex items-center gap-2">
                    Time out
                    {getSortIcon("timeOut")}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("status")}>
                  <div className="flex items-center gap-2">
                    Status
                    {getSortIcon("status")}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("lateMinutes")}>
                  <div className="flex items-center gap-2">
                    Late minutes
                    {getSortIcon("lateMinutes")}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("overtimeMinutes")}>
                  <div className="flex items-center gap-2">
                    Overtime
                    {getSortIcon("overtimeMinutes")}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                    No attendance records
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row: any) => (
                  <TableRow
                    key={row.id}
                    className={cn(row.isLeaveDay && "bg-red-100 dark:bg-red-950/40")}
                  >
                    <TableCell className="font-mono text-sm">{new Date(row.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono text-sm">{formatTime(row.timeIn)}</TableCell>
                    <TableCell className="font-mono text-sm">{formatTime(row.timeOut)}</TableCell>
                    <TableCell>{getStatusBadge(row.status)}</TableCell>
                    <TableCell className="font-medium">{row.lateMinutes}m</TableCell>
                    <TableCell className="font-medium">{row.overtimeMinutes}m</TableCell>
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
  )
}
