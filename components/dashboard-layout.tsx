"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Search, Home, Users, Building2, Clock, DollarSign, BarChart3, Calendar, ArrowRight, UserCheck, LogOut, Shield, CalendarDays } from "lucide-react"
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

const departmentHeadNavigation = [
  { name: "Dashboard", href: "/department-head-dashboard", icon: Home },
]

const employeeNavigation = [
  { name: "Dashboard", href: "/employee-dashboard", icon: Home },
]

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const { data: session } = useSession()

  // Get navigation based on user role
  const getNavigation = () => {
    if (!session?.user?.role) return []
    
    switch (session.user.role) {
      case 'ADMIN':
        return adminNavigation
      case 'DEPARTMENT_HEAD':
        return departmentHeadNavigation
      case 'EMPLOYEE':
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
            <span className="capitalize">
              {pathname === "/" ? "Overview" : 
               pathname === "/department-head-dashboard" ? "Department Dashboard" :
               pathname === "/employee-dashboard" ? "Employee Dashboard" :
               pathname.slice(1)}
            </span>
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
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                        className={`flex items-center w-full justify-start px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActive ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                  >
                    <item.icon className="w-4 h-4 mr-3" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
            <main className="flex-1 p-8 bg-muted/50">{children}</main>
      </div>
    </div>
  )
}
