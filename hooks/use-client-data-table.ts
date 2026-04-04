"use client"

import { useMemo, useState, useEffect } from "react"

export function useClientDataTable<T extends object>(
  items: T[],
  options: {
    searchText: (row: T) => string
    statusFilter: string
    statusField?: keyof T
    initialPageSize?: number
  },
) {
  const { searchText, statusFilter, statusField, initialPageSize = 10 } = options
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const filtered = useMemo(() => {
    let rows = [...items]
    if (statusFilter && statusFilter !== "all" && statusField !== undefined) {
      const f = statusFilter.toUpperCase()
      rows = rows.filter(
        (r) => String((r as Record<string, unknown>)[statusField as string]).toUpperCase() === f,
      )
    }
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter((r) => searchText(r).toLowerCase().includes(q))
    }
    return rows
  }, [items, search, statusFilter, statusField, searchText])

  const totalItems = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1)
  const safePage = Math.min(page, totalPages)
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, items.length])

  const onPageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  return {
    search,
    setSearch,
    page: safePage,
    setPage,
    pageSize,
    onPageSizeChange,
    slice,
    totalItems,
    totalPages,
  }
}
