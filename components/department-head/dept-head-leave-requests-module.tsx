"use client"

import { useEffect, useState } from "react"
import { Search, Eye, ExternalLink } from "lucide-react"
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

type LeaveRow = {
  id: string
  startDate: string
  endDate: string
  reason?: string | null
  attachmentPath?: string | null
  status: string
  employee: { firstName: string; lastName: string; position: string; email: string }
}

function statusBadgeVariant(s: string) {
  if (s === "APPROVED") return "default" as const
  if (s === "REJECTED") return "destructive" as const
  return "secondary" as const
}

export function DeptHeadLeaveRequestsModule() {
  const { toast } = useToast()
  const [list, setList] = useState<LeaveRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [sortField] = useState("startDate")
  const [sortDir] = useState<"asc" | "desc">("desc")
  const [review, setReview] = useState<LeaveRow | null>(null)
  const [acting, setActing] = useState(false)
  const [statusTab, setStatusTab] = useState("all")

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/leave-requests/department?status=${encodeURIComponent(statusTab)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to load")
      setList(data.requests || [])
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to load",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [statusTab])

  const rows = list.map((r) => {
    const start = new Date(r.startDate)
    const end = new Date(r.endDate)
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (86400000)) + 1)
    return {
      id: r.id,
      name: `${r.employee.firstName} ${r.employee.lastName}`,
      firstName: r.employee.firstName,
      lastName: r.employee.lastName,
      email: r.employee.email,
      position: r.employee.position,
      startDate: r.startDate,
      endDate: r.endDate,
      rangeLabel: `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`,
      badge: `${days} day${days === 1 ? "" : "s"}`,
      raw: r,
    }
  })

  const filtered = filterAndSortData(rows as any[], search, sortField, sortDir)
  const { paginatedData, totalItems } = paginateData(filtered, page, itemsPerPage)

  const decide = async (decision: "APPROVE" | "REJECT") => {
    if (!review) return
    try {
      setActing(true)
      const res = await fetch(`/api/leave-requests/${review.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to update")
      toast({ title: "Updated", description: `Leave request ${decision === "APPROVE" ? "approved" : "rejected"}.` })
      setReview(null)
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
          <CardTitle>Leave request</CardTitle>
          <CardDescription>Approve or reject leave from your department</CardDescription>
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
                  <TableHead>Duration</TableHead>
                  <TableHead>Leave period</TableHead>
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
                      No leave requests for this filter
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
                      <TableCell className="text-muted-foreground text-sm">{row.rangeLabel}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.raw.status)}>{row.raw.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => setReview(row.raw)}>
                          <Eye className="w-4 h-4 mr-1" />
                          {row.raw.status === "PENDING" ? "Review" : "View"}
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

      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave request</DialogTitle>
            <DialogDescription>
              {review && (
                <>
                  {review.employee.firstName} {review.employee.lastName} —{" "}
                  {new Date(review.startDate).toLocaleDateString()} to {new Date(review.endDate).toLocaleDateString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {review && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Status: </span>
                <Badge variant={statusBadgeVariant(review.status)} className="ml-1">
                  {review.status}
                </Badge>
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Reason: </span>
                {review.reason?.trim() || "—"}
              </p>
              {review.attachmentPath && (
                <a
                  href={review.attachmentPath}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline text-sm"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View attachment
                </a>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReview(null)} disabled={acting}>
              {review?.status === "PENDING" ? "Cancel" : "Close"}
            </Button>
            {review?.status === "PENDING" && (
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
