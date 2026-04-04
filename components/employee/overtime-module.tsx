"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, MoreHorizontal, Eye } from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"
import { useEmployeeRequests } from "@/hooks/use-employee-requests"
import { useClientDataTable } from "@/hooks/use-client-data-table"
import {
  AdminStylePrimaryCell,
  AdminStyleStatusBadge,
  EmployeeModuleTablePagination,
  EmployeeModuleTableToolbar,
} from "@/components/employee/admin-style-employee-table"
import { RequestStatusTabs, tabToEmployeeStatusFilter } from "@/components/request-status-tabs"

type OtRow = {
  id: string
  requestDate: string
  requestedMinutes: number
  status: string
  reason?: string | null
}

export function OvertimeModule() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const { requestsLoading, overtimeRequests, fetchMyRequests } = useEmployeeRequests()
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detailRow, setDetailRow] = useState<OtRow | null>(null)
  const [statusTab, setStatusTab] = useState("all")
  const statusFilter = tabToEmployeeStatusFilter(statusTab)

  const [otRequestDate, setOtRequestDate] = useState("")
  const [otRequestedMinutes, setOtRequestedMinutes] = useState<number>(60)
  const [otReason, setOtReason] = useState("")

  const userInitials =
    session?.user?.name
      ?.split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "ME"

  const resetForm = useCallback(() => {
    setOtRequestDate("")
    setOtRequestedMinutes(60)
    setOtReason("")
  }, [])

  const searchText = useCallback(
    (r: OtRow) =>
      `${r.requestDate} ${r.requestedMinutes} ${r.status} ${r.reason ?? ""}`.toLowerCase(),
    [],
  )

  const table = useClientDataTable<OtRow>(overtimeRequests as OtRow[], {
    searchText,
    statusFilter,
    statusField: "status",
  })

  useEffect(() => {
    fetchMyRequests()
  }, [fetchMyRequests])

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

      setSubmitting(true)
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
      resetForm()
      setFormOpen(false)
      fetchMyRequests()
    } catch (err) {
      console.error(err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit overtime request",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Overtime</h1>
          <p className="text-muted-foreground mt-1">Submit overtime requests to your department head</p>
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
            <DialogTitle>New overtime request</DialogTitle>
            <DialogDescription>Date, duration, and optional reason. Sent to your department head for approval.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Request date</label>
              <Input type="date" value={otRequestDate} onChange={(e) => setOtRequestDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Requested minutes</label>
              <Input
                type="number"
                min={1}
                value={otRequestedMinutes}
                onChange={(e) => setOtRequestedMinutes(parseInt(e.target.value, 10) || 0)}
                placeholder="Minutes"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason (optional)</label>
              <textarea
                value={otReason}
                onChange={(e) => setOtReason(e.target.value)}
                placeholder="Reason"
                className="w-full min-h-[80px] rounded-md border border-border bg-background p-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmitOvertime} disabled={requestsLoading || submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Overtime request</DialogTitle>
            <DialogDescription>Full details</DialogDescription>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Date: </span>
                {new Date(detailRow.requestDate).toLocaleDateString()}
              </p>
              <p>
                <span className="text-muted-foreground">Minutes: </span>
                {detailRow.requestedMinutes}
              </p>
              <p>
                <span className="text-muted-foreground">Status: </span>
                {detailRow.status}
              </p>
              <p>
                <span className="text-muted-foreground">Reason: </span>
                {detailRow.reason?.trim() || "—"}
              </p>
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
          <CardTitle>My overtime requests</CardTitle>
          <CardDescription>
            {requestsLoading ? "Loading…" : "Search, filter by status, and open actions for each request"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequestStatusTabs value={statusTab} onValueChange={setStatusTab} />
          <EmployeeModuleTableToolbar
            searchPlaceholder="Search overtime requests..."
            searchValue={table.search}
            onSearchChange={table.setSearch}
          />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Minutes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.totalItems === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                      No overtime requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  table.slice.map((r) => (
                    <TableRow key={r.id}>
                      <AdminStylePrimaryCell
                        initials={userInitials}
                        title="Overtime request"
                        subtitle={`Requested for ${new Date(r.requestDate).toLocaleDateString()}`}
                      />
                      <TableCell className="whitespace-nowrap">{new Date(r.requestDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{r.requestedMinutes}</TableCell>
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
