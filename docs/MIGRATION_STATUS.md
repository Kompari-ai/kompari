# Kompari Migration Status

最終更新: 2026-06-27

## 完了フェーズ

- [x] Phase 0: 型定義(KompariEventDoc / KompariPredictionDoc)
- [x] Phase 1: normalizeEventDocToEvent 実装
- [x] Phase 2a: events Firestore rules
- [x] Phase 2b: admin 作成時の二重書き(races / events / events/{id}/predictions)
- [x] Phase 2.5: バックフィル(既存 races 14件 → events/predictions 64件)
- [x] Phase 3-1: home(app/page.tsx)を events読みに切り替え(collectionGroup)
  - Firestore rules に collectionGroup("predictions") read を追加(a707fb2)
  - 本番で home の AIカード / split meter / consensus / prediction 表示を確認済み
- [x] Phase 3-2: races一覧(app/races/page.tsx)を events読みに切り替え(collectionGroup)
  - フィルタ/検索(カテゴリ/キーワード/ステータス)が events読みで動作することを本番確認済み

## 現在の Source of Truth

writes:

- races(従来どおり)
- events + events/{id}/predictions(Phase 2b の二重書き + Phase 2.5 バックフィル済み)

reads:

- events: home(app/page.tsx) + races一覧(app/races/page.tsx) ← Phase 3-1 / Phase 3-2 で切替済み
- races: 残りの画面(ranking / ai / admin / race[slug] / notifications等)はまだ races読み

## 次のフェーズ

Phase 3-3: ranking(app/ranking/page.tsx) と ai/[slug](app/ai/[slug]/page.tsx)を events読みに切り替え

- 同じ「2本購読 + useMemo合成 + nullローディング」パターンを使う
- 【注意】ranking/ai は統計集計(的中率/AI別成績)が絡む「赤信号」画面
- stats.ts が KompariEvent[] に対して動くので集計ロジック自体は無変更のはず
- ただし切替後に集計結果(的中率の数値)が races読み時と一致するか本番で慎重に検証する
- 残り順序: ranking/ai → admin(read/write同時、書き込み二重化が必要) → race[slug](My AI書き込み)

Phase 4: races 読み取りの完全廃止(LegacyRaceData / normalizeRaceToEvent 削除)

## メモ

- 本番データ大量生成を伴うフェーズは Phase 2.5 で完了。以降は読み取り切替が中心
- ダミーデータ(reason "なんとなく"等の初期手入力)が races/events 双方に存在
  - 除去は「移行とは別タスク」として Phase 3 完了後に検討する
- サービスアカウント鍵はバックフィル後に無効化済み
- collectionGroup の読み取り rules は Phase 3-1 で追加済み
  - 本番 Console とリポジトリ(firestore.rules)を一致させて運用
  - Firebase CLI は未導入のため Console paste で反映
- 読み取り切替パターンを home(3-1)・races一覧(3-2)で確立
  - フィルタ/検索も events読みで動作確認済み
  - lib/hooks/useEvents への切り出しは Phase 3-3 以降で検討する
