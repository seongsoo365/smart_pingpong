'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'

export default function TournamentSearchForm({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(defaultValue ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams)
    if (q) params.set('q', q)
    else params.delete('q')
    router.push(`/tournaments?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-w-48">
      <input
        name="q"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="대회명 검색..."
        className="glass border border-white/10 rounded-xl px-4 py-2 text-sm bg-transparent outline-none focus:border-primary transition-colors w-full"
      />
    </form>
  )
}
