"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
  DollarSign,
  Calendar,
  Users,
  Calculator,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  MoreHorizontal,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  X,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
  ToggleLeft,
  ToggleRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { Payslip } from "@/components/payslip"

interface PayrollPeriod {
  id: string
  name: string
  startDate: string
  endDate: string
  status: 'DRAFT' | 'CLOSED'
  deductionsEnabled: boolean
  createdAt: string
  totalEarnings: number
  totalDeductions: number
  totalNetPay: number
  employeeCount: number
  payrollItems: PayrollItem[]
}

interface PayrollItem {
  id: string
  basicPay: number
  overtimePay: number
  holidayPay: number
  thirteenthMonthPay?: number
  totalEarnings: number
  totalDeductions: number
  netPay: number
  createdAt: string
  employee: {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    position: string
    salaryRate: number
    salaryType: string
    department?: {
      name: string
    }
  }
  payrollPeriod: {
    id: string
    name: string
    startDate: string
    endDate: string
    status: string
    isThirteenthMonth?: boolean
  }
  deductions: Array<{
    id: string
    amount: number
    deductionType: {
      id: string
      name: string
      description?: string
      isFixed: boolean
    }
  }>
}

interface PaginationData {
  page: number
  limit: number
  total: number
  pages: number
}

export default function PayrollPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([])
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [activeTab, setActiveTab] = useState("periods")
  const [selectedPeriod, setSelectedPeriod] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreatePeriodOpen, setIsCreatePeriodOpen] = useState(false)
  
  // Enhanced filtering state for payroll items
  const [filters, setFilters] = useState({
    status: "all",
    department: "all",
    position: "all",
    dateRange: {
      start: "",
      end: ""
    },
    minAmount: "",
    maxAmount: ""
  })
  const [showFilters, setShowFilters] = useState(false)
  const [departments, setDepartments] = useState<Array<{id: string, name: string}>>([])
  const [positions, setPositions] = useState<Array<string>>([])
  
  // Filtering state for payroll periods
  const [periodsFilters, setPeriodsFilters] = useState({
    status: "all",
    dateRange: {
      start: "",
      end: ""
    },
    minAmount: "",
    maxAmount: "",
    minEmployees: "",
    maxEmployees: ""
  })
  const [periodsSearchTerm, setPeriodsSearchTerm] = useState("")
  const [showPeriodsFilters, setShowPeriodsFilters] = useState(false)
  
  // Sorting state for periods
  const [periodsSortField, setPeriodsSortField] = useState<string>("")
  const [periodsSortDirection, setPeriodsSortDirection] = useState<"asc" | "desc">("desc")
  const [periodsPagination, setPeriodsPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  })
  const [itemsPagination, setItemsPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  })
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    description: "",
    action: () => {},
  })
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [viewingItem, setViewingItem] = useState<PayrollItem | null>(null)
  
  // Payslip state
  const [isPayslipOpen, setIsPayslipOpen] = useState(false)
  const [payslipData, setPayslipData] = useState<any>(null)
  const [periodForm, setPeriodForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    isThirteenthMonth: false,
  })
  const [exporting, setExporting] = useState(false)

  const isEmployee = session?.user?.role === 'EMPLOYEE'
  const isAdmin = session?.user?.role === 'ADMIN'

  useEffect(() => {
    fetchPayrollPeriods()
    if (isEmployee) {
      fetchPayrollItems()
    }
  }, [periodsPagination.page, periodsPagination.limit, periodsSearchTerm, periodsFilters, periodsSortField, periodsSortDirection])

  // Separate useEffect for fetching departments and positions
  useEffect(() => {
    if (isAdmin) {
      fetchDepartments()
      fetchPositions()
    }
  }, [isAdmin])

  useEffect(() => {
    if (selectedPeriod && isAdmin) {
      fetchPayrollItems(selectedPeriod === 'all' ? undefined : selectedPeriod)
    }
  }, [selectedPeriod, itemsPagination.page, itemsPagination.limit, searchTerm, filters])

  const fetchPayrollPeriods = async () => {
    try {
      const params = new URLSearchParams()
      params.append('page', periodsPagination.page.toString())
      params.append('limit', periodsPagination.limit.toString())
      
      // Add search parameter
      if (periodsSearchTerm) params.append('search', periodsSearchTerm)
      
      // Add filter parameters
      if (periodsFilters.status !== 'all') params.append('status', periodsFilters.status)
      if (periodsFilters.dateRange.start) params.append('startDate', periodsFilters.dateRange.start)
      if (periodsFilters.dateRange.end) params.append('endDate', periodsFilters.dateRange.end)
      if (periodsFilters.minAmount) params.append('minAmount', periodsFilters.minAmount)
      if (periodsFilters.maxAmount) params.append('maxAmount', periodsFilters.maxAmount)
      if (periodsFilters.minEmployees) params.append('minEmployees', periodsFilters.minEmployees)
      if (periodsFilters.maxEmployees) params.append('maxEmployees', periodsFilters.maxEmployees)
      
      // Add sorting parameters
      if (periodsSortField) params.append('sortField', periodsSortField)
      if (periodsSortDirection) params.append('sortDirection', periodsSortDirection)
      
      const response = await fetch(`/api/payroll/periods?${params}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Payroll periods fetch error:', errorData)
        throw new Error(errorData.error || 'Failed to fetch payroll periods')
      }
      
      const data = await response.json()
      setPayrollPeriods(data.periods || [])
      setPeriodsPagination(data.pagination || periodsPagination)
    } catch (error) {
      console.error('Error fetching payroll periods:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch payroll periods",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments')
      if (!response.ok) throw new Error('Failed to fetch departments')
      
      const data = await response.json()
      setDepartments(data || [])
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const fetchPositions = async () => {
    try {
      const response = await fetch('/api/employees')
      if (!response.ok) throw new Error('Failed to fetch employees')
      
      const data = await response.json()
      const uniquePositions = [...new Set(data.employees.map((emp: any) => emp.position).filter(Boolean))] as string[]
      setPositions(uniquePositions.sort())
    } catch (error) {
      console.error('Error fetching positions:', error)
    }
  }

  const fetchPayrollItems = async (payrollPeriodId?: string) => {
    try {
      const params = new URLSearchParams()
      if (payrollPeriodId && payrollPeriodId !== 'all') params.append('payrollPeriodId', payrollPeriodId)
      if (searchTerm) params.append('search', searchTerm)
      
      // Add filter parameters
      if (filters.status !== 'all') params.append('status', filters.status)
      if (filters.department !== 'all') params.append('department', filters.department)
      if (filters.position !== 'all') params.append('position', filters.position)
      if (filters.dateRange.start) params.append('startDate', filters.dateRange.start)
      if (filters.dateRange.end) params.append('endDate', filters.dateRange.end)
      if (filters.minAmount) params.append('minAmount', filters.minAmount)
      if (filters.maxAmount) params.append('maxAmount', filters.maxAmount)
      
      params.append('page', itemsPagination.page.toString())
      params.append('limit', itemsPagination.limit.toString())
      
      const response = await fetch(`/api/payroll/items?${params}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.error || 'Failed to fetch payroll items')
      }
      
      const data = await response.json()
      setPayrollItems(data.payrollItems || [])
      setItemsPagination(data.pagination || itemsPagination)
    } catch (error) {
      console.error('Error fetching payroll items:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch payroll items",
        variant: "destructive",
      })
    }
  }

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/payroll/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(periodForm),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create payroll period')
      }

      toast({
        title: "Success",
        description: "Payroll period created successfully",
      })

      setIsCreatePeriodOpen(false)
      setPeriodForm({ name: "", startDate: "", endDate: "", isThirteenthMonth: false })
      fetchPayrollPeriods()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      })
    }
  }

  const handleCalculatePayroll = (periodId: string, periodName: string) => {
    setConfirmDialog({
      open: true,
      title: "Process Payroll",
      description: `Are you sure you want to process payroll for "${periodName}"? This will process all employee attendance and generate payroll items.`,
      action: () => performCalculatePayroll(periodId),
    })
  }

  const handleRecalculatePayroll = (periodId: string, periodName: string) => {
    setConfirmDialog({
      open: true,
      title: "Recalculate Payroll",
      description: `Are you sure you want to recalculate payroll for "${periodName}"? This will update all existing payroll items with current data.`,
      action: () => performCalculatePayroll(periodId),
    })
  }


  const handleCloseEntry = (periodId: string, periodName: string) => {
    setConfirmDialog({
      open: true,
      title: "Close Payroll Period",
      description: `Are you sure you want to close "${periodName}"? Once closed, this payroll period cannot be reopened.`,
      action: () => performCloseEntry(periodId),
    })
  }

  const handleToggleDeductions = async (periodId: string, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/payroll/periods/toggle-deductions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payrollPeriodId: periodId,
          deductionsEnabled: !currentStatus
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to toggle deductions')
      }

      const data = await response.json()
      
      toast({
        title: "Success",
        description: data.message,
      })

      // Refresh the payroll periods data
      fetchPayrollPeriods()
    } catch (error) {
      console.error('Error toggling deductions:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to toggle deductions",
        variant: "destructive",
      })
    }
  }

  const performCalculatePayroll = async (periodId: string) => {
    setCalculating(true)
    try {
      const response = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payrollPeriodId: periodId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to process payroll')
      }

      const result = await response.json()
      
      toast({
        title: "Success",
        description: `Payroll processed for ${result.summary.totalEmployees} employees`,
      })

      fetchPayrollPeriods()
      if (selectedPeriod === periodId) {
        fetchPayrollItems(periodId)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      })
    } finally {
      setCalculating(false)
    }
  }

  const performCloseEntry = async (periodId: string) => {
    setCalculating(true)
    try {
      const response = await fetch(`/api/payroll/periods/${periodId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to close payroll entry')
      }

      toast({
        title: "Success",
        description: "Payroll period closed successfully",
      })

      // Refresh data
      fetchPayrollPeriods()
      fetchPayrollItems()
    } catch (error) {
      console.error('Error closing payroll entry:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to close payroll entry",
        variant: "destructive",
      })
    } finally {
      setCalculating(false)
    }
  }

  const handlePeriodsPageChange = (page: number) => {
    setPeriodsPagination(prev => ({ ...prev, page }))
  }

  const handlePeriodsPageSizeChange = (pageSize: number) => {
    setPeriodsPagination(prev => ({ ...prev, limit: pageSize, page: 1 }))
  }

  const handleItemsPageChange = (page: number) => {
    setItemsPagination(prev => ({ ...prev, page }))
  }

  const handleItemsPageSizeChange = (pageSize: number) => {
    setItemsPagination(prev => ({ ...prev, limit: pageSize, page: 1 }))
  }

  const handleViewDetails = (item: PayrollItem) => {
    setViewingItem(item)
    setIsViewDialogOpen(true)
  }

  const handleGeneratePayslip = async (item: PayrollItem) => {
    try {
      const response = await fetch('/api/payroll/generate-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payrollItemId: item.id })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate payslip')
      }

      const data = await response.json()
      setPayslipData(data.payslipData)
      setIsPayslipOpen(true)
      
      toast({
        title: "Success",
        description: `Payslip generated for ${item.employee.firstName} ${item.employee.lastName}`,
      })
    } catch (error) {
      console.error('Error generating payslip:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate payslip",
        variant: "destructive",
      })
    }
  }

  const handleExportReport = async (payrollPeriodId: string) => {
    try {
      setExporting(true)
      
      const response = await fetch('/api/payroll/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          payrollPeriodId,
          format: 'excel'
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to export report')
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `payroll_report_${Date.now()}.xlsx`

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: "Payroll report exported successfully",
      })
    } catch (error) {
      console.error('Error exporting report:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to export report",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const clearFilters = () => {
    setFilters({
      status: "all",
      department: "all",
      position: "all",
      dateRange: {
        start: "",
        end: ""
      },
      minAmount: "",
      maxAmount: ""
    })
    setSearchTerm("")
  }

  const clearPeriodsFilters = () => {
    setPeriodsFilters({
      status: "all",
      dateRange: {
        start: "",
        end: ""
      },
      minAmount: "",
      maxAmount: "",
      minEmployees: "",
      maxEmployees: ""
    })
    setPeriodsSearchTerm("")
  }

  const hasActiveFilters = () => {
    return filters.status !== "all" || 
           filters.department !== "all" || 
           filters.position !== "all" ||
           filters.dateRange.start || 
           filters.dateRange.end || 
           filters.minAmount || 
           filters.maxAmount ||
           searchTerm
  }

  const hasActivePeriodsFilters = () => {
    return periodsFilters.status !== "all" || 
           periodsFilters.dateRange.start || 
           periodsFilters.dateRange.end || 
           periodsFilters.minAmount || 
           periodsFilters.maxAmount ||
           periodsFilters.minEmployees ||
           periodsFilters.maxEmployees ||
           periodsSearchTerm
  }

  const handlePeriodsSort = (field: string) => {
    if (periodsSortField === field) {
      setPeriodsSortDirection(periodsSortDirection === "asc" ? "desc" : "asc")
    } else {
      setPeriodsSortField(field)
      setPeriodsSortDirection("asc")
    }
  }

  const getPeriodsSortIcon = (field: string) => {
    if (periodsSortField !== field) {
      return <ChevronDownIcon className="h-4 w-4 opacity-50" />
    }
    return periodsSortDirection === "asc" ? 
      <ChevronUp className="h-4 w-4" /> : 
      <ChevronDownIcon className="h-4 w-4" />
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      DRAFT: { variant: "secondary" as const, label: "Draft", icon: Clock },
      CLOSED: { variant: "destructive" as const, label: "Closed", icon: AlertTriangle },
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <config.icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  // Server-side filtering is now handled by the API
  const filteredPayrollItems = payrollItems

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payroll</h1>
            <p className="text-muted-foreground">
              Manage payroll periods and employee compensation
            </p>
          </div>
          {isAdmin && (
            <Dialog open={isCreatePeriodOpen} onOpenChange={setIsCreatePeriodOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Period
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Payroll Period</DialogTitle>
                  <DialogDescription>
                    Set up a new payroll period for processing employee payments
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreatePeriod} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Period Name</Label>
                    <Input
                      id="name"
                      value={periodForm.name}
                      onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                      placeholder="e.g., October 2024 - 1st Half"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={periodForm.startDate}
                        onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate">End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={periodForm.endDate}
                        onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isThirteenthMonth"
                        checked={periodForm.isThirteenthMonth}
                        onCheckedChange={(checked) => setPeriodForm({ ...periodForm, isThirteenthMonth: checked as boolean })}
                      />
                      <Label htmlFor="isThirteenthMonth" className="cursor-pointer">
                        13th Month Pay Period
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Check this if this period is for 13th month pay calculation
                    </p>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreatePeriodOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Period</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {isAdmin && <TabsTrigger value="periods">Payroll Periods</TabsTrigger>}
            <TabsTrigger value="items">
              {isEmployee ? "My Payslips" : "Payroll Items"}
            </TabsTrigger>
          </TabsList>

          {/* Payroll Periods Tab */}
          {isAdmin && (
            <TabsContent value="periods" className="space-y-6">
              {/* Search and Filter Section for Periods */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Search & Filters</CardTitle>
                    <div className="flex items-center gap-2">
                      {hasActivePeriodsFilters() && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearPeriodsFilters}
                          className="text-muted-foreground"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Clear All
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPeriodsFilters(!showPeriodsFilters)}
                      >
                        <Filter className="h-4 w-4 mr-1" />
                        Filters
                        <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${showPeriodsFilters ? 'rotate-180' : ''}`} />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search Bar */}
                  <div className="flex items-center space-x-4">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Search periods by name..."
                        value={periodsSearchTerm}
                        onChange={(e) => setPeriodsSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Advanced Filters */}
                  {showPeriodsFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t">
                      {/* Status Filter */}
                      <div>
                        <Label htmlFor="periods-status-filter" className="text-sm font-medium">Status</Label>
                        <Select value={periodsFilters.status} onValueChange={(value) => setPeriodsFilters(prev => ({ ...prev, status: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="DRAFT">Draft</SelectItem>
                            <SelectItem value="CLOSED">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Date Range Filter */}
                      <div>
                        <Label htmlFor="periods-start-date" className="text-sm font-medium">Start Date</Label>
                        <Input
                          id="periods-start-date"
                          type="date"
                          value={periodsFilters.dateRange.start}
                          onChange={(e) => setPeriodsFilters(prev => ({ 
                            ...prev, 
                            dateRange: { ...prev.dateRange, start: e.target.value }
                          }))}
                        />
                      </div>

                      <div>
                        <Label htmlFor="periods-end-date" className="text-sm font-medium">End Date</Label>
                        <Input
                          id="periods-end-date"
                          type="date"
                          value={periodsFilters.dateRange.end}
                          onChange={(e) => setPeriodsFilters(prev => ({ 
                            ...prev, 
                            dateRange: { ...prev.dateRange, end: e.target.value }
                          }))}
                        />
                      </div>

                      {/* Amount Range Filters */}
                      <div>
                        <Label htmlFor="periods-min-amount" className="text-sm font-medium">Min Net Pay</Label>
                        <Input
                          id="periods-min-amount"
                          type="number"
                          placeholder="0.00"
                          value={periodsFilters.minAmount}
                          onChange={(e) => setPeriodsFilters(prev => ({ ...prev, minAmount: e.target.value }))}
                        />
                      </div>

                      <div>
                        <Label htmlFor="periods-max-amount" className="text-sm font-medium">Max Net Pay</Label>
                        <Input
                          id="periods-max-amount"
                          type="number"
                          placeholder="0.00"
                          value={periodsFilters.maxAmount}
                          onChange={(e) => setPeriodsFilters(prev => ({ ...prev, maxAmount: e.target.value }))}
                        />
                      </div>

                      {/* Employee Count Range Filters */}
                      <div>
                        <Label htmlFor="periods-min-employees" className="text-sm font-medium">Min Employees</Label>
                        <Input
                          id="periods-min-employees"
                          type="number"
                          placeholder="0"
                          value={periodsFilters.minEmployees}
                          onChange={(e) => setPeriodsFilters(prev => ({ ...prev, minEmployees: e.target.value }))}
                        />
                      </div>

                      <div>
                        <Label htmlFor="periods-max-employees" className="text-sm font-medium">Max Employees</Label>
                        <Input
                          id="periods-max-employees"
                          type="number"
                          placeholder="0"
                          value={periodsFilters.maxEmployees}
                          onChange={(e) => setPeriodsFilters(prev => ({ ...prev, maxEmployees: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}

                  {/* Active Filters Display */}
                  {hasActivePeriodsFilters() && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Active filters:</span>
                      {periodsSearchTerm && (
                        <Badge variant="secondary" className="text-xs">
                          Search: "{periodsSearchTerm}"
                        </Badge>
                      )}
                      {periodsFilters.status !== "all" && (
                        <Badge variant="secondary" className="text-xs">
                          Status: {periodsFilters.status}
                        </Badge>
                      )}
                      {(periodsFilters.dateRange.start || periodsFilters.dateRange.end) && (
                        <Badge variant="secondary" className="text-xs">
                          Date: {periodsFilters.dateRange.start || 'Start'} - {periodsFilters.dateRange.end || 'End'}
                        </Badge>
                      )}
                      {(periodsFilters.minAmount || periodsFilters.maxAmount) && (
                        <Badge variant="secondary" className="text-xs">
                          Net Pay: {periodsFilters.minAmount || '0'} - {periodsFilters.maxAmount || '∞'}
                        </Badge>
                      )}
                      {(periodsFilters.minEmployees || periodsFilters.maxEmployees) && (
                        <Badge variant="secondary" className="text-xs">
                          Employees: {periodsFilters.minEmployees || '0'} - {periodsFilters.maxEmployees || '∞'}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Periods</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{payrollPeriods.length}</div>
                    <p className="text-xs text-muted-foreground">payroll periods</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Active Periods</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {payrollPeriods.filter(p => p.status === 'DRAFT').length}
                    </div>
                    <p className="text-xs text-muted-foreground">in draft status</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Payroll</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(
                        payrollPeriods.reduce((sum, period) => sum + period.totalNetPay, 0)
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">all periods</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Employees Paid</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {payrollPeriods.reduce((sum, period) => sum + period.employeeCount, 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">total payments</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Payroll Periods</CardTitle>
                  <CardDescription>
                    Manage payroll periods and calculate employee payments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handlePeriodsSort("name")}
                        >
                          <div className="flex items-center gap-2">
                            Period
                            {getPeriodsSortIcon("name")}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handlePeriodsSort("startDate")}
                        >
                          <div className="flex items-center gap-2">
                            Date Range
                            {getPeriodsSortIcon("startDate")}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handlePeriodsSort("status")}
                        >
                          <div className="flex items-center gap-2">
                            Status
                            {getPeriodsSortIcon("status")}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handlePeriodsSort("employeeCount")}
                        >
                          <div className="flex items-center gap-2">
                            Employees
                            {getPeriodsSortIcon("employeeCount")}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handlePeriodsSort("totalEarnings")}
                        >
                          <div className="flex items-center gap-2">
                            Total Earnings
                            {getPeriodsSortIcon("totalEarnings")}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handlePeriodsSort("totalDeductions")}
                        >
                          <div className="flex items-center gap-2">
                            Total Deductions
                            {getPeriodsSortIcon("totalDeductions")}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handlePeriodsSort("totalNetPay")}
                        >
                          <div className="flex items-center gap-2">
                            Net Pay
                            {getPeriodsSortIcon("totalNetPay")}
                          </div>
                        </TableHead>
                        <TableHead>Deductions</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollPeriods.map((period) => (
                        <TableRow key={period.id}>
                          <TableCell className="font-medium">{period.name}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(period.startDate).toLocaleDateString()} - {' '}
                              {new Date(period.endDate).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(period.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>{period.employeeCount}</span>
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(period.totalEarnings)}</TableCell>
                          <TableCell>{formatCurrency(period.totalDeductions)}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(period.totalNetPay)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {period.deductionsEnabled ? (
                                <>
                                  <ToggleRight className="h-4 w-4 text-green-600" />
                                  <span className="text-green-600 text-sm font-medium">Enabled</span>
                                </>
                              ) : (
                                <>
                                  <ToggleLeft className="h-4 w-4 text-gray-400" />
                                  <span className="text-gray-500 text-sm">Disabled</span>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedPeriod(period.id)
                                    setActiveTab("items")
                                  }}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Items
                                </DropdownMenuItem>
                                {period.status === 'DRAFT' && (
                                  <>
                                    {(!period.payrollItems || period.payrollItems.length === 0) ? (
                                      <DropdownMenuItem
                                        onClick={() => handleCalculatePayroll(period.id, period.name)}
                                        disabled={calculating}
                                      >
                                        <Calculator className="mr-2 h-4 w-4" />
                                        Process Payroll
                                      </DropdownMenuItem>
                                    ) : (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() => handleRecalculatePayroll(period.id, period.name)}
                                          disabled={calculating}
                                        >
                                          <RefreshCw className="mr-2 h-4 w-4" />
                                          Recalculate
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          onClick={() => handleCloseEntry(period.id, period.name)}
                                          disabled={calculating}
                                        >
                                          <CheckCircle className="mr-2 h-4 w-4" />
                                          Close Period
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </>
                                )}
                                <DropdownMenuItem 
                                  onClick={() => handleToggleDeductions(period.id, period.deductionsEnabled)}
                                >
                                  {period.deductionsEnabled ? (
                                    <>
                                      <ToggleRight className="mr-2 h-4 w-4 text-green-600" />
                                      Disable Deductions
                                    </>
                                  ) : (
                                    <>
                                      <ToggleLeft className="mr-2 h-4 w-4 text-gray-400" />
                                      Enable Deductions
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleExportReport(period.id)}
                                  disabled={exporting}
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  {exporting ? "Exporting..." : "Export Report"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                      {payrollPeriods.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            <div className="text-muted-foreground">
                              No payroll periods found. Create your first period to get started.
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <DataTablePagination
                    currentPage={periodsPagination.page}
                    totalPages={periodsPagination.pages}
                    pageSize={periodsPagination.limit}
                    totalItems={periodsPagination.total}
                    onPageChange={handlePeriodsPageChange}
                    onPageSizeChange={handlePeriodsPageSizeChange}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Payroll Items Tab */}
          <TabsContent value="items" className="space-y-6">
            {/* Enhanced Search and Filter Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Search & Filters</CardTitle>
                  <div className="flex items-center gap-2">
                    {hasActiveFilters() && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                        className="text-muted-foreground"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Clear All
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <Filter className="h-4 w-4 mr-1" />
                      Filters
                      <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search Bar */}
                <div className="flex items-center space-x-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search employees, ID, or position..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  {isAdmin && (
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Select payroll period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Periods</SelectItem>
                        {payrollPeriods.map((period) => (
                          <SelectItem key={period.id} value={period.id}>
                            {period.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Advanced Filters */}
                {showFilters && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                    {/* Status Filter */}
                    <div>
                      <Label htmlFor="status-filter" className="text-sm font-medium">Status</Label>
                      <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="DRAFT">Draft</SelectItem>
                          <SelectItem value="CLOSED">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Department Filter */}
                    {isAdmin && (
                      <div>
                        <Label htmlFor="department-filter" className="text-sm font-medium">Department</Label>
                        <Select value={filters.department} onValueChange={(value) => setFilters(prev => ({ ...prev, department: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Departments" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Position Filter */}
                    {isAdmin && (
                      <div>
                        <Label htmlFor="position-filter" className="text-sm font-medium">Position</Label>
                        <Select value={filters.position} onValueChange={(value) => setFilters(prev => ({ ...prev, position: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Positions" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Positions</SelectItem>
                            {positions.map((position) => (
                              <SelectItem key={position} value={position}>
                                {position}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Date Range Filter */}
                    <div>
                      <Label htmlFor="start-date" className="text-sm font-medium">Start Date</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={filters.dateRange.start}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          dateRange: { ...prev.dateRange, start: e.target.value }
                        }))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="end-date" className="text-sm font-medium">End Date</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={filters.dateRange.end}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          dateRange: { ...prev.dateRange, end: e.target.value }
                        }))}
                      />
                    </div>

                    {/* Amount Range Filters */}
                    <div>
                      <Label htmlFor="min-amount" className="text-sm font-medium">Min Amount</Label>
                      <Input
                        id="min-amount"
                        type="number"
                        placeholder="0.00"
                        value={filters.minAmount}
                        onChange={(e) => setFilters(prev => ({ ...prev, minAmount: e.target.value }))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="max-amount" className="text-sm font-medium">Max Amount</Label>
                      <Input
                        id="max-amount"
                        type="number"
                        placeholder="0.00"
                        value={filters.maxAmount}
                        onChange={(e) => setFilters(prev => ({ ...prev, maxAmount: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                {/* Active Filters Display */}
                {hasActiveFilters() && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Active filters:</span>
                    {searchTerm && (
                      <Badge variant="secondary" className="text-xs">
                        Search: "{searchTerm}"
                      </Badge>
                    )}
                    {filters.status !== "all" && (
                      <Badge variant="secondary" className="text-xs">
                        Status: {filters.status}
                      </Badge>
                    )}
                    {filters.department !== "all" && (
                      <Badge variant="secondary" className="text-xs">
                        Department: {departments.find(d => d.id === filters.department)?.name || filters.department}
                      </Badge>
                    )}
                    {filters.position !== "all" && (
                      <Badge variant="secondary" className="text-xs">
                        Position: {filters.position}
                      </Badge>
                    )}
                    {(filters.dateRange.start || filters.dateRange.end) && (
                      <Badge variant="secondary" className="text-xs">
                        Date: {filters.dateRange.start || 'Start'} - {filters.dateRange.end || 'End'}
                      </Badge>
                    )}
                    {(filters.minAmount || filters.maxAmount) && (
                      <Badge variant="secondary" className="text-xs">
                        Amount: {filters.minAmount || '0'} - {filters.maxAmount || '∞'}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {isEmployee ? "My Payslips" : "Payroll Items"}
                    </CardTitle>
                    <CardDescription>
                      {isEmployee 
                        ? "View your payroll history and download payslips"
                        : `${filteredPayrollItems.length} payroll item${filteredPayrollItems.length !== 1 ? 's' : ''} found`
                      }
                    </CardDescription>
                  </div>
                  {isAdmin && selectedPeriod !== "all" && filteredPayrollItems.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const period = payrollPeriods.find(p => p.id === selectedPeriod)
                        if (period) {
                          handleRecalculatePayroll(period.id, period.name)
                        }
                      }}
                      disabled={calculating}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Recalculate All
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isAdmin && <TableHead>Employee</TableHead>}
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Basic Pay</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Holiday Pay</TableHead>
                      <TableHead>13th Month Pay</TableHead>
                      <TableHead>Gross Pay</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Pay</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayrollItems.map((item) => (
                      <TableRow key={item.id}>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {item.employee.firstName[0]}{item.employee.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">
                                  {item.employee.firstName} {item.employee.lastName}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {item.employee.employeeId} • {item.employee.position}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.payrollPeriod.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(item.payrollPeriod.startDate).toLocaleDateString()} - {' '}
                              {new Date(item.payrollPeriod.endDate).toLocaleDateString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.payrollPeriod.status === 'DRAFT' ? 'secondary' : 'destructive'}>
                            {item.payrollPeriod.status === 'DRAFT' ? 'Processed' : 'Closed'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(item.basicPay)}</TableCell>
                        <TableCell>{formatCurrency(item.overtimePay)}</TableCell>
                        <TableCell>{formatCurrency(item.holidayPay)}</TableCell>
                        <TableCell>{formatCurrency(item.thirteenthMonthPay || 0)}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(item.totalEarnings)}
                        </TableCell>
                        <TableCell>{formatCurrency(item.totalDeductions)}</TableCell>
                        <TableCell className="font-bold text-green-600">
                          {formatCurrency(item.netPay)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(item)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleGeneratePayslip(item)}
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                Generate Payslip
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredPayrollItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8">
                          <div className="text-muted-foreground">
                            No payroll items found.
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <DataTablePagination
                  currentPage={itemsPagination.page}
                  totalPages={itemsPagination.pages}
                  pageSize={itemsPagination.limit}
                  totalItems={itemsPagination.total}
                  onPageChange={handleItemsPageChange}
                  onPageSizeChange={handleItemsPageSizeChange}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Confirmation Dialog */}
        <ConfirmationDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmText="Confirm"
          onConfirm={() => {
            confirmDialog.action()
            setConfirmDialog(prev => ({ ...prev, open: false }))
          }}
        />

        {/* View Details Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Payroll Details</DialogTitle>
              <DialogDescription>
                Detailed breakdown of payroll calculations
              </DialogDescription>
            </DialogHeader>
            {viewingItem && (
              <div className="space-y-6">
                {/* Employee Information */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Employee Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Name</Label>
                      <p className="font-medium">
                        {viewingItem.employee.firstName} {viewingItem.employee.lastName}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Employee ID</Label>
                      <p className="font-medium">{viewingItem.employee.employeeId}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Position</Label>
                      <p className="font-medium">{viewingItem.employee.position}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Department</Label>
                      <p className="font-medium">{viewingItem.employee.department?.name || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Payroll Period */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Payroll Period</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Period Name</Label>
                      <p className="font-medium">{viewingItem.payrollPeriod.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Status</Label>
                      <p className="font-medium">{viewingItem.payrollPeriod.status}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Start Date</Label>
                      <p className="font-medium">
                        {new Date(viewingItem.payrollPeriod.startDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">End Date</Label>
                      <p className="font-medium">
                        {new Date(viewingItem.payrollPeriod.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Earnings */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Earnings</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Basic Pay</span>
                      <span className="font-medium">{formatCurrency(viewingItem.basicPay)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overtime Pay</span>
                      <span className="font-medium">{formatCurrency(viewingItem.overtimePay)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Holiday Pay</span>
                      <span className="font-medium">{formatCurrency(viewingItem.holidayPay)}</span>
                    </div>
                    {viewingItem.thirteenthMonthPay && viewingItem.thirteenthMonthPay > 0 && (
                      <div className="flex justify-between">
                        <span>13th Month Pay</span>
                        <span className="font-medium">{formatCurrency(viewingItem.thirteenthMonthPay)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">Total Earnings</span>
                      <span className="font-semibold">{formatCurrency(viewingItem.totalEarnings)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Deductions</h3>
                  {viewingItem.deductions.length > 0 ? (
                    <div className="space-y-2">
                      {viewingItem.deductions.map((deduction) => (
                        <div key={deduction.id} className="flex justify-between">
                          <span>{deduction.deductionType.name}</span>
                          <span className="font-medium">{formatCurrency(deduction.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">Total Deductions</span>
                        <span className="font-semibold">{formatCurrency(viewingItem.totalDeductions)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No deductions applied</p>
                  )}
                </div>

                {/* Net Pay */}
                <div className="border rounded-lg p-4 bg-green-50">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold">Net Pay</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(viewingItem.netPay)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                Close
              </Button>
              <Button onClick={() => viewingItem && handleGeneratePayslip(viewingItem)}>
                <FileText className="mr-2 h-4 w-4" />
                Generate Payslip
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payslip Dialog */}
        <Payslip
          isOpen={isPayslipOpen}
          onClose={() => setIsPayslipOpen(false)}
          payslipData={payslipData}
        />
      </div>
    </DashboardLayout>
  )
}