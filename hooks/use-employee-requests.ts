"use client"

import { useState, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"

export function useEmployeeRequests() {
  const { toast } = useToast()
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [overtimeRequests, setOvertimeRequests] = useState<any[]>([])
  const [cashAdvances, setCashAdvances] = useState<any[]>([])
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])

  const fetchMyRequests = useCallback(async () => {
    try {
      setRequestsLoading(true)
      const [otRes, cashRes, leaveRes] = await Promise.all([
        fetch("/api/overtime-requests/my"),
        fetch("/api/cash-advances/my"),
        fetch("/api/leave-requests/my"),
      ])

      if (otRes.ok) setOvertimeRequests((await otRes.json()).requests || [])
      if (cashRes.ok) setCashAdvances((await cashRes.json()).cashAdvances || [])
      if (leaveRes.ok) setLeaveRequests((await leaveRes.json()).requests || [])
    } catch (err) {
      console.error("Error fetching my requests:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load requests",
        variant: "destructive",
      })
    } finally {
      setRequestsLoading(false)
    }
  }, [toast])

  return {
    requestsLoading,
    overtimeRequests,
    cashAdvances,
    leaveRequests,
    fetchMyRequests,
  }
}
