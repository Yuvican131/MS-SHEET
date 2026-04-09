
"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/firebase"
import { initiateEmailSignIn, initiateEmailSignUp } from "@/firebase/non-blocking-login"
import { Lock, UserPlus, LogIn, ShieldCheck } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const auth = useAuth()
  const { toast } = useToast()

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please enter both email and password.",
        variant: "destructive",
      })
      return
    }

    if (isLogin) {
      initiateEmailSignIn(auth, email, password)
    } else {
      initiateEmailSignUp(auth, email, password)
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
            GridSheet Access
          </CardTitle>
          <CardDescription className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">
            {isLogin ? "Authorized Entry Only" : "Register New Admin Account"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAuth}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-zinc-950 border-zinc-800 rounded-none h-12 font-bold focus-visible:ring-primary"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-zinc-950 border-zinc-800 rounded-none h-12 font-bold focus-visible:ring-primary"
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest rounded-none">
              {isLogin ? (
                <>
                  <LogIn className="mr-2 h-4 w-4" /> Sign In
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" /> Create Account
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={() => setIsLogin(!isLogin)}
              className="text-zinc-500 hover:text-primary font-bold text-xs uppercase tracking-tight"
            >
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
            </Button>
          </CardFooter>
        </form>
      </Card>
      <div className="fixed bottom-4 text-center w-full">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">
          Protected by AES-256 Encryption & Firebase Auth
        </p>
      </div>
    </div>
  )
}
