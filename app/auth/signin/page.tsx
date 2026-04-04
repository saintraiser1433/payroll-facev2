"use client"

import type React from "react"

import { useState, useEffect, lazy, Suspense } from "react"
import { signIn, getSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Lock, Mail, Clock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ThemeToggle } from "@/components/theme-toggle"

// Lazy load face recognition attendance (replaces QR scanner UI)
const FaceRecognitionAttendance = lazy(() =>
  import("@/components/face-attendance").then(module => ({ default: module.FaceRecognitionAttendance }))
)

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [imageError, setImageError] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const router = useRouter()

  // Update time every second (optimized)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid email or password")
      } else {
        // Get session to check user role
        const session = await getSession()
        if (session?.user?.role === "ADMIN") {
          router.push("/")
        } else if (session?.user?.role === "DEPARTMENT_HEAD") {
          router.push("/department-head-dashboard")
        } else {
          router.push("/employee-dashboard")
        }
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 z-0">
        {!imageError ? (
          <img 
            src="/trop.jpg" 
            alt="Beach background" 
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-cyan-400 via-blue-500 to-orange-400" />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 via-blue-500/20 to-orange-400/30 backdrop-blur-[2px]" />
      </div>

      <div className="absolute top-0 left-0 w-full h-32 z-10 opacity-20">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,0 C150,100 350,0 600,50 C850,100 1050,0 1200,50 L1200,0 L0,0 Z" fill="white" />
        </svg>
      </div>

      <div className="absolute top-4 right-4 z-30 flex items-center gap-4">
        {/* Live Clock */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-lg px-4 py-2 border border-cyan-200/50 dark:border-cyan-700/50 shadow-lg">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <div className="text-right">
              <div className="text-lg font-bold text-cyan-700 dark:text-cyan-300 font-mono">
                {currentTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true
                })}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {currentTime.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
            </div>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="w-full max-w-6xl relative z-20 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Login Form */}
        <Card className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-2 border-cyan-200/50 dark:border-cyan-700/50 shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="relative mx-auto flex justify-center px-4">
            <div className="relative rounded-xl bg-white dark:bg-slate-950 px-6 py-3 shadow-lg border border-cyan-200/50 dark:border-cyan-800/50">
              <img
                src="/GWB.png"
                alt="Glan Whitesand Beach Resort"
                className="h-14 sm:h-16 w-auto max-w-[min(280px,85vw)] object-contain mx-auto"
                onError={(e) => {
                  console.error("Logo image failed to load:", e)
                }}
              />
            </div>
          </div>

          <div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-cyan-600 via-blue-600 to-orange-500 bg-clip-text text-transparent">
              Glan White Sand Beach Resort
            </CardTitle>
            <CardDescription className="text-base mt-2 text-slate-600 dark:text-slate-300">
              Web-based Payroll Management System for Glan White Sand Beach Resort
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 dark:text-slate-200 font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-600 dark:text-cyan-400 w-5 h-5" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@beachresort.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 h-12 border-2 border-cyan-200 dark:border-cyan-800 focus:border-cyan-500 dark:focus:border-cyan-500 bg-white dark:bg-slate-800 transition-colors"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 dark:text-slate-200 font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-600 dark:text-cyan-400 w-5 h-5" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 pr-12 h-12 border-2 border-cyan-200 dark:border-cyan-800 focus:border-cyan-500 dark:focus:border-cyan-500 bg-white dark:bg-slate-800 transition-colors"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 w-10 h-10 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-cyan-500 via-blue-500 to-orange-400 hover:from-cyan-600 hover:via-blue-600 hover:to-orange-500 text-white font-semibold text-base shadow-lg hover:shadow-xl transition-all duration-300 border-0"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In to Paradise"
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 rounded-lg border-2 border-cyan-200/50 dark:border-cyan-800/50">
            <h3 className="font-semibold text-sm mb-3 text-cyan-900 dark:text-cyan-100 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Demo Accounts:
            </h3>
            <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">Admin:</span>
                <span>admin@pyrol.com / admin123</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-orange-600 dark:text-orange-400">Department Head:</span>
                <span>depthead@pyrol.com / dept123</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-orange-600 dark:text-orange-400">Employee:</span>
                <span>employee@pyrol.com / emp123</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

        {/* Face Recognition Attendance - Lazy loaded */}
        <Suspense fallback={
          <Card className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-2 border-cyan-200/50 dark:border-cyan-700/50 shadow-2xl">
            <CardContent className="flex items-center justify-center min-h-[400px]">
              <div className="text-center text-slate-500 dark:text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p>Loading Face Recognition...</p>
              </div>
            </CardContent>
          </Card>
        }>
          <FaceRecognitionAttendance />
        </Suspense>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-32 z-10 opacity-20">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,50 C150,100 350,0 600,50 C850,100 1050,0 1200,50 L1200,120 L0,120 Z" fill="white" />
        </svg>
      </div>
    </div>
  )
}
