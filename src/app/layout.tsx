import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Tele-Kapan | B2B Yönetim',
  description: 'Telefon tamircileri ve 2. el alım-satım yürüten işletmeler için yönetim paneli.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="tr" className="dark">
      <body className={inter.className}>
        {children}
        <Toaster theme="dark" position="top-right" />
      </body>
    </html>
  )
}
