import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cuida Amor | Plataforma de Cursos',
  description: 'Plataforma de Cursos Cuida Amor integrada ao SoftCare ERP',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
