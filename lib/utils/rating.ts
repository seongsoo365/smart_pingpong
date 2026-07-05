export const RATING_POINTS = {
  CASUAL_WIN: 10,
  PRELIMINARY_WIN: 15,
  MAIN_EXTRA_WIN: 20,   // diff >= 4 (32강 이상)
  MAIN_R16_WIN: 30,     // diff = 3 (16강)
  MAIN_QF_WIN: 50,      // diff = 2 (8강)
  MAIN_SF_WIN: 80,      // diff = 1 (준결승)
  MAIN_FINAL_WIN: 150,  // diff = 0, 우승
  MAIN_RUNNER_UP: 100,  // diff = 0, 준우승
} as const

export interface RatingMatchContext {
  phase_type: 'preliminary' | 'main' | 'casual'
  format: string
  round: number
  total_rounds: number
  won: boolean
}

export function getMatchRatingPoints(ctx: RatingMatchContext): number {
  const { phase_type, format, round, total_rounds, won } = ctx

  if (phase_type === 'casual') return won ? RATING_POINTS.CASUAL_WIN : 0
  if (phase_type === 'preliminary') return won ? RATING_POINTS.PRELIMINARY_WIN : 0

  // main 단계
  if (format !== 'single_elimination') {
    // round_robin main 등 기타 포맷은 예선과 동일 처리
    return won ? RATING_POINTS.PRELIMINARY_WIN : 0
  }

  const diff = total_rounds - round
  if (!won) {
    // 결승 패배(준우승)만 포인트 부여
    return diff === 0 ? RATING_POINTS.MAIN_RUNNER_UP : 0
  }

  if (diff === 0) return RATING_POINTS.MAIN_FINAL_WIN
  if (diff === 1) return RATING_POINTS.MAIN_SF_WIN
  if (diff === 2) return RATING_POINTS.MAIN_QF_WIN
  if (diff === 3) return RATING_POINTS.MAIN_R16_WIN
  return RATING_POINTS.MAIN_EXTRA_WIN
}
