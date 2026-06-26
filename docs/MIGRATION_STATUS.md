# Kompari Migration Status

最終更新: 2026-06-27

## 完了フェーズ
- [x] Phase 0: 型定義(KompariEventDoc / KompariPredictionDoc)
- [x] Phase 1: normalizeEventDocToEvent
- [x] Phase 2a: events Firestore rules
- [x] Phase 2b: admin 二重書き(races + events/predictions)
- [x] Phase 2.5: バックフィル(既存 races 14件 → events/predictions 64件)
- [x] Phase 3-1: home(app/page.tsx)を events読みに切り替え(collectionGroup)
  + Firestore rules に collectionGroup("predictions") read を追加(a707fb2)

## 現在の Source of Truth
writes:
- races(従来どおり)
- events + events/{id}/predictions(Phase 2b の二重書き + Phase 2.5 バックフィル済み)

reads:
- events: home(app/page.tsx) ← Phase 3-1 で切替済み
- races: home以外の全画面(races一覧/ranking/ai/admin/race[slug]等)はまだ races読み

## 次のフェーズ
Phase 3-2: races一覧(app/races/page.tsx)を events読みに切り替え
- home で確立した「2本購読(events + collectionGroup predictions)+ useMemo合成 +
  null ローディング」パターンを使い回す
- 残りの読み取り切替順序: races一覧 → ranking/ai → admin(read/write同時) → race[slug](My AI書き込み)

Phase 4: races 読み取りの完全廃止(LegacyRaceData / normalizeRaceToEvent 削除)

## メモ
- 本番データ大量生成を伴うフェーズは Phase 2.5 で完了。以降は読み取り差し替えのみ
- ダミーデータ(reason "なんとなく"等の初期手入力)が races/events 双方に存在。
  除去は「移行とは別タスク」として Phase 3 完了後に検討(移行にクレンジングを混ぜない)
- サービスアカウント鍵はバックフィル後に無効化済み
- collectionGroup の読み取りパターンを home(Phase 3-1)で確立。本番で予測カード表示を確認済み。
  将来 lib/hooks/useEvents に切り出して全画面で再利用する候補
- rules は本番Console とリポジトリ(firestore.rules)を一致させて運用(CLI未導入、Console paste)
