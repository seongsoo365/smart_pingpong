import { NextRequest, NextResponse } from 'next/server'

interface NotifyPayload {
  type: 'approved' | 'rejected'
  email: string
  name: string
  tournamentName: string
  divisionName: string
}

function buildHtml(payload: NotifyPayload): string {
  const { type, name, tournamentName, divisionName } = payload
  const isApproved = type === 'approved'
  const statusText = isApproved ? '승인' : '거절'
  const statusColor = isApproved ? '#3B82F6' : '#EF4444'
  const bodyText = isApproved
    ? '대회 관련 일정 및 공지는 추후 별도로 안내될 예정입니다.'
    : '문의사항이 있으시면 대회 운영진에게 연락해 주세요.'

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
    <div style="background:#0F172A;padding:24px 32px">
      <p style="margin:0;color:#3B82F6;font-size:13px;font-weight:600;letter-spacing:.05em">SMART PINGPONG</p>
      <h1 style="margin:8px 0 0;color:#f1f5f9;font-size:20px">참가 신청 ${statusText} 안내</h1>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 16px;color:#334155;font-size:15px">
        안녕하세요, <strong>${name}</strong> 선수님.
      </p>
      <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:20px">
        <p style="margin:0 0 6px;color:#64748b;font-size:12px">대회</p>
        <p style="margin:0;color:#0F172A;font-weight:600">${tournamentName}</p>
        <p style="margin:4px 0 0;color:#64748b;font-size:13px">${divisionName}</p>
      </div>
      <p style="margin:0 0 8px;color:#334155;font-size:15px">
        귀하의 참가 신청이
        <strong style="color:${statusColor}">${statusText}</strong>
        되었습니다.
      </p>
      <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6">${bodyText}</p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:12px">Smart Pingpong 참가 접수 알림 · 이 메일은 자동 발송되었습니다</p>
    </div>
  </div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  let body: NotifyPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { type, email, name, tournamentName, divisionName } = body
  if (!type || !email || !name || !tournamentName) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const fromEmail = process.env.NOTIFY_FROM_EMAIL ?? 'Smart Pingpong <noreply@smart-pingpong.vercel.app>'
  const subject = `[${tournamentName}] 참가 신청 ${type === 'approved' ? '승인' : '거절'} 안내`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject,
      html: buildHtml({ type, email, name, tournamentName, divisionName }),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[notify] Resend error:', err)
    return NextResponse.json({ error: 'send failed' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
