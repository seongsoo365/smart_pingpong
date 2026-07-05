'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Trophy, Gamepad2, Users, Medal, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/',             icon: Home,      label: '홈' },
  { href: '/tournaments',  icon: Trophy,    label: '대회' },
  { href: '/games/new',    icon: Gamepad2,  label: '게임' },
  { href: '/players',      icon: Users,     label: '전적' },
  { href: '/rankings',     icon: Medal,     label: '랭킹' },
  { href: '/admin',        icon: Settings,  label: '관리' },
]

export default function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/10 pb-safe md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('w-5 h-5', active && 'scale-110')} />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
