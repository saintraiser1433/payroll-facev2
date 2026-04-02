// Philippine Progressive Tax Calculation System
// Based on BIR regulations and TRAIN Law

export interface TaxBracket {
  minIncome: number
  maxIncome: number
  rate: number
  baseTax: number
}

export interface TaxCalculation {
  annualTaxableIncome: number
  monthlyTaxableIncome: number
  annualTax: number
  monthlyTax: number
  effectiveRate: number
  bracketBreakdown: Array<{
    bracket: string
    taxableAmount: number
    taxRate: number
    taxAmount: number
  }>
}

// Philippine Tax Brackets (2024-2025) - Annual Income
export const PHILIPPINE_TAX_BRACKETS: TaxBracket[] = [
  {
    minIncome: 0,
    maxIncome: 250000,
    rate: 0,
    baseTax: 0
  },
  {
    minIncome: 250001,
    maxIncome: 400000,
    rate: 15,
    baseTax: 0
  },
  {
    minIncome: 400001,
    maxIncome: 800000,
    rate: 20,
    baseTax: 22500 // 15% of 150,000
  },
  {
    minIncome: 800001,
    maxIncome: 2000000,
    rate: 25,
    baseTax: 102500 // 22,500 + (20% of 400,000)
  },
  {
    minIncome: 2000001,
    maxIncome: 8000000,
    rate: 30,
    baseTax: 402500 // 102,500 + (25% of 1,200,000)
  },
  {
    minIncome: 8000001,
    maxIncome: Infinity,
    rate: 35,
    baseTax: 2202500 // 402,500 + (30% of 6,000,000)
  }
]

/**
 * Calculate Philippine progressive income tax
 * @param monthlySalary - Monthly salary amount
 * @param salaryType - Type of salary (MONTHLY, DAILY, etc.)
 * @returns Tax calculation details
 */
export function calculatePhilippineTax(
  monthlySalary: number,
  salaryType: string = 'MONTHLY'
): TaxCalculation {
  // Convert to annual income
  let annualIncome: number
  
  switch (salaryType.toUpperCase()) {
    case 'MONTHLY':
      annualIncome = monthlySalary * 12
      break
    case 'DAILY':
      annualIncome = monthlySalary * 22 * 12 // Assuming 22 working days per month
      break
    case 'HOURLY':
      annualIncome = monthlySalary * 8 * 22 * 12 // Assuming 8 hours per day, 22 days per month
      break
    default:
      annualIncome = monthlySalary * 12
  }
  
  // Personal exemption (₱250,000 annual)
  const personalExemption = 250000
  const annualTaxableIncome = Math.max(0, annualIncome - personalExemption)
  const monthlyTaxableIncome = annualTaxableIncome / 12
  
  // If no taxable income, return zero tax
  if (annualTaxableIncome <= 0) {
    return {
      annualTaxableIncome: 0,
      monthlyTaxableIncome: 0,
      annualTax: 0,
      monthlyTax: 0,
      effectiveRate: 0,
      bracketBreakdown: []
    }
  }
  
  // Calculate tax using progressive brackets
  let totalTax = 0
  const bracketBreakdown: Array<{
    bracket: string
    taxableAmount: number
    taxRate: number
    taxAmount: number
  }> = []
  
  for (const bracket of PHILIPPINE_TAX_BRACKETS) {
    if (annualTaxableIncome <= bracket.minIncome) {
      break
    }
    
    const taxableInThisBracket = Math.min(
      annualTaxableIncome - bracket.minIncome,
      bracket.maxIncome - bracket.minIncome
    )
    
    if (taxableInThisBracket > 0) {
      const taxInThisBracket = taxableInThisBracket * (bracket.rate / 100)
      totalTax += taxInThisBracket
      
      bracketBreakdown.push({
        bracket: `₱${bracket.minIncome.toLocaleString()} - ₱${bracket.maxIncome === Infinity ? '∞' : bracket.maxIncome.toLocaleString()}`,
        taxableAmount: taxableInThisBracket,
        taxRate: bracket.rate,
        taxAmount: taxInThisBracket
      })
    }
  }
  
  const monthlyTax = totalTax / 12
  const effectiveRate = annualIncome > 0 ? (totalTax / annualIncome) * 100 : 0
  
  return {
    annualTaxableIncome,
    monthlyTaxableIncome,
    annualTax: totalTax,
    monthlyTax,
    effectiveRate,
    bracketBreakdown
  }
}

/**
 * Get tax bracket information for a given income
 */
export function getTaxBracketInfo(annualIncome: number): {
  bracket: TaxBracket | null
  isExempt: boolean
  exemptionAmount: number
} {
  const personalExemption = 250000
  const taxableIncome = Math.max(0, annualIncome - personalExemption)
  
  if (taxableIncome <= 0) {
    return {
      bracket: null,
      isExempt: true,
      exemptionAmount: personalExemption
    }
  }
  
  const bracket = PHILIPPINE_TAX_BRACKETS.find(
    b => taxableIncome >= b.minIncome && taxableIncome <= b.maxIncome
  )
  
  return {
    bracket: bracket || null,
    isExempt: false,
    exemptionAmount: personalExemption
  }
}

/**
 * Calculate tax for multiple salary levels (for testing/demonstration)
 */
export function demonstrateTaxCalculation(): Array<{
  monthlySalary: number
  annualIncome: number
  taxableIncome: number
  monthlyTax: number
  annualTax: number
  effectiveRate: number
  isExempt: boolean
}> {
  const salaryLevels = [
    { level: "Minimum Wage", monthly: 15000 },
    { level: "Entry Level", monthly: 25000 },
    { level: "Mid Level", monthly: 50000 },
    { level: "Senior Level", monthly: 80000 },
    { level: "Manager Level", monthly: 120000 },
    { level: "Executive Level", monthly: 200000 }
  ]
  
  return salaryLevels.map(({ level, monthly }) => {
    const taxCalc = calculatePhilippineTax(monthly, 'MONTHLY')
    const bracketInfo = getTaxBracketInfo(monthly * 12)
    
    return {
      level,
      monthlySalary: monthly,
      annualIncome: monthly * 12,
      taxableIncome: taxCalc.annualTaxableIncome,
      monthlyTax: taxCalc.monthlyTax,
      annualTax: taxCalc.annualTax,
      effectiveRate: taxCalc.effectiveRate,
      isExempt: bracketInfo.isExempt
    }
  })
}
