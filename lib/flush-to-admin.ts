import { prisma } from "./prisma"

async function flushToAdmin() {
  // Keep only users with role ADMIN; remove all others and their cascaded data.
  // Then clear payroll periods so old payroll history is removed as well.
  const adminUsers = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, role: true },
  })

  if (adminUsers.length === 0) {
    throw new Error("No ADMIN user found. Cannot flush safely.")
  }

  const nonAdminUsers = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: { id: true },
  })

  const nonAdminUserIds = nonAdminUsers.map((u) => u.id)
  const adminUserIds = adminUsers.map((u) => u.id)

  // Identify admin employee(s) so we can keep only those.
  const adminEmployeeIds = await prisma.employee.findMany({
    where: { userId: { in: adminUserIds } },
    select: { id: true },
  })

  const nonAdminEmployeeIds = await prisma.employee.findMany({
    where: { userId: { in: nonAdminUserIds } },
    select: { id: true },
  })

  // Dept head is referenced by Department.headId -> Employee.id.
  // Clear these pointers first so deleting the dept head employee doesn't violate FK constraints.
  if (nonAdminEmployeeIds.length > 0) {
    await prisma.department.updateMany({
      where: { headId: { in: nonAdminEmployeeIds.map((e) => e.id) } },
      data: { headId: null },
    })
  }

  // Delete all non-admin users. Employee + attendance + requests + payrollItems will cascade.
  if (nonAdminUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { role: { not: "ADMIN" } },
    })
  }

  // Delete any remaining employee rows that are not linked to an ADMIN user
  // (these can exist with userId = null depending on previous seed/cleanup).
  await prisma.employee.deleteMany({
    where: { id: { notIn: adminEmployeeIds.map((e) => e.id) } },
  })

  // Clear payroll history periods (and any remaining payroll items tied to them via cascade).
  await prisma.payrollPeriod.deleteMany({})

  // Verification
  const usersAfter = await prisma.user.findMany({
    select: { id: true, email: true, role: true },
    orderBy: { createdAt: "asc" },
  })

  const employeesAfter = await prisma.employee.findMany({
    select: { id: true, employeeId: true, firstName: true, lastName: true, userId: true },
  })

  const deptHeadsAfter = await prisma.department.findMany({
    where: { headId: { not: null } },
    select: { id: true, name: true, headId: true },
  })

  return {
    adminUsers,
    usersAfter,
    employeesAfter,
    deptHeadsAfter,
  }
}

export async function main() {
  const result = await flushToAdmin()
  // eslint-disable-next-line no-console
  console.log("Flush to admin completed:")
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2))
}

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err)
    process.exit(1)
  })
}

