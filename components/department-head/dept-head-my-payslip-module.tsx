"use client"

import { useState } from "react"
import { Search, Download, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Payslip } from "@/components/payslip"
import { useToast } from "@/hooks/use-toast"
import { useDepartmentHeadDashboard } from "@/hooks/use-department-head-dashboard"
import { filterAndSortData, paginateData } from "@/lib/dept-head-table-helpers"
import { DeptHeadTablePaginationFooter } from "@/components/department-head/dept-head-table-pagination-footer"

const itemsPerPage = 10

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount)
}

export function DeptHeadMyPayslipModule() {
  const { toast } = useToast()
  const { data, loading, error, refetch } = useDepartmentHeadDashboard()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState("period")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [payslipOpen, setPayslipOpen] = useState(false)
  const [payslipData, setPayslipData] = useState<any>(null)

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

  const handleGeneratePayslip = async (payrollItem: any) => {
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
      setPayslipOpen(true)
      toast({
        title: "Success",
        description: `Payslip generated for ${payrollItem?.payrollPeriod?.name || "payroll period"}`,
      })
    } catch (e) {
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

  const rows =
    data.employee.payrollItems?.map((p) => ({
      id: p.id,
      period: p.payrollPeriod.name,
      basicPay: p.basicPay,
      netPay: p.netPay,
      status: p.payrollPeriod.status,
      originalPayroll: p,
    })) ?? []

  const filteredSorted = filterAndSortData(rows, search, sortField, sortDir)
  const { paginatedData, totalItems } = paginateData(filteredSorted, page, itemsPerPage)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>My payslip</CardTitle>
          <CardDescription>Download your personal payslips</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search payslips..."
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
                  <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("period")}>
                    <div className="flex items-center gap-2">
                      Period
                      {getSortIcon("period")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("basicPay")}>
                    <div className="flex items-center gap-2">
                      Basic pay
                      {getSortIcon("basicPay")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("netPay")}>
                    <div className="flex items-center gap-2">
                      Net pay
                      {getSortIcon("netPay")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("status")}>
                    <div className="flex items-center gap-2">
                      Status
                      {getSortIcon("status")}
                    </div>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                      No payslips found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.period}</TableCell>
                      <TableCell>{formatCurrency(row.basicPay)}</TableCell>
                      <TableCell className="font-medium text-green-600">{formatCurrency(row.netPay)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => handleGeneratePayslip(row.originalPayroll)}>
                          <Download className="w-4 h-4 mr-1" />
                          PDF
                        </Button>
                      </TableCell>
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

      {payslipData && (
        <Payslip
          isOpen={payslipOpen}
          onClose={() => {
            setPayslipOpen(false)
            setPayslipData(null)
          }}
          payslipData={payslipData}
        />
      )}
    </>
  )
}
