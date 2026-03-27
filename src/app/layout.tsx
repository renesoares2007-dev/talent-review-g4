import type { Metadata } from "next"
import "./globals.css"
import { NavBar } from "./navbar"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "Talent Review G4",
  description: "Avaliacao 360 com Ninebox, PDI e Feedback por IA",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 min-h-screen">
        <Providers>
          <NavBar />
          <main className="max-w-7xl mx-auto px-4 py-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
