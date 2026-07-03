'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, MessageCircle, Send, Trash2, CheckCircle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { MainQuestion } from '@/lib/types'

export default function MainQnaAdminPage() {
  const supabase = createClient()

  const [questions, setQuestions] = useState<MainQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('main_questions')
      .select('*')
      .order('created_at')
    setQuestions((data ?? []) as MainQuestion[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveAnswer(q: MainQuestion) {
    const text = answers[q.id]?.trim()
    if (!text) return
    setSaving(q.id)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('main_questions')
      .update({
        answer: text,
        answered_by: user?.id ?? null,
        answered_at: new Date().toISOString(),
      })
      .eq('id', q.id)
    setSaving(null)
    if (error) { toast.error('답변 저장 실패: ' + error.message); return }
    setAnswers(prev => { const next = { ...prev }; delete next[q.id]; return next })
    await load()
    toast.success('답변이 저장되었습니다.')
  }

  async function deleteQuestion(q: MainQuestion) {
    if (!confirm(`"${q.question.slice(0, 30)}..." 질문을 삭제하시겠습니까?`)) return
    const { error } = await supabase.from('main_questions').delete().eq('id', q.id)
    if (error) { toast.error('삭제 실패: ' + error.message); return }
    setQuestions(prev => prev.filter(x => x.id !== q.id))
    toast.success('질문이 삭제되었습니다.')
  }

  async function togglePublic(q: MainQuestion) {
    const { error } = await supabase
      .from('main_questions')
      .update({ is_public: !q.is_public })
      .eq('id', q.id)
    if (error) { toast.error('변경 실패: ' + error.message); return }
    setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, is_public: !x.is_public } : x))
  }

  const unanswered = questions.filter(q => !q.answer)
  const answered = questions.filter(q => !!q.answer)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/admin"
          className="p-2 glass rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" /> 메인 Q&amp;A 관리
          </h1>
          <p className="text-sm text-muted-foreground">사이트 공통 질문/답변</p>
        </div>
        <div className="ml-auto flex gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-accent" /> 미답변 {unanswered.length}
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-primary" /> 답변 완료 {answered.length}
          </span>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">불러오는 중...</p>
      ) : questions.length === 0 ? (
        <div className="glass rounded-2xl border border-white/10 p-12 text-center text-muted-foreground">
          아직 등록된 질문이 없습니다.
        </div>
      ) : (
        <>
          {/* 미답변 */}
          {unanswered.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-accent flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> 미답변 질문
              </h2>
              {unanswered.map(q => (
                <div key={q.id} className="glass rounded-xl border border-accent/20 overflow-hidden">
                  <div className="px-4 py-3 flex items-start gap-3">
                    <span className="text-primary font-bold text-sm shrink-0 mt-0.5">Q.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{q.question}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {q.author_name}
                        <span className="ml-2">{new Date(q.created_at).toLocaleDateString('ko-KR')}</span>
                      </p>
                    </div>
                    <button onClick={() => deleteQuestion(q)}
                      className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="px-4 pb-4 border-t border-white/10 bg-white/[0.02] pt-3 space-y-2">
                    <textarea
                      className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors resize-none"
                      rows={3}
                      placeholder="답변을 입력하세요..."
                      value={answers[q.id] ?? ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => saveAnswer(q)}
                        disabled={saving === q.id || !answers[q.id]?.trim()}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {saving === q.id ? '저장 중...' : '답변 저장'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* 답변 완료 */}
          {answered.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> 답변 완료
              </h2>
              {answered.map(q => (
                <div key={q.id} className="glass rounded-xl border border-white/10 overflow-hidden">
                  <div className="px-4 py-3 flex items-start gap-3">
                    <span className="text-primary font-bold text-sm shrink-0 mt-0.5">Q.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{q.question}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {q.author_name}
                        <span className="ml-2">{new Date(q.created_at).toLocaleDateString('ko-KR')}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => togglePublic(q)}
                        className={`text-sm px-2 py-1 rounded-lg transition-colors ${
                          q.is_public
                            ? 'bg-primary/15 text-primary hover:bg-primary/25'
                            : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                        }`}
                      >
                        {q.is_public ? '공개' : '비공개'}
                      </button>
                      <button onClick={() => deleteQuestion(q)}
                        className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="px-4 pb-3 pt-2 border-t border-white/10 bg-white/[0.02]">
                    <div className="flex gap-3">
                      <span className="text-accent font-bold text-sm shrink-0">A.</span>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{q.answer}</p>
                    </div>
                    {q.answered_at && (
                      <p className="text-sm text-muted-foreground/50 mt-2 ml-7">
                        {new Date(q.answered_at).toLocaleString('ko-KR')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
