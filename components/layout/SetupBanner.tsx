import { AlertTriangle } from 'lucide-react'

export default function SetupBanner() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center gradient-bg p-4">
      <div className="glass rounded-2xl border border-yellow-500/30 p-8 max-w-lg w-full space-y-5">
        <div className="flex items-center gap-3 text-yellow-400">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <h1 className="text-lg font-bold">Supabase 설정이 필요합니다</h1>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          앱을 사용하려면 Supabase 프로젝트를 생성하고 환경변수를 설정해야 합니다.
        </p>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
            <div>
              <div className="font-medium">Supabase 프로젝트 생성</div>
              <div className="text-muted-foreground mt-0.5">supabase.com → New Project</div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
            <div>
              <div className="font-medium">API 키 복사</div>
              <div className="text-muted-foreground mt-0.5">Settings → API → Project URL / anon key / service_role key</div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
            <div>
              <div className="font-medium">.env.local 파일 수정</div>
              <div className="mt-1 rounded-lg bg-black/40 p-3 font-mono text-xs text-green-400 space-y-1">
                <div>NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co</div>
                <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...</div>
                <div>SUPABASE_SERVICE_ROLE_KEY=eyJ...</div>
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">4</span>
            <div>
              <div className="font-medium">DB 마이그레이션 실행</div>
              <div className="mt-1 rounded-lg bg-black/40 p-3 font-mono text-xs text-green-400">
                Supabase 대시보드 → SQL Editor →<br />
                supabase/migrations/001_initial_schema.sql 붙여넣기 → Run
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">5</span>
            <div>
              <div className="font-medium">개발 서버 재시작</div>
              <div className="mt-1 rounded-lg bg-black/40 p-3 font-mono text-xs text-green-400">npm run dev</div>
            </div>
          </li>
        </ol>
      </div>
    </div>
  )
}
