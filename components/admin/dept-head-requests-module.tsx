"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { ExternalLink, FileText } from "lucide-react"

type ReqRow = {
  id: string
  status: string
  employee: {
    firstName: string
    lastName: string
    employeeId: string
    position: string
  }
  requestDate?: string
  requestedMinutes?: number
  startDate?: string
  endDate?: string
  dateIssued?: string
  amount?: number
  reason?: string | null
  attachmentPath?: string | null
}

export function DeptHeadRequestsModule() {
  const { toast } = useToast()
  const [ot, setOt] = useState<ReqRow[]>([])
  const [leave, setLeave] = useState<ReqRow[]>([])
  const [cash, setCash] = useState<ReqRow[]>([])
  const [acting, setActing] = useState(false)

  const load = async () => {
    try {
      const [a, b, c] = await Promise.all([
        fetch("/api/overtime-requests/pending"),
        fetch("/api/leave-requests/pending"),
        fetch("/api/cash-advances/pending"),
      ])
      setOt(((await a.json()).requests || []) as ReqRow[])
      setLeave(((await b.json()).requests || []) as ReqRow[])
      setCash(((await c.json()).cashAdvances || []) as ReqRow[])
    } catch {
      toast({ title: "Error", description: "Failed to load department head requests", variant: "destructive" })
    }
  }

  useEffect(() => {
    load()
  }, [])

  const decide = async (
    kind: "ot" | "leave" | "cash",
    id: string,
    decision: "APPROVE" | "REJECT",
    requestedMinutes?: number,
  ) => {
    try {
      setActing(true)
      const url =
        kind === "ot"
          ? `/api/overtime-requests/${id}/decision`
          : kind === "leave"
            ? `/api/leave-requests/${id}/decision`
            : `/api/cash-advances/${id}/decision`
      const body: any = { decision }
      if (kind === "ot" && decision === "APPROVE") {
        body.approvedMinutes = requestedMinutes ?? 0
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const err = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(err.error || "Decision failed")
      toast({ title: "Updated", description: "Request status updated." })
      load()
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to update",
        variant: "destructive",
      })
    } finally {
      setActing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Requests</CardTitle>
        <CardDescription>
          Approve or reject department head overtime and leave. Cash advances (including employees) are approved here by
          admin only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ot">
          <TabsList>
            <TabsTrigger value="ot">Overtime</TabsTrigger>
            <TabsTrigger value="leave">Leave</TabsTrigger>
            <TabsTrigger value="cash">Cash Advance</TabsTrigger>
          </TabsList>

          <TabsContent value="ot">
            <RequestTable
              kind="ot"
              rows={ot}
              renderInfo={(r) => (
                <span>
                  {new Date(r.requestDate || "").toLocaleDateString()} · {r.requestedMinutes} mins
                </span>
              )}
              acting={acting}
              onApprove={(r) => decide("ot", r.id, "APPROVE", r.requestedMinutes)}
              onReject={(r) => decide("ot", r.id, "REJECT")}
            />
          </TabsContent>
          <TabsContent value="leave">
            <RequestTable
              kind="leave"
              rows={leave}
              renderInfo={(r) => (
                <span>
                  {new Date(r.startDate || "").toLocaleDateString()} - {new Date(r.endDate || "").toLocaleDateString()}
                </span>
              )}
              acting={acting}
              onApprove={(r) => decide("leave", r.id, "APPROVE")}
              onReject={(r) => decide("leave", r.id, "REJECT")}
            />
          </TabsContent>
          <TabsContent value="cash">
            <RequestTable
              kind="cash"
              rows={cash}
              renderInfo={(r) => (
                <span>
                  {new Date(r.dateIssued || "").toLocaleDateString()} · ₱{(r.amount || 0).toFixed(2)}
                </span>
              )}
              acting={acting}
              onApprove={(r) => decide("cash", r.id, "APPROVE")}
              onReject={(r) => decide("cash", r.id, "REJECT")}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function RequestTable({
  kind,
  rows,
  renderInfo,
  acting,
  onApprove,
  onReject,
}: {
  kind: "ot" | "leave" | "cash"
  rows: ReqRow[]
  renderInfo: (r: ReqRow) => ReactNode
  acting: boolean
  onApprove: (r: ReqRow) => void
  onReject: (r: ReqRow) => void
}) {
  const [detailRow, setDetailRow] = useState<ReqRow | null>(null)

  const detailTitle =
    kind === "ot" ? "Overtime request details" : kind === "leave" ? "Leave request details" : "Cash advance details"

  return (
    <>
    <div className="w-full overflow-x-auto rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Requester</TableHead>
          <TableHead>Request</TableHead>
          <TableHead className="min-w-[140px] max-w-[240px]">Reason</TableHead>
          <TableHead className="w-[100px]">Attachment</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              {r.employee.firstName} {r.employee.lastName}
              <div className="text-xs text-muted-foreground">{r.employee.employeeId} · {r.employee.position}</div>
            </TableCell>
            <TableCell>{renderInfo(r)}</TableCell>
            <TableCell className="max-w-[240px] align-top">
              <span className="line-clamp-3 text-sm text-muted-foreground" title={r.reason?.trim() || undefined}>
                {r.reason?.trim() ? r.reason.trim() : "—"}
              </span>
            </TableCell>
            <TableCell className="align-top">
              {r.attachmentPath ? (
                <a
                  href={`/api/leave-requests/${r.id}/attachment`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-2"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  Open
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{r.status}</Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setDetailRow(r)} disabled={acting}>
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Details
                </Button>
                <Button size="sm" variant="outline" onClick={() => onReject(r)} disabled={acting}>
                  Reject
                </Button>
                <Button size="sm" onClick={() => onApprove(r)} disabled={acting}>
                  Approve
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              No pending requests.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
    </div>

    <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{detailTitle}</DialogTitle>
          <DialogDescription>
            {detailRow && (
              <>
                {detailRow.employee.firstName} {detailRow.employee.lastName} ({detailRow.employee.employeeId})
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {detailRow && (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Request</p>
              <p className="mt-1">{renderInfo(detailRow)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reason</p>
              <p className="mt-1 whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-foreground min-h-[3rem]">
                {detailRow.reason?.trim() || "—"}
              </p>
            </div>
            {kind === "leave" && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attachment</p>
                {detailRow.attachmentPath ? (
                  <a
                    href={`/api/leave-requests/${detailRow.id}/attachment`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-primary underline underline-offset-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open attachment
                  </a>
                ) : (
                  <p className="mt-1 text-muted-foreground">No attachment</p>
                )}
              </div>
            )}
            {kind === "cash" && (
              <p className="text-xs text-muted-foreground">Cash advance requests do not include file attachments.</p>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
              <Badge variant="secondary" className="mt-1">
                {detailRow.status}
              </Badge>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setDetailRow(null)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

