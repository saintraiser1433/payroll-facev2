import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { calculatePhilippineTax } from '@/lib/philippine-tax'

const calculatePayrollSchema = z.object({
  payrollPeriodId: z.string().min(1, 'Payroll period ID is required'),
  employeeIds: z.array(z.string()).optional(), // If not provided, calculate for all active employees
})

// POST /api/payroll/calculate - Calculate payroll for a period
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { payrollPeriodId, employeeIds } = calculatePayrollSchema.parse(body)

    // Get payroll period
    const payrollPeriod = await prisma.payrollPeriod.findUnique({
      where: { id: payrollPeriodId }
    })

    if (!payrollPeriod) {
      return NextResponse.json(
        { error: 'Payroll period not found' },
        { status: 404 }
      )
    }

    if (payrollPeriod.status === 'CLOSED') {
      return NextResponse.json(
        { error: 'Cannot calculate payroll for closed period' },
        { status: 400 }
      )
    }

    // Get employees to calculate payroll for
    const whereClause: any = { isActive: true }
    if (employeeIds && employeeIds.length > 0) {
      whereClause.id = { in: employeeIds }
    }

    const employees = await prisma.employee.findMany({
      where: whereClause,
      include: {
        schedule: true,
        salaryGrade: true,
        attendances: {
          where: {
            date: {
              gte: payrollPeriod.startDate,
              lte: payrollPeriod.endDate
            }
          }
        },
        cashAdvances: {
          where: {
            dateIssued: {
              gte: payrollPeriod.startDate,
              lte: payrollPeriod.endDate
            },
            status: 'APPROVED',
            isPaid: false
          }
        },
        overtimeRequests: {
          where: {
            status: 'APPROVED',
            requestDate: {
              gte: payrollPeriod.startDate,
              lte: payrollPeriod.endDate
            }
          }
        },
        leaveRequests: {
          where: {
            status: 'APPROVED',
            startDate: { lte: payrollPeriod.endDate },
            endDate: { gte: payrollPeriod.startDate }
          }
        },
        employeeBenefits: {
          where: {
            isActive: true,
            OR: [
              { endDate: null },
              { endDate: { gte: payrollPeriod.startDate } }
            ]
          },
          include: {
            benefit: true
          }
        }
      }
    })

    // Get deduction types
    const deductionTypes = await prisma.deductionType.findMany()

    // Get holidays for the payroll period
    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: payrollPeriod.startDate,
          lte: payrollPeriod.endDate
        },
        isActive: true
      }
    })

    const payrollItems = []

    // Build a position -> salaryRate map (position-based payroll).
    const uniquePositions = Array.from(new Set(employees.map((e) => e.position).filter(Boolean)))
    const positionSalaries = await prisma.positionSalary.findMany({
      where: {
        position: { in: uniquePositions },
        isActive: true,
      },
      select: {
        position: true,
        salaryRate: true,
      },
    })
    const positionSalaryMap = new Map(positionSalaries.map((ps) => [ps.position, ps.salaryRate]))

    for (const employee of employees) {
      // Calculate basic pay based on attendance
      let basicPay = 0
      let overtimePay = 0
      let holidayPay = 0
      let thirteenthMonthPay = 0
      let totalWorkedHours = 0
      let totalOvertimeHours = 0
      let totalEarnings = 0 // Declare early to avoid initialization error

      // Handle 13th month pay calculation (Philippine Labor Law)
      // Formula: (Total Basic Salary Earned in Calendar Year) / 12
      // For employees who didn't work full year: (Monthly Basic Salary × Months Worked) / 12
      if (payrollPeriod.isThirteenthMonth) {
        const salaryRate = positionSalaryMap.get(employee.position) ?? employee.salaryGrade?.salaryRate ?? 0
        
        // Philippine 13th Month Pay Calculation
        // Based on Presidential Decree No. 851 and DOLE guidelines
        const hireDate = new Date(employee.hireDate)
        const periodStartDate = new Date(payrollPeriod.startDate)
        const periodEndDate = new Date(payrollPeriod.endDate)
        
        // Calculate based on calendar year (January 1 to December 31)
        const calendarYear = periodEndDate.getFullYear()
        const startOfYear = new Date(calendarYear, 0, 1) // January 1
        const endOfYear = new Date(calendarYear, 11, 31) // December 31
        
        // Determine actual start date (hire date or start of year, whichever is later)
        const actualStartDate = hireDate > startOfYear ? hireDate : startOfYear
        
        // Determine actual end date (period end or end of year, whichever is earlier)
        // For 13th month calculation, use end of year if period extends beyond
        const actualEndDate = periodEndDate > endOfYear ? endOfYear : periodEndDate
        
        // Calculate months worked in the calendar year (Philippine standard)
        // Philippine Labor Law (Presidential Decree No. 851):
        // Formula: (Monthly Basic Salary × Months Worked in Calendar Year) / 12
        // Count each month where employee worked at least 1 day
        let monthsWorked = 0
        
        // If employee worked the full calendar year (Jan 1 to Dec 31)
        if (actualStartDate <= startOfYear && actualEndDate >= endOfYear) {
          monthsWorked = 12
        } else {
          // Calculate total days worked in the calendar year
          const totalDaysWorked = Math.ceil((actualEndDate.getTime() - actualStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
          
          // Philippine standard: Convert days to months using 30.44 days per month (365.25/12)
          // This is the standard conversion used in Philippine payroll calculations
          monthsWorked = totalDaysWorked / 30.44
        }
        
        // Cap at 12 months (full year maximum)
        const cappedMonths = Math.min(12, Math.max(0, monthsWorked))
        
        // Philippine 13th Month Pay Formula: (Monthly Basic Salary × Months Worked) / 12
        // Only includes basic salary, excludes overtime, allowances, etc.
        thirteenthMonthPay = (salaryRate * cappedMonths) / 12
        
        console.log(`\n13th Month Pay calculation (Philippine Standard) for ${employee.firstName} ${employee.lastName}:`)
        console.log(`- Monthly basic salary: ₱${salaryRate.toLocaleString()}`)
        console.log(`- Hire date: ${hireDate.toLocaleDateString()}`)
        console.log(`- Calendar year: ${calendarYear}`)
        console.log(`- Actual start date: ${actualStartDate.toLocaleDateString()}`)
        console.log(`- Actual end date: ${actualEndDate.toLocaleDateString()}`)
        console.log(`- Months worked in calendar year: ${cappedMonths.toFixed(2)}`)
        console.log(`- 13th Month Pay: ₱${thirteenthMonthPay.toFixed(2)}`)
        console.log(`- Note: 13th month pay is tax-exempt up to ₱90,000 under Philippine tax law`)
        
        // For 13th month pay, set basic pay to 0 and total earnings to 13th month pay
        basicPay = 0
        overtimePay = 0
        holidayPay = 0
        totalEarnings = thirteenthMonthPay
        
        // Create or update payroll item for 13th month pay
        const existingPayrollItem = await prisma.payrollItem.findUnique({
          where: {
            employeeId_payrollPeriodId: {
              employeeId: employee.id,
              payrollPeriodId: payrollPeriodId
            }
          }
        })

        let payrollItem
        if (existingPayrollItem) {
          payrollItem = await prisma.payrollItem.update({
            where: { id: existingPayrollItem.id },
            data: {
              basicPay: 0,
              overtimePay: 0,
              holidayPay: 0,
              thirteenthMonthPay,
              totalEarnings: thirteenthMonthPay,
              totalDeductions: 0, // 13th month pay is typically tax-free or has minimal deductions
              netPay: thirteenthMonthPay
            }
          })
        } else {
          payrollItem = await prisma.payrollItem.create({
            data: {
              employeeId: employee.id,
              payrollPeriodId: payrollPeriodId,
              basicPay: 0,
              overtimePay: 0,
              holidayPay: 0,
              thirteenthMonthPay,
              totalEarnings: thirteenthMonthPay,
              totalDeductions: 0,
              netPay: thirteenthMonthPay
            }
          })
        }

        payrollItems.push({
          ...payrollItem,
          employee: {
            id: employee.id,
            employeeId: employee.employeeId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            position: employee.position
          },
          totalWorkedHours: 0,
          totalOvertimeHours: 0,
          cashAdvanceTotal: 0
        })

        continue // Skip to next employee
      }

      // Regular payroll calculation continues below
      for (const attendance of employee.attendances) {
        if (attendance.timeIn && attendance.timeOut) {
          // Calculate worked hours
          const workedMinutes = Math.floor(
            (attendance.timeOut.getTime() - attendance.timeIn.getTime()) / (1000 * 60)
          )
          const workedHours = workedMinutes / 60
          totalWorkedHours += workedHours

          // Calculate overtime
          if (attendance.overtimeMinutes > 0) {
            const overtimeHours = attendance.overtimeMinutes / 60
            totalOvertimeHours += overtimeHours
          }
        }
      }

      // Calculate pay based on salary type with time-based adjustments
      let lateMinutes = 0
      let undertimeMinutes = 0
      let timeAdjustments = 0
      // totalEarnings already declared above

      if (employee.salaryType === 'MONTHLY') {
        // For monthly, calculate based on payroll period type
        const expectedWorkDays = getWorkDaysInPeriod(
          payrollPeriod.startDate,
          payrollPeriod.endDate,
          employee.schedule?.workingDays || 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY'
        )
        const workedDays = employee.attendances.filter(a => a.timeIn && a.timeOut).length
        
        // Calculate period-based salary using legal working days
        const periodDays = Math.ceil((new Date(payrollPeriod.endDate).getTime() - new Date(payrollPeriod.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
        const daysInMonth = new Date(new Date(payrollPeriod.startDate).getFullYear(), new Date(payrollPeriod.startDate).getMonth() + 1, 0).getDate()
        
        // Use simple half-month calculation for now
        const salaryRate = positionSalaryMap.get(employee.position) ?? employee.salaryGrade?.salaryRate ?? 0
        const halfMonthSalary = salaryRate / 2
        
        console.log(`\nMonthly worker calculation for ${employee.firstName} ${employee.lastName}:`)
        console.log(`- Monthly salary: ₱${salaryRate}`)
        console.log(`- Expected work days in period: ${expectedWorkDays}`)
        console.log(`- Half-month salary: ₱${halfMonthSalary.toFixed(2)}`)
        console.log(`- Worked days: ${workedDays}`)
        
        // Basic pay is the full half-month salary (unchanged)
        basicPay = halfMonthSalary
        
        // Calculate daily rate for gross pay calculation based on present legal days
        const dailyRate = halfMonthSalary / expectedWorkDays

        const workingDaysCsv = employee.schedule?.workingDays || 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY'

        // Approved leave days count as "worked" days for absence deduction.
        const approvedLeaveDays = (employee.leaveRequests || []).reduce((sum: number, leave) => {
          const overlapStart = leave.startDate > payrollPeriod.startDate ? leave.startDate : payrollPeriod.startDate
          const overlapEnd = leave.endDate < payrollPeriod.endDate ? leave.endDate : payrollPeriod.endDate
          if (overlapStart > overlapEnd) return sum
          return sum + getWorkDaysInPeriod(overlapStart, overlapEnd, workingDaysCsv)
        }, 0)

        const absentDays = Math.max(0, expectedWorkDays - (workedDays + approvedLeaveDays))
        const absentDeduction = absentDays * dailyRate
        
        // Calculate schedule duration for accurate rate calculations
        // Example: Schedule 9am-7pm = 10 hours (600 minutes)
        let scheduleDurationMinutes = 8 * 60 // Default to 8 hours (480 minutes)
        if (employee.schedule) {
          const [scheduleStartHour, scheduleStartMin] = employee.schedule.timeIn.split(':').map(Number)
          const [scheduleEndHour, scheduleEndMin] = employee.schedule.timeOut.split(':').map(Number)
          const scheduleStartMinutes = scheduleStartHour * 60 + scheduleStartMin
          const scheduleEndMinutes = scheduleEndHour * 60 + scheduleEndMin
          let duration = scheduleEndMinutes - scheduleStartMinutes
          if (duration < 0) {
            duration += 24 * 60 // Handle night shifts that cross midnight
          }
          scheduleDurationMinutes = duration
        }
        
        // Calculate hourly rate based on actual schedule duration (not assuming 8 hours)
        const scheduleHours = scheduleDurationMinutes / 60
        const hourlyRate = dailyRate / scheduleHours
        
        console.log(`- Daily rate: ₱${dailyRate.toFixed(2)}`)
        console.log(`- Schedule duration: ${scheduleDurationMinutes / 60} hours (${scheduleDurationMinutes} minutes)`)
        console.log(`- Hourly rate: ₱${hourlyRate.toFixed(2)}`)
        console.log(`- Basic pay (half-month salary): ₱${basicPay.toFixed(2)}`)
        
        // For monthly employees, calculate time adjustments (tardy + undertime deductions)
        // These are deducted from the basic pay proportionally
        let totalLateMinutes = 0
        let totalUndertimeMinutes = 0
        let totalOvertimeHours = 0
        
        for (const attendance of employee.attendances) {
          if (attendance.timeIn && attendance.timeOut && employee.schedule) {
            // Calculate late minutes (from schedule time in)
            if (attendance.lateMinutes > 0) {
              totalLateMinutes += attendance.lateMinutes
            }
            
            // Calculate undertime minutes (from schedule time out)
            if (attendance.undertimeMinutes > 0) {
              totalUndertimeMinutes += attendance.undertimeMinutes
            }
            
            // Calculate overtime hours
            if (attendance.overtimeMinutes > 0) {
              totalOvertimeHours += attendance.overtimeMinutes / 60
            }
          }
        }

        // Add overtime minutes approved by Dept Head (covers requested OT not captured by attendance).
        const approvedOvertimeMinutes = (employee.overtimeRequests || []).reduce(
          (sum: number, req: any) => sum + (req.approvedMinutes || 0),
          0
        )
        totalOvertimeHours += approvedOvertimeMinutes / 60
        
        // Calculate time adjustments (late + undertime deductions)
        // For monthly employees: Deduct from basic pay based on tardy/undertime
        // Calculate day-by-day: For each day with adjustments, deduct proportional amount from daily rate
        // Example: 30 minutes tardy in a 10-hour (600 min) day = (30/600) * dailyRate = deduction for that day
        timeAdjustments = 0
        
        // Sum up deductions day by day
        // For each day with adjustments, calculate (adjustmentMinutes / scheduleDurationMinutes) * dailyRate
        for (const attendance of employee.attendances) {
          if (attendance.timeIn && attendance.timeOut && employee.schedule) {
            const dayAdjustmentMinutes = (attendance.lateMinutes || 0) + (attendance.undertimeMinutes || 0)
            if (dayAdjustmentMinutes > 0) {
              const dayDeduction = (dayAdjustmentMinutes / scheduleDurationMinutes) * dailyRate
              timeAdjustments += dayDeduction
            }
          }
        }
        
        // Calculate overtime pay
        overtimePay = totalOvertimeHours * hourlyRate * 1.5
        
        // Calculate holiday pay
        for (const holiday of holidays) {
          const holidayDate = new Date(holiday.date)
          const isHolidayWorked = employee.attendances.some(attendance => {
            const attendanceDate = new Date(attendance.date)
            return attendanceDate.toDateString() === holidayDate.toDateString() && 
                   attendance.timeIn && attendance.timeOut
          })
          
          if (isHolidayWorked) {
            // Calculate holiday pay based on the holiday's pay rate
            const dailyHolidayPay = dailyRate * holiday.payRate
            holidayPay += dailyHolidayPay
            
            console.log(`- Holiday: ${holiday.name} (${holiday.type}) - Pay Rate: ${holiday.payRate}x - Amount: ₱${dailyHolidayPay.toFixed(2)}`)
          }
        }
        
        console.log(`- Worked days: ${workedDays}`)
        console.log(`- Approved leave days: ${approvedLeaveDays}`)
        console.log(`- Absent days: ${absentDays}`)
        console.log(`- Late minutes: ${totalLateMinutes}`)
        console.log(`- Undertime minutes: ${totalUndertimeMinutes}`)
        console.log(`- Overtime hours: ${totalOvertimeHours.toFixed(2)}`)
        console.log(`- Time adjustments (deductions): ₱${timeAdjustments.toFixed(2)}`)
        console.log(`- Absent deduction: ₱${absentDeduction.toFixed(2)}`)
        console.log(`- Overtime pay: ₱${overtimePay.toFixed(2)}`)
        console.log(`- Holiday pay: ₱${holidayPay.toFixed(2)}`)
        
        // For monthly employees: Basic pay is fixed, then add overtime/holiday, then subtract tardy/undertime
        // Gross Pay = Basic Pay + Overtime Pay + Holiday Pay - Time Adjustments (tardy + undertime)
        totalEarnings = Math.max(0, basicPay + overtimePay + holidayPay - timeAdjustments - absentDeduction)
      } else {
        // For daily workers, calculate total earnings normally
        totalEarnings = Math.max(0, basicPay + overtimePay - timeAdjustments)
      }

      // Validate and fix NaN values
      const safeBasicPay = isNaN(basicPay) ? 0 : basicPay
      const safeOvertimePay = isNaN(overtimePay) ? 0 : overtimePay
      const safeHolidayPay = isNaN(holidayPay) ? 0 : holidayPay
      const safeThirteenthMonthPay = isNaN(thirteenthMonthPay) ? 0 : thirteenthMonthPay
      const safeTotalEarnings = isNaN(totalEarnings) ? 0 : totalEarnings

      // Log time adjustments for debugging
      if (timeAdjustments > 0) {
        console.log(`\nTime adjustments for ${employee.firstName} ${employee.lastName}:`)
        console.log(`- Late minutes: ${lateMinutes}`)
        console.log(`- Undertime minutes: ${undertimeMinutes}`)
        console.log(`- Time adjustments: ₱${timeAdjustments.toFixed(2)}`)
        console.log(`- Basic pay after adjustments: ₱${safeBasicPay.toFixed(2)}`)
      }

      // Calculate cash advances total (always needed for reporting)
      const cashAdvanceTotal = employee.cashAdvances.reduce(
        (sum, advance) => sum + advance.amount,
        0
      )

      // Calculate deductions - only if deductions are enabled for this period
      let totalDeductions = 0
      const deductions = []

      if (payrollPeriod.deductionsEnabled) {
        console.log(`\n🔧 Deductions ENABLED for period "${payrollPeriod.name}" - applying all deductions`)
        
        // Apply Philippine Progressive Tax System
        const withholdingTaxType = deductionTypes.find(dt => dt.name === "Withholding Tax")
        
        if (withholdingTaxType) {
          // Calculate progressive tax based on annual income
          const taxCalculation = calculatePhilippineTax(safeTotalEarnings, employee.salaryType)
          
          if (taxCalculation.monthlyTax > 0) {
            deductions.push({
              deductionTypeId: withholdingTaxType.id,
              amount: taxCalculation.monthlyTax
            })
            totalDeductions += taxCalculation.monthlyTax
            
            console.log(`✅ Applied Philippine progressive tax: ₱${taxCalculation.monthlyTax.toFixed(2)}`)
            console.log(`   Annual taxable income: ₱${taxCalculation.annualTaxableIncome.toLocaleString()}`)
            console.log(`   Effective tax rate: ${taxCalculation.effectiveRate.toFixed(2)}%`)
            console.log(`   Tax brackets used: ${taxCalculation.bracketBreakdown.length}`)
            
            if (taxCalculation.bracketBreakdown.length > 0) {
              console.log(`   Tax breakdown:`)
              taxCalculation.bracketBreakdown.forEach(bracket => {
                console.log(`     ${bracket.bracket}: ₱${bracket.taxAmount.toFixed(2)} (${bracket.taxRate}%)`)
              })
            }
          } else {
            console.log(`ℹ️  Employee exempt from tax (below ₱250,000 annual exemption)`)
          }
        }

        // Note: SSS, PhilHealth, and Pag-IBIG are now manual deductions
        // They will only be applied if explicitly assigned to employees via benefits
        console.log(`ℹ️  SSS, PhilHealth, and Pag-IBIG deductions are now manual - only applied when assigned to employees`)

        // Add benefit deductions (employee contributions) - only if net pay won't be negative
        let benefitDeductions = 0
        let tempTotalDeductions = totalDeductions
        
        console.log(`\nProcessing benefits for ${employee.firstName} ${employee.lastName}:`)
        console.log(`- Total Earnings: ₱${totalEarnings}`)
        console.log(`- Current Deductions: ₱${totalDeductions}`)
        console.log(`- Employee Benefits: ${employee.employeeBenefits.length}`)
        
        for (const employeeBenefit of employee.employeeBenefits) {
          if (employeeBenefit.benefit.isActive && employeeBenefit.benefit.employeeContribution > 0) {
            // Check if adding this benefit deduction would result in negative net pay
            const potentialNetPay = totalEarnings - (tempTotalDeductions + employeeBenefit.benefit.employeeContribution)
            
            console.log(`- Benefit: ${employeeBenefit.benefit.name} (₱${employeeBenefit.benefit.employeeContribution})`)
            console.log(`- Potential Net Pay: ₱${potentialNetPay}`)
            
            if (potentialNetPay >= 0) {
              benefitDeductions += employeeBenefit.benefit.employeeContribution
              tempTotalDeductions += employeeBenefit.benefit.employeeContribution
              
              console.log(`✅ Adding ${employeeBenefit.benefit.name} benefit deduction`)
              
              // Create or find specific deduction type for this benefit
              let benefitDeductionType = await prisma.deductionType.findFirst({
                where: { name: employeeBenefit.benefit.name }
              })
              
              if (!benefitDeductionType) {
                benefitDeductionType = await prisma.deductionType.create({
                  data: {
                    name: employeeBenefit.benefit.name,
                    description: `Employee contribution for ${employeeBenefit.benefit.name} benefit`,
                    amount: 0,
                    isFixed: false
                  }
                })
              }
              
              // Add benefit as a deduction entry
              deductions.push({
                deductionTypeId: benefitDeductionType.id,
                amount: employeeBenefit.benefit.employeeContribution,
                benefitName: employeeBenefit.benefit.name
              })
            } else {
              // Log when benefit is skipped due to negative net pay
              console.log(`❌ Skipping ${employeeBenefit.benefit.name} benefit - would result in negative net pay (₱${potentialNetPay})`)
            }
          }
        }
        
        totalDeductions += benefitDeductions
        console.log(`- Final Benefit Deductions: ₱${benefitDeductions}`)
        console.log(`- Final Total Deductions: ₱${totalDeductions}`)

        // Add cash advances as deductions
        totalDeductions += cashAdvanceTotal
      } else {
        console.log(`\n🚫 Deductions DISABLED for period "${payrollPeriod.name}" - skipping all deductions`)
        console.log(`- Total Earnings: ₱${totalEarnings}`)
        console.log(`- Deductions Applied: ₱0 (disabled)`)
        console.log(`- Net Pay: ₱${totalEarnings}`)
      }

      // Ensure net pay is never negative
      const netPay = Math.max(0, totalEarnings - totalDeductions)

      // Create or update payroll item
      const existingPayrollItem = await prisma.payrollItem.findUnique({
        where: {
          employeeId_payrollPeriodId: {
            employeeId: employee.id,
            payrollPeriodId: payrollPeriodId
          }
        }
      })

      let payrollItem
      if (existingPayrollItem) {
        // Update existing
        payrollItem = await prisma.payrollItem.update({
          where: { id: existingPayrollItem.id },
          data: {
            basicPay: safeBasicPay,
            overtimePay: safeOvertimePay,
            holidayPay: safeHolidayPay,
            thirteenthMonthPay: safeThirteenthMonthPay,
            totalEarnings: safeTotalEarnings,
            totalDeductions,
            netPay
          }
        })

        // Delete existing deductions and recreate
        await prisma.payrollDeduction.deleteMany({
          where: { payrollItemId: existingPayrollItem.id }
        })
      } else {
        // Create new
        payrollItem = await prisma.payrollItem.create({
          data: {
            employeeId: employee.id,
            payrollPeriodId: payrollPeriodId,
            basicPay: safeBasicPay,
            overtimePay: safeOvertimePay,
            holidayPay: safeHolidayPay,
            thirteenthMonthPay: safeThirteenthMonthPay,
            totalEarnings: safeTotalEarnings,
            totalDeductions,
            netPay
          }
        })
      }

      // Create deductions
      if (deductions.length > 0) {
        for (const deduction of deductions) {
          // Create the deduction entry
          await prisma.payrollDeduction.create({
            data: {
              payrollItemId: payrollItem.id,
              deductionTypeId: deduction.deductionTypeId,
              amount: deduction.amount
            }
          })
        }
      }

      // Mark cash advances as paid - only if deductions are enabled
      if (employee.cashAdvances.length > 0 && payrollPeriod.deductionsEnabled) {
        await prisma.cashAdvance.updateMany({
          where: {
            id: { in: employee.cashAdvances.map(ca => ca.id) }
          },
          data: { isPaid: true }
        })
        console.log(`✅ Marked ${employee.cashAdvances.length} cash advances as paid for ${employee.firstName} ${employee.lastName}`)
      } else if (employee.cashAdvances.length > 0 && !payrollPeriod.deductionsEnabled) {
        console.log(`ℹ️  Cash advances not marked as paid - deductions disabled for period "${payrollPeriod.name}"`)
      }

      payrollItems.push({
        ...payrollItem,
        employee: {
          id: employee.id,
          employeeId: employee.employeeId,
          firstName: employee.firstName,
          lastName: employee.lastName,
          position: employee.position
        },
        totalWorkedHours,
        totalOvertimeHours,
        cashAdvanceTotal
      })
    }

    // Keep the period as DRAFT after processing
    // Status will be changed to FINALIZED only when manually closed

    return NextResponse.json({
      message: 'Payroll calculated successfully',
      payrollItems,
      summary: {
        totalEmployees: payrollItems.length,
        totalEarnings: payrollItems.reduce((sum, item) => sum + item.totalEarnings, 0),
        totalDeductions: payrollItems.reduce((sum, item) => sum + item.totalDeductions, 0),
        totalNetPay: payrollItems.reduce((sum, item) => sum + item.netPay, 0)
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error calculating payroll:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to calculate work days in a period
function getWorkDaysInPeriod(startDate: Date, endDate: Date, workingDays: string): number {
  const workDays = workingDays.split(',').map(day => day.trim().toUpperCase())
  const dayMap: { [key: string]: number } = {
    'SUNDAY': 0,
    'MONDAY': 1,
    'TUESDAY': 2,
    'WEDNESDAY': 3,
    'THURSDAY': 4,
    'FRIDAY': 5,
    'SATURDAY': 6
  }

  let count = 0
  const current = new Date(startDate)
  
  while (current <= endDate) {
    const dayName = Object.keys(dayMap).find(key => dayMap[key] === current.getDay())
    if (dayName && workDays.includes(dayName)) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }

  return count
}

