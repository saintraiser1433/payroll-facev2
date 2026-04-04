"use client"

import { useState } from "react"
import { Search, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { useDepartmentHeadDashboard } from "@/hooks/use-department-head-dashboard"
import { filterAndSortData, paginateData } from "@/lib/dept-head-table-helpers"
import { DeptHeadTablePaginationFooter } from "@/components/department-head/dept-head-table-pagination-footer"

const itemsPerPage = 10

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount)
}

export function DepartmentPayrollModule() {
  const { data, loading, error, refetch } = useDepartmentHeadDashboard()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

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

  const rows = data.employee.department.employees.map((emp) => {
    const latest = emp.payrollItems[0]
    return {
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      position: emp.position,
      basicPay: latest?.basicPay ?? 0,
      netPay: latest?.netPay ?? 0,
      period: latest?.payrollPeriod.name ?? "N/A",
      status: latest?.payrollPeriod.status ?? "N/A",
      firstName: emp.firstName,
      lastName: emp.lastName,
    }
  })

  const filteredSorted = filterAndSortData(rows, search, sortField, sortDir)
  const { paginatedData, totalItems } = paginateData(filteredSorted, page, itemsPerPage)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Department payroll</CardTitle>
        <CardDescription>Payroll summary for department members</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
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
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-2">
                    Employee
                    {getSortIcon("name")}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("position")}>
                  <div className="flex items-center gap-2">
                    Position
                    {getSortIcon("position")}
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
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("period")}>
                  <div className="flex items-center gap-2">
                    Period
                    {getSortIcon("period")}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort("status")}>
                  <div className="flex items-center gap-2">
                    Status
                    {getSortIcon("status")}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((emp: any) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {emp.firstName[0]}
                            {emp.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="font-medium">{emp.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>{emp.position}</TableCell>
                    <TableCell>{formatCurrency(emp.basicPay)}</TableCell>
                    <TableCell className="font-medium text-green-600">{formatCurrency(emp.netPay)}</TableCell>
                    <TableCell>{emp.period}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        {emp.status}
                      </Badge>
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
  )
}
