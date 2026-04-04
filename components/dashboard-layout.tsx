"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import {
  Search,
  Home,
  Users,
  Building2,
  Clock,
  DollarSign,
  BarChart3,
  Calendar,
  ArrowRight,
  LogOut,
  Shield,
  CalendarDays,
  Timer,
  Wallet,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { TopbarNotifications } from "@/components/topbar-notifications"

// Role-based navigation menus
const adminNavigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Employees", href: "/employees", icon: Users },
  { name: "Departments", href: "/departments", icon: Building2 },
  { name: "Position Salaries", href: "/position-salaries", icon: DollarSign },
  { name: "Attendance", href: "/attendance", icon: Clock },
  { name: "Schedules", href: "/schedules", icon: Calendar },
  { name: "Holidays", href: "/holidays", icon: CalendarDays },
  { name: "Payroll", href: "/payroll", icon: DollarSign },
  { name: "Benefits", href: "/benefits", icon: Shield },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
]

const departmentHeadPayrollNav = [
  { name: "Dashboard", href: "/department-head-dashboard", icon: Home },
  { name: "Department attendance", href: "/department-head-dashboard/department-attendance", icon: Users },
  { name: "Department payroll", href: "/department-head-dashboard/department-payroll", icon: DollarSign },
  { name: "My DTR", href: "/department-head-dashboard/my-dtr", icon: Clock },
  { name: "My payslip", href: "/department-head-dashboard/my-payslip", icon: FileText },
]

const departmentHeadRequestNav = [
  { name: "Overtime request", href: "/department-head-dashboard/requests/overtime", icon: Timer },
  { name: "Cash advance request", href: "/department-head-dashboard/requests/cash-advance", icon: Wallet },
  { name: "Leave request", href: "/department-head-dashboard/requests/leave", icon: CalendarDays },
]

function departmentHeadLinkActive(pathname: string, href: string) {
  if (href === "/department-head-dashboard") return pathname === "/department-head-dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}

const employeeNavigation = [
  { name: "Dashboard", href: "/employee-dashboard", icon: BarChart3 },
  { name: "My Attendance", href: "/employee-dashboard/my-attendance", icon: Clock },
  { name: "My Payslip", href: "/employee-dashboard/my-payslip", icon: DollarSign },
  { name: "Overtime", href: "/employee-dashboard/overtime", icon: Timer },
  { name: "Cash Advance", href: "/employee-dashboard/cash-advance", icon: Wallet },
  { name: "Leave", href: "/employee-dashboard/leave", icon: CalendarDays },
]

interface DashboardLayoutProps {
  children: React.ReactNode
}

function sidebarPageTitle(pathname: string) {
  if (pathname === "/") return "Overview"
  if (pathname === "/department-head-dashboard") return "Dashboard"
  if (pathname.startsWith("/department-head-dashboard/")) {
    const map: Record<string, string> = {
      "/department-head-dashboard/department-attendance": "Department Attendance",
      "/department-head-dashboard/department-payroll": "Department Payroll",
      "/department-head-dashboard/my-dtr": "My DTR",
      "/department-head-dashboard/my-payslip": "My Payslip",
      "/department-head-dashboard/requests/overtime": "Overtime Request",
      "/department-head-dashboard/requests/cash-advance": "Cash Advance Request",
      "/department-head-dashboard/requests/leave": "Leave Request",
    }
    return map[pathname] || pathname.replace("/department-head-dashboard/", "").replace(/-/g, " ")
  }
  if (pathname === "/employee-dashboard") return "Employee Dashboard"
  if (pathname.startsWith("/employee-dashboard/")) {
    const key = pathname.replace("/employee-dashboard/", "")
    const map: Record<string, string> = {
      "my-attendance": "My Attendance",
      "my-payslip": "My Payslip",
      overtime: "Overtime",
      "cash-advance": "Cash Advance",
      leave: "Leave",
    }
    return map[key] || key
  }
  return pathname.slice(1)
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const { data: session } = useSession()

  // Get navigation based on user role
  const getNavigation = () => {
    if (!session?.user?.role) return []
    
    switch (session.user.role) {
      case "ADMIN":
        return adminNavigation
      case "DEPARTMENT_HEAD":
        return null
      case "EMPLOYEE":
        return employeeNavigation
      default:
        return []
    }
  }

  const navigation = getNavigation()

  const handleSignOut = () => {
    signOut({ callbackUrl: "/auth/signin" })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 border-b border-border bg-background px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden">
              <img 
                src="/logo.png" 
                alt="Glan White Sand Beach Resort Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-semibold text-foreground">Glan White Sand Beach Resort</span>
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="capitalize">{session?.user?.role?.replace('_', ' ') || 'Dashboard'}</span> <span className="mx-1">/</span>
            <span className="capitalize">{sidebarPageTitle(pathname)}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search employees, payroll..."
              className="pl-10 w-80 bg-muted border-border focus:bg-background"
            />
          </div>
          <TopbarNotifications />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Avatar className="w-8 h-8">
                  <AvatarImage src="/placeholder-user.jpg" alt="User Avatar" />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-semibold">
                    {session?.user?.name ? 
                      session.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) :
                      session?.user?.email ? 
                        session.user.email.slice(0, 2).toUpperCase() :
                        'U'
                    }
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src="/placeholder-user.jpg" alt="User Avatar" />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-semibold">
                      {session?.user?.name ? 
                        session.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) :
                        session?.user?.email ? 
                          session.user.email.slice(0, 2).toUpperCase() :
                          'U'
                      }
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{session?.user?.name || "User"}</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      {session?.user?.email || "user@example.com"}
                    </div>
                    <div className="text-xs text-primary font-medium">
                      {session?.user?.role?.replace('_', ' ') || "Employee"}
                    </div>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
            <aside className="w-60 border-r border-border bg-background h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="p-4">
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input placeholder="Search anything..." className="pl-10 bg-muted border-border text-sm" />
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 w-6 h-6"
              >
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>

            <nav className="space-y-1">
              {session?.user?.role === "DEPARTMENT_HEAD" ? (
                <div className="space-y-5">
                  <div>
                    <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Payroll
                    </p>
                    <div className="space-y-1">
                      {departmentHeadPayrollNav.map((item) => {
                        const isActive = departmentHeadLinkActive(pathname, item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center w-full justify-start px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                              isActive
                                ? "bg-primary/10 text-primary hover:bg-primary/20"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <item.icon className="w-4 h-4 mr-3 shrink-0" />
                            {item.name}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Request
                    </p>
                    <div className="space-y-1">
                      {departmentHeadRequestNav.map((item) => {
                        const isActive = departmentHeadLinkActive(pathname, item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center w-full justify-start px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                              isActive
                                ? "bg-primary/10 text-primary hover:bg-primary/20"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <item.icon className="w-4 h-4 mr-3 shrink-0" />
                            {item.name}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                (navigation ?? []).map((item) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : item.href === "/employee-dashboard"
                        ? pathname === "/employee-dashboard"
                        : pathname === item.href || pathname.startsWith(`${item.href}/`)
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center w-full justify-start px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary hover:bg-primary/20"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className="w-4 h-4 mr-3" />
                      {item.name}
                    </Link>
                  )
                })
              )}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
            <main className="flex-1 p-8 bg-muted/50">{children}</main>
      </div>
    </div>
  )
}
