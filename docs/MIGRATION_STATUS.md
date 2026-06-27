# Kompari Migration Status

最終更新: 2026-06-27（Phase 3-5a 完了）

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
  - 本番で数値照合済み: AI別/ブランド別/モデル別/My AI/ai/[slug] すべて races読み時と完全一致(予測数・的中数・的中率・順位・ヘッダー集計)
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
- [x] Phase 3-4b-2: admin編集の read切替 + generatePrediction の events二重化(同時実装)
  - read: doc(db,"events",id) + collection(db,"events",id,"predictions") の単一doc+サブコレクション直接購読(collectionGroup 不使用)
  - generatePrediction: races.predictions[] 上書き + events/{id}/predictions/{predictionId} を writeBatch で atomic二重化
    - predictionId = sanitize(pred.myAiId || pred.ai)。公式AIは AI名そのままで既存doc IDと一致(検証済み)
    - set で丸ごと置換。removeUndefinedFields で undefined 除去(モック時の aiProvider/aiModel/aiModelId は補完しない)
    - outcome:"pending" リセット、predictedAt/updatedAt 更新、predictionCount 不変
    - My AI(source=="user"/myAiId)は触らない(races配列も events サブコレクションも保持)
  - 【hotfix(commit 7dc7a62)】read切替の useEffect で onSnapshot 2本購読の到着順レースにより、
    event doc が先に届くとフォーム初期化(カテゴリ/タイトル/候補/結果)がスキップされるバグが本番で発生。
    フォーム初期化条件を if (fromEventDoc) → if (!formInitialized || fromEventDoc) に修正。
    本番検証(再生成)の段階で発見・修正(本番データは無傷のまま)
    ※教訓: onSnapshot 2本購読では片方の snapshot 到着時に early return した後、もう片方の callback で
      初回 normalize されることがある。フォーム初期化等の副作用を fromEventDoc だけに閉じ込めると初回同期が抜ける。
      今後 race/[slug] や他の編集画面で同じパターンを使う際の注意点
  - 本番検証済み(ウィザーズVSブルズ): ChatGPT 1つ再生成 →
    races.predictions[]とevents/{id}/predictions/ChatGPT 両方が新予測に更新(main:ウィザーズ→ブルズ、outcome:pending)、
    マイケル・ジョーダンAI(My AI, source=="user")が events/races 両方で保持されることを Firestore Console で確認。
    編集画面(events読み)に再生成結果が反映、フォーム保持も正常
- [x] Phase 3-4c: deleteEvent 方針決定 + 削除導線の移行期間中一時無効化
  - 方針: C採用。events側は残置し、正式な削除方式と孤立データ整理は Phase 4 に統合する
  - 理由: 現在の deleteEvent は races/{id} のみ deleteDoc し、events/{id} と events/{id}/predictions を削除しない。
    そのまま使うと events 側に孤立データが残り「削除したはずのイベントが events 読み画面に表示される」事故が起きる
  - 実装: app/admin/edit/[id]/page.tsx に DELETE_DISABLED_DURING_EVENTS_MIGRATION = true を追加
    - 削除ボタン disabled 条件に DELETE_DISABLED_DURING_EVENTS_MIGRATION を OR 追加
    - 補足テキスト「削除は移行完了まで一時停止中です」を削除ボタン直下に表示
    - deleteEvent 関数本体・onClick は未変更(Phase 4 で正式な削除方式実装時に使う)
    - 実削除・soft delete・events サブコレクション削除処理は今回実装しない
  - commit: 3de5496 fix(admin): disable delete during events migration
  - 本番検証済み: 3de5496 / Production / Ready を Vercel Dashboard で確認。
    admin/edit で削除ボタン非活性 + 補足テキスト表示を目視確認。
    「イベントを更新」「AI再生成」ボタンには無効化が波及していないことを確認
- [x] Phase 3-5a: race/[slug](app/race/[slug]/page.tsx) の read を races → events に切替
  - read切替のみ。My AI 導線整理は対象外(Phase 3-5b 以降)
  - 実装: app/race/[slug]/page.tsx のみ
    - onSnapshot(doc(db,"races",slug)) を削除
    - onSnapshot(doc(db,"events",slug)) を追加
    - onSnapshot(collection(db,"events",slug,"predictions")) を追加
    - 単一イベントページなので collectionGroup は使わず events/{id}/predictions を直接購読
    - 両 snapshot が揃ったら normalizeEventDocToEvent で setEvent(tryNormalize パターン)
    - snapshot 到着順に依存しない構造(admin/edit の教訓を踏襲)
    - normalizeRaceToEvent / LegacyRaceData import を削除
    - normalizeEventDocToEvent / KompariEventDoc / KompariPredictionDoc に差し替え
  - 触っていない: myAis購読 / joinMyAi関数本体 / コメントアウト済み My AI 投稿UI / My AIバッジ・プレースホルダー
  - 注意: joinMyAi 内の races updateDoc は、現在UIから呼ばれない死んだ導線として残置。
    My AI 導線整理は Phase 3-5b 以降で扱う
  - commit: 5868f3b feat(race): switch detail read to events subcollection
  - 本番検証済み:
    - ウィザーズVSブルズ(結果入力済み・予測5件・My AI含む)正常表示、判定バッジ正常
    - 皐月賞(競馬・結果未入力・予測4件)正常表示、判定待ち表示正常
    - コンセンサス・予測カード・レイアウトに問題なし

## 現在の Source of Truth

writes:

- races: 全書き込み
- events: 二重化済み = 作成(2b) + 結果入力(3-4a) + 編集メタ(3-4b-1) + 予測再生成(3-4b-2)
  - deleteEvent: races/{id} のみ deleteDoc。正式な削除方式は Phase 4 で扱う
  - admin/edit の削除導線は Phase 3-4c で一時無効化済み(DELETE_DISABLED_DURING_EVENTS_MIGRATION)
  - joinMyAi: races のみ updateDoc だが、現在 UI から呼ばれない死んだ導線。Phase 3-5b 以降で整理

reads:

- events: home / races一覧 / ranking / ai/[slug] / admin結果入力 / admin編集 / race/[slug]
- races: notifications など未確認箇所のみ残り

## 次のフェーズ

Phase 3-5b: My AI 導線整理

- race/[slug] の myAis購読、joinMyAi、コメントアウト投稿UI、My AIバッジ、プレースホルダーの扱いを確認
- MVP方針では My AI は非表示・非訴求
- 必要に応じて導線非表示・凍結・将来実装扱いに整理

Phase 4: races 読み取りの完全廃止

- LegacyRaceData / normalizeRaceToEvent 削除
- deleteEvent の正式方式決定(races + events + events/{id}/predictions の完全削除)
- 孤立データがあれば一括クリーンアップ

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
