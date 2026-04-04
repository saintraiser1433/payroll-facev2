import type { ReactNode } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"

export default function DepartmentHeadLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>
}
