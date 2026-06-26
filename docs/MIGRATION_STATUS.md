# Kompari Migration Status

最終更新: 2026-06-26

## 完了フェーズ
- [x] Phase 0: 型定義(KompariEventDoc / KompariPredictionDoc)
- [x] Phase 1: normalizeEventDocToEvent
- [x] Phase 2a: events Firestore rules
- [x] Phase 2b: admin 二重書き(races + events/predictions)
- [x] Phase 2.5: バックフィル(既存 races 14件 → events/predictions 64件)

## 現在の Source of Truth
writes:
- races(従来どおり)
- events + events/{id}/predictions(Phase 2b の二重書き + Phase 2.5 バックフィル済み)

reads:
- races(全画面まだ races 主読み。events はまだ読んでいない)

## 次のフェーズ
Phase 3: 読み取りを events に切り替える(画面1枚ずつ)
切替順序: admin → race/[slug] → ai/[slug] → ranking → home → 残り
- predictions 供給は collectionGroup(方式B、複合インデックス不要)
- 各画面切替時、events が想定どおり読めるか検証してから次へ
- rollback は容易(events読みを races読みに戻すだけ。データ生成は伴わない)

Phase 4: races 読み取りの完全廃止(LegacyRaceData / normalizeRaceToEvent 削除)

## メモ
- 本番データ大量生成を伴うフェーズは Phase 2.5 で完了。以降は読み取り差し替えのみ
- ダミーデータ(reason "なんとなく"等の初期手入力)が races/events 双方に存在。
  除去は「移行とは別タスク」として Phase 3 完了後に検討(移行にクレンジングを混ぜない)
- サービスアカウント鍵はバックフィル後に無効化済み
