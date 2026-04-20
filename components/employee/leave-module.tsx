"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, MoreHorizontal, Eye, ExternalLink } from "lucide-react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar as CalendarUI } from "@/components/ui/calendar"
import { useToast } from "@/hooks/use-toast"
import { useEmployeeDashboard } from "@/hooks/use-employee-dashboard"
import { useEmployeeRequests } from "@/hooks/use-employee-requests"
import { useClientDataTable } from "@/hooks/use-client-data-table"
import {
  formatTime,
  getStatusBadge,
  submittedEmployeeRequestToastDescription,
} from "@/components/employee/employee-ui-helpers"
import {
  AdminStylePrimaryCell,
  AdminStyleStatusBadge,
  EmployeeModuleTablePagination,
  EmployeeModuleTableToolbar,
} from "@/components/employee/admin-style-employee-table"
import { RequestStatusTabs, tabToEmployeeStatusFilter } from "@/components/request-status-tabs"

type LeaveRow = {
  id: string
  startDate: string
  endDate: string
  status: string
  reason?: string | null
  attachmentPath?: string | null
}

export function LeaveModule() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const { data, loading, error, refetch } = useEmployeeDashboard()
  const { requestsLoading, leaveRequests, fetchMyRequests } = useEmployeeRequests()
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detailRow, setDetailRow] = useState<LeaveRow | null>(null)
  const [statusTab, setStatusTab] = useState("all")
  const statusFilter = tabToEmployeeStatusFilter(statusTab)

  const [leaveStartDate, setLeaveStartDate] = useState("")
  const [leaveEndDate, setLeaveEndDate] = useState("")
  const [leaveReason, setLeaveReason] = useState("")
  const [leaveAttachment, setLeaveAttachment] = useState<File | null>(null)
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date())

  const userInitials =
    session?.user?.name
      ?.split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "ME"

  const resetForm = useCallback(() => {
    setLeaveStartDate("")
    setLeaveEndDate("")
    setLeaveReason("")
    setLeaveAttachment(null)
  }, [])

  const searchText = useCallback(
    (r: LeaveRow) =>
      `${r.startDate} ${r.endDate} ${r.status} ${r.reason ?? ""} ${r.attachmentPath ?? ""}`.toLowerCase(),
    [],
  )

  const table = useClientDataTable<LeaveRow>(leaveRequests as LeaveRow[], {
    searchText,
    statusFilter,
    statusField: "status",
  })

  useEffect(() => {
    fetchMyRequests()
  }, [fetchMyRequests])

  const handleSubmitLeave = async () => {
    try {
      if (!leaveStartDate || !leaveEndDate) {
        toast({ title: "Error", description: "Please select start/end date.", variant: "destructive" })
        return
      }

      setSubmitting(true)
      const formData = new FormData()
      formData.append("startDate", leaveStartDate)
      formData.append("endDate", leaveEndDate)
      formData.append("reason", leaveReason || "")
      if (leaveAttachment) formData.append("attachment", leaveAttachment)

      const res = await fetch("/api/leave-requests", { method: "POST", body: formData })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Failed to submit leave request")

      toast({
        title: "Submitted",
        description: submittedEmployeeRequestToastDescription("leave", session?.user?.role),
      })
      resetForm()
      setFormOpen(false)
      fetchMyRequests()
    } catch (err) {
      console.error(err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit leave request",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading…</p>
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

  const approvedLeaveDates: Date[] = []
  for (const leave of leaveRequests) {
    if (leave?.status !== "APPROVED") continue
    const leaveStart = new Date(leave.startDate)
    const leaveEnd = new Date(leave.endDate)
    for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === monthAnchor.getFullYear() && d.getMonth() === monthAnchor.getMonth()) {
        const dayName = dayNameByIndex[d.getDay()]
        if (workingDayNames.includes(dayName)) approvedLeaveDates.push(new Date(d))
      }
    }
  }

  const selectedDayRecord = data.employee.attendances.find((a) => {
    const day = new Date(a.date)
    return calendarDate ? day.toDateString() === calendarDate.toDateString() : false
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Leave</h1>
          <p className="text-muted-foreground mt-1">Calendar, new leave requests, and request history</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New request
        </Button>
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New leave request</DialogTitle>
            <DialogDescription>Date range, optional reason, and optional attachment (image or PDF).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start date</label>
              <Input type="date" value={leaveStartDate} onChange={(e) => setLeaveStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">End date</label>
              <Input type="date" value={leaveEndDate} onChange={(e) => setLeaveEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason (optional)</label>
              <textarea
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="Reason"
                className="w-full min-h-[80px] rounded-md border border-border bg-background p-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Attachment (optional)</label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setLeaveAttachment(e.target.files?.[0] ?? null)}
                className="cursor-pointer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmitLeave} disabled={requestsLoading || submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave request</DialogTitle>
            <DialogDescription>Full details</DialogDescription>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Start: </span>
                {new Date(detailRow.startDate).toLocaleDateString()}
              </p>
              <p>
                <span className="text-muted-foreground">End: </span>
                {new Date(detailRow.endDate).toLocaleDateString()}
              </p>
              <p>
                <span className="text-muted-foreground">Status: </span>
                {detailRow.status}
              </p>
              <p>
                <span className="text-muted-foreground">Reason: </span>
                {detailRow.reason?.trim() || "—"}
              </p>
              {detailRow.attachmentPath && (
                <a
                  href={`/api/leave-requests/${detailRow.id}/attachment`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline underline-offset-2 text-sm"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open attachment
                </a>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailRow(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
          <CardDescription>Working days and approved leave</CardDescription>
        </CardHeader>
        <CardContent>
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
              <p className="text-sm font-medium">Selected day</p>
              <p className="text-sm text-muted-foreground">{calendarDate ? calendarDate.toDateString() : "—"}</p>
              {calendarDate ? (
                dayNameByIndex[calendarDate.getDay()] &&
                workingDayNames.includes(dayNameByIndex[calendarDate.getDay()]) &&
                data.employee.schedule ? (
                  <p className="text-xs">
                    Shift: <span className="font-medium">{data.employee.schedule.timeIn}</span> —{" "}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My leave requests</CardTitle>
          <CardDescription>
            {requestsLoading ? "Loading…" : "Search, filter by status, and open actions for each request"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequestStatusTabs value={statusTab} onValueChange={setStatusTab} />
          <EmployeeModuleTableToolbar
            searchPlaceholder="Search leave requests..."
            searchValue={table.search}
            onSearchChange={table.setSearch}
          />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.totalItems === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                      No leave requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  table.slice.map((r) => (
                    <TableRow key={r.id}>
                      <AdminStylePrimaryCell
                        initials={userInitials}
                        title="Leave request"
                        subtitle={`${new Date(r.startDate).toLocaleDateString()} – ${new Date(r.endDate).toLocaleDateString()}`}
                      />
                      <TableCell className="whitespace-nowrap">{new Date(r.startDate).toLocaleDateString()}</TableCell>
                      <TableCell className="whitespace-nowrap">{new Date(r.endDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <AdminStyleStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[200px] truncate text-muted-foreground">
                        {r.reason?.trim() || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailRow(r)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View details
                            </DropdownMenuItem>
                            {r.attachmentPath ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  window.open(`/api/leave-requests/${r.id}/attachment`, "_blank", "noopener,noreferrer")
                                }}
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open attachment
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <EmployeeModuleTablePagination
            currentPage={table.page}
            totalPages={table.totalPages}
            pageSize={table.pageSize}
            totalItems={table.totalItems}
            onPageChange={table.setPage}
            onPageSizeChange={table.onPageSizeChange}
          />
        </CardContent>
      </Card>
    </div>
  )
}
