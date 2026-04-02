# Fix for Payroll Items Error

## Problem
The error occurs because the Prisma client needs to be regenerated after adding new fields to the schema.

## Solution

### Option 1: Restart Dev Server (Recommended)
1. Stop your Next.js dev server (Ctrl+C)
2. Run: `npx prisma generate`
3. Restart your dev server: `npm run dev`

### Option 2: If Option 1 doesn't work
1. Stop your Next.js dev server
2. Close any Node processes: `taskkill /F /IM node.exe` (Windows)
3. Run: `npx prisma generate`
4. Restart your dev server: `npm run dev`

### Option 3: Full Reset (if needed)
1. Stop your dev server
2. Delete `.next` folder: `rmdir /s /q .next` (Windows) or `rm -rf .next` (Mac/Linux)
3. Run: `npx prisma generate`
4. Restart: `npm run dev`

## What Was Changed
- Added `thirteenthMonthPay` field to `PayrollItem` model
- Added `isThirteenthMonth` field to `PayrollPeriod` model
- Database schema has been updated via `prisma db push`
- Prisma client needs to be regenerated to recognize new fields

## Verification
After regenerating, the payroll items should load correctly and show the new "13th Month Pay" column.

