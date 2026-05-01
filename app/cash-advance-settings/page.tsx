"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { CashAdvanceSettingsModule } from "@/components/admin/cash-advance-settings-module"

export default function CashAdvanceSettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cash Advance Settings</h1>
          <p className="text-muted-foreground">Manage cash advance percentage limits and installment rules.</p>
        </div>
        <CashAdvanceSettingsModule />
      </div>
    </DashboardLayout>
  )
}
