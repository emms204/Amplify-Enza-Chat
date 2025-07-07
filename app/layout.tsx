import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AmplifyProvider } from "../main"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Enza - Document Q&A Assistant",
  description: "Secure team workspace for document analysis and AI assistance",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <AmplifyProvider>{children}</AmplifyProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
