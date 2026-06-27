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
- [x] Phase 3-3: ranking(app/ranking/page.tsx) と ai/[slug](app/ai/[slug]/page.tsx)を events読みに切り替え(collectionGroup)
  - stats.ts / lib/events.ts は無変更
  - outcome フィールドは ranking/ai の集計では使われず、prediction.main === getResultWinner(event) の動的判定で的中を計算することを確認(パターンA)
  - 本番で数値照合済み: AI別/ブランド別/モデル別/My AI/ai[slug] すべて races読み時と完全一致(予測数・的中数・的中率・順位・ヘッダー集計)
  - collectionGroup購読に eventId fallback(pred.eventId || d.ref.parent.parent?.id)を追加

## 現在の Source of Truth

writes:

- races(従来どおり)
- events + events/{id}/predictions(Phase 2b の二重書き + Phase 2.5 バックフィル済み)

reads:

- events: home / races一覧 / ranking / ai[slug] ← Phase 3-1〜3-3 で切替済み
- races: 残り(admin / race[slug] / notifications)はまだ races読み

## 次のフェーズ

Phase 3-4: admin(結果入力/編集)を events読み + 書き込み二重化

- 現状 admin/results と admin/edit は races のみ書き込み(Phase 2b は作成時のみ二重化)
- read切替 と write二重化 の両方が必要。delete時の events サブコレクション削除の扱いも論点

Phase 3-5: race/[slug] read切替 + My AI参加の書き込み移行(配列push → subcollection addDoc + 一般ユーザーのcreate権限rules)

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
- ai/[slug] カテゴリ別成績で「競馬」が2行に分裂して表示される箇所あり(表記揺れ起因の可能性)
  - events読み/races読みで同じ表示のため移行とは無関係。ダミーデータ/表記揺れ cleanup の候補として記録
