"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/firebase"
import { initiateAnonymousSignIn } from "@/firebase/non-blocking-login"
import { ShieldCheck, Lock, ArrowRight, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function AuthScreen() {
  const [passcode, setPasscode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const auth = useAuth()
  const { toast } = useToast()

  // You can change this hardcoded passcode to whatever you want
  const MASTER_PASSCODE = "1234"

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (passcode !== MASTER_PASSCODE) {
      toast({
        title: "Access Denied",
        description: "The passcode you entered is incorrect.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      // Use Anonymous sign-in to satisfy Firebase rules and provide protection
      await initiateAnonymousSignIn(auth)
      toast({
        title: "Access Granted",
        description: "Welcome back to GridSheet Manager.",
      })
    } catch (error: any) {
      console.error("Auth Error:", error)
      toast({
        title: "Security Error",
        description: "Could not initialize secure session. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900 shadow-2xl rounded-none">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
              <ShieldCheck className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-black uppercase tracking-tighter text-white">
            Security Gate
          </CardTitle>
          <CardDescription className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">
            Authorized Personnel Only
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="passcode" className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Access Key</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  id="passcode"
                  type="password"
                  placeholder="Enter Passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 rounded-none h-12 pl-10 font-bold text-center tracking-[0.5em] focus-visible:ring-primary"
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full h-12 font-black uppercase tracking-widest rounded-none">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Enter Terminal <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col text-center">
          <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
            End-to-End Encryption Enabled
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}