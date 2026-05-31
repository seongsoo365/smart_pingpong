import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import SetupBanner from '@/components/layout/SetupBanner'
import { supabaseConfigured } from '@/lib/supabase/server'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Smart Pingpong — 탁구 대회 관리',
  description: '탁구 대회 생성, 대진표 관리, 결과 조회 플랫폼',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="gradient-bg min-h-dvh">
        {supabaseConfigured ? children : <SetupBanner />}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
