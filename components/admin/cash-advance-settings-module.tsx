"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

type CashAdvancePolicy = {
  maxCashAdvancePercent: number
  installmentMaxPeriods: number
}

type CashAdvanceSettingsModuleProps = {
  onSaved?: () => Promise<void> | void
}

export function CashAdvanceSettingsModule({ onSaved }: CashAdvanceSettingsModuleProps) {
  const { toast } = useToast()
  const [policy, setPolicy] = useState<CashAdvancePolicy>({
    maxCashAdvancePercent: 80,
    installmentMaxPeriods: 12,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/cash-advance-policy")
        if (!res.ok) return
        const data = await res.json()
        if (cancelled || !data.policy) return
        setPolicy({
          maxCashAdvancePercent: data.policy.maxCashAdvancePercent ?? 80,
          installmentMaxPeriods: data.policy.installmentMaxPeriods ?? 12,
        })
      } catch {
        // ignore fetch error for now
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const saveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/cash-advance-policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to save")
      }

      if (onSaved) {
        await onSaved()
      }

      toast({ title: "Saved", description: "Cash advance settings updated." })
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Save failed",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash advance payment settings</CardTitle>
        <CardDescription>
          Configure cash advance limits and installment periods. Cash advance is no-interest.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-2">
          <Label>Max cash advance (% of monthly salary)</Label>
          <Input
            type="number"
            min={1}
            max={100}
            step={0.01}
            className="w-40"
            value={policy.maxCashAdvancePercent}
            onChange={(e) =>
              setPolicy((p) => ({
                ...p,
                maxCashAdvancePercent: parseFloat(e.target.value) || 1,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Max installment periods</Label>
          <Input
            type="number"
            min={1}
            max={120}
            className="w-32"
            value={policy.installmentMaxPeriods}
            onChange={(e) =>
              setPolicy((p) => ({
                ...p,
                installmentMaxPeriods: parseInt(e.target.value, 10) || 1,
              }))
            }
          />
        </div>
        <Button type="button" onClick={saveSettings} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </CardContent>
    </Card>
  )
}
