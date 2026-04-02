"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Plus, Search, Edit, Trash2 } from "lucide-react"
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
import { DashboardLayout } from "@/components/dashboard-layout"

type PositionSalary = {
  id: string
  position: string
  description?: string | null
  salaryRate: number
  department?: { id: string; name: string } | null
  isActive: boolean
  createdAt: string | Date
  _count?: {
    employees: number
  }
}

type Department = {
  id: string
  name: string
}

export default function PositionSalariesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()

  const [positionSalaries, setPositionSalaries] = useState<PositionSalary[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isActiveFilter, setIsActiveFilter] = useState<string>("all")

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  })

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const [selectedRow, setSelectedRow] = useState<PositionSalary | null>(null)

  const [formData, setFormData] = useState({
    position: "",
    description: "",
    salaryRate: 0,
    departmentId: "",
    isActive: true,
  })

  useEffect(() => {
    fetchDepartments()
    fetchPositionSalaries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, searchTerm, isActiveFilter])

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments")
      if (!response.ok) throw new Error("Failed to fetch departments")
      const data = await response.json()
      setDepartments(data || [])
    } catch (error) {
      console.error("Error fetching departments:", error)
    }
  }

  const fetchPositionSalaries = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: searchTerm,
        isActive: isActiveFilter,
      })

      const response = await fetch(`/api/position-salaries?${params}`)
      if (!response.ok) throw new Error("Failed to fetch position salaries")
      const data = await response.json()
      setPositionSalaries(data.positionSalaries || [])
      setPagination(data.pagination || pagination)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch position salaries",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/position-salaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Failed to create position salary")
      }

      toast({ title: "Success", description: "Position salary created successfully" })
      setIsCreateDialogOpen(false)
      setFormData({ position: "", description: "", salaryRate: 0, departmentId: "", isActive: true })
      fetchPositionSalaries()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create position salary",
        variant: "destructive",
      })
    }
  }

  const handleEdit = async () => {
    if (!selectedRow) return
    try {
      const response = await fetch(`/api/position-salaries/${selectedRow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: formData.position,
          description: formData.description,
          salaryRate: formData.salaryRate,
          departmentId: formData.departmentId || null,
          isActive: formData.isActive,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Failed to update position salary")
      }

      toast({ title: "Success", description: "Position salary updated successfully" })
      setIsEditDialogOpen(false)
      setSelectedRow(null)
      setFormData({ position: "", description: "", salaryRate: 0, departmentId: "", isActive: true })
      fetchPositionSalaries()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update position salary",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    if (!selectedRow) return
    try {
      const response = await fetch(`/api/position-salaries/${selectedRow.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Failed to delete position salary")
      }

      toast({ title: "Success", description: "Position salary deleted successfully" })
      setIsDeleteDialogOpen(false)
      setSelectedRow(null)
      fetchPositionSalaries()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete position salary",
        variant: "destructive",
      })
    }
  }

  const openEditDialog = (row: PositionSalary) => {
    setSelectedRow(row)
    setFormData({
      position: row.position,
      description: row.description || "",
      salaryRate: row.salaryRate,
      departmentId: row.department?.id || "",
      isActive: row.isActive,
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (row: PositionSalary) => {
    setSelectedRow(row)
    setIsDeleteDialogOpen(true)
  }

  if (session?.user?.role !== "ADMIN") {
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
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Position Salaries</h1>
            <p className="text-muted-foreground">Manage payroll salary rates by employee position</p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Position Salary
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Position Salary</DialogTitle>
                <DialogDescription>Add a new position and its monthly salary rate.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="position">Position *</Label>
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="e.g., Software Developer"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>

                <div>
                  <Label htmlFor="salaryRate">Monthly Salary Rate *</Label>
                  <Input
                    id="salaryRate"
                    type="number"
                    min={0}
                    value={formData.salaryRate}
                    onChange={(e) => setFormData({ ...formData, salaryRate: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g., 50000"
                  />
                </div>

                <div>
                  <Label htmlFor="departmentId">Department</Label>
                  <select
                    id="departmentId"
                    className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  >
                    <option value="">(No department)</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="isActive">Active</Label>
                  <Switch id="isActive" checked={formData.isActive} onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })} />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Rates</CardTitle>
                <CardDescription>These rates are used by payroll (base salary = Position Salary / 2).</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    className="pl-10"
                    placeholder="Search position..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label>Active</Label>
                  <select className="h-10 rounded-md border border-border bg-background px-2" value={isActiveFilter} onChange={(e) => setIsActiveFilter(e.target.value)}>
                    <option value="all">All</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Position</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Salary Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : positionSalaries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No position salaries found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    positionSalaries.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.position}</TableCell>
                        <TableCell>{row.department?.name || "-"}</TableCell>
                        <TableCell className="text-right">{row.salaryRate.toLocaleString()}</TableCell>
                        <TableCell>
                          {row.isActive ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-muted text-foreground">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditDialog(row)}>
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={(row._count?.employees || 0) > 0}
                              onClick={() => openDeleteDialog(row)}
                              title={(row._count?.employees || 0) > 0 ? "Cannot delete: assigned employees exist" : "Delete"}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages || 1}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page === 1} onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= (pagination.pages || 1)}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Position Salary</DialogTitle>
              <DialogDescription>Update the salary rate used by payroll for this position.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="editPosition">Position *</Label>
                <Input id="editPosition" value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="editDescription">Description</Label>
                <Textarea id="editDescription" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="editDepartmentId">Department</Label>
                <select
                  id="editDepartmentId"
                  className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                >
                  <option value="">(No department)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="editSalaryRate">Monthly Salary Rate *</Label>
                <Input
                  id="editSalaryRate"
                  type="number"
                  min={0}
                  value={formData.salaryRate}
                  onChange={(e) => setFormData({ ...formData, salaryRate: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="editIsActive">Active</Label>
                <Switch
                  id="editIsActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Position Salary?</DialogTitle>
              <DialogDescription>
                {selectedRow && (selectedRow._count?.employees || 0) > 0
                  ? "This position is assigned to employees. Delete is disabled."
                  : "This will remove the salary rate used by payroll."}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleDelete} disabled={selectedRow ? (selectedRow._count?.employees || 0) > 0 : false} variant="destructive">
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

