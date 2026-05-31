'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/',            label: '홈' },
  { href: '/tournaments', label: '대회 목록' },
  { href: '/results',     label: '결과 이력' },
]

export default function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 glass border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Trophy className="w-4 h-4 text-primary-foreground" />
          </span>
          <span className="hidden sm:block">Smart Pingpong</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname === href || (href !== '/' && pathname.startsWith(href))
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <Link
          href="/admin"
          className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg glass text-sm font-medium hover:bg-white/10 transition-colors"
        >
          관리자
        </Link>
      </div>
    </header>
  )
}
