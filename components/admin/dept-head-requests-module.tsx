"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

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
        <CardTitle>Department Head Requests</CardTitle>
        <CardDescription>Approve or reject department head overtime, leave, and cash advance requests.</CardDescription>
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
  rows,
  renderInfo,
  acting,
  onApprove,
  onReject,
}: {
  rows: ReqRow[]
  renderInfo: (r: ReqRow) => ReactNode
  acting: boolean
  onApprove: (r: ReqRow) => void
  onReject: (r: ReqRow) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Department Head</TableHead>
          <TableHead>Request</TableHead>
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
            <TableCell>
              <Badge variant="secondary">{r.status}</Badge>
            </TableCell>
            <TableCell className="text-right space-x-2">
              <Button size="sm" variant="outline" onClick={() => onReject(r)} disabled={acting}>
                Reject
              </Button>
              <Button size="sm" onClick={() => onApprove(r)} disabled={acting}>
                Approve
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              No pending requests.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

