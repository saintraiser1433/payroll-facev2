"use client"

import { useEffect, useState } from "react"
import { Search, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { filterAndSortData, paginateData } from "@/lib/dept-head-table-helpers"
import { DeptHeadTablePaginationFooter } from "@/components/department-head/dept-head-table-pagination-footer"
import { RequestStatusTabs } from "@/components/request-status-tabs"

const itemsPerPage = 10

type OtRequest = {
  id: string
  requestDate: string
  requestedMinutes: number
  reason?: string | null
  status: string
  employee: {
    id: string
    firstName: string
    lastName: string
    position: string
    email: string
  }
}

function statusBadgeVariant(s: string) {
  if (s === "APPROVED") return "default" as const
  if (s === "REJECTED") return "destructive" as const
  return "secondary" as const
}

export function DeptHeadOvertimeRequestsModule() {
  const { toast } = useToast()
  const [list, setList] = useState<OtRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [sortField] = useState("requestDate")
  const [sortDir] = useState<"asc" | "desc">("desc")
  const [active, setActive] = useState<OtRequest | null>(null)
  const [acting, setActing] = useState(false)
  const [statusTab, setStatusTab] = useState("all")

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/overtime-requests/department?status=${encodeURIComponent(statusTab)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to load")
      setList(data.requests || [])
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to load requests",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [statusTab])

  const rows = list.map((r) => ({
    id: r.id,
    name: `${r.employee.firstName} ${r.employee.lastName}`,
    firstName: r.employee.firstName,
    lastName: r.employee.lastName,
    email: r.employee.email,
    position: r.employee.position,
    requestDate: r.requestDate,
    badge: `${r.requestedMinutes} min`,
    minutes: r.requestedMinutes,
    raw: r,
  }))

  const filtered = filterAndSortData(rows as any[], search, sortField, sortDir)
  const { paginatedData, totalItems } = paginateData(filtered, page, itemsPerPage)

  const decide = async (decision: "APPROVE" | "REJECT") => {
    if (!active) return
    try {
      setActing(true)
      const res = await fetch(`/api/overtime-requests/${active.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          approvedMinutes: decision === "APPROVE" ? active.requestedMinutes : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to update")
      toast({ title: "Updated", description: `Request ${decision === "APPROVE" ? "approved" : "rejected"}.` })
      setActive(null)
      load()
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed",
        variant: "destructive",
      })
    } finally {
      setActing(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Overtime request</CardTitle>
          <CardDescription>Approve or reject overtime from your department</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequestStatusTabs
            value={statusTab}
            onValueChange={(v) => {
              setStatusTab(v)
              setPage(1)
            }}
          />
          <div className="flex items-center gap-4">
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
                  <TableHead>Employee</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Requested OT</TableHead>
                  <TableHead>Request date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                      No overtime requests for this filter
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {row.firstName[0]}
                              {row.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{row.name}</div>
                            <div className="text-sm text-muted-foreground">{row.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{row.position}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          {row.badge}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(row.requestDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.raw.status)}>{row.raw.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => setActive(row.raw)}>
                          <FileText className="w-4 h-4 mr-1" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {!loading && (
              <DeptHeadTablePaginationFooter
                page={page}
                setPage={setPage}
                itemsPerPage={itemsPerPage}
                totalItems={totalItems}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Overtime request details</DialogTitle>
            <DialogDescription>
              {active && (
                <>
                  {active.employee.firstName} {active.employee.lastName} — {active.requestedMinutes} minutes on{" "}
                  {new Date(active.requestDate).toLocaleDateString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {active && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                <Badge variant={statusBadgeVariant(active.status)} className="mt-1">
                  {active.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reason</p>
                <p className="mt-1 whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-foreground min-h-[3rem]">
                  {active.reason?.trim() || "—"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Overtime requests do not include file attachments.</p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setActive(null)} disabled={acting}>
              {active?.status === "PENDING" ? "Cancel" : "Close"}
            </Button>
            {active?.status === "PENDING" && (
              <>
                <Button variant="destructive" onClick={() => decide("REJECT")} disabled={acting}>
                  Reject
                </Button>
                <Button onClick={() => decide("APPROVE")} disabled={acting}>
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
