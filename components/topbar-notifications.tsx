"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Bell, CalendarDays, ClipboardList, Timer, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Kind = "overtime" | "leave" | "cashAdvance" | "draftPeriods"

type DecisionAlert = { id: string; kind: Kind; status: string }

type Summary = {
  overtime: number
  leave: number
  cashAdvance: number
  draftPeriods: number
  decisionAlerts?: DecisionAlert[]
}

const DEPT_ROUTES: Record<Kind, string> = {
  overtime: "/department-head-dashboard/requests/overtime",
  leave: "/department-head-dashboard/requests/leave",
  cashAdvance: "/department-head-dashboard",
  draftPeriods: "/department-head-dashboard",
}

const EMP_ROUTES: Record<Kind, string> = {
  overtime: "/employee-dashboard/overtime",
  leave: "/employee-dashboard/leave",
  cashAdvance: "/employee-dashboard/cash-advance",
  draftPeriods: "/employee-dashboard",
}

const ADMIN_ROUTES: Record<Kind, string> = {
  overtime: "/department-head-requests",
  leave: "/department-head-requests",
  cashAdvance: "/department-head-requests",
  draftPeriods: "/payroll",
}

function pendingDismissKey(userId: string) {
  return `payroll-pending-dismiss-${userId}`
}

function decisionSeenKey(userId: string) {
  return `payroll-decision-seen-${userId}`
}

function loadDismiss(userId: string): Partial<Record<Kind, number>> {
  try {
    const s = localStorage.getItem(pendingDismissKey(userId))
    return s ? JSON.parse(s) : {}
  } catch {
    return {}
  }
}

function saveDismiss(userId: string, v: Partial<Record<Kind, number>>) {
  localStorage.setItem(pendingDismissKey(userId), JSON.stringify(v))
}

function loadSeenIds(userId: string): Set<string> {
  try {
    const s = localStorage.getItem(decisionSeenKey(userId))
    const arr: string[] = s ? JSON.parse(s) : []
    return new Set(arr)
  } catch {
    return new Set()
  }
}

function saveSeenIds(userId: string, ids: Set<string>) {
  localStorage.setItem(decisionSeenKey(userId), JSON.stringify([...ids]))
}

/** If user dismissed when count was `dismissed`, show 0 until count changes. */
function displayPendingCount(server: number, dismissed: number | undefined): number {
  if (dismissed === undefined) return server
  if (server > dismissed) return server
  if (server < dismissed) return server
  return 0
}

export function TopbarNotifications() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [pendingDismiss, setPendingDismiss] = useState<Partial<Record<Kind, number>>>({})
  const [seenDecisionIds, setSeenDecisionIds] = useState<Set<string>>(new Set())

  const role = session?.user?.role
  const userId = session?.user?.id
  const enabled = role === "DEPARTMENT_HEAD" || role === "EMPLOYEE" || role === "ADMIN"

  const fetchSummary = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await fetch("/api/notifications/summary")
      if (!res.ok) return
      const data = await res.json()
      setSummary({
        overtime: data.overtime ?? 0,
        leave: data.leave ?? 0,
        cashAdvance: data.cashAdvance ?? 0,
        draftPeriods: data.draftPeriods ?? 0,
        decisionAlerts: Array.isArray(data.decisionAlerts) ? data.decisionAlerts : [],
      })
    } catch {
      /* ignore */
    }
  }, [enabled])

  useEffect(() => {
    if (status !== "authenticated" || !enabled) return
    fetchSummary()
    const t = setInterval(fetchSummary, 60_000)
    const onFocus = () => fetchSummary()
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener("focus", onFocus)
    }
  }, [status, enabled, fetchSummary])

  useEffect(() => {
    if (!userId) return
    setPendingDismiss(loadDismiss(userId))
    setSeenDecisionIds(loadSeenIds(userId))
  }, [userId])

  // Clear stale dismiss baselines when server count dropped (e.g. request was processed).
  useEffect(() => {
    if (!userId || !summary) return
    setPendingDismiss((prev) => {
      const next = { ...prev }
      let changed = false
      ;(["overtime", "leave", "cashAdvance", "draftPeriods"] as const).forEach((k) => {
        const d = next[k]
        if (d !== undefined && summary[k] < d) {
          delete next[k]
          changed = true
        }
      })
      if (changed) saveDismiss(userId, next)
      return changed ? next : prev
    })
  }, [userId, summary?.overtime, summary?.leave, summary?.cashAdvance, summary?.draftPeriods])

  const routes =
    role === "DEPARTMENT_HEAD" ? DEPT_ROUTES : role === "ADMIN" ? ADMIN_ROUTES : EMP_ROUTES

  const unseenByKind = useMemo(() => {
    const alerts = summary?.decisionAlerts ?? []
    if (role !== "EMPLOYEE" || alerts.length === 0) {
      return { overtime: 0, leave: 0, cashAdvance: 0 }
    }
    const acc = { overtime: 0, leave: 0, cashAdvance: 0 }
    for (const a of alerts) {
      if (!seenDecisionIds.has(a.id)) acc[a.kind] += 1
    }
    return acc
  }, [summary?.decisionAlerts, seenDecisionIds, role])

  const displayPending = useMemo(() => {
    if (!summary) {
      return { overtime: 0, leave: 0, cashAdvance: 0, draftPeriods: 0 }
    }
    return {
      overtime: displayPendingCount(summary.overtime, pendingDismiss.overtime),
      leave: displayPendingCount(summary.leave, pendingDismiss.leave),
      cashAdvance: displayPendingCount(summary.cashAdvance, pendingDismiss.cashAdvance),
      draftPeriods: displayPendingCount(summary.draftPeriods ?? 0, pendingDismiss.draftPeriods),
    }
  }, [summary, pendingDismiss])

  const lineTotals = useMemo(() => {
    const isEmp = role === "EMPLOYEE"
    return {
      overtime: displayPending.overtime + (isEmp ? unseenByKind.overtime : 0),
      leave: displayPending.leave + (isEmp ? unseenByKind.leave : 0),
      cashAdvance: displayPending.cashAdvance + (isEmp ? unseenByKind.cashAdvance : 0),
      draftPeriods: displayPending.draftPeriods,
    }
  }, [displayPending, unseenByKind, role])

  const total =
    role === "DEPARTMENT_HEAD"
      ? lineTotals.overtime + lineTotals.leave
      : role === "ADMIN"
        ? lineTotals.overtime + lineTotals.leave + lineTotals.cashAdvance + lineTotals.draftPeriods
        : lineTotals.overtime + lineTotals.leave + lineTotals.cashAdvance

  const handleRowClick = (kind: Kind) => {
    if (!userId || !summary) {
      router.push(routes[kind])
      return
    }

    const nextDismiss = { ...pendingDismiss, [kind]: summary[kind] }
    setPendingDismiss(nextDismiss)
    saveDismiss(userId, nextDismiss)

    if (role === "EMPLOYEE" && summary.decisionAlerts?.length) {
      const ids = summary.decisionAlerts.filter((a) => a.kind === kind).map((a) => a.id)
      if (ids.length) {
        const merged = new Set(seenDecisionIds)
        ids.forEach((id) => merged.add(id))
        setSeenDecisionIds(merged)
        saveSeenIds(userId, merged)
      }
    }

    router.push(routes[kind])
  }

  if (!enabled) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 flex items-center justify-center p-0 text-[10px]"
            >
              {total > 99 ? "99+" : total}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>
          {role === "DEPARTMENT_HEAD"
            ? "Department requests"
            : role === "ADMIN"
              ? "Admin monitoring"
              : "Your requests & updates"}
        </DropdownMenuLabel>
        <p className="px-2 pb-1 text-xs text-muted-foreground">
          {role === "EMPLOYEE"
            ? "Counts include pending submissions and new approve/reject updates. Open a row to clear its count."
            : role === "ADMIN"
              ? "Pending department-head requests, all cash advances, and open payroll periods. Open a row to clear its count until counts change."
              : "Open a row to clear its count until new requests arrive."}
        </p>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center justify-between gap-2 cursor-pointer"
          onClick={() => handleRowClick("overtime")}
        >
          <span className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-muted-foreground" />
            Overtime
          </span>
          <Badge variant={lineTotals.overtime > 0 ? "default" : "secondary"}>
            {lineTotals.overtime}
          </Badge>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center justify-between gap-2 cursor-pointer"
          onClick={() => handleRowClick("leave")}
        >
          <span className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Leave
          </span>
          <Badge variant={lineTotals.leave > 0 ? "default" : "secondary"}>
            {lineTotals.leave}
          </Badge>
        </DropdownMenuItem>
        {role !== "DEPARTMENT_HEAD" && (
          <DropdownMenuItem
            className="flex items-center justify-between gap-2 cursor-pointer"
            onClick={() => handleRowClick("cashAdvance")}
          >
            <span className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              {role === "ADMIN" ? "Cash advances (pending)" : "Cash advance"}
            </span>
            <Badge variant={lineTotals.cashAdvance > 0 ? "default" : "secondary"}>
              {lineTotals.cashAdvance}
            </Badge>
          </DropdownMenuItem>
        )}
        {role === "ADMIN" && (
          <DropdownMenuItem
            className="flex items-center justify-between gap-2 cursor-pointer"
            onClick={() => handleRowClick("draftPeriods")}
          >
            <span className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              Open payroll periods
            </span>
            <Badge variant={lineTotals.draftPeriods > 0 ? "default" : "secondary"}>
              {lineTotals.draftPeriods}
            </Badge>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
