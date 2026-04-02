# Web-based Payroll Management System for Glan White Sand Beach Resort - Setup Instructions

## Quick Setup for Development

### 1. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 2. Setup Environment Variables
Create a `.env` file in the root directory with:
```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/payroll_db?schema=public"

# NextAuth Configuration  
NEXTAUTH_URL="http://localhost:3002"
NEXTAUTH_SECRET="pyrol-secret-key-2025-dennis-bejarasco-payroll-system"
```

### 3. Setup Database (if using PostgreSQL)
```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database (for development)
npm run db:push

# OR run migrations (for production)
npm run db:migrate

# Seed database with demo data
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
```

## Demo Accounts

After seeding the database, you can use these accounts:

- **Admin**: `admin@pyrol.com` / `admin123`
- **Department Head**: `depthead@pyrol.com` / `dept123`
- **Employee**: `employee@pyrol.com` / `emp123`

## Troubleshooting

### Prisma Client Error
If you see "Prisma client did not initialize", run:
```bash
npx prisma generate
```

### NextAuth NO_SECRET Error
Make sure `NEXTAUTH_SECRET` is set in your `.env` file.

### Database Connection Issues
1. Make sure PostgreSQL is running
2. Update `DATABASE_URL` in `.env` with correct credentials
3. Create the database if it doesn't exist

## Development Workflow

1. **Make changes** to your code
2. **Test locally** at `http://localhost:3002`
3. **Access sign-in** at `http://localhost:3002/auth/signin`
4. **Use demo accounts** to test different user roles

## Production Deployment

See `DEPLOYMENT.md` for detailed production deployment instructions.

