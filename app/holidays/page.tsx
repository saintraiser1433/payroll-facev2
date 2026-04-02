"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Plus, Search, Edit, Trash2, Calendar, DollarSign, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { DashboardLayout } from "@/components/dashboard-layout"

interface Holiday {
  id: string
  name: string
  date: string
  type: 'REGULAR' | 'SPECIAL'
  payRate: number
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function HolidaysPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString())
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
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null)

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    type: "REGULAR" as 'REGULAR' | 'SPECIAL',
    payRate: 2.0,
    description: "",
    isActive: true
  })

  useEffect(() => {
    fetchHolidays()
  }, [pagination.page, searchTerm, typeFilter, yearFilter])

  const fetchHolidays = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: searchTerm,
        type: typeFilter,
        year: yearFilter
      })

      const response = await fetch(`/api/holidays?${params}`)
      if (!response.ok) throw new Error('Failed to fetch holidays')
      
      const data = await response.json()
      setHolidays(data.holidays)
      setPagination(data.pagination)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch holidays",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create holiday')
      }

      toast({
        title: "Success",
        description: "Holiday created successfully",
      })

      setIsCreateDialogOpen(false)
      resetForm()
      fetchHolidays()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create holiday",
        variant: "destructive",
      })
    }
  }

  const handleEdit = async () => {
    if (!selectedHoliday) return

    try {
      const response = await fetch(`/api/holidays/${selectedHoliday.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update holiday')
      }

      toast({
        title: "Success",
        description: "Holiday updated successfully",
      })

      setIsEditDialogOpen(false)
      resetForm()
      fetchHolidays()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update holiday",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    if (!selectedHoliday) return

    try {
      const response = await fetch(`/api/holidays/${selectedHoliday.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete holiday')
      }

      toast({
        title: "Success",
        description: "Holiday deleted successfully",
      })

      setIsDeleteDialogOpen(false)
      setSelectedHoliday(null)
      fetchHolidays()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete holiday",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      date: "",
      type: "REGULAR",
      payRate: 2.0,
      description: "",
      isActive: true
    })
  }

  const handleEditHoliday = (holiday: Holiday) => {
    setSelectedHoliday(holiday)
    setFormData({
      name: holiday.name,
      date: new Date(holiday.date).toISOString().split('T')[0],
      type: holiday.type,
      payRate: holiday.payRate,
      description: holiday.description || "",
      isActive: holiday.isActive
    })
    setIsEditDialogOpen(true)
  }

  const handleDeleteHoliday = (holiday: Holiday) => {
    setSelectedHoliday(holiday)
    setIsDeleteDialogOpen(true)
  }

  const getTypeBadge = (type: string) => {
    return type === 'REGULAR' ? (
      <Badge variant="default">Regular</Badge>
    ) : (
      <Badge variant="secondary">Special</Badge>
    )
  }

  const getPayRateText = (payRate: number) => {
    if (payRate === 2.0) return "Double Pay"
    if (payRate === 1.5) return "1.5x Pay"
    return `${payRate}x Pay`
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  if (session?.user?.role !== 'ADMIN') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
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
            <h1 className="text-3xl font-bold text-gray-900">Holiday Management</h1>
            <p className="text-gray-600">Manage company holidays and special pay rates</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Holiday
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Holiday</DialogTitle>
                <DialogDescription>
                  Create a new holiday with special pay rates
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Holiday Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Christmas Day"
                  />
                </div>
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="type">Holiday Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: 'REGULAR' | 'SPECIAL') => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REGULAR">Regular Holiday</SelectItem>
                      <SelectItem value="SPECIAL">Special Holiday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="payRate">Pay Rate Multiplier</Label>
                  <Input
                    id="payRate"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={formData.payRate}
                    onChange={(e) => setFormData({ ...formData, payRate: parseFloat(e.target.value) || 2.0 })}
                    placeholder="2.0 for double pay"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    2.0 = Double Pay, 1.5 = 1.5x Pay, etc.
                  </p>
                </div>
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Additional details about this holiday"
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
                <Button onClick={handleCreate}>Create Holiday</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search holidays..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="REGULAR">Regular</SelectItem>
                    <SelectItem value="SPECIAL">Special</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="year">Year</Label>
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Holidays Table */}
        <Card>
          <CardHeader>
            <CardTitle>Holidays</CardTitle>
            <CardDescription>
              Manage company holidays and their pay rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Pay Rate</TableHead>
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
                ) : holidays.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No holidays found
                    </TableCell>
                  </TableRow>
                ) : (
                  holidays.map((holiday) => (
                    <TableRow key={holiday.id}>
                      <TableCell className="font-medium">{holiday.name}</TableCell>
                      <TableCell>
                        {new Date(holiday.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{getTypeBadge(holiday.type)}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-1" />
                          {getPayRateText(holiday.payRate)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={holiday.isActive ? "default" : "secondary"}>
                          {holiday.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditHoliday(holiday)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteHoliday(holiday)}
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
              <DialogTitle>Edit Holiday</DialogTitle>
              <DialogDescription>
                Update holiday information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Holiday Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-type">Holiday Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'REGULAR' | 'SPECIAL') => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REGULAR">Regular Holiday</SelectItem>
                    <SelectItem value="SPECIAL">Special Holiday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-payRate">Pay Rate Multiplier</Label>
                <Input
                  id="edit-payRate"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={formData.payRate}
                  onChange={(e) => setFormData({ ...formData, payRate: parseFloat(e.target.value) || 2.0 })}
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
              <Button onClick={handleEdit}>Update Holiday</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Holiday</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{selectedHoliday?.name}"? This action cannot be undone.
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
