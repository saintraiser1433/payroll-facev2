"use client"

import { useEffect, useRef, useState } from "react"
// @ts-ignore - qr-scanner doesn't have TypeScript types
import QrScanner from "qr-scanner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Clock, Coffee, LogOut, LogIn, CheckCircle2, XCircle, Loader2 } from "lucide-react"

interface QRScannerProps {
  onScanSuccess?: (employeeId: string) => void
}

export function QRScanner({ onScanSuccess }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [scannedEmployeeId, setScannedEmployeeId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedAction, setSelectedAction] = useState<'IN' | 'OUT' | 'BREAK_OUT' | 'BREAK_IN' | null>(null)
  const [pendingAction, setPendingAction] = useState<'IN' | 'OUT' | 'BREAK_OUT' | 'BREAK_IN' | null>(null)
  const [isCameraStarting, setIsCameraStarting] = useState(false)
  
  const scannerRef = useRef<QrScanner | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scanAreaRef = useRef<HTMLDivElement>(null)
  const isCleaningUpRef = useRef(false)
  const pendingActionRef = useRef<'IN' | 'OUT' | 'BREAK_OUT' | 'BREAK_IN' | null>(null)
  const scannedEmployeeIdRef = useRef<string | null>(null)

  const startScanning = async () => {
    // Prevent multiple simultaneous start attempts
    if (isCameraStarting || (isScanning && scannerRef.current)) {
      console.log('Scanner already starting or running')
      return
    }

    try {
      setIsCameraStarting(true)
      setIsScanning(true)
      setMessage({ type: 'info', text: 'Initializing camera...' })
      
      // Check if camera is available
      const hasCamera = await QrScanner.hasCamera()
      if (!hasCamera) {
        throw new Error('No camera found. Please connect a camera device.')
      }

      // Get the container element
      const element = scanAreaRef.current || document.getElementById("qr-reader")
      if (!element) {
        throw new Error("QR reader element not found")
      }

      // Stop any existing scanner first (before clearing)
      if (scannerRef.current) {
        try {
          // @ts-ignore - qr-scanner API
          await scannerRef.current.stop().catch(() => {})
          // @ts-ignore - qr-scanner API
          scannerRef.current.destroy()
        } catch (err: any) {
          // Suppress removeChild errors from qr-scanner cleanup
          if (!err?.message?.includes('removeChild')) {
            console.warn('Error stopping scanner:', err)
          }
        }
        scannerRef.current = null
      }

      // Wait a bit for scanner cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 200))

      // Clear existing video reference (but don't remove manually - qr-scanner should handle it)
      if (videoRef.current) {
        try {
          const videoEl = videoRef.current
          videoEl.pause()
          videoEl.srcObject = null
        } catch (err) {
          // Ignore errors
        }
        videoRef.current = null
      }

      // Clear the element using innerHTML (simpler and safer)
      // Set a flag to suppress errors during this operation
      try {
        element.innerHTML = ''
      } catch (err: any) {
        // If innerHTML fails, try removing children
        try {
          while (element.firstChild) {
            const child: Node = element.firstChild
            if (child.parentNode === element) {
              element.removeChild(child)
            } else {
              break
            }
          }
        } catch (innerErr) {
          console.warn('Could not clear element:', innerErr)
        }
      }
      
      // Wait for DOM to settle
      await new Promise(resolve => requestAnimationFrame(resolve))
      
      // Create video element
      const video = document.createElement('video')
      video.id = 'qr-scanner-video'
      video.style.cssText = `
        width: 100% !important;
        height: auto !important;
        min-height: 300px !important;
        max-height: 600px !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        background: #000 !important;
        object-fit: contain !important;
        border-radius: 8px;
      `
      video.setAttribute('playsinline', 'true')
      video.setAttribute('autoplay', 'true')
      
      // Append video to element
      try {
        element.appendChild(video)
        videoRef.current = video
      } catch (err: any) {
        if (err?.message?.includes('removeChild')) {
          // Suppress removeChild errors
          console.warn('Suppressed appendChild error:', err)
        } else {
          throw err
        }
      }

      setMessage({ type: 'info', text: 'Requesting camera access...' })

      // Wait a bit to ensure DOM is stable
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      // Create QR scanner instance
      // @ts-ignore - qr-scanner API
      const qrScanner = new QrScanner(
        video,
        (result: any) => {
          // QR code scanned successfully
          console.log('✅ QR Code decoded successfully!', result, typeof result)
          
          // Ensure result is a string
          let employeeId: string
          if (typeof result === 'string') {
            employeeId = result
          } else if (result?.data && typeof result.data === 'string') {
            employeeId = result.data
          } else if (result?.toString) {
            employeeId = result.toString()
          } else {
            console.error('Invalid QR code result:', result)
            setMessage({ type: 'error', text: 'Invalid QR code format. Please try again.' })
            return
          }
          
          // Prevent multiple scans of the same code (use ref for latest value)
          if (scannedEmployeeIdRef.current === employeeId) {
            console.log('Same QR code scanned, ignoring duplicate')
            return
          }
          
          // Check if an action is selected first using ref (which has latest value)
          const currentAction = pendingActionRef.current
          console.log('QR scan callback - Current action from ref:', currentAction, 'Employee ID:', employeeId)
          
          if (!currentAction) {
            console.warn('No action selected when QR code scanned - showing error')
            setMessage({ 
              type: 'error', 
              text: 'Please select an action (Time In, Time Out, Break In, or Break Out) before scanning your QR code.' 
            })
            setScannedEmployeeId(null)
            scannedEmployeeIdRef.current = null
            return
          }
          
          console.log('✅ QR code scanned with action:', currentAction, 'Employee ID:', employeeId)
          
          // Handle the scanned QR code
          handleQRCodeScanned(employeeId)
        },
        {
          // Use back camera if available (environment = back camera, user = front camera)
          // 'environment' means rear-facing camera (back camera)
          preferredCamera: 'environment',
          // Scan settings
          maxScansPerSecond: 5,
          // Highlight scan region (optional)
          highlightScanRegion: false,
          highlightCodeOutline: false,
          // Return detailed scan result for better debugging
          returnDetailedScanResult: false,
        } as any
      )

      scannerRef.current = qrScanner

      // Start scanning - wrap in error handler to catch removeChild errors
      setMessage({ type: 'info', text: 'Starting camera...' })
      
      let scannerStarted = false
      try {
        // Wrap the start call to catch any synchronous errors
        const startPromise = (async () => {
          try {
            // @ts-ignore - qr-scanner API
            await qrScanner.start()
            return true
          } catch (err: any) {
            // If it's a removeChild error, check if scanner actually started
            if (err?.message?.includes('removeChild') || 
                err?.message?.includes('not a child')) {
              console.warn('Suppressed removeChild error during start:', err.message)
              // Check if video is actually working
              await new Promise(resolve => setTimeout(resolve, 300))
              if (video.readyState > 0 || video.videoWidth > 0) {
                console.log('Scanner appears to be working despite error')
                return true
              }
              // If video isn't working, it's a real error
              throw new Error('Camera failed to start. Please check permissions and try again.')
            }
            throw err
          }
        })()
        
        scannerStarted = await startPromise
      } catch (startErr: any) {
        // Final error handling
        if (startErr?.message?.includes('removeChild') || 
            startErr?.message?.includes('not a child')) {
          console.warn('Suppressed removeChild error:', startErr.message)
          // Check if video is actually playing despite the error
          await new Promise(resolve => setTimeout(resolve, 500))
          if (video.readyState > 0 || video.videoWidth > 0 || !video.paused) {
            console.log('Video is working, ignoring removeChild error')
            scannerStarted = true
          } else {
            throw new Error('Camera failed to start. Please check permissions and try again.')
          }
        } else {
          throw startErr
        }
      }
      
      if (!scannerStarted) {
        throw new Error('Scanner failed to start')
      }
      
      // Wait a bit for qr-scanner to fully initialize
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Check which camera is being used and apply appropriate transform
      try {
        const stream = video.srcObject as MediaStream
        if (stream) {
          const videoTrack = stream.getVideoTracks()[0]
          if (videoTrack) {
            const settings = videoTrack.getSettings()
            console.log('Camera settings:', {
              facingMode: settings.facingMode,
              width: settings.width,
              height: settings.height,
              deviceId: settings.deviceId
            })
            
            // Only flip if using front camera (user-facing)
            // Front cameras typically need to be mirrored for natural viewing
            // Back cameras (environment) should not be flipped
            if (settings.facingMode === 'user') {
              console.log('Front camera detected - applying horizontal flip for natural viewing')
              video.style.transform = 'scaleX(-1)'
              video.style.webkitTransform = 'scaleX(-1)'
            } else {
              // Back camera - no flip needed
              console.log('Back camera detected - no flip needed')
              video.style.transform = 'none'
              video.style.webkitTransform = 'none'
            }
          }
        }
      } catch (err) {
        console.warn('Could not check camera settings:', err)
        // Default: no flip (assuming back camera)
        video.style.transform = 'none'
        video.style.webkitTransform = 'none'
      }
      
      console.log('✅ Scanner started successfully')
      setIsCameraStarting(false)
      setIsScanning(true)
      setMessage({ type: 'success', text: 'Camera ready! Position your QR code in the scanning box.' })
      
    } catch (err: any) {
      console.error("Error starting scanner:", err)
      setIsCameraStarting(false)
      setIsScanning(false)
      
      let errorMessage = 'Failed to start camera. '
      if (err?.message?.includes('Permission') || err?.message?.includes('permission')) {
        errorMessage += 'Please allow camera access and try again.'
      } else if (err?.message?.includes('NotFound') || err?.message?.includes('not found') || err?.message?.includes('No camera')) {
        errorMessage += 'No camera found. Please connect a camera device.'
      } else if (err?.message?.includes('NotAllowedError') || err?.message?.includes('NotReadableError')) {
        errorMessage += 'Camera access denied or camera is in use by another application.'
      } else {
        errorMessage += `Please check camera permissions and try again. Error: ${err?.message || 'Unknown error'}`
      }
      setMessage({ type: 'error', text: errorMessage })
    }
  }

  const stopScanning = async () => {
    if (isCleaningUpRef.current) {
      return
    }

    isCleaningUpRef.current = true

    try {
      // Stop scanner
      if (scannerRef.current) {
        // @ts-ignore - qr-scanner API
        await scannerRef.current.stop()
        // @ts-ignore - qr-scanner API
        scannerRef.current.destroy()
        scannerRef.current = null
      }

      // Clean up video element - use safer method
      if (videoRef.current) {
        try {
          const videoEl = videoRef.current
          videoEl.pause()
          videoEl.srcObject = null
          
          // Safely remove from parent if it exists and is actually a child
          if (videoEl.parentElement && videoEl.parentElement.contains(videoEl)) {
            try {
              videoEl.parentElement.removeChild(videoEl)
            } catch (removeErr: any) {
              // If removeChild fails, try remove() method
              if (videoEl.remove) {
                videoEl.remove()
              } else {
                // Last resort: clear parent's innerHTML (but this might affect other children)
                console.warn('Could not remove video element safely')
              }
            }
          } else if (videoEl.parentElement) {
            // Not a child, just clear reference
            console.warn('Video element is not a child of its parent')
          }
        } catch (err) {
          console.warn('Error cleaning up video element:', err)
        }
        videoRef.current = null
      }

      // Clear container - use safer method
      const element = scanAreaRef.current || document.getElementById("qr-reader")
      if (element) {
        try {
          // Instead of innerHTML, remove children one by one
          while (element.firstChild) {
            try {
              if (element.firstChild.parentElement === element) {
                element.removeChild(element.firstChild)
              } else {
                element.firstChild.remove?.()
              }
            } catch (err) {
              // If removing fails, break to avoid infinite loop
              console.warn('Error removing child, using innerHTML fallback')
              element.innerHTML = ''
              break
            }
          }
        } catch (err) {
          // Fallback to innerHTML if individual removal fails
          try {
            element.innerHTML = ''
          } catch (innerErr) {
            console.warn('Could not clear element:', innerErr)
          }
        }
      }
    } catch (err) {
      console.log("Cleanup error (ignored):", err)
    } finally {
      isCleaningUpRef.current = false
      setIsScanning(false)
      setScannedEmployeeId(null)
      scannedEmployeeIdRef.current = null
      setSelectedAction(null)
      pendingActionRef.current = null // Clear ref on stop
    }
  }

  const handleQRCodeScanned = async (employeeId: any) => {
    try {
      console.log('QR Code scanned - Raw value:', employeeId, typeof employeeId)
      
      // Ensure employeeId is a string
      let employeeIdStr: string
      if (typeof employeeId === 'string') {
        employeeIdStr = employeeId
      } else if (employeeId?.data && typeof employeeId.data === 'string') {
        employeeIdStr = employeeId.data
      } else if (employeeId?.toString && typeof employeeId.toString === 'function') {
        employeeIdStr = employeeId.toString()
      } else {
        console.error('Invalid employeeId type:', employeeId, typeof employeeId)
        setMessage({ type: 'error', text: 'Invalid QR code format. Please try again.' })
        return
      }
      
      // Validate the scanned text
      if (!employeeIdStr || typeof employeeIdStr.trim !== 'function') {
        console.error('employeeId is not a valid string:', employeeIdStr)
        setMessage({ type: 'error', text: 'Invalid QR code. Please try again.' })
        return
      }

      const trimmedId = employeeIdStr.trim()
      console.log('QR Code scanned - Trimmed ID:', trimmedId)
      
      if (trimmedId === '') {
        setMessage({ type: 'error', text: 'Invalid QR code. Please try again.' })
        return
      }
      
      // Check if an action is selected - REQUIRED (use ref for latest value)
      const actionToProcess = pendingActionRef.current || pendingAction || selectedAction
      if (!actionToProcess) {
        console.error('No action found when processing QR scan')
        setMessage({ 
          type: 'error', 
          text: 'Please select an action (Time In, Time Out, Break In, or Break Out) before scanning your QR code.' 
        })
        return
      }
      
      console.log('Processing QR scan with action:', actionToProcess, 'for employee:', trimmedId)
      setScannedEmployeeId(trimmedId)
      scannedEmployeeIdRef.current = trimmedId // Update ref
      
      // Automatically process the selected action
      setMessage({ type: 'info', text: `Processing ${getActionName(actionToProcess)} for ${trimmedId}...` })
      await handleAction(actionToProcess, trimmedId)
      setPendingAction(null)
      pendingActionRef.current = null // Clear ref after processing
    } catch (error: any) {
      console.error('Error handling QR code scan:', error)
      const errorMsg = error?.message || 'Failed to process QR code. Please try again.'
      setMessage({ type: 'error', text: errorMsg })
    }
  }

  const handlePreSelectAction = (type: 'IN' | 'OUT' | 'BREAK_OUT' | 'BREAK_IN') => {
    setPendingAction(type)
    pendingActionRef.current = type // Update ref so callback can access it
    setSelectedAction(null) // Clear any previous selection
    setScannedEmployeeId(null) // Clear any previous scan
    setMessage({ type: 'info', text: `Action selected: ${getActionName(type)}. Now scan your QR code.` })
    // Automatically start scanner when action is selected
    if (!isScanning && !isCameraStarting) {
      startScanning()
    }
  }

  const getActionName = (type: 'IN' | 'OUT' | 'BREAK_OUT' | 'BREAK_IN'): string => {
    switch (type) {
      case 'IN': return 'Time In'
      case 'OUT': return 'Time Out'
      case 'BREAK_OUT': return 'Break Out'
      case 'BREAK_IN': return 'Break In'
    }
  }

  const handleAction = async (type: 'IN' | 'OUT' | 'BREAK_OUT' | 'BREAK_IN', employeeIdOverride?: string) => {
    const employeeId = employeeIdOverride || scannedEmployeeId
    if (!employeeId) {
      setMessage({ type: 'error', text: 'Please scan a QR code first' })
      return
    }

    // Prevent multiple simultaneous requests
    if (isProcessing) {
      console.log('Already processing, ignoring duplicate request')
      return
    }

    setIsProcessing(true)
    setSelectedAction(type)
    setMessage({ type: 'info', text: `Processing ${getActionName(type)}...` })

    try {
      // Create an AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const response = await fetch('/api/attendance/qr-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: employeeId,
          type,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Parse response
      const data = await response.json().catch(() => ({ 
        success: false, 
        error: 'Network error',
        message: 'Failed to parse server response'
      }))
      
      console.log('API Response:', data)

      // Check if response is ok and data indicates success
      if (!response.ok || !data.success) {
        // This is an expected error from the API (like validation errors)
        const errorMessage = data.message || data.error || `Server error: ${response.status}`
        console.warn('Attendance API error:', errorMessage)
        setMessage({ type: 'error', text: errorMessage })
        setPendingAction(null)
        pendingActionRef.current = null
        // Don't clear scannedEmployeeId on error so user can try again with different action
        return
      }

      // Success case
      setMessage({ 
        type: 'success', 
        text: data.message || `${getActionName(type)} successful for ${data.employeeName || employeeId}` 
      })
      if (onScanSuccess) {
        onScanSuccess(employeeId)
      }
      // Reset after 3 seconds
      setTimeout(() => {
        setScannedEmployeeId(null)
        scannedEmployeeIdRef.current = null
        setSelectedAction(null)
        setPendingAction(null)
        pendingActionRef.current = null
        setMessage(null)
      }, 3000)
    } catch (error: any) {
      // Handle network errors, timeouts, etc.
      console.error('Error processing attendance:', error)
      
      // Handle different error types
      if (error.name === 'AbortError') {
        setMessage({ type: 'error', text: 'Request timed out. Please try again.' })
      } else if (error.message && !error.message.includes('JSON')) {
        // Only show error message if it's not a JSON parse error
        setMessage({ type: 'error', text: error.message })
      } else {
        setMessage({ type: 'error', text: 'Failed to process attendance. Please check your connection and try again.' })
      }
      
      setPendingAction(null)
      pendingActionRef.current = null
    } finally {
      setIsProcessing(false)
      setSelectedAction(null)
    }
  }

  // Set up global error handlers to catch removeChild errors - MUST be first
  useEffect(() => {
    // More aggressive error suppression
    const originalRemoveChild = Node.prototype.removeChild
    Node.prototype.removeChild = function<T extends Node>(child: T): T {
      try {
        // Check if child is actually a child before removing
        if (this.contains && !this.contains(child)) {
          console.warn('Prevented removeChild: node is not a child')
          return child
        }
        return originalRemoveChild.call(this, child) as T
      } catch (err: any) {
        // If removeChild fails, suppress the error
        if (err?.message?.includes('not a child') || 
            err?.message?.includes('removeChild')) {
          console.warn('Suppressed removeChild error:', err.message)
          return child
        }
        throw err
      }
    }

    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.message || event.error?.message || event.error?.toString() || ''
      const errorStr = errorMessage.toLowerCase()
      if (
        errorStr.includes('removechild') ||
        errorStr.includes('not a child') ||
        errorStr.includes('failed to execute') ||
        errorStr.includes('not a child of this node')
      ) {
        console.warn('Suppressed removeChild error:', errorMessage)
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        return false
      }
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message = (reason?.message || reason?.toString() || '').toLowerCase()
      if (
        message.includes('removechild') ||
        message.includes('not a child') ||
        message.includes('failed to execute') ||
        message.includes('not a child of this node')
      ) {
        console.warn('Suppressed removeChild rejection:', reason)
        event.preventDefault()
        event.stopPropagation()
        return false
      }
    }

    window.addEventListener('error', handleError, true)
    window.addEventListener('unhandledrejection', handleUnhandledRejection as any, true)

    return () => {
      // Restore original removeChild
      Node.prototype.removeChild = originalRemoveChild
      window.removeEventListener('error', handleError, true)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection as any, true)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          // @ts-ignore - qr-scanner API
          scannerRef.current.stop()
          // @ts-ignore - qr-scanner API
          scannerRef.current.destroy()
        } catch (err) {
          // Ignore cleanup errors
        }
      }
      
      // Clean up video element
      if (videoRef.current) {
        try {
          const videoEl = videoRef.current
          videoEl.pause()
          videoEl.srcObject = null
          if (videoEl.parentElement && videoEl.parentElement.contains(videoEl)) {
            videoEl.parentElement.removeChild(videoEl)
          } else if (videoEl.remove) {
            videoEl.remove()
          }
        } catch (err) {
          // Ignore cleanup errors
        }
        videoRef.current = null
      }
    }
  }, [])

  return (
    <Card className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-2 border-cyan-200/50 dark:border-cyan-700/50 shadow-2xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-cyan-600 via-blue-600 to-orange-500 bg-clip-text text-transparent">
          QR Code Attendance
        </CardTitle>
        <CardDescription>
          Scan your QR code to clock in/out
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Message Display */}
        {message && (
          <Alert
            variant={message.type === 'error' ? 'destructive' : message.type === 'success' ? 'default' : 'default'}
            className={
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800'
                : message.type === 'error'
                ? 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800'
                : 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
            }
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : message.type === 'error' ? (
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            ) : (
              <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
            )}
            <AlertDescription className={message.type === 'success' ? 'text-green-800 dark:text-green-200' : message.type === 'error' ? 'text-red-800 dark:text-red-200' : 'text-blue-800 dark:text-blue-200'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* QR Scanner Area */}
        <div className="relative">
          <div className="relative w-full">
            <div
              id="qr-reader"
              ref={scanAreaRef}
              className={`w-full ${isScanning ? 'min-h-[300px]' : 'min-h-[200px]'} rounded-lg border-2 border-dashed border-cyan-300 dark:border-cyan-700 ${!isScanning ? 'flex items-center justify-center bg-slate-100 dark:bg-slate-800' : 'bg-[#1a1a1a]'} relative overflow-hidden`}
            >
            {!isScanning && !isCameraStarting && (
              <div className="text-center p-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-cyan-100 dark:bg-cyan-900 rounded-full flex items-center justify-center">
                  <Clock className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Click "Start Scanner" to begin
                </p>
              </div>
            )}
            {isCameraStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <div className="text-center text-white">
                  <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" />
                  <p className="text-lg font-medium">Starting camera...</p>
                  <p className="text-sm text-white/80 mt-2">Please allow camera access if prompted</p>
                </div>
              </div>
            )}
            
            {/* QR Code Scanning Box Overlay */}
            {isScanning && !isCameraStarting && (
              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <div className="relative w-64 h-64 max-w-[80%] max-h-[60%]">
                  {/* Scanning Frame */}
                  <div className="absolute inset-0 border-4 border-cyan-400 rounded-lg shadow-2xl shadow-cyan-500/50">
                    {/* Corner markers */}
                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg"></div>
                    <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg"></div>
                    <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg"></div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-cyan-400 rounded-br-lg"></div>
                  </div>
                  
                  {/* Scanning Line Animation */}
                  <div className="absolute inset-0 overflow-hidden rounded-lg">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse"></div>
                    <div 
                      className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80"
                      style={{
                        animation: 'scan 2s linear infinite',
                        top: '0%'
                      }}
                    ></div>
                  </div>
                  
                  {/* Instruction Text */}
                  <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-center">
                    {pendingAction ? (
                      <p className="text-white text-sm font-medium bg-green-600/80 px-4 py-2 rounded-lg backdrop-blur-sm shadow-lg">
                        ✓ {getActionName(pendingAction)} selected - Scan QR code
                      </p>
                    ) : (
                      <p className="text-white text-sm font-medium bg-orange-600/80 px-4 py-2 rounded-lg backdrop-blur-sm shadow-lg">
                        ⚠️ Select an action first, then scan
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Scanner Controls */}
        <div className="flex gap-2">
          {isScanning ? (
            <Button
              onClick={stopScanning}
              variant="destructive"
              className="flex-1"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Stop Scanner
            </Button>
          ) : (
            <div className="flex-1 text-center text-sm text-slate-600 dark:text-slate-400 py-2">
              Select an action below to start scanning
            </div>
          )}
        </div>

        {/* Action Buttons - Always show when scanner is available */}
        {!isProcessing && (
          <div className="space-y-2 pt-4 border-t">
            {pendingAction && (
              <p className="text-sm font-medium text-center text-cyan-600 dark:text-cyan-400 mb-2">
                ✓ Selected: <span className="font-bold">{getActionName(pendingAction)}</span> - Scan your QR code now
              </p>
            )}
            {scannedEmployeeId && pendingAction && (
              <p className="text-sm font-medium text-center text-slate-700 dark:text-slate-300 mb-2">
                Employee ID: <span className="font-mono font-bold">{scannedEmployeeId}</span>
              </p>
            )}
            {!pendingAction && (
              <p className="text-sm font-medium text-center text-orange-600 dark:text-orange-400 mb-2">
                ⚠️ Select an action below first, then scan your QR code
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handlePreSelectAction('IN')
                }}
                disabled={isProcessing}
                className={`bg-green-600 hover:bg-green-700 text-white ${pendingAction === 'IN' ? 'ring-2 ring-green-400 ring-offset-2 border-2 border-green-300' : ''} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isProcessing && selectedAction === 'IN' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" />
                )}
                Time In
              </Button>
              <Button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handlePreSelectAction('OUT')
                }}
                disabled={isProcessing}
                className={`bg-red-600 hover:bg-red-700 text-white ${pendingAction === 'OUT' ? 'ring-2 ring-red-400 ring-offset-2 border-2 border-red-300' : ''} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isProcessing && selectedAction === 'OUT' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" />
                )}
                Time Out
              </Button>
              <Button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handlePreSelectAction('BREAK_OUT')
                }}
                disabled={isProcessing}
                variant="outline"
                className={`border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950 ${pendingAction === 'BREAK_OUT' ? 'ring-2 ring-orange-400 ring-offset-2 border-2' : ''} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isProcessing && selectedAction === 'BREAK_OUT' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Coffee className="mr-2 h-4 w-4" />
                )}
                Break Out
              </Button>
              <Button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handlePreSelectAction('BREAK_IN')
                }}
                disabled={isProcessing}
                variant="outline"
                className={`border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 ${pendingAction === 'BREAK_IN' ? 'ring-2 ring-blue-400 ring-offset-2 border-2' : ''} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isProcessing && selectedAction === 'BREAK_IN' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Coffee className="mr-2 h-4 w-4" />
                )}
                Break In
              </Button>
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center gap-2 text-cyan-600 dark:text-cyan-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Processing...</span>
          </div>
        )}
      </CardContent>
      
      <style jsx>{`
        @keyframes scan {
          0% {
            top: 0%;
            opacity: 0.8;
          }
          50% {
            opacity: 0.4;
          }
          100% {
            top: 100%;
            opacity: 0.8;
          }
        }
      `}</style>
    </Card>
  )
}
