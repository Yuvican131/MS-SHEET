
"use client"

import React, { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/firebase"
import { initiatePhoneSignIn } from "@/firebase/non-blocking-login"
import { ShieldCheck, Phone, MessageSquare, ArrowRight, Loader2, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { RecaptchaVerifier, ConfirmationResult } from "firebase/auth"

export function AuthScreen() {
  const [phoneNumber, setPhoneNumber] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [step, setStep] = useState<"phone" | "otp">("phone")
  const [isLoading, setIsLoading] = useState(false)
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  
  const auth = useAuth()
  const { toast } = useToast()
  const recaptchaContainerRef = useRef<HTMLDivElement>(null)
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null)

  useEffect(() => {
    if (recaptchaContainerRef.current && !recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        size: "invisible",
        callback: () => {
          // reCAPTCHA solved
        }
      })
    }
  }, [auth])

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        title: "Invalid Number",
        description: "Please enter a valid phone number with country code (e.g., +919876543210).",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      if (!recaptchaVerifierRef.current) throw new Error("Recaptcha not initialized")
      
      const result = await initiatePhoneSignIn(auth, phoneNumber, recaptchaVerifierRef.current)
      setConfirmationResult(result)
      setStep("otp")
      toast({
        title: "OTP Sent",
        description: "Please check your mobile for the verification code.",
      })
    } catch (error: any) {
      console.error("Phone Auth Error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to send OTP. Ensure the number is correct.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpCode || otpCode.length < 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter the 6-digit OTP code.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      if (!confirmationResult) throw new Error("No pending verification found.")
      await confirmationResult.confirm(otpCode)
      // On success, the onAuthStateChanged listener in FirebaseProvider will pick it up
    } catch (error: any) {
      console.error("OTP Verification Error:", error)
      toast({
        title: "Verification Failed",
        description: "The code you entered is incorrect or expired.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setStep("phone")
    setOtpCode("")
    setConfirmationResult(null)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div id="recaptcha-container" ref={recaptchaContainerRef}></div>
      
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900 shadow-2xl rounded-none">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
              <ShieldCheck className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-black uppercase tracking-tighter text-white">
            GridSheet Access
          </CardTitle>
          <CardDescription className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">
            {step === "phone" ? "Enter Mobile Number" : "Verify OTP Code"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === "phone" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 9876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 rounded-none h-12 pl-10 font-bold focus-visible:ring-primary"
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-12 font-black uppercase tracking-widest rounded-none">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Send OTP <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="otp" className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Verification Code</Label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    className="bg-zinc-950 border-zinc-800 rounded-none h-12 pl-10 font-bold tracking-[0.5em] text-center focus-visible:ring-primary"
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-12 font-black uppercase tracking-widest rounded-none">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify & Sign In"}
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={handleReset}
                className="w-full text-zinc-500 hover:text-primary font-bold text-xs uppercase tracking-tight"
              >
                <RotateCw className="mr-2 h-3 w-3" /> Change Phone Number
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex flex-col text-center">
          <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
            {step === "phone" ? "Standard carrier rates may apply for SMS" : `Verifying ${phoneNumber}`}
          </p>
        </CardFooter>
      </Card>
      
      <div className="fixed bottom-4 text-center w-full">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">
          Protected by AES-256 Encryption & Firebase Phone Auth
        </p>
      </div>
    </div>
  )
}
