'use client'
import { useState } from 'react'
import { MessageCircle, ChevronDown, ChevronUp, Send, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { TournamentQuestion } from '@/lib/types'

interface Props {
  tournamentId: string
  initialQuestions: TournamentQuestion[]
  hideTitle?: boolean
}

export default function QnaSection({ tournamentId, initialQuestions, hideTitle = false }: Props) {
  const supabase = createClient()
  const [questions, setQuestions] = useState(initialQuestions)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', question: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.question.trim()) return
    setSubmitting(true)
    const { data, error } = await supabase.from('tournament_questions').insert({
      tournament_id: tournamentId,
      author_name: form.name.trim(),
      question: form.question.trim(),
    }).select().single()
    setSubmitting(false)
    if (error) { toast.error('질문 등록 실패: ' + error.message); return }
    if (data) setQuestions(prev => [...prev, data])
    setForm({ name: '', question: '' })
    setSubmitted(true)
    toast.success('질문이 등록되었습니다. 관리자 답변 후 답변이 표시됩니다.')

    fetch('/api/notify/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'tournament',
        tournamentId,
        authorName: form.name.trim(),
        question: form.question.trim(),
        pageUrl: window.location.href,
      }),
    }).catch(() => {})
  }

  return (
    <section className="space-y-5">
      {!hideTitle && (
        <h2 className="text-lg font-bold flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" /> Q&amp;A
        </h2>
      )}

      {/* 질문 목록 */}
      {questions.length > 0 ? (
        <div className="space-y-2">
          {questions.map(q => (
            <div key={q.id} className="glass rounded-xl border border-white/10 overflow-hidden">
              {q.answer ? (
                <button
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                  onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                >
                  <span className="text-primary font-bold text-sm shrink-0 mt-0.5">Q.</span>
                  <span className="flex-1 text-sm">{q.question}</span>
                  {expanded === q.id
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                </button>
              ) : (
                <div className="w-full flex items-start gap-3 px-4 py-3">
                  <span className="text-primary font-bold text-sm shrink-0 mt-0.5">Q.</span>
                  <span className="flex-1 text-sm">{q.question}</span>
                  <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-accent/20 text-accent shrink-0 mt-0.5">
                    <Clock className="w-2.5 h-2.5" /> 답변 대기
                  </span>
                </div>
              )}
              {expanded === q.id && q.answer && (
                <div className="px-4 pb-4 pt-2 border-t border-white/10 bg-white/[0.02]">
                  <div className="flex gap-3">
                    <span className="text-accent font-bold text-sm shrink-0">A.</span>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{q.answer}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">아직 등록된 질문이 없습니다.</p>
      )}

      {/* Submit form */}
      <div className="glass rounded-xl border border-white/10 p-5">
        <p className="text-sm font-medium mb-4">질문하기</p>
        {submitted ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-muted-foreground">질문이 등록되었습니다.</p>
            <p className="text-xs text-muted-foreground/70">관리자 검토 후 답변이 공개됩니다.</p>
            <button
              onClick={() => setSubmitted(false)}
              className="text-xs text-primary hover:underline mt-1"
            >
              추가 질문하기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              className="glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors w-full"
              placeholder="이름 *"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
            <textarea
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors resize-none"
              rows={3}
              placeholder="질문 내용을 입력해주세요 *"
              value={form.question}
              onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
              required
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? '등록 중...' : '질문 등록'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
