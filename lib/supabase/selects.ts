// 여러 위치(초기 서버 렌더링 + 클라이언트 realtime refetch)에서 동일하게 사용하는
// matches 조회 컬럼 목록. 화면에서 실제 쓰지 않는 컬럼(notes, table_number, scheduled_time 등)은 제외.
export const MATCH_SELECT =
  'id, group_id, round, match_number, participant1_id, participant2_id, winner_id, score1, score2, status, sets:match_sets(id, set_number, score1, score2)'
