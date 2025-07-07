"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Authenticator, useAuthenticator, ThemeProvider } from "@aws-amplify/ui-react"
import { authTheme } from "@/components/auth-theme"

export default function LoginPage() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus])
  const router = useRouter()

  useEffect(() => {
    if (authStatus === "authenticated") {
      router.push("/chat")
    }
  }, [authStatus, router])

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/login-bg.png')",
        }}
      />

      {/* Overlay for better contrast */}
      <div className="absolute inset-0 bg-white/10" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <ThemeProvider theme={authTheme}>
          <Authenticator />
        </ThemeProvider>
      </div>
    </div>
  )
}
