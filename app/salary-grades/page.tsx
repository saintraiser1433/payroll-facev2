"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Plus, Search, Edit, Trash2, Users, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { DashboardLayout } from "@/components/dashboard-layout"

interface SalaryGrade {
  id: string
  grade: string
  description?: string
  salaryRate: number
  isActive: boolean
  createdAt: string
  _count: {
    employees: number
  }
}

export default function SalaryGradesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  
  const [salaryGrades, setSalaryGrades] = useState<SalaryGrade[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isActiveFilter, setIsActiveFilter] = useState<string>("all")
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  })

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedGrade, setSelectedGrade] = useState<SalaryGrade | null>(null)

  // Form states
  const [formData, setFormData] = useState({
    grade: "",
    description: "",
    salaryRate: 0,
    isActive: true
  })

  useEffect(() => {
    fetchSalaryGrades()
  }, [pagination.page, searchTerm, isActiveFilter])

  const fetchSalaryGrades = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: searchTerm,
        isActive: isActiveFilter
      })

      const response = await fetch(`/api/salary-grades?${params}`)
      if (!response.ok) throw new Error('Failed to fetch salary grades')
      
      const data = await response.json()
      setSalaryGrades(data.salaryGrades)
      setPagination(data.pagination)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch salary grades",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/salary-grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create salary grade')
      }

      toast({
        title: "Success",
        description: "Salary grade created successfully",
      })
      
      setIsCreateDialogOpen(false)
      setFormData({ grade: "", description: "", salaryRate: 0, isActive: true })
      fetchSalaryGrades()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create salary grade",
        variant: "destructive",
      })
    }
  }

  const handleEdit = async () => {
    if (!selectedGrade) return

    try {
      const response = await fetch(`/api/salary-grades/${selectedGrade.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update salary grade')
      }

      toast({
        title: "Success",
        description: "Salary grade updated successfully",
      })
      
      setIsEditDialogOpen(false)
      setSelectedGrade(null)
      setFormData({ grade: "", description: "", salaryRate: 0, isActive: true })
      fetchSalaryGrades()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update salary grade",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    if (!selectedGrade) return

    try {
      const response = await fetch(`/api/salary-grades/${selectedGrade.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete salary grade')
      }

      toast({
        title: "Success",
        description: "Salary grade deleted successfully",
      })
      
      setIsDeleteDialogOpen(false)
      setSelectedGrade(null)
      fetchSalaryGrades()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete salary grade",
        variant: "destructive",
      })
    }
  }

  const openEditDialog = (grade: SalaryGrade) => {
    setSelectedGrade(grade)
    setFormData({
      grade: grade.grade,
      description: grade.description || "",
      salaryRate: grade.salaryRate,
      isActive: grade.isActive
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (grade: SalaryGrade) => {
    setSelectedGrade(grade)
    setIsDeleteDialogOpen(true)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (session?.user?.role !== 'ADMIN') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to access this page.</p>
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
            <h1 className="text-3xl font-bold">Salary Grades</h1>
            <p className="text-muted-foreground">Manage employee salary grades and rates</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Salary Grade
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Salary Grade</DialogTitle>
                <DialogDescription>
                  Add a new salary grade with its corresponding rate.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="grade">Grade *</Label>
                  <Input
                    id="grade"
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    placeholder="e.g., SG-1, SG-2"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Grade description"
                  />
                </div>
                <div>
                  <Label htmlFor="salaryRate">Salary Rate *</Label>
                  <Input
                    id="salaryRate"
                    type="number"
                    value={formData.salaryRate}
                    onChange={(e) => setFormData({ ...formData, salaryRate: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Salary Grades Management</CardTitle>
            <CardDescription>View and manage all salary grades in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search salary grades..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={isActiveFilter}
                onChange={(e) => setIsActiveFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grade</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Salary Rate</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : salaryGrades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No salary grades found
                    </TableCell>
                  </TableRow>
                ) : (
                  salaryGrades.map((grade) => (
                    <TableRow key={grade.id}>
                      <TableCell className="font-medium">{grade.grade}</TableCell>
                      <TableCell>{grade.description || "-"}</TableCell>
                      <TableCell>{formatCurrency(grade.salaryRate)}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Users className="mr-2 h-4 w-4" />
                          {grade._count.employees}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={grade.isActive ? "default" : "secondary"}>
                          {grade.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(grade)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(grade)}
                            disabled={grade._count.employees > 0}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <DataTablePagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              pageSize={pagination.limit}
              totalItems={pagination.total}
              onPageChange={(page) => setPagination({ ...pagination, page })}
              onPageSizeChange={(limit) => setPagination({ ...pagination, limit, page: 1 })}
            />
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Salary Grade</DialogTitle>
              <DialogDescription>
                Update the salary grade information.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-grade">Grade *</Label>
                <Input
                  id="edit-grade"
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  placeholder="e.g., SG-1, SG-2"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Grade description"
                />
              </div>
              <div>
                <Label htmlFor="edit-salaryRate">Salary Rate *</Label>
                <Input
                  id="edit-salaryRate"
                  type="number"
                  value={formData.salaryRate}
                  onChange={(e) => setFormData({ ...formData, salaryRate: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="edit-isActive">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEdit}>Update</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Salary Grade</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{selectedGrade?.grade}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
