"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

/** Shared by employee modules (client filter) and dept-head modules (API filter). Values: all | pending | approved | rejected */
export function RequestStatusTabs({
  value,
  onValueChange,
  className,
}: {
  value: string
  onValueChange: (v: string) => void
  className?: string
}) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={className ?? "w-full"}>
      <TabsList className="grid w-full max-w-xl grid-cols-4 h-9">
        <TabsTrigger value="all" className="text-xs sm:text-sm">
          All
        </TabsTrigger>
        <TabsTrigger value="pending" className="text-xs sm:text-sm">
          Pending
        </TabsTrigger>
        <TabsTrigger value="approved" className="text-xs sm:text-sm">
          Approved
        </TabsTrigger>
        <TabsTrigger value="rejected" className="text-xs sm:text-sm">
          Rejected
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

/** Maps tab value to employee table status filter (PENDING, APPROVED, REJECTED, all). */
export function tabToEmployeeStatusFilter(tab: string): string {
  if (tab === "pending") return "PENDING"
  if (tab === "approved") return "APPROVED"
  if (tab === "rejected") return "REJECTED"
  return "all"
}
