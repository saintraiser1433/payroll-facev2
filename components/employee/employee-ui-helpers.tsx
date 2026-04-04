"use client"

import { Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function getStatusBadge(status: string) {
  switch (status) {
    case "PRESENT":
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-700">
          <CheckCircle className="w-3 h-3 mr-1" />
          Present
        </Badge>
      )
    case "LATE":
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Late
        </Badge>
      )
    case "OVERTIME":
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
          <Clock className="w-3 h-3 mr-1" />
          Overtime
        </Badge>
      )
    case "ABSENT":
      return (
        <Badge variant="secondary" className="bg-red-100 text-red-700">
          <XCircle className="w-3 h-3 mr-1" />
          Absent
        </Badge>
      )
    default:
      return null
  }
}

export function formatTime(dateString: string | null) {
  if (!dateString) return "N/A"
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount)
}

export function handleSort(
  field: string,
  setSortField: (field: string) => void,
  setSortDirection: (direction: "asc" | "desc") => void,
  currentField: string,
  currentDirection: "asc" | "desc",
) {
  if (currentField === field) {
    setSortDirection(currentDirection === "asc" ? "desc" : "asc")
  } else {
    setSortField(field)
    setSortDirection("asc")
  }
}

export function getSortIcon(field: string, currentField: string, currentDirection: "asc" | "desc") {
  if (currentField !== field) return null
  return currentDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
}

export function filterAndSortData(
  rows: any[],
  searchTerm: string,
  sortField: string,
  sortDirection: "asc" | "desc",
) {
  let filtered = rows

  if (searchTerm) {
    filtered = rows.filter((item) =>
      Object.values(item).some((value) => value?.toString().toLowerCase().includes(searchTerm.toLowerCase())),
    )
  }

  filtered.sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
    return 0
  })

  return filtered
}

export function paginateData(data: any[], page: number, itemsPerPage: number) {
  const startIndex = (page - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  return {
    paginatedData: data.slice(startIndex, endIndex),
    totalPages: Math.ceil(data.length / itemsPerPage),
    totalItems: data.length,
  }
}
