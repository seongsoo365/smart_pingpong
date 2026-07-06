import { NextRequest, NextResponse } from 'next/server'
import { createClientSafe } from '@/lib/supabase/server'

interface DiscordNotifyPayload {
  source: 'main' | 'tournament'
  tournamentId?: string
  authorName: string
  question: string
  pageUrl?: string
}

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  let body: DiscordNotifyPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { source, tournamentId, authorName, question, pageUrl } = body
  if (!source || !authorName?.trim() || !question?.trim()) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  let scopeText = '메인 Q&A'
  if (source === 'tournament') {
    scopeText = '대회 Q&A'
    if (tournamentId) {
      const supabase = await createClientSafe()
      if (supabase) {
        const { data: tournament } = await supabase
          .from('tournaments').select('name').eq('id', tournamentId).single()
        if (tournament?.name) scopeText = `대회 Q&A · ${tournament.name}`
      }
    }
  }

  const embed = {
    title: '📩 새 Q&A 질문',
    color: 0x3B82F6,
    fields: [
      { name: '구분', value: scopeText, inline: true },
      { name: '작성자', value: authorName, inline: true },
      { name: '질문', value: question.slice(0, 1000) },
    ],
    ...(pageUrl ? { url: pageUrl } : {}),
    timestamp: new Date().toISOString(),
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })
    if (!res.ok) {
      console.error('[notify/discord] webhook error:', await res.text())
    }
  } catch (e) {
    console.error('[notify/discord] request failed:', e)
  }

  return NextResponse.json({ ok: true })
}
