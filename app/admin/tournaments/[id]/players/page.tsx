'use client'
import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, ChevronLeft, Pencil, Check, X, Clock, ClipboardList, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Division, Player } from '@/lib/types'

interface ParsedRow { name: string; club: string; duplicate: boolean }

function parseBulkText(text: string, existing: Player[]): ParsedRow[] {
  const existingNames = new Set(existing.map(p => p.name.trim().toLowerCase()))
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const [rawName, rawClub = ''] = line.split(',')
      const name = rawName.trim()
      const club = rawClub.trim()
      return { name, club, duplicate: existingNames.has(name.toLowerCase()) }
    })
    .filter(row => row.name.length > 0)
}

export default function PlayersPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const defaultDivId = searchParams.get('divId') ?? ''

  const [divisions, setDivisions] = useState<Division[]>([])
  const [selectedDivId, setSelectedDivId] = useState(defaultDivId)
  const [players, setPlayers] = useState<Player[]>([])
  const [newName, setNewName] = useState('')
  const [newClub, setNewClub] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editClub, setEditClub] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const supabase = createClient()

  const parsedRows = useMemo(() => parseBulkText(bulkText, players), [bulkText, players])

  useEffect(() => {
    supabase.from('divisions').select('*').eq('tournament_id', id).order('display_order')
      .then(({ data }) => {
        setDivisions(data ?? [])
        if (!selectedDivId && data?.[0]) setSelectedDivId(data[0].id)
      })
  }, [id])

  useEffect(() => {
    if (!selectedDivId) return
    supabase.from('players').select('*').eq('division_id', selectedDivId).order('seed', { nullsFirst: false }).order('created_at')
      .then(({ data }) => setPlayers(data ?? []))
  }, [selectedDivId])

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !selectedDivId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('players')
      .insert({ division_id: selectedDivId, name: newName.trim(), club: newClub.trim() || null, confirmed: true })
      .select()
      .single()
    if (error) { toast.error('추가 실패: ' + error.message) }
    else { setPlayers(prev => [...prev, data]); setNewName(''); setNewClub('') }
    setLoading(false)
  }

  async function confirmPlayer(playerId: string) {
    const { data, error } = await supabase.from('players').update({ confirmed: true }).eq('id', playerId).select().single()
    if (error) { toast.error('승인 실패'); return }
    setPlayers(prev => prev.map(p => p.id === playerId ? data : p))
    toast.success('선수를 승인했습니다')
  }

  async function removePlayer(playerId: string) {
    const { error } = await supabase.from('players').delete().eq('id', playerId)
    if (error) toast.error('삭제 실패')
    else setPlayers(prev => prev.filter(p => p.id !== playerId))
  }

  function startEdit(p: Player) {
    setEditingId(p.id)
    setEditName(p.name)
    setEditClub(p.club ?? '')
  }

  async function savePlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId || !editName.trim()) return
    const { data, error } = await supabase
      .from('players')
      .update({ name: editName.trim(), club: editClub.trim() || null })
      .eq('id', editingId)
      .select()
      .single()
    if (error) { toast.error('수정 실패: ' + error.message); return }
    setPlayers(prev => prev.map(p => p.id === editingId ? data : p))
    setEditingId(null)
    toast.success('선수 정보가 수정되었습니다')
  }

  async function addBulk() {
    const rows = parsedRows.filter(r => !r.duplicate)
    if (rows.length === 0) { toast.error('등록할 선수가 없습니다'); return }
    setBulkLoading(true)
    const { data, error } = await supabase
      .from('players')
      .insert(rows.map(r => ({ division_id: selectedDivId, name: r.name, club: r.club || null, confirmed: true })))
      .select()
    if (error) { toast.error('일괄 등록 실패: ' + error.message) }
    else {
      setPlayers(prev => [...prev, ...(data ?? [])])
      setBulkText('')
      setShowBulk(false)
      toast.success(`${data?.length ?? 0}명을 등록했습니다`)
    }
    setBulkLoading(false)
  }

  async function updateSeed(playerId: string, seed: number) {
    await supabase.from('players').update({ seed: seed || null }).eq('id', playerId)
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, seed } : p))
  }

  const selectedDiv = divisions.find(d => d.id === selectedDivId)
  const genderLabel: Record<string, string> = { male: '남자', female: '여자', mixed: '혼합' }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/tournaments/${id}/edit`} className="p-2 glass rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold">선수 관리</h1>
      </div>

      {/* Division selector */}
      <div className="flex flex-wrap gap-2">
        {divisions.map(div => (
          <button
            key={div.id}
            onClick={() => setSelectedDivId(div.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              selectedDivId === div.id
                ? 'bg-primary text-primary-foreground'
                : 'glass border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10'
            }`}
          >
            {genderLabel[div.gender]} {div.name}
          </button>
        ))}
      </div>

      {selectedDiv && (
        <>
          <div className="glass rounded-2xl p-5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                {genderLabel[selectedDiv.gender]} {selectedDiv.name} 선수 목록
                <span className="text-muted-foreground font-normal ml-2 text-sm">({players.length}명)</span>
              </h2>
            </div>

            {players.length > 0 ? (
              <div className="space-y-2">
                {players.map((p, i) => (
                  <div key={p.id} className="rounded-xl bg-white/5 px-4 py-3">
                    {editingId === p.id ? (
                      <form onSubmit={savePlayer} className="flex items-center gap-2 flex-wrap">
                        <span className="text-muted-foreground text-sm w-5 shrink-0">{i + 1}</span>
                        <input required value={editName} onChange={e => setEditName(e.target.value)}
                          placeholder="선수명 *"
                          className="flex-1 min-w-24 glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary" />
                        <input value={editClub} onChange={e => setEditClub(e.target.value)}
                          placeholder="소속"
                          className="flex-1 min-w-24 glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary" />
                        <div className="flex gap-1.5 shrink-0">
                          <button type="submit"
                            className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => setEditingId(null)}
                            className="p-2 glass border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-sm w-5 shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{p.name}</span>
                            {!p.confirmed && (
                              <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-accent/20 text-accent">
                                <Clock className="w-2.5 h-2.5" /> 미승인
                              </span>
                            )}
                          </div>
                          {p.club && <div className="text-xs text-muted-foreground">{p.club}</div>}
                          {p.phone && <div className="text-xs text-muted-foreground">{p.phone}</div>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!p.confirmed && (
                            <button onClick={() => confirmPlayer(p.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
                              <Check className="w-3 h-3" /> 승인
                            </button>
                          )}
                          {p.confirmed && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">시드</span>
                              <input
                                type="number"
                                min={1}
                                defaultValue={p.seed ?? ''}
                                onBlur={e => updateSeed(p.id, Number(e.target.value))}
                                className="w-12 glass border border-white/10 rounded-lg px-2 py-1 text-xs text-center bg-transparent outline-none focus:border-primary"
                                placeholder="-"
                              />
                            </div>
                          )}
                          <button onClick={() => startEdit(p)}
                            className="p-1 text-muted-foreground hover:text-primary transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => removePlayer(p.id)}
                            className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">등록된 선수가 없습니다</p>
            )}
          </div>

          {/* Add form */}
          <form onSubmit={addPlayer} className="glass rounded-2xl p-5 border border-white/10 space-y-4">
            <h2 className="font-semibold">선수 추가</h2>
            <div className="flex gap-3 flex-wrap">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="선수명 *"
                required
                className="flex-1 min-w-32 glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary"
              />
              <input
                value={newClub}
                onChange={e => setNewClub(e.target.value)}
                placeholder="소속 (선택)"
                className="flex-1 min-w-32 glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 shrink-0"
              >
                <Plus className="w-4 h-4" /> 추가
              </button>
            </div>
          </form>

          {/* Bulk registration */}
          <div className="glass rounded-2xl border border-white/10 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowBulk(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
            >
              <span className="flex items-center gap-2 font-semibold text-sm">
                <ClipboardList className="w-4 h-4 text-primary" />
                일괄 등록
                <span className="text-xs text-muted-foreground font-normal">이름,소속 형식으로 여러 명 한 번에 등록</span>
              </span>
              {showBulk ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {showBulk && (
              <div className="px-5 pb-5 space-y-4 border-t border-white/10 pt-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    한 줄에 한 명씩 입력 — <code className="bg-white/10 px-1 rounded">이름,소속</code> 또는 <code className="bg-white/10 px-1 rounded">이름</code>
                  </label>
                  <textarea
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    rows={6}
                    placeholder={"홍길동,한국탁구클럽\n김철수\n이영희,서울FC\n박민준,부산탁구"}
                    className="w-full glass border border-white/10 rounded-xl px-4 py-3 text-sm bg-transparent outline-none focus:border-primary resize-y font-mono"
                  />
                </div>

                {parsedRows.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      미리보기 — 총 {parsedRows.length}명
                      {parsedRows.some(r => r.duplicate) && (
                        <span className="text-accent ml-2">
                          (중복 {parsedRows.filter(r => r.duplicate).length}명 제외)
                        </span>
                      )}
                    </p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {parsedRows.map((row, i) => (
                        <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${row.duplicate ? 'bg-accent/10 text-muted-foreground line-through' : 'bg-white/5'}`}>
                          {row.duplicate && <AlertTriangle className="w-3.5 h-3.5 text-accent shrink-0" />}
                          <span className="font-medium">{row.name}</span>
                          {row.club && <span className="text-muted-foreground">{row.club}</span>}
                          {row.duplicate && <span className="text-xs text-accent ml-auto">중복</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addBulk}
                    disabled={bulkLoading || parsedRows.filter(r => !r.duplicate).length === 0}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    {bulkLoading ? '등록 중...' : `${parsedRows.filter(r => !r.duplicate).length}명 등록`}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBulkText(''); setShowBulk(false) }}
                    className="px-4 glass border border-white/10 rounded-xl text-sm hover:bg-white/10 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
