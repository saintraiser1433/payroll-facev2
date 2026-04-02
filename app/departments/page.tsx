"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
  Building2,
  Users,
  UserCheck,
  Plus,
  Search,
  Edit,
  MoreHorizontal,
  Crown,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Textarea } from "@/components/ui/textarea"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"

interface Department {
  id: string
  name: string
  description?: string
  head?: {
    id: string
    firstName: string
    lastName: string
    position: string
    employeeId: string
  }
  employees: Array<{
    id: string
    firstName: string
    lastName: string
    position: string
    isActive: boolean
  }>
  positionSalaries?: Array<{
    id: string
    position: string
    salaryRate: number
    isActive: boolean
  }>
}

interface PositionSalary {
  id: string
  position: string
  salaryRate: number
  isActive: boolean
  department?: { id: string; name: string } | null
}

interface Employee {
  id: string
  firstName: string
  lastName: string
  position: string
  employeeId: string
  departmentId?: string | null
  user?: {
    id: string
    email: string
    role: string
  }
}

export default function DepartmentsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [positionSalaries, setPositionSalaries] = useState<PositionSalary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isAssignHeadDialogOpen, setIsAssignHeadDialogOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    description: "",
    action: () => {},
  })
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    positionSalaryIds: [] as string[],
  })
  const [selectedHeadId, setSelectedHeadId] = useState("")

  const isAdmin = session?.user?.role === "ADMIN"

  useEffect(() => {
    if (isAdmin) {
      fetchDepartments()
      fetchEmployees()
      fetchPositionSalaries()
    }
  }, [isAdmin])

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments')
      if (!response.ok) throw new Error('Failed to fetch departments')
      const data = await response.json()
      setDepartments(data)
    } catch (error) {
      console.error('Error fetching departments:', error)
      toast({
        title: "Error",
        description: "Failed to fetch departments",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees?limit=1000&isActive=true')
      if (!response.ok) throw new Error('Failed to fetch employees')
      const data = await response.json()
      setEmployees(data.employees || [])
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const fetchPositionSalaries = async () => {
    try {
      const response = await fetch("/api/position-salaries?limit=1000&isActive=true")
      if (!response.ok) throw new Error("Failed to fetch position salaries")
      const data = await response.json()
      setPositionSalaries(data.positionSalaries || [])
    } catch (error) {
      console.error("Error fetching position salaries:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingDepartment ? `/api/departments/${editingDepartment.id}` : '/api/departments'
      const method = editingDepartment ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create department')
      }

      toast({
        title: "Success",
        description: `Department ${editingDepartment ? "updated" : "created"} successfully`,
      })

      setIsDialogOpen(false)
      resetForm()
      fetchDepartments()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      })
    }
  }

  const handleAssignHead = async () => {
    if (!selectedDepartment) return

    try {
      console.log('Assigning department head:', {
        departmentId: selectedDepartment.id,
        headId: selectedHeadId
      })
      
      const response = await fetch('/api/departments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: selectedDepartment.id,
          headId: selectedHeadId === "none" ? null : selectedHeadId,
        }),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to assign department head'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (parseError) {
          console.error('Error parsing response:', parseError)
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('Department head assigned successfully:', result)

      toast({
        title: "Success",
        description: "Department head assigned successfully",
      })

      setIsAssignHeadDialogOpen(false)
      setSelectedDepartment(null)
      setSelectedHeadId("")
      fetchDepartments()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      positionSalaryIds: [],
    })
    setEditingDepartment(null)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    resetForm()
  }

  const openCreateDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (department: Department) => {
    setEditingDepartment(department)
    setFormData({
      name: department.name,
      description: department.description || "",
      positionSalaryIds: (department.positionSalaries || []).map((p) => p.id),
    })
    setIsDialogOpen(true)
  }

  const addPositionRow = () => {
    setFormData((prev) => ({
      ...prev,
      positionSalaryIds: [...prev.positionSalaryIds, ""],
    }))
  }

  const updatePositionRow = (idx: number, positionSalaryId: string) => {
    setFormData((prev) => ({
      ...prev,
      positionSalaryIds: prev.positionSalaryIds.map((id, i) => (i === idx ? positionSalaryId : id)),
    }))
  }

  const removePositionRow = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      positionSalaryIds: prev.positionSalaryIds.filter((_, i) => i !== idx),
    }))
  }

  const selectedIdsSet = new Set(formData.positionSalaryIds.filter(Boolean))

  const getPositionSalaryLabel = (id: string) => {
    const ps = positionSalaries.find((p) => p.id === id)
    return ps ? `${ps.position} - ₱${ps.salaryRate.toLocaleString()}` : "Select position"
  }

  const handleAssignHeadDialogClose = () => {
    setIsAssignHeadDialogOpen(false)
    setSelectedDepartment(null)
    setSelectedHeadId("none")
  }

  const openAssignHeadDialog = (department: Department) => {
    setSelectedDepartment(department)
    setSelectedHeadId(department.head?.id || "none")
    setIsAssignHeadDialogOpen(true)
  }

  // Filter departments based on search term
  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.head?.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.head?.lastName.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Departments</h1>
            <p className="text-muted-foreground">
              Manage departments and assign department heads
            </p>
          </div>
          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Department
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingDepartment ? "Edit Department" : "Add New Department"}</DialogTitle>
                  <DialogDescription>
                    {editingDepartment ? "Update department details and positions" : "Create a new department for your organization"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Department Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe the department's purpose and responsibilities..."
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Positions (child)</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addPositionRow}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Position
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {formData.positionSalaryIds.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No positions selected. Add position salary records from the Position Salaries module.</p>
                      ) : (
                        formData.positionSalaryIds.map((id, idx) => (
                          <div key={`${id}-${idx}`} className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-11 space-y-1">
                              <Label className="text-xs">Position Salary</Label>
                              <Select value={id || undefined} onValueChange={(value) => updatePositionRow(idx, value)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select position salary" />
                                </SelectTrigger>
                                <SelectContent>
                                  {positionSalaries
                                    .filter((p) => p.isActive)
                                    .filter((p) => !selectedIdsSet.has(p.id) || p.id === id)
                                    .map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.position} - ₱{p.salaryRate.toLocaleString()}
                                        {p.department?.name ? ` (assigned: ${p.department.name})` : ""}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              {id && (
                                <p className="text-xs text-muted-foreground">
                                  Selected: {getPositionSalaryLabel(id)}
                                </p>
                              )}
                            </div>
                            <div className="col-span-1 flex justify-end pb-1">
                              <Button type="button" variant="ghost" size="icon" onClick={() => removePositionRow(idx)} title="Remove">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleDialogClose}>
                      Cancel
                    </Button>
                    <Button type="submit">{editingDepartment ? "Save Changes" : "Create Department"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search departments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Department Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDepartments.map((department) => (
            <Card key={department.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{department.name}</CardTitle>
                  </div>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(department)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Department
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAssignHeadDialog(department)}>
                          <Crown className="mr-2 h-4 w-4" />
                          Assign Head
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <CardDescription>
                  {department.description || "No description provided"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Department Head */}
                  <div className="flex items-center space-x-2">
                    <Crown className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium">Department Head:</span>
                    {department.head ? (
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {department.head.firstName[0]}{department.head.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {department.head.firstName} {department.head.lastName}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {department.head.position}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">No head assigned</span>
                    )}
                  </div>

                  {/* Employee Count */}
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {department.employees.length} employee{department.employees.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Active Employees */}
                  <div className="flex items-center space-x-2">
                    <UserCheck className="h-4 w-4 text-green-600" />
                    <span className="text-sm">
                      {department.employees.filter(emp => emp.isActive).length} active
                    </span>
                  </div>

                  {/* Positions */}
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {(department.positionSalaries || []).filter(p => p.isActive).length} position{(department.positionSalaries || []).filter(p => p.isActive).length !== 1 ? "s" : ""}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {(department.positionSalaries || []).filter(p => p.isActive).length ? "Active positions" : "No active positions"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Assign Department Head Dialog */}
        <Dialog open={isAssignHeadDialogOpen} onOpenChange={setIsAssignHeadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Department Head</DialogTitle>
              <DialogDescription>
                Select an employee to be the head of {selectedDepartment?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="head">Department Head</Label>
                <Select value={selectedHeadId} onValueChange={setSelectedHeadId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department head" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No head assigned</SelectItem>
                    {employees
                      .filter(emp => 
                        emp.id && 
                        emp.firstName && 
                        emp.lastName && 
                        emp.departmentId === selectedDepartment?.id &&
                        emp.id !== selectedDepartment?.head?.id &&
                        emp.user?.role !== 'ADMIN'
                      )
                      .map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.firstName} {employee.lastName} ({employee.employeeId}) - {employee.position}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleAssignHeadDialogClose}>
                Cancel
              </Button>
              <Button onClick={handleAssignHead}>
                Assign Head
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmationDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
          title={confirmDialog.title}
          description={confirmDialog.description}
          onConfirm={confirmDialog.action}
        />
      </div>
    </DashboardLayout>
  )
}
