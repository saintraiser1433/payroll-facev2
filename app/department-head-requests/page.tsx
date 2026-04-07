"use client"

import { DeptHeadRequestsModule } from "@/components/admin/dept-head-requests-module"
import { DashboardLayout } from "@/components/dashboard-layout"

export default function DepartmentHeadRequestsPage() {
  return (
    <DashboardLayout>
      <DeptHeadRequestsModule />
    </DashboardLayout>
  )
}

