import { redirect } from "next/navigation"

/** Cash advances are admin-approved only; department heads no longer review them here. */
export default function DeptHeadCashAdvanceRequestsPage() {
  redirect("/department-head-dashboard")
}
