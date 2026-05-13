"use client"

import { useState, useEffect } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const COLORS = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#6366f1"]

export interface EmployeeAnalyticsPayload {
  employee: {
    firstName: string
    lastName: string
    position: string
    departmentName: string
  }
  monthlyAttendance: Array<{
    monthKey: string
    label: string
    presentDays: number
    hoursWorked: number
    overtimeHours: number
  }>
  payrollTrend: Array<{
    period: string
    netPay: number
    basicPay: number
    status: string
  }>
  statusBreakdown: Array<{ name: string; value: number }>
  stats: {
    presentThisMonth: number
    totalHours: number
    overtimeHours: number
    monthlySalary: number
    lastNetPay: number
    walletMode?: "last_payout" | "current_period" | "running_estimate"
    walletPeriodName?: string | null
  }
}

export function EmployeeAnalyticsCharts() {
  const [data, setData] = useState<EmployeeAnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/employee-analytics")
        if (!res.ok) {
          let detail = `Request failed (${res.status})`
          try {
            const errBody = await res.json()
            if (errBody?.error && typeof errBody.error === "string") detail = errBody.error
          } catch {
            /* ignore */
          }
          throw new Error(detail)
        }
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-80" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analytics unavailable</CardTitle>
          <CardDescription>{error || "No data"}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const formatPhp = (n: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(
      n,
    )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Welcome back, {data.employee.firstName}!</h1>
        <p className="text-muted-foreground mt-1">
          {data.employee.position} — {data.employee.departmentName}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Your attendance and payroll trends (last six months where applicable).
        </p>
      </div>

      <Card className="overflow-hidden border-0 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg">
        <CardContent className="p-6">
          <p className="text-sm text-white/80">Salary wallet</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{formatPhp(data.stats.lastNetPay)}</p>
          <p className="mt-1 text-sm text-white/80">
            {data.stats.walletMode === "running_estimate" && data.stats.walletPeriodName
              ? `Estimated net for draft period "${data.stats.walletPeriodName}" (same rules as payroll: half-month base, minus absences and late/undertime, then taxes and other period deductions if enabled). Final amount is set when payroll is calculated.`
              : data.stats.walletMode === "current_period" && data.stats.walletPeriodName
                ? `Net pay from your latest payroll run for draft period "${data.stats.walletPeriodName}".`
                : "Last net pay credited from your most recent payroll slip."}
            {data.stats.monthlySalary > 0 ? ` Monthly salary ${formatPhp(data.stats.monthlySalary)}.` : ""}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance by month</CardTitle>
            <CardDescription>Days present and hours worked per month</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyAttendance} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8 }}
                  formatter={(value: number, name: string) =>
                    name === "hoursWorked" ? [`${value}h`, "Hours worked"] : [value, "Present days"]
                  }
                />
                <Legend />
                <Bar yAxisId="left" dataKey="presentDays" name="Present days" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="hoursWorked" name="Hours worked" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overtime by month</CardTitle>
            <CardDescription>Approved overtime hours (from attendance records)</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthlyAttendance} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8 }} formatter={(v: number) => [`${v}h`, "Overtime"]} />
                <Line type="monotone" dataKey="overtimeHours" name="Overtime (hrs)" stroke="#f59e0b" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Net pay by period</CardTitle>
            <CardDescription>Recent payroll runs</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.payrollTrend} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: 8 }}
                  formatter={(value: number) => [formatPhp(value), "Net pay"]}
                />
                <Bar dataKey="netPay" name="Net pay" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance status mix</CardTitle>
            <CardDescription>Recorded days in the last six months</CardDescription>
          </CardHeader>
          <CardContent className="h-72 flex items-center justify-center">
            {data.statusBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance records in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={data.statusBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                    {data.statusBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
