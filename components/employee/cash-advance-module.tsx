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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useEmployeeRequests } from "@/hooks/use-employee-requests"
import { useClientDataTable } from "@/hooks/use-client-data-table"
import { formatCurrency } from "@/components/employee/employee-ui-helpers"
import {
  AdminStylePrimaryCell,
  AdminStyleStatusBadge,
  EmployeeModuleTablePagination,
  EmployeeModuleTableToolbar,
} from "@/components/employee/admin-style-employee-table"
import { RequestStatusTabs, tabToEmployeeStatusFilter } from "@/components/request-status-tabs"

type CashRow = {
  id: string
  dateIssued: string
  amount: number
  status: string
  reason?: string | null
}

export function CashAdvanceModule() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const { requestsLoading, cashAdvances, fetchMyRequests } = useEmployeeRequests()
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detailRow, setDetailRow] = useState<CashRow | null>(null)
  const [statusTab, setStatusTab] = useState("all")
  const statusFilter = tabToEmployeeStatusFilter(statusTab)

  const [cashAdvanceDateIssued, setCashAdvanceDateIssued] = useState<string>(new Date().toISOString().slice(0, 10))
  const [cashAdvanceAmount, setCashAdvanceAmount] = useState<number>(0)
  const [cashAdvanceReason, setCashAdvanceReason] = useState("")
  const [repaymentType, setRepaymentType] = useState<"FULL" | "INSTALLMENT">("FULL")
  const [installmentCount, setInstallmentCount] = useState(2)
  const [interestRate, setInterestRate] = useState(0)
  const [policy, setPolicy] = useState({
    fullPaymentInterestRate: 0,
    installmentInterestRate: 0,
    installmentMaxPeriods: 12,
  })

  const userInitials =
    session?.user?.name
      ?.split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "ME"

  const resetForm = useCallback(() => {
    setCashAdvanceAmount(0)
    setCashAdvanceReason("")
    setCashAdvanceDateIssued(new Date().toISOString().slice(0, 10))
  }, [])

  const searchText = useCallback(
    (r: CashRow) =>
      `${r.dateIssued} ${r.amount} ${r.status} ${r.reason ?? ""}`.toLowerCase(),
    [],
  )

  const table = useClientDataTable<CashRow>(cashAdvances as CashRow[], {
    searchText,
    statusFilter,
    statusField: "status",
  })

  useEffect(() => {
    fetchMyRequests()
  }, [fetchMyRequests])

  const handleSubmitCashAdvance = async () => {
    try {
      if (!cashAdvanceAmount || cashAdvanceAmount <= 0) {
        toast({ title: "Error", description: "Please enter amount.", variant: "destructive" })
        return
      }

      setSubmitting(true)
      if (repaymentType === "INSTALLMENT") {
        if (installmentCount < 2 || installmentCount > policy.installmentMaxPeriods) {
          toast({
            title: "Invalid installments",
            description: `Choose 2–${policy.installmentMaxPeriods} periods.`,
            variant: "destructive",
          })
          return
        }
      }

      const res = await fetch("/api/cash-advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: cashAdvanceAmount,
          dateIssued: cashAdvanceDateIssued,
          reason: cashAdvanceReason || null,
          repaymentType,
          installmentCount: repaymentType === "INSTALLMENT" ? installmentCount : null,
          interestRate,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to submit cash advance request")

      toast({ title: "Submitted", description: "Cash advance request sent to Dept Head." })
      resetForm()
      setFormOpen(false)
      fetchMyRequests()
    } catch (err) {
      console.error(err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit cash advance request",
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
          <h1 className="text-2xl font-semibold text-foreground">Cash advance</h1>
          <p className="text-muted-foreground mt-1">Apply for a cash advance through your department head</p>
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
            <DialogTitle>New cash advance</DialogTitle>
            <DialogDescription>Amount, date issued, and optional reason.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date issued</label>
              <Input type="date" value={cashAdvanceDateIssued} onChange={(e) => setCashAdvanceDateIssued(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount (PHP)</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={cashAdvanceAmount}
                onChange={(e) => setCashAdvanceAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Repayment</Label>
              <Select
                value={repaymentType}
                onValueChange={(v) => setRepaymentType(v as "FULL" | "INSTALLMENT")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL">Full (next payroll period)</SelectItem>
                  <SelectItem value="INSTALLMENT">Installment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {repaymentType === "INSTALLMENT" && (
              <div className="space-y-1.5">
                <Label>Number of payroll periods</Label>
                <Input
                  type="number"
                  min={2}
                  max={policy.installmentMaxPeriods}
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(parseInt(e.target.value, 10) || 2)}
                />
                <p className="text-xs text-muted-foreground">Max {policy.installmentMaxPeriods} (admin setting)</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Interest rate (%)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Total repayable:{" "}
                {formatCurrency(cashAdvanceAmount * (1 + interestRate / 100))}
                {repaymentType === "INSTALLMENT" && cashAdvanceAmount > 0 && (
                  <>
                    {" "}
                    · Per period ~{" "}
                    {formatCurrency(
                      (cashAdvanceAmount * (1 + interestRate / 100)) / Math.max(installmentCount, 1),
                    )}
                  </>
                )}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason (optional)</label>
              <textarea
                value={cashAdvanceReason}
                onChange={(e) => setCashAdvanceReason(e.target.value)}
                placeholder="Reason"
                className="w-full min-h-[80px] rounded-md border border-border bg-background p-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmitCashAdvance} disabled={requestsLoading || submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cash advance</DialogTitle>
            <DialogDescription>Full details</DialogDescription>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Date issued: </span>
                {new Date(detailRow.dateIssued).toLocaleDateString()}
              </p>
              <p>
                <span className="text-muted-foreground">Amount: </span>
                {formatCurrency(detailRow.amount)}
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
          <CardTitle>My cash advances</CardTitle>
          <CardDescription>
            {requestsLoading ? "Loading…" : "Search, filter by status, and open actions for each request"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequestStatusTabs value={statusTab} onValueChange={setStatusTab} />
          <EmployeeModuleTableToolbar
            searchPlaceholder="Search cash advances..."
            searchValue={table.search}
            onSearchChange={table.setSearch}
          />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Date issued</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.totalItems === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                      No cash advances found
                    </TableCell>
                  </TableRow>
                ) : (
                  table.slice.map((r) => (
                    <TableRow key={r.id}>
                      <AdminStylePrimaryCell
                        initials={userInitials}
                        title="Cash advance"
                        subtitle={`Issued ${new Date(r.dateIssued).toLocaleDateString()}`}
                      />
                      <TableCell className="whitespace-nowrap">{new Date(r.dateIssued).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatCurrency(r.amount)}</TableCell>
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
