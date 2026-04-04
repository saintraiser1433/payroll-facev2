"use client"

import type { ReactNode } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DataTablePagination } from "@/components/ui/data-table-pagination"

export function EmployeeModuleTableToolbar({
  searchPlaceholder,
  searchValue,
  onSearchChange,
  rightSlot,
}: {
  searchPlaceholder: string
  searchValue: string
  onSearchChange: (v: string) => void
  rightSlot?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0">
      <div className="relative flex-1">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8"
        />
      </div>
      {rightSlot}
    </div>
  )
}

export function StatusFilterSelect({
  value,
  onValueChange,
}: {
  value: string
  onValueChange: (v: string) => void
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full sm:w-[200px]">
        <SelectValue placeholder="Filter by status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        <SelectItem value="PENDING">Pending</SelectItem>
        <SelectItem value="APPROVED">Approved</SelectItem>
        <SelectItem value="REJECTED">Rejected</SelectItem>
      </SelectContent>
    </Select>
  )
}

/** Payslip period status (e.g. PROCESSED) — separate filter labels */
export function PayslipStatusFilterSelect({
  value,
  onValueChange,
  statuses,
}: {
  value: string
  onValueChange: (v: string) => void
  statuses: string[]
}) {
  const unique = Array.from(new Set(statuses.filter(Boolean)))
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full sm:w-[200px]">
        <SelectValue placeholder="Filter by period status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        {unique.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function AdminStylePrimaryCell({
  initials,
  title,
  subtitle,
}: {
  initials: string
  title: string
  subtitle: string
}) {
  return (
    <TableCell className="font-medium">
      <div className="flex items-center space-x-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs font-medium">{initials.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="font-medium truncate">{title}</div>
          <div className="text-sm text-muted-foreground truncate">{subtitle}</div>
        </div>
      </div>
    </TableCell>
  )
}

export function AdminStyleStatusBadge({ status }: { status: string }) {
  const s = (status || "").toUpperCase()
  if (s === "APPROVED") {
    return (
      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        Approved
      </Badge>
    )
  }
  if (s === "REJECTED") {
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-800 hover:bg-red-100">
        Rejected
      </Badge>
    )
  }
  return <Badge variant="secondary">Pending</Badge>
}

export function AdminStyleTextBadge({ children }: { children: ReactNode }) {
  return <Badge variant="secondary">{children}</Badge>
}

/** Payroll period status (matches admin schedule-style pill) */
export function AdminStyleOutlineBadge({ children }: { children: ReactNode }) {
  return <Badge variant="outline">{children}</Badge>
}

export function EmployeeModuleTablePagination(props: {
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
}) {
  return (
    <DataTablePagination
      currentPage={props.currentPage}
      totalPages={props.totalPages}
      pageSize={props.pageSize}
      totalItems={props.totalItems}
      onPageChange={props.onPageChange}
      onPageSizeChange={props.onPageSizeChange}
    />
  )
}
