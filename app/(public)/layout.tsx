import Header from '@/components/layout/Header'
import MobileBottomNav from '@/components/layout/MobileBottomNav'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh">
      <Header />
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  )
}
