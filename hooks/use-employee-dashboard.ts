"use client"

import { useState, useEffect, useCallback } from "react"
import type { EmployeeData } from "@/lib/employee-dashboard-types"

export function useEmployeeDashboard() {
  const [data, setData] = useState<EmployeeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/employee-dashboard")
      if (!response.ok) throw new Error("Failed to fetch employee data")
      const json = await response.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
