"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function DeptHeadTablePaginationFooter({
  page,
  setPage,
  itemsPerPage,
  totalItems,
}: {
  page: number
  setPage: (p: number) => void
  itemsPerPage: number
  totalItems: number
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage) || 1)
  const start = totalItems === 0 ? 0 : (page - 1) * itemsPerPage + 1
  const end = Math.min(page * itemsPerPage, totalItems)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <div className="text-sm text-muted-foreground">
        Showing {start} to {end} of {totalItems} entries
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>
        <span className="text-sm">
          Page {page} of {totalPages}
        </span>
        <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
