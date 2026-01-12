import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OmniChat - Omni-Channel Communication',
  description: 'AI-powered assistant for employee management, recruitment, accounting, and e-invoicing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

