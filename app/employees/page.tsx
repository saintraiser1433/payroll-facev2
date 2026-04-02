"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { Plus, Search, MoreHorizontal, Edit, UserX, UserCheck, Eye, Users, Building2, Calendar, DollarSign, Shield, X, EyeOff, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useToast } from "@/hooks/use-toast"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Employee {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  address?: string
  position: string
  jobDescription?: string
  salaryType: string
  hireDate: string
  profileImage?: string
  qrCode?: string
  isActive: boolean
  department?: {
    id: string
    name: string
  }
  schedule?: {
    id: string
    name: string
  }
  user?: {
    id: string
    email: string
    role: string
  }
}

interface Department {
  id: string
  name: string
}

interface PositionSalary {
  id: string
  position: string
  salaryRate: number
  department?: { id: string; name: string } | null
  isActive: boolean
}

type EmployeeFace = {
  id: string
  slot: number
  imagePath: string
  createdAt: string | Date
}

interface Benefit {
  id: string
  name: string
  description: string
  type: string
  employeeContribution: number
  employerContribution: number
  isActive: boolean
}

interface EmployeeBenefit {
  id: string
  employeeId: string
  benefitId: string
  startDate: string
  endDate?: string
  isActive: boolean
  employee: {
    id: string
    employeeId: string
    firstName: string
    lastName: string
  }
  benefit: {
    id: string
    name: string
    type: string
    employeeContribution: number
    employerContribution: number
  }
}

interface Schedule {
  id: string
  name: string
}

interface PaginationData {
  page: number
  limit: number
  total: number
  pages: number
}

export default function EmployeesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [positionSalaries, setPositionSalaries] = useState<PositionSalary[]>([])
  const [availablePositions, setAvailablePositions] = useState<PositionSalary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDepartment, setSelectedDepartment] = useState("all")
  const [activeTab, setActiveTab] = useState("active")
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isQRCodeDialogOpen, setIsQRCodeDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null)
  const [qrCodeEmployee, setQrCodeEmployee] = useState<Employee | null>(null)
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    description: "",
    action: () => {},
  })
  const [formData, setFormData] = useState({
    employeeId: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    position: "",
    jobDescription: "",
    salaryType: "MONTHLY",
    hireDate: "",
    departmentId: "",
    scheduleId: "",
    role: "EMPLOYEE",
  })

  const [showPassword, setShowPassword] = useState(false)
  const [saveAndRegisterFaces, setSaveAndRegisterFaces] = useState(false)

  const [faceSamples, setFaceSamples] = useState<EmployeeFace[]>([])
  const [faceLoading, setFaceLoading] = useState(false)
  const [faceSlot, setFaceSlot] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [facePreview, setFacePreview] = useState<string | null>(null)
  const [faceCapturing, setFaceCapturing] = useState(false)
  const [faceUploading, setFaceUploading] = useState(false)
  const [faceCameraError, setFaceCameraError] = useState<string | null>(null)

  const faceVideoRef = useRef<HTMLVideoElement | null>(null)
  const faceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const faceStreamRef = useRef<MediaStream | null>(null)

  const isAdmin = session?.user?.role === "ADMIN"
  const [userDepartment, setUserDepartment] = useState<string | null>(null)
  
  // Benefits state
  const [benefits, setBenefits] = useState<Benefit[]>([])
  const [employeeBenefits, setEmployeeBenefits] = useState<EmployeeBenefit[]>([])
  const [isBenefitDialogOpen, setIsBenefitDialogOpen] = useState(false)
  const [selectedEmployeeForBenefit, setSelectedEmployeeForBenefit] = useState<Employee | null>(null)
  const [benefitDialogMode, setBenefitDialogMode] = useState<'view' | 'assign'>('assign')
  const [benefitFormData, setBenefitFormData] = useState({
    benefitId: "",
    startDate: new Date().toISOString().split('T')[0],
    endDate: ""
  })

  useEffect(() => {
    if (isAdmin) {
      fetchEmployees()
      fetchDepartments()
      fetchSchedules()
      fetchPositionSalaries()
      fetchBenefits()
      fetchEmployeeBenefits()
    } else {
      checkUserDepartment()
    }
  }, [isAdmin, searchTerm, selectedDepartment, activeTab, pagination.page, pagination.limit])

  const checkUserDepartment = async () => {
    try {
      const response = await fetch('/api/employees')
      if (response.ok) {
        const data = await response.json()
        const currentUserEmployee = data.employees.find((emp: any) => emp.user?.email === session?.user?.email)
        
        if (currentUserEmployee?.department?.id) {
          setUserDepartment(currentUserEmployee.department.id)
          fetchEmployeesForDepartment(currentUserEmployee.department.id)
        }
      }
    } catch (error) {
      console.error('Error checking user department:', error)
    }
  }

  const fetchEmployeesForDepartment = async (departmentId: string) => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      params.append('departmentId', departmentId)
      params.append('isActive', 'true')
      params.append('page', pagination.page.toString())
      params.append('limit', pagination.limit.toString())
      
      const response = await fetch(`/api/employees?${params}`)
      if (!response.ok) throw new Error('Failed to fetch employees')
      
      const data = await response.json()
      setEmployees(data.employees || [])
      setPagination(data.pagination || pagination)
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast({
        title: "Error",
        description: "Failed to fetch employees",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (selectedDepartment && selectedDepartment !== 'all') params.append('departmentId', selectedDepartment)
      params.append('isActive', activeTab === 'active' ? 'true' : 'false')
      params.append('page', pagination.page.toString())
      params.append('limit', pagination.limit.toString())
      
      const response = await fetch(`/api/employees?${params}`)
      if (!response.ok) throw new Error('Failed to fetch employees')
      
      const data = await response.json()
      setEmployees(data.employees || [])
      setPagination(data.pagination || pagination)
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast({
        title: "Error",
        description: "Failed to fetch employees",
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
      setDepartments(data)
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const fetchPositionSalaries = async () => {
    try {
      const response = await fetch('/api/position-salaries?limit=1000&isActive=true')
      if (!response.ok) throw new Error('Failed to fetch position salaries')

      const data = await response.json()
      setPositionSalaries(data.positionSalaries || [])
    } catch (error) {
      console.error('Error fetching position salaries:', error)
    }
  }

  const refreshAvailablePositions = async (departmentId: string) => {
    if (!departmentId) {
      setAvailablePositions([])
      return
    }
    try {
      const response = await fetch(`/api/position-salaries?limit=1000&isActive=true&departmentId=${departmentId}`)
      if (!response.ok) throw new Error("Failed to fetch department positions")
      const data = await response.json()
      setAvailablePositions(data.positionSalaries || [])
    } catch (error) {
      console.error("Error fetching department positions:", error)
      setAvailablePositions([])
    }
  }

  const getPositionSalaryRate = (position: string) => {
    return positionSalaries.find((p) => p.position === position)?.salaryRate
  }

  const activePositionRates = employees
    .filter((e) => e.isActive)
    .map((e) => getPositionSalaryRate(e.position))
    .filter((r): r is number => typeof r === "number" && Number.isFinite(r))

  const avgPositionRate = activePositionRates.length
    ? activePositionRates.reduce((sum, r) => sum + r, 0) / activePositionRates.length
    : 0

  const fetchSchedules = async () => {
    try {
      const response = await fetch('/api/schedules?limit=100')
      if (!response.ok) throw new Error('Failed to fetch schedules')
      
      const data = await response.json()
      setSchedules(data.schedules || [])
    } catch (error) {
      console.error('Error fetching schedules:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingEmployee ? `/api/employees/${editingEmployee.id}` : '/api/employees'
      const method = editingEmployee ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        // Show specific validation error if available
        if (error.details && error.details.length > 0) {
          const firstError = error.details[0]
          throw new Error(firstError.message || error.error || 'Failed to save employee')
        }
        throw new Error(error.error || 'Failed to save employee')
      }

      const savedEmployee = await response.json().catch(() => null)

      toast({
        title: "Success",
        description: `Employee ${editingEmployee ? 'updated' : 'created'} successfully`,
      })

      fetchEmployees()

      if (!editingEmployee && saveAndRegisterFaces && savedEmployee?.id) {
        // Keep dialog open and switch to edit mode so we can register faces immediately.
        setEditingEmployee(savedEmployee)
        setSaveAndRegisterFaces(false)
        setFacePreview(null)
        setFaceSlot(1)
        setTimeout(() => {
          // Start camera once we have an employee to register against.
          startFaceCamera()
          fetchFaceSamples(savedEmployee.id)
        }, 0)
        return
      }

      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error('Error saving employee:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save employee",
        variant: "destructive",
      })
    }
  }

  const handleViewDetails = (employee: Employee) => {
    setViewingEmployee(employee)
    setIsViewDialogOpen(true)
  }

  const handleViewQRCode = (employee: Employee) => {
    setQrCodeEmployee(employee)
    setIsQRCodeDialogOpen(true)
  }

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee)
    setFormData({
      employeeId: employee.employeeId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      password: "", // Don't populate password when editing
      phone: employee.phone || "",
      address: employee.address || "",
      position: employee.position,
      jobDescription: employee.jobDescription || "",
      salaryType: employee.salaryType,
      hireDate: employee.hireDate.split('T')[0],
      departmentId: employee.department?.id || "",
      scheduleId: employee.schedule?.id || "",
      role: employee.user?.role || "EMPLOYEE", // Use actual role from user data
    })
    if (employee.department?.id) {
      refreshAvailablePositions(employee.department.id)
    } else {
      setAvailablePositions([])
    }
    setShowPassword(false)
    setIsDialogOpen(true)

    // Face registration
    setFacePreview(null)
    setFaceSlot(1)
    setFaceSamples([])
    setFaceCameraError(null)
    setTimeout(() => {
      startFaceCamera()
      fetchFaceSamples(employee.id)
    }, 0)
  }

  const handleDeactivate = (employee: Employee) => {
    setConfirmDialog({
      open: true,
      title: "Deactivate Employee",
      description: `Are you sure you want to deactivate ${employee.firstName} ${employee.lastName}? They will be moved to the inactive list and won't be able to access the system.`,
      action: () => performDeactivation(employee.id),
    })
  }

  const handleReactivate = (employee: Employee) => {
    setConfirmDialog({
      open: true,
      title: "Reactivate Employee",
      description: `Are you sure you want to reactivate ${employee.firstName} ${employee.lastName}? They will be moved back to the active list and regain system access.`,
      action: () => performReactivation(employee.id),
    })
  }

  const performDeactivation = async (id: string) => {
    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: false }),
      })

      if (!response.ok) throw new Error('Failed to deactivate employee')

      toast({
        title: "Success",
        description: "Employee deactivated successfully",
      })

      fetchEmployees()
    } catch (error) {
      console.error('Error deactivating employee:', error)
      toast({
        title: "Error",
        description: "Failed to deactivate employee",
        variant: "destructive",
      })
    }
  }

  const performReactivation = async (id: string) => {
    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: true }),
      })

      if (!response.ok) throw new Error('Failed to reactivate employee')

      toast({
        title: "Success",
        description: "Employee reactivated successfully",
      })

      fetchEmployees()
    } catch (error) {
      console.error('Error reactivating employee:', error)
      toast({
        title: "Error",
        description: "Failed to reactivate employee",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      employeeId: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      address: "",
      position: "",
      jobDescription: "",
      salaryType: "MONTHLY",
      hireDate: "",
      departmentId: "",
      scheduleId: "",
      role: "EMPLOYEE",
    })
    setAvailablePositions([])
    setShowPassword(false)
    setEditingEmployee(null)
    setSaveAndRegisterFaces(false)
    setFaceSamples([])
    setFacePreview(null)
    setFaceSlot(1)
    setFaceCameraError(null)
    stopFaceCamera()
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    resetForm()
  }

  const startFaceCamera = async () => {
    try {
      setFaceCameraError(null)
      const hasCamera = !!navigator.mediaDevices?.getUserMedia
      if (!hasCamera) {
        throw new Error("No camera found. Please connect a camera device.")
      }
      if (faceStreamRef.current) return

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      faceStreamRef.current = stream
      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = stream
        await faceVideoRef.current.play()
      }
    } catch (err) {
      setFaceCameraError(err instanceof Error ? err.message : "Failed to start camera")
    }
  }

  const stopFaceCamera = () => {
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach((t) => t.stop())
      faceStreamRef.current = null
    }
  }

  const fetchFaceSamples = async (employeeDbId: string) => {
    try {
      setFaceLoading(true)
      const res = await fetch(`/api/employees/${employeeDbId}/faces`)
      if (!res.ok) throw new Error("Failed to fetch face samples")
      const data = await res.json()
      setFaceSamples(data.faces || [])
    } catch (err) {
      console.error("Fetch faces error:", err)
      setFaceSamples([])
    } finally {
      setFaceLoading(false)
    }
  }

  const captureFace = async () => {
    if (!faceVideoRef.current || !faceCanvasRef.current) return
    setFaceCapturing(true)
    try {
      const video = faceVideoRef.current
      const canvas = faceCanvasRef.current
      const width = video.videoWidth || 640
      const height = video.videoHeight || 480
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas context not available")
      ctx.drawImage(video, 0, 0, width, height)
      const dataUrl = canvas.toDataURL("image/png")
      setFacePreview(dataUrl)
    } catch (err) {
      setFaceCameraError(err instanceof Error ? err.message : "Failed to capture face")
    } finally {
      setFaceCapturing(false)
    }
  }

  const uploadFace = async () => {
    if (!editingEmployee?.id) return
    if (!facePreview) {
      toast({ title: "Face required", description: "Capture a face image first.", variant: "destructive" })
      return
    }
    setFaceUploading(true)
    try {
      const res = await fetch(`/api/employees/${editingEmployee.id}/faces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: faceSlot, dataUrl: facePreview }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to save face sample")
      toast({ title: "Saved", description: `Face sample #${faceSlot} saved. (${data.count || 0}/5)` })
      setFacePreview(null)
      await fetchFaceSamples(editingEmployee.id)
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save face sample", variant: "destructive" })
    } finally {
      setFaceUploading(false)
    }
  }

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }

  const handlePageSizeChange = (pageSize: number) => {
    setPagination(prev => ({ ...prev, limit: pageSize, page: 1 }))
  }

  // Benefits functions
  const fetchBenefits = async () => {
    try {
      const response = await fetch('/api/benefits?limit=100')
      if (!response.ok) throw new Error('Failed to fetch benefits')
      
      const data = await response.json()
      setBenefits(data.benefits || [])
    } catch (error) {
      console.error('Error fetching benefits:', error)
    }
  }

  const fetchEmployeeBenefits = async (employeeId?: string) => {
    try {
      const params = new URLSearchParams()
      if (employeeId) params.append('employeeId', employeeId)
      
      const response = await fetch(`/api/employee-benefits?${params}`)
      if (!response.ok) throw new Error('Failed to fetch employee benefits')
      
      const data = await response.json()
      setEmployeeBenefits(data.employeeBenefits || [])
    } catch (error) {
      console.error('Error fetching employee benefits:', error)
    }
  }

  const handleAssignBenefit = (employee: Employee) => {
    setSelectedEmployeeForBenefit(employee)
    setBenefitDialogMode('assign')
    setBenefitFormData({
      benefitId: "",
      startDate: new Date().toISOString().split('T')[0],
      endDate: ""
    })
    setIsBenefitDialogOpen(true)
  }

  const handleViewBenefits = (employee: Employee) => {
    setSelectedEmployeeForBenefit(employee)
    setBenefitDialogMode('view')
    fetchEmployeeBenefits(employee.id)
    setIsBenefitDialogOpen(true)
  }

  const handleSaveBenefit = async () => {
    if (!selectedEmployeeForBenefit || !benefitFormData.benefitId) return

    try {
      const response = await fetch('/api/employee-benefits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployeeForBenefit.id,
          benefitId: benefitFormData.benefitId,
          startDate: benefitFormData.startDate,
          endDate: benefitFormData.endDate || null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to assign benefit')
      }

      toast({
        title: "Success",
        description: "Benefit assigned successfully",
      })

      setIsBenefitDialogOpen(false)
      fetchEmployeeBenefits()
    } catch (error) {
      console.error('Error assigning benefit:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign benefit",
        variant: "destructive",
      })
    }
  }

  const handleRemoveBenefit = async (employeeBenefit: EmployeeBenefit) => {
    try {
      const response = await fetch(`/api/employee-benefits/${employeeBenefit.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to remove benefit')

      toast({
        title: "Success",
        description: "Benefit removed successfully",
      })

      fetchEmployeeBenefits()
    } catch (error) {
      console.error('Error removing benefit:', error)
      toast({
        title: "Error",
        description: "Failed to remove benefit",
        variant: "destructive",
      })
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  if (!isAdmin && !userDepartment) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Access denied. Admin or department head privileges required.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
            <p className="text-muted-foreground">
              {isAdmin 
                ? "Manage your organization's employees" 
                : userDepartment 
                  ? "Manage employees in your department" 
                  : "View employee information"
              }
            </p>
          </div>
          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Employee
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingEmployee ? 'Update employee information' : 'Create a new employee record'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="employeeId">Employee ID</Label>
                      <Input
                        id="employeeId"
                        value={formData.employeeId}
                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder={editingEmployee ? "Leave blank to keep current password" : "Minimum 6 characters"}
                          required={!editingEmployee}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value) => setFormData({ ...formData, role: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EMPLOYEE">Employee</SelectItem>
                          <SelectItem value="DEPARTMENT_HEAD">Department Head</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salaryType">Salary Type</Label>
                      <Select value={formData.salaryType} onValueChange={(value) => setFormData({ ...formData, salaryType: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="jobDescription">Job Description</Label>
                    <Textarea
                      id="jobDescription"
                      value={formData.jobDescription}
                      onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
                      placeholder="Describe the employee's responsibilities and duties..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                   
                    <div className="space-y-2">
                      <Label htmlFor="hireDate">Hire Date</Label>
                      <Input
                        id="hireDate"
                        type="date"
                        value={formData.hireDate}
                        onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                        required
                      />
                    </div>
                     <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Select
                        value={formData.departmentId || undefined}
                        onValueChange={(value) => {
                          setFormData({ ...formData, departmentId: value, position: "" })
                          refreshAvailablePositions(value)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.filter(dept => dept.id && dept.name).map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                   
                    <div className="space-y-2">
                      <Label htmlFor="position">Position</Label>
                      <Select
                        value={formData.position || undefined}
                        onValueChange={(value) => setFormData({ ...formData, position: value })}
                        disabled={!formData.departmentId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={formData.departmentId ? "Select position" : "Select department first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePositions.map((p) => (
                            <SelectItem key={p.id} value={p.position}>
                              {p.position} - ₱{p.salaryRate.toLocaleString()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="schedule">Schedule</Label>
                      <Select value={formData.scheduleId || undefined} onValueChange={(value) => setFormData({ ...formData, scheduleId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select schedule" />
                        </SelectTrigger>
                        <SelectContent>
                          {schedules.filter(schedule => schedule.id && schedule.name).map((schedule) => (
                            <SelectItem key={schedule.id} value={schedule.id}>
                              {schedule.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                    </div>

                    <div className="space-y-3 rounded-md border p-4 lg:sticky lg:top-4 self-start">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Register Faces (5 samples)</p>
                          <p className="text-xs text-muted-foreground">
                            Capture and save 5 face samples to enable face-recognition attendance.
                          </p>
                        </div>
                        <Badge variant={faceSamples.length >= 5 ? "default" : "secondary"}>
                          {faceSamples.length}/5
                        </Badge>
                      </div>

                      {!editingEmployee ? (
                        <Alert>
                          <AlertDescription>Save the employee first, then you can register face samples.</AlertDescription>
                        </Alert>
                      ) : (
                        <div className="space-y-3">
                          {faceCameraError && (
                            <Alert variant="destructive">
                              <AlertDescription>{faceCameraError}</AlertDescription>
                            </Alert>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>Sample Slot</Label>
                              <Select value={String(faceSlot)} onValueChange={(v) => setFaceSlot(Number(v) as any)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <SelectItem key={n} value={String(n)}>
                                      Face #{n} {faceSamples.some((f) => f.slot === n) ? "(saved)" : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Status</Label>
                              <div className="h-10 rounded-md border border-border bg-background px-3 flex items-center text-sm">
                                {faceLoading ? "Loading..." : faceSamples.some((f) => f.slot === faceSlot) ? "Saved" : "Not saved"}
                              </div>
                            </div>
                          </div>

                          <div className="relative">
                            <video
                              ref={faceVideoRef}
                              className="w-full rounded-md border border-border bg-black"
                              playsInline
                              muted
                            />
                            <canvas ref={faceCanvasRef} className="hidden" />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" onClick={captureFace} disabled={faceCapturing}>
                              {faceCapturing ? "Capturing..." : "Capture"}
                            </Button>
                            <Button type="button" onClick={uploadFace} disabled={faceUploading || !facePreview}>
                              {faceUploading ? "Saving..." : `Save Face #${faceSlot}`}
                            </Button>
                          </div>

                          {facePreview && (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">Preview</p>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={facePreview} alt="Face preview" className="w-full max-w-sm rounded-md border border-border" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleDialogClose}>
                      Cancel
                    </Button>
                    {!editingEmployee && (
                      <Button type="submit" variant="secondary" onClick={() => setSaveAndRegisterFaces(true)}>
                        Create & Register Faces
                      </Button>
                    )}
                    <Button type="submit" onClick={() => setSaveAndRegisterFaces(false)}>
                      {editingEmployee ? 'Update' : 'Create'} Employee
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stats Cards Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{employees.filter(e => e.isActive).length}</div>
                <p className="text-xs text-muted-foreground">
                  Currently active
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Departments</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{departments.length}</div>
                <p className="text-xs text-muted-foreground">
                  Active departments
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Schedules</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{schedules.length}</div>
                <p className="text-xs text-muted-foreground">
                  Available schedules
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Salary</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₱{avgPositionRate ? avgPositionRate.toFixed(0) : "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Average position salary rate
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Employee Management Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Employee Management</h2>
          <Card>
            <CardHeader>
              <CardTitle>Employee Management</CardTitle>
              <CardDescription>
                Manage active and inactive employees in your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
                <TabsList>
                  <TabsTrigger value="active">Active Employees</TabsTrigger>
                  <TabsTrigger value="inactive">Inactive Employees</TabsTrigger>
                  <TabsTrigger value="benefits">Benefits</TabsTrigger>
                </TabsList>

                {/* Filters */}
                <div className="flex items-center space-x-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search employees..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  {isAdmin && (
                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filter by department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments.filter(dept => dept.id && dept.name).map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <TabsContent value="active" className="space-y-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-muted-foreground">Loading employees...</p>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Employee</TableHead>
                              <TableHead>ID</TableHead>
                              <TableHead>Position</TableHead>
                              <TableHead>Department</TableHead>
                              <TableHead>Schedule</TableHead>
                              <TableHead>Salary</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {employees.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground">
                                  No active employees found
                                </TableCell>
                              </TableRow>
                            ) : (
                              employees.map((employee) => (
                                <TableRow key={employee.id}>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center space-x-3">
                                      <Avatar className="h-8 w-8">
                                        <AvatarImage src={employee.profileImage} />
                                        <AvatarFallback>
                                          {employee.firstName[0]}{employee.lastName[0]}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <div className="font-medium">
                                          {employee.firstName} {employee.lastName}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                          {employee.email}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>{employee.employeeId}</TableCell>
                                  <TableCell>{employee.position}</TableCell>
                                  <TableCell>
                                    {employee.department ? (
                                      <Badge variant="secondary">{employee.department.name}</Badge>
                                    ) : (
                                      <span className="text-muted-foreground">Not assigned</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {employee.schedule ? (
                                      <Badge variant="outline">{employee.schedule.name}</Badge>
                                    ) : (
                                      <span className="text-muted-foreground">Not assigned</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {typeof getPositionSalaryRate(employee.position) === "number"
                                      ? `₱${getPositionSalaryRate(employee.position)!.toLocaleString()}`
                                      : "Not set"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                          <span className="sr-only">Open menu</span>
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleViewDetails(employee)}>
                                          <Eye className="mr-2 h-4 w-4" />
                                          View Details
                                        </DropdownMenuItem>
                                        {employee.isActive && employee.qrCode && (
                                          <DropdownMenuItem onClick={() => handleViewQRCode(employee)}>
                                            <QrCode className="mr-2 h-4 w-4" />
                                            View QR Code
                                          </DropdownMenuItem>
                                        )}
                                        {isAdmin && (
                                          <>
                                            <DropdownMenuItem onClick={() => handleEdit(employee)}>
                                              <Edit className="mr-2 h-4 w-4" />
                                              Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleViewBenefits(employee)}>
                                              <Shield className="mr-2 h-4 w-4" />
                                              View Benefits
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleAssignBenefit(employee)}>
                                              <Shield className="mr-2 h-4 w-4" />
                                              Assign Benefit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                              onClick={() => handleDeactivate(employee)}
                                              className="text-orange-600"
                                            >
                                              <UserX className="mr-2 h-4 w-4" />
                                              Deactivate
                                            </DropdownMenuItem>
                                          </>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      <DataTablePagination
                        currentPage={pagination.page}
                        totalPages={pagination.pages}
                        pageSize={pagination.limit}
                        totalItems={pagination.total}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                      />
                    </>
                  )}
                </TabsContent>

                <TabsContent value="inactive" className="space-y-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-muted-foreground">Loading employees...</p>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Employee</TableHead>
                              <TableHead>ID</TableHead>
                              <TableHead>Position</TableHead>
                              <TableHead>Department</TableHead>
                              <TableHead>Schedule</TableHead>
                              <TableHead>Salary</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {employees.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground">
                                  No inactive employees found
                                </TableCell>
                              </TableRow>
                            ) : (
                              employees.map((employee) => (
                                <TableRow key={employee.id} className="opacity-60">
                                  <TableCell className="font-medium">
                                    <div className="flex items-center space-x-3">
                                      <Avatar className="h-8 w-8">
                                        <AvatarImage src={employee.profileImage} />
                                        <AvatarFallback>
                                          {employee.firstName[0]}{employee.lastName[0]}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <div className="font-medium">
                                          {employee.firstName} {employee.lastName}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                          {employee.email}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>{employee.employeeId}</TableCell>
                                  <TableCell>{employee.position}</TableCell>
                                  <TableCell>
                                    {employee.department ? (
                                      <Badge variant="secondary">{employee.department.name}</Badge>
                                    ) : (
                                      <span className="text-muted-foreground">Not assigned</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {employee.schedule ? (
                                      <Badge variant="outline">{employee.schedule.name}</Badge>
                                    ) : (
                                      <span className="text-muted-foreground">Not assigned</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {typeof getPositionSalaryRate(employee.position) === "number"
                                      ? `₱${getPositionSalaryRate(employee.position)!.toLocaleString()}`
                                      : "Not set"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                          <span className="sr-only">Open menu</span>
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleViewDetails(employee)}>
                                          <Eye className="mr-2 h-4 w-4" />
                                          View Details
                                        </DropdownMenuItem>
                                        {employee.isActive && employee.qrCode && (
                                          <DropdownMenuItem onClick={() => handleViewQRCode(employee)}>
                                            <QrCode className="mr-2 h-4 w-4" />
                                            View QR Code
                                          </DropdownMenuItem>
                                        )}
                                        {isAdmin && (
                                          <>
                                            <DropdownMenuItem onClick={() => handleEdit(employee)}>
                                              <Edit className="mr-2 h-4 w-4" />
                                              Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                              onClick={() => handleReactivate(employee)}
                                              className="text-green-600"
                                            >
                                              <UserCheck className="mr-2 h-4 w-4" />
                                              Reactivate
                                            </DropdownMenuItem>
                                          </>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      <DataTablePagination
                        currentPage={pagination.page}
                        totalPages={pagination.pages}
                        pageSize={pagination.limit}
                        totalItems={pagination.total}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                      />
                    </>
                  )}
                </TabsContent>

                <TabsContent value="benefits" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Employee Benefits</h3>
                    <Button
                      onClick={() => window.open('/benefits', '_blank')}
                      className="flex items-center gap-2"
                    >
                      <Shield className="h-4 w-4" />
                      Manage Benefits
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {employeeBenefits.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No benefits assigned yet. Assign benefits to employees to see them here.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Benefit</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Employee Contribution</TableHead>
                            <TableHead>Employer Contribution</TableHead>
                            <TableHead>Start Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employeeBenefits.map((employeeBenefit) => (
                            <TableRow key={employeeBenefit.id}>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback>
                                      {employeeBenefit.employee.firstName[0]}{employeeBenefit.employee.lastName[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium">
                                      {employeeBenefit.employee.firstName} {employeeBenefit.employee.lastName}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {employeeBenefit.employee.employeeId}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                {employeeBenefit.benefit.name}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {employeeBenefit.benefit.type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                ₱{employeeBenefit.benefit.employeeContribution.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                ₱{employeeBenefit.benefit.employerContribution.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                {new Date(employeeBenefit.startDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant={employeeBenefit.isActive ? "default" : "secondary"}>
                                  {employeeBenefit.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => handleRemoveBenefit(employeeBenefit)}
                                      className="text-red-600"
                                    >
                                      <X className="mr-2 h-4 w-4" />
                                      Remove Benefit
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* View Details Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Employee Details</DialogTitle>
              <DialogDescription>
                Complete information for {viewingEmployee?.firstName} {viewingEmployee?.lastName}
              </DialogDescription>
            </DialogHeader>
            {viewingEmployee && (
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={viewingEmployee.profileImage} />
                    <AvatarFallback className="text-lg">
                      {viewingEmployee.firstName[0]}{viewingEmployee.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {viewingEmployee.firstName} {viewingEmployee.lastName}
                    </h3>
                    <p className="text-muted-foreground">{viewingEmployee.position}</p>
                    <Badge variant={viewingEmployee.isActive ? "default" : "secondary"}>
                      {viewingEmployee.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Employee ID</Label>
                      <p className="text-sm">{viewingEmployee.employeeId}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                      <p className="text-sm">{viewingEmployee.email}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                      <p className="text-sm">{viewingEmployee.phone || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Department</Label>
                      <p className="text-sm">{viewingEmployee.department?.name || "Not assigned"}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Schedule</Label>
                      <p className="text-sm">{viewingEmployee.schedule?.name || "Not assigned"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Position Salary</Label>
                      <p className="text-sm">
                        {typeof getPositionSalaryRate(viewingEmployee.position) === "number"
                          ? `₱${getPositionSalaryRate(viewingEmployee.position)!.toLocaleString()}`
                          : "Not set"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Hire Date</Label>
                      <p className="text-sm">{new Date(viewingEmployee.hireDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                      <p className="text-sm">{viewingEmployee.isActive ? "Active Employee" : "Inactive Employee"}</p>
                    </div>
                  </div>
                </div>

                {viewingEmployee.address && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Address</Label>
                    <p className="text-sm">{viewingEmployee.address}</p>
                  </div>
                )}

                {viewingEmployee.jobDescription && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Job Description</Label>
                    <p className="text-sm">{viewingEmployee.jobDescription}</p>
                  </div>
                )}

                {viewingEmployee.isActive && viewingEmployee.qrCode && (
                  <div className="border-t pt-6">
                    <Label className="text-sm font-medium text-muted-foreground mb-4 block">QR Code</Label>
                    <div className="flex flex-col items-center space-y-2">
                      <div className="border rounded-lg p-4 bg-white">
                        <img 
                          src={viewingEmployee.qrCode} 
                          alt={`QR Code for ${viewingEmployee.employeeId}`}
                          className="w-48 h-48"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Employee ID: {viewingEmployee.employeeId}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                Close
              </Button>
              {isAdmin && viewingEmployee && (
                <Button onClick={() => {
                  setIsViewDialogOpen(false)
                  handleEdit(viewingEmployee)
                }}>
                  Edit Employee
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Benefit Assignment Dialog */}
        <Dialog open={isBenefitDialogOpen} onOpenChange={setIsBenefitDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {benefitDialogMode === 'view' ? 'View Benefits' : 'Assign Benefit'}
              </DialogTitle>
              <DialogDescription>
                {benefitDialogMode === 'view' 
                  ? `Benefits assigned to ${selectedEmployeeForBenefit?.firstName} ${selectedEmployeeForBenefit?.lastName}`
                  : `Assign a benefit to ${selectedEmployeeForBenefit?.firstName} ${selectedEmployeeForBenefit?.lastName}`
                }
              </DialogDescription>
            </DialogHeader>
            
            {benefitDialogMode === 'view' ? (
              // View mode - show existing benefits
              <div className="space-y-4">
                {employeeBenefits.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No benefits assigned to this employee.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {employeeBenefits.map((empBenefit) => (
                      <div key={empBenefit.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{empBenefit.benefit.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Employee Contribution: ₱{empBenefit.benefit.employeeContribution.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Start: {new Date(empBenefit.startDate).toLocaleDateString()}
                            {empBenefit.endDate && ` - End: ${new Date(empBenefit.endDate).toLocaleDateString()}`}
                          </div>
                        </div>
                        <Badge variant={empBenefit.isActive ? "default" : "secondary"}>
                          {empBenefit.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Assign mode - show form
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="benefit">Benefit</Label>
                  <Select
                    value={benefitFormData.benefitId}
                    onValueChange={(value) => setBenefitFormData({ ...benefitFormData, benefitId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a benefit" />
                    </SelectTrigger>
                    <SelectContent>
                      {benefits.filter(benefit => benefit.isActive).map((benefit) => (
                        <SelectItem key={benefit.id} value={benefit.id}>
                          {benefit.name} - ₱{benefit.employeeContribution.toFixed(2)} employee contribution
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={benefitFormData.startDate}
                    onChange={(e) => setBenefitFormData({ ...benefitFormData, startDate: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date (Optional)</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={benefitFormData.endDate}
                    onChange={(e) => setBenefitFormData({ ...benefitFormData, endDate: e.target.value })}
                  />
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBenefitDialogOpen(false)}>
                {benefitDialogMode === 'view' ? 'Close' : 'Cancel'}
              </Button>
              {benefitDialogMode === 'assign' && (
                <Button onClick={handleSaveBenefit} disabled={!benefitFormData.benefitId}>
                  Assign Benefit
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* QR Code Dialog */}
        <Dialog open={isQRCodeDialogOpen} onOpenChange={setIsQRCodeDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Employee QR Code</DialogTitle>
              <DialogDescription>
                QR Code for {qrCodeEmployee?.firstName} {qrCodeEmployee?.lastName}
              </DialogDescription>
            </DialogHeader>
            {qrCodeEmployee && qrCodeEmployee.qrCode && (
              <div className="flex flex-col items-center space-y-4 py-4">
                <div className="border-2 border-gray-200 rounded-lg p-6 bg-white shadow-sm">
                  <img 
                    src={qrCodeEmployee.qrCode} 
                    alt={`QR Code for ${qrCodeEmployee.employeeId}`}
                    className="w-64 h-64 mx-auto"
                  />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium">
                    Employee ID: <span className="font-mono">{qrCodeEmployee.employeeId}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {qrCodeEmployee.firstName} {qrCodeEmployee.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {qrCodeEmployee.position}
                  </p>
                </div>
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const link = document.createElement('a')
                      link.href = qrCodeEmployee.qrCode!
                      link.download = `QR_Code_${qrCodeEmployee.employeeId}.png`
                      link.click()
                    }}
                  >
                    Download QR Code
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      navigator.clipboard.writeText(qrCodeEmployee.employeeId)
                      toast({
                        title: "Copied!",
                        description: "Employee ID copied to clipboard",
                      })
                    }}
                  >
                    Copy Employee ID
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsQRCodeDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <ConfirmationDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmText={confirmDialog.title.includes("Deactivate") ? "Deactivate" : "Reactivate"}
          variant={confirmDialog.title.includes("Deactivate") ? "destructive" : "default"}
          onConfirm={() => {
            confirmDialog.action()
            setConfirmDialog(prev => ({ ...prev, open: false }))
          }}
        />
      </div>
    </DashboardLayout>
  )
}