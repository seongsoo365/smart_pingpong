'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

export default function RankingsSearchForm({ defaultValue }: { defaultValue: string }) {
  const router = useRouter()
  const [q, setQ] = useState(defaultValue)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    router.push(q ? `/rankings?q=${encodeURIComponent(q)}` : '/rankings')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        name="q"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="이름 또는 소속으로 검색"
        className="flex-1 glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors"
      />
      <button type="submit" className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
        검색
      </button>
      {defaultValue && (
        <Link href="/rankings" className="px-4 py-2.5 glass border border-white/10 rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors">
          초기화
        </Link>
      )}
    </form>
  )
}
