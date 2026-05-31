'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Trophy, Users, LayoutDashboard, LogOut, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/admin',                  icon: LayoutDashboard, label: '대시보드',    exact: true },
  { href: '/admin/tournaments/new',  icon: Trophy,          label: '대회 등록' },
  { href: '/admin/system/users',     icon: Shield,          label: '사용자 관리' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex flex-col w-56 glass border-r border-white/10 min-h-screen p-4">
      <Link href="/" className="flex items-center gap-2 font-bold text-base mb-8 px-2">
        <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Trophy className="w-4 h-4 text-primary-foreground" />
        </span>
        Smart Pingpong
      </Link>

      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map(({ href, icon: Icon, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors w-full"
      >
        <LogOut className="w-4 h-4" />
        로그아웃
      </button>
    </aside>
  )
}
