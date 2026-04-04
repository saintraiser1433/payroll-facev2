export function filterAndSortData(
  data: Record<string, unknown>[],
  searchTerm: string,
  sortField: string,
  sortDirection: "asc" | "desc",
) {
  let filtered = data

  if (searchTerm) {
    filtered = data.filter((item) =>
      Object.values(item).some((value) => value?.toString().toLowerCase().includes(searchTerm.toLowerCase())),
    )
  }

  filtered.sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]
    if (aValue == null && bValue == null) return 0
    if (aValue == null) return 1
    if (bValue == null) return -1
    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
    return 0
  })

  return filtered
}

export function paginateData(data: unknown[], page: number, itemsPerPage: number) {
  const startIndex = (page - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  return {
    paginatedData: data.slice(startIndex, endIndex),
    totalPages: Math.max(1, Math.ceil(data.length / itemsPerPage)),
    totalItems: data.length,
  }
}
