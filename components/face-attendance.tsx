"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

type AttendanceType = "IN" | "OUT" | "BREAK_OUT" | "BREAK_IN"
type FaceApiLike = typeof import("face-api.js")
type LabeledFaceDescriptor = import("face-api.js").LabeledFaceDescriptors

export function FaceRecognitionAttendance() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const faceApiRef = useRef<FaceApiLike | null>(null)
  const matcherRef = useRef<import("face-api.js").FaceMatcher | null>(null)
  const labelMapRef = useRef<Map<string, { employeeId: string; name: string }>>(new Map())
  const rafRef = useRef<number | null>(null)
  const consecutiveFaceFramesRef = useRef(0)
  const cooldownUntilRef = useRef<number>(0)
  const modelReadyRef = useRef(false)

  const [isCameraStarting, setIsCameraStarting] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [selectedAction, setSelectedAction] = useState<AttendanceType | null>(null)
  const [recognized, setRecognized] = useState<{ employeeId: string; name: string } | null>(null)
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null)

  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)
  const [autoDetectSupported, setAutoDetectSupported] = useState(false)

  useEffect(() => {
    let cancelled = false

    const start = async () => {
      try {
        setIsCameraStarting(true)
        const hasCamera = !!navigator.mediaDevices?.getUserMedia
        if (!hasCamera) {
          throw new Error("No camera found. Please connect a camera device.")
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        // Load face-api.js models and enrolled face descriptors.
        try {
          const faceapi = (await import("face-api.js")) as FaceApiLike
          faceApiRef.current = faceapi
          // Load local model files from public/models/face-api
          const modelUrl = "/models/face-api"
          await faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl)
          await faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl)
          await faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl)

          const enrolledRes = await fetch("/api/attendance/enrolled-faces", {
            method: "GET",
            headers: { Accept: "application/json" },
            cache: "no-store",
          })
          const contentType = enrolledRes.headers.get("content-type") || ""
          const raw = await enrolledRes.text()
          if (!enrolledRes.ok) {
            throw new Error(`Failed to load enrolled faces (HTTP ${enrolledRes.status}).`)
          }
          if (!contentType.includes("application/json")) {
            throw new Error("Enrolled-faces endpoint returned non-JSON response.")
          }
          let enrolledData: any
          try {
            enrolledData = JSON.parse(raw)
          } catch {
            throw new Error("Invalid JSON from enrolled-faces endpoint.")
          }
          const enrolled = (enrolledData?.enrolled || []) as Array<{
            employeeId: string
            firstName: string
            lastName: string
            faces: Array<{ slot: number; imagePath: string }>
          }>

          const labeled: LabeledFaceDescriptor[] = []
          const map = new Map<string, { employeeId: string; name: string }>()

          for (const employee of enrolled) {
            const descriptors: Float32Array[] = []
            const label = employee.employeeId
            map.set(label, { employeeId: employee.employeeId, name: `${employee.firstName} ${employee.lastName}` })
            for (const f of employee.faces) {
              try {
                const img = await faceapi.fetchImage(f.imagePath)
                const detected = await faceapi
                  .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
                  .withFaceLandmarks()
                  .withFaceDescriptor()
                if (detected?.descriptor) descriptors.push(detected.descriptor)
              } catch {
                // skip invalid sample image
              }
            }
            if (descriptors.length > 0) {
              labeled.push(new faceapi.LabeledFaceDescriptors(label, descriptors))
            }
          }

          if (enrolled.length === 0) {
            throw new Error("No employees with uploaded face samples found.")
          }

          if (labeled.length === 0) {
            throw new Error("Face samples found, but no valid descriptors could be generated.")
          }

          matcherRef.current = new faceapi.FaceMatcher(labeled, 0.55)
          labelMapRef.current = map
          modelReadyRef.current = true
          setAutoDetectSupported(true)
        } catch (err) {
          faceApiRef.current = null
          modelReadyRef.current = false
          setAutoDetectSupported(false)
          setMessage({
            type: "error",
            text:
              err instanceof Error
                ? `Auto face detection unavailable: ${err.message}`
                : "Auto face detection unavailable.",
          })
        }
      } catch (err) {
        console.error("Camera start error:", err)
        setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to start camera" })
      } finally {
        setIsCameraStarting(false)
      }
    }

    start()
    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [])

  const captureAndSubmit = async (employeeId: string, employeeName: string) => {
    if (!videoRef.current || !canvasRef.current) return
    if (!selectedAction) return

    setIsDetecting(true)
    setIsSubmitting(true)
    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const width = video.videoWidth || 640
      const height = video.videoHeight || 480
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas context not available")
      ctx.drawImage(video, 0, 0, width, height)
      const dataUrl = canvas.toDataURL("image/png")
      setCapturedPreview(dataUrl)
      setRecognized({ employeeId, name: employeeName })

      const res = await fetch("/api/attendance/qr-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, type: selectedAction, faceDataUrl: dataUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: "error", text: data?.message || data?.error || "Attendance failed" })
        return
      }

      setMessage({ type: "success", text: `${employeeName} (${employeeId}) - ${data?.message || "Attendance submitted successfully"}` })
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to submit attendance" })
    } finally {
      setIsSubmitting(false)
      setIsDetecting(false)
    }
  }

  useEffect(() => {
    if (!autoDetectSupported) return
    if (!faceApiRef.current || !modelReadyRef.current || !matcherRef.current) return

    const loop = async () => {
      rafRef.current = requestAnimationFrame(loop)

      const faceapi = faceApiRef.current
      const video = videoRef.current
      const matcher = matcherRef.current
      if (!faceapi || !video || !matcher) return
      if (!selectedAction) return
      if (isSubmitting || isDetecting) return

      const now = Date.now()
      if (now < cooldownUntilRef.current) return
      if (video.readyState < 2) return

      try {
        const face = await faceapi
          .detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
        )
          .withFaceLandmarks()
          .withFaceDescriptor()
        if (face) {
          consecutiveFaceFramesRef.current += 1
        } else {
          consecutiveFaceFramesRef.current = 0
          setRecognized(null)
        }

        // Require stable face for a few frames then auto-submit.
        if (consecutiveFaceFramesRef.current >= 8) {
          if (!face?.descriptor) return
          const best = matcher.findBestMatch(face.descriptor)
          if (best.label === "unknown") {
            setMessage({ type: "error", text: "Face not recognized. Please register face samples." })
            cooldownUntilRef.current = now + 4000
            return
          }
          const meta = labelMapRef.current.get(best.label)
          if (!meta) return

          consecutiveFaceFramesRef.current = 0
          cooldownUntilRef.current = now + 8000
          setMessage({ type: "info", text: `Face detected: ${meta.name} (${meta.employeeId}). Submitting attendance...` })
          await captureAndSubmit(meta.employeeId, meta.name)
        }
      } catch {
        faceApiRef.current = null
        modelReadyRef.current = false
        setAutoDetectSupported(false)
      }
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [autoDetectSupported, selectedAction, isSubmitting, isDetecting])

  return (
    <Card className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-2 border-cyan-200/50 dark:border-cyan-700/50 shadow-2xl">
      <CardHeader>
        <CardTitle className="text-cyan-900 dark:text-cyan-50">Face Recognition Attendance</CardTitle>
        <CardDescription className="text-muted-foreground">
          {autoDetectSupported
            ? `Select action, then face is auto-detected and attendance is auto-submitted.`
            : `Auto face recognition unavailable on this browser/device.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {message && (
            <Alert variant={message.type === "error" ? "destructive" : "default"}>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-900 dark:text-slate-100">Action</label>
              <div className="flex flex-wrap gap-2">
                {(["IN", "OUT", "BREAK_IN", "BREAK_OUT"] as AttendanceType[]).map(type => (
                  <Button
                    key={type}
                    type="button"
                    variant={selectedAction === type ? "default" : "outline"}
                    onClick={() => setSelectedAction(type)}
                  >
                    {type === "IN" ? "Time In" : type === "OUT" ? "Time Out" : type === "BREAK_IN" ? "Break In" : "Break Out"}
                  </Button>
                ))}
              </div>
            </div>

            {recognized && (
              <div className="rounded-md border border-border bg-background px-3 py-2">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Recognized Employee</p>
                <p className="text-sm text-muted-foreground">{recognized.employeeId} - {recognized.name}</p>
              </div>
            )}

            <div className="relative">
              <video
                ref={videoRef}
                className="w-full rounded-md border border-border bg-black"
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />
              {isCameraStarting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-md">
                  <div className="flex items-center gap-2 text-white">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Starting camera...</span>
                  </div>
                </div>
              )}
            </div>

            {capturedPreview && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Captured Preview</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={capturedPreview} alt="Captured face preview" className="w-full rounded-md border border-border" />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

