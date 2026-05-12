import type { Metadata, Viewport } from 'next'
import './globals.css'
import SentryInit from '@/components/SentryInit'
import SWUpdatePrompt from '@/components/SWUpdatePrompt'

export const metadata: Metadata = {
  title: 'BIM Elétrico',
  description: 'Acompanhamento de Instalações Elétricas',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BIM Elétrico',
  },
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
      </head>
      <body className="antialiased">
        <SentryInit />
        <SWUpdatePrompt />
        {children}
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => {})
              })
            }
          `
        }} />
      </body>
    </html>
  )
}
