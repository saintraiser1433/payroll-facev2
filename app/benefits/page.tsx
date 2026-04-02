"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
  Shield,
  Plus,
  Search,
  Edit,
  Trash2,
  MoreHorizontal,
  Users,
  DollarSign,
  Calendar,
  CheckCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { DataTablePagination } from "@/components/ui/data-table-pagination"

interface Benefit {
  id: string
  name: string
  description: string
  type: 'HEALTH' | 'DENTAL' | 'VISION' | 'LIFE' | 'DISABILITY' | 'RETIREMENT' | 'OTHER'
  coverageAmount: number
  employeeContribution: number
  employerContribution: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  employeeCount: number
}

interface PaginationData {
  page: number
  limit: number
  total: number
  pages: number
}

const BENEFIT_TYPES = [
  { value: 'HEALTH', label: 'Health Insurance' },
  { value: 'DENTAL', label: 'Dental Insurance' },
  { value: 'VISION', label: 'Vision Insurance' },
  { value: 'LIFE', label: 'Life Insurance' },
  { value: 'DISABILITY', label: 'Disability Insurance' },
  { value: 'RETIREMENT', label: 'Retirement Plan' },
  { value: 'OTHER', label: 'Other' },
]

export default function BenefitsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [benefits, setBenefits] = useState<Benefit[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedBenefit, setSelectedBenefit] = useState<Benefit | null>(null)
  const [pagination, setPagination] = useState<PaginationData>({
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
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "",
    coverageAmount: "",
    employeeContribution: "",
    employerContribution: "",
  })

  const isAdmin = session?.user?.role === 'ADMIN'

  useEffect(() => {
    fetchBenefits()
  }, [searchTerm, pagination.page, pagination.limit])

  const fetchBenefits = async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      params.append('page', pagination.page.toString())
      params.append('limit', pagination.limit.toString())
      
      const response = await fetch(`/api/benefits?${params}`)
      if (!response.ok) throw new Error('Failed to fetch benefits')
      
      const data = await response.json()
      setBenefits(data.benefits || [])
      setPagination(data.pagination || pagination)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch benefits",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = selectedBenefit ? `/api/benefits/${selectedBenefit.id}` : '/api/benefits'
      const method = selectedBenefit ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          coverageAmount: parseFloat(formData.coverageAmount),
          employeeContribution: parseFloat(formData.employeeContribution),
          employerContribution: parseFloat(formData.employerContribution),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save benefit')
      }

      toast({
        title: "Success",
        description: `Benefit ${selectedBenefit ? 'updated' : 'created'} successfully`,
      })

      setIsAddDialogOpen(false)
      setIsEditDialogOpen(false)
      resetForm()
      fetchBenefits()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      })
    }
  }

  const handleDelete = (benefit: Benefit) => {
    setConfirmDialog({
      open: true,
      title: "Delete Benefit",
      description: `Are you sure you want to delete "${benefit.name}"? This action cannot be undone.`,
      action: () => performDelete(benefit.id),
    })
  }

  const performDelete = async (benefitId: string) => {
    try {
      const response = await fetch(`/api/benefits/${benefitId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete benefit')

      toast({
        title: "Success",
        description: "Benefit deleted successfully",
      })

      fetchBenefits()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete benefit",
        variant: "destructive",
      })
    }
  }

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }

  const handlePageSizeChange = (pageSize: number) => {
    setPagination(prev => ({ ...prev, limit: pageSize, page: 1 }))
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "",
      coverageAmount: "",
      employeeContribution: "",
      employerContribution: "",
    })
    setSelectedBenefit(null)
  }

  const openEditDialog = (benefit: Benefit) => {
    setSelectedBenefit(benefit)
    setFormData({
      name: benefit.name,
      description: benefit.description,
      type: benefit.type,
      coverageAmount: benefit.coverageAmount.toString(),
      employeeContribution: benefit.employeeContribution.toString(),
      employerContribution: benefit.employerContribution.toString(),
    })
    setIsEditDialogOpen(true)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }

  const getTypeBadge = (type: string) => {
    const typeConfig = {
      HEALTH: { variant: "default" as const, label: "Health" },
      DENTAL: { variant: "secondary" as const, label: "Dental" },
      VISION: { variant: "outline" as const, label: "Vision" },
      LIFE: { variant: "destructive" as const, label: "Life" },
      DISABILITY: { variant: "secondary" as const, label: "Disability" },
      RETIREMENT: { variant: "default" as const, label: "Retirement" },
      OTHER: { variant: "outline" as const, label: "Other" },
    }
    
    const config = typeConfig[type as keyof typeof typeConfig] || typeConfig.OTHER
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

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

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You don't have permission to access this page.
            </p>
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
            <h1 className="text-3xl font-bold tracking-tight">Benefits</h1>
            <p className="text-muted-foreground">
              Manage employee benefits and insurance coverage
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Add Benefit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Benefit</DialogTitle>
                <DialogDescription>
                  Create a new employee benefit
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Benefit Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Health Insurance"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the benefit coverage..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="type">Benefit Type</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    required
                  >
                    <option value="">Select benefit type</option>
                    {BENEFIT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="coverageAmount">Coverage Amount</Label>
                    <Input
                      id="coverageAmount"
                      type="number"
                      step="0.01"
                      value={formData.coverageAmount}
                      onChange={(e) => setFormData({ ...formData, coverageAmount: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="employeeContribution">Employee Contribution</Label>
                    <Input
                      id="employeeContribution"
                      type="number"
                      step="0.01"
                      value={formData.employeeContribution}
                      onChange={(e) => setFormData({ ...formData, employeeContribution: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="employerContribution">Employer Contribution</Label>
                    <Input
                      id="employerContribution"
                      type="number"
                      step="0.01"
                      value={formData.employerContribution}
                      onChange={(e) => setFormData({ ...formData, employerContribution: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Benefit</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search benefits..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Benefits Table */}
        <Card>
          <CardHeader>
            <CardTitle>Employee Benefits</CardTitle>
            <CardDescription>
              Manage and configure employee benefits and insurance coverage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Benefit Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Coverage Amount</TableHead>
                  <TableHead>Employee Contribution</TableHead>
                  <TableHead>Employer Contribution</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {benefits.map((benefit) => (
                  <TableRow key={benefit.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{benefit.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {benefit.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(benefit.type)}</TableCell>
                    <TableCell>{formatCurrency(benefit.coverageAmount)}</TableCell>
                    <TableCell>{formatCurrency(benefit.employeeContribution)}</TableCell>
                    <TableCell>{formatCurrency(benefit.employerContribution)}</TableCell>
                    <TableCell>
                      <Badge variant={benefit.isActive ? "default" : "secondary"}>
                        {benefit.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(benefit)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(benefit)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {benefits.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="text-muted-foreground">
                        No benefits found. Create your first benefit to get started.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <DataTablePagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              pageSize={pagination.limit}
              totalItems={pagination.total}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Benefit</DialogTitle>
              <DialogDescription>
                Update benefit information
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Benefit Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Health Insurance"
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the benefit coverage..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="edit-type">Benefit Type</Label>
                <select
                  id="edit-type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  required
                >
                  <option value="">Select benefit type</option>
                  {BENEFIT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit-coverageAmount">Coverage Amount</Label>
                  <Input
                    id="edit-coverageAmount"
                    type="number"
                    step="0.01"
                    value={formData.coverageAmount}
                    onChange={(e) => setFormData({ ...formData, coverageAmount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-employeeContribution">Employee Contribution</Label>
                  <Input
                    id="edit-employeeContribution"
                    type="number"
                    step="0.01"
                    value={formData.employeeContribution}
                    onChange={(e) => setFormData({ ...formData, employeeContribution: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-employerContribution">Employer Contribution</Label>
                  <Input
                    id="edit-employerContribution"
                    type="number"
                    step="0.01"
                    value={formData.employerContribution}
                    onChange={(e) => setFormData({ ...formData, employerContribution: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update Benefit</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <ConfirmationDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmText="Delete"
          variant="destructive"
          onConfirm={() => {
            confirmDialog.action()
            setConfirmDialog(prev => ({ ...prev, open: false }))
          }}
        />
      </div>
    </DashboardLayout>
  )
}
