"use client"

import { useCallback, useMemo, useState } from "react"
import { MoreHorizontal, Download } from "lucide-react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Payslip } from "@/components/payslip"
import { useToast } from "@/hooks/use-toast"
import { useEmployeeDashboard } from "@/hooks/use-employee-dashboard"
import { useClientDataTable } from "@/hooks/use-client-data-table"
import type { EmployeeData } from "@/lib/employee-dashboard-types"
import { formatCurrency } from "@/components/employee/employee-ui-helpers"
import {
  AdminStyleOutlineBadge,
  AdminStylePrimaryCell,
  EmployeeModuleTablePagination,
  EmployeeModuleTableToolbar,
  PayslipStatusFilterSelect,
} from "@/components/employee/admin-style-employee-table"

type PayrollItem = EmployeeData["employee"]["payrollItems"][number]

type PayslipRow = {
  id: string
  period: string
  basicPay: number
  netPay: number
  status: string
  originalPayroll: PayrollItem
}

export function MyPayslipModule() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const { data, loading, error, refetch } = useEmployeeDashboard()
  const [isPayslipOpen, setIsPayslipOpen] = useState(false)
  const [payslipData, setPayslipData] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState("all")

  const userInitials =
    session?.user?.name
      ?.split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "ME"

  const payrollRows: PayslipRow[] = useMemo(() => {
    if (!data?.employee?.payrollItems) return []
    return data.employee.payrollItems.map((payslip) => ({
      id: payslip.id,
      period: payslip.payrollPeriod.name,
      basicPay: payslip.basicPay,
      netPay: payslip.netPay,
      status: payslip.payrollPeriod.status,
      originalPayroll: payslip,
    }))
  }, [data])

  const periodStatuses = useMemo(() => payrollRows.map((r) => r.status), [payrollRows])

  const searchText = useCallback(
    (r: PayslipRow) =>
      `${r.period} ${r.status} ${r.basicPay} ${r.netPay} ${formatCurrency(r.netPay)}`.toLowerCase(),
    [],
  )

  const table = useClientDataTable<PayslipRow>(payrollRows, {
    searchText,
    statusFilter,
    statusField: "status",
  })

  const handleGeneratePayslip = async (payrollItem: PayrollItem) => {
    if (!payrollItem?.id) {
      toast({ title: "Error", description: "Invalid payroll item", variant: "destructive" })
      return
    }

    try {
      const response = await fetch("/api/payroll/generate-payslip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payrollItemId: payrollItem.id }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to generate payslip")
      }

      const json = await response.json()
      setPayslipData(json.payslipData)
      setIsPayslipOpen(true)
      toast({
        title: "Success",
        description: `Payslip generated for ${payrollItem?.payrollPeriod?.name || "payroll period"}`,
      })
    } catch (e) {
      console.error(e)
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to generate payslip",
        variant: "destructive",
      })
    }
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
        <h1 className="text-2xl font-semibold text-foreground">My Payslip</h1>
        <p className="text-muted-foreground mt-1">View and download payslips for your payroll periods</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payslips</CardTitle>
          <CardDescription>Search, filter by period status, and download PDF from the actions menu</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <EmployeeModuleTableToolbar
            searchPlaceholder="Search payslips..."
            searchValue={table.search}
            onSearchChange={table.setSearch}
            rightSlot={
              <PayslipStatusFilterSelect
                value={statusFilter}
                onValueChange={setStatusFilter}
                statuses={periodStatuses}
              />
            }
          />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payroll</TableHead>
                  <TableHead className="text-right">Basic pay</TableHead>
                  <TableHead className="text-right">Net pay</TableHead>
                  <TableHead>Period status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.totalItems === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                      No payslips found
                    </TableCell>
                  </TableRow>
                ) : (
                  table.slice.map((r) => (
                    <TableRow key={r.id}>
                      <AdminStylePrimaryCell
                        initials={userInitials}
                        title={r.period}
                        subtitle={`Net pay ${formatCurrency(r.netPay)}`}
                      />
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.basicPay)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-green-600">
                        {formatCurrency(r.netPay)}
                      </TableCell>
                      <TableCell>
                        <AdminStyleOutlineBadge>{r.status}</AdminStyleOutlineBadge>
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
                            <DropdownMenuItem onClick={() => handleGeneratePayslip(r.originalPayroll)}>
                              <Download className="mr-2 h-4 w-4" />
                              Download PDF
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

      {payslipData && (
        <Payslip
          isOpen={isPayslipOpen}
          onClose={() => {
            setIsPayslipOpen(false)
            setPayslipData(null)
          }}
          payslipData={payslipData}
        />
      )}
    </div>
  )
}
