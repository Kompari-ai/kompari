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
- [x] Phase 3-4a: admin結果入力(app/admin/results/page.tsx)を events読みに切替 + 結果の二重書き
  - read: races読み → events + collectionGroup(predictions)読み(確立パターン)
  - write: saveResult を writeBatch で races + events を atomic更新
    (races: resultWinner + result / events: result + updatedAt。events側 top-level resultWinner は持たない)
  - 【重要】Phase 2b の作成時二重化はベストエフォートだったが、admin/results 自体が events読みに
    なるため atomic(writeBatch)にした(races成功・events失敗の不整合=「保存したのに反映されない」を防止)
  - events/{id}/predictions の outcome は更新しない(app全体で .outcome を読む箇所がゼロ、動的判定のため)
  - 本番検証済み: ベルギーVSエジプトに結果「引き分け」を入力
    - Firestore Console で races/events 両方に同じ result.winner が書かれたことを確認(races側は resultWinner も更新)
    - admin/results が events読みのまま「入力済み」に変わることを本番画面で確認
    - ranking 集計に反映されることを本番画面で確認
- [x] Phase 3-4b-1: admin編集(app/admin/edit/[id]/page.tsx)の saveEvent を races + events 二重書き
  - saveEvent を writeBatch で races + events を atomic更新(メタ情報: category/title/venue/startsAt/candidates + result。events側 updatedAt 付与、top-level resultWinner は持たない)
  - 【重要】read はまだ races のまま維持。generatePrediction がまだ races のみ書き込みのため、
    read を events に切り替えると再生成結果が events に反映されず不整合になる。
    read切替は generatePrediction 二重化(3-4b-2)と同時に行う
  - generatePrediction / deleteEvent は今回未変更(races のまま)
  - 本番検証済み: ベルギーVSエジプトの title を編集 → races/events 両方に反映、events側 updatedAt 更新を Firestore Console で確認。既存の result.winner も保持

## 現在の Source of Truth

writes:

- races: 全書き込み(作成 / 結果入力 / 編集メタ / AI予測再生成 / 削除)
- events: 二重化済み = 作成(2b) + 結果入力(3-4a) + 編集メタ(3-4b-1)
  - 未対応: generatePrediction(AI予測再生成) / deleteEvent(削除)はまだ races のみ

reads:

- events: home / races一覧 / ranking / ai[slug] / admin結果入力
- races: admin編集(3-4b-2で切替予定) / race[slug] / notifications

## 次のフェーズ

Phase 3-4b-2: admin編集の read切替 + generatePrediction の events二重化(同時実装)

- read: doc(db,"events",id) + collection(db,"events",id,"predictions") の単一doc+サブコレクション直接購読
  (単一イベント編集なので collectionGroup でなく直接購読。eventId fallback 不要)
- generatePrediction: races.predictions[] 上書き + events/{id}/predictions/{predictionId} を set で二重化
  - predictionId = sanitize(pred.ai)。公式AI名はそのまま("ChatGPT"等)で既存ドキュメントIDと完全一致(検証済み)
  - set(merge:false)で丸ごと置換(再生成はフィールド増減ありうるため)。outcome:"pending"リセット、predictedAt/updatedAt 更新
  - My AI(source==="user")は触らない。predictionCount 不変
  - read切替と同時に行う理由: 中間状態(read=events だが generatePrediction が races のみ)を作らないため
- makePredictionId ヘルパーを admin/edit 内に local定義(規則の手書き散在を避ける)

Phase 3-4c(または Phase4に統合): 削除(deleteEvent)の方針決定

- 現状 races のみ deleteDoc。events本体 + predictions サブコレクションが残置(孤立)
- 選択肢: A.明示削除(サブコレクション逐次delete) / B.soft delete / C.残置しPhase4で一括クリーンアップ
- 現時点の暫定方針: C(残置)を有力候補とし、3-4b完了後に判断

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
