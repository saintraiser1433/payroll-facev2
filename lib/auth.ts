import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Find user in database
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email
            },
            include: {
              employee: true
            }
          })

          if (!user) {
            console.log('User not found:', credentials.email)
            return null
          }

          console.log('User found:', { 
            id: user.id, 
            email: user.email, 
            role: user.role,
            passwordLength: user.password.length,
            employeeId: user.employee?.id 
          })

          // Verify password
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
          
          console.log('Password verification:', { 
            email: credentials.email,
            isValid: isPasswordValid,
            inputPasswordLength: credentials.password.length,
            storedPasswordLength: user.password.length
          })

          if (!isPasswordValid) {
            return null
          }

          // Return user object
          return {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user.email,
            employeeId: user.employee?.id || null,
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.employeeId = user.employeeId
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.employeeId = token.employeeId as string
        session.user.name = token.name as string
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
}

