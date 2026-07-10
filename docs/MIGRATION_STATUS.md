# Kompari Migration Status

最終更新: 2026-06-30（mock 表示改善 Step2 完了）

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
- [x] Phase 3-5b-1: My AI を公開UIから非表示（データ・機能は保全）
  - 方針: MVPでは My AI を利用者に見せない。削除ではなく filter/hide。
    「preservation does not mean display」= データ・作成削除機能・/my-ai ページは保全し、
    公開UIから表示・訴求・集計混入を除外する
  - 実装(6ファイル):
    - app/page.tsx: topPrediction/split meter/アバター/ヒーロー予測総数を officialPreds に、
      My AI CTA 削除、CTA grid-cols-2 → grid-cols-3
    - app/races/page.tsx: topPrediction/split meter/予測数/分母を officialPreds に
    - app/race/[slug]/page.tsx: buildConsensus/buildPodiumData/予測カード一覧/候補支持率分母/
      ヘッダーAI予測数を officialPreds に、My AI参加プレースホルダー削除(コメントアウト済みUIは残置)
    - app/ranking/page.tsx: sourceFilter 初期値 "official"、「すべて」「My AI」タブ削除(公式AI一択)、
      myAiId 公開リンク削除
    - components/TopBar.tsx: My AI メニュー項目・説明文から除去
    - components/BottomNav.tsx: My AI 項目削除、grid-cols-4 → grid-cols-3
  - filter 式統一: p.source !== "user" && !p.myAiId
  - 触っていない(保全): /my-ai 本体・/my-ai/[id]・createMyAi/deleteMyAi・joinMyAi関数本体・
    race/[slug]コメントアウトUI・My AIバッジ定義・SourceFilter型・buildRankings本体・lib/stats.ts
  - commit: d950b43 feat(ui): hide My AI from public UI (nav/CTA/consensus/ranking)
  - 本番検証済み:
    - TopBar/BottomNav から My AI 消失、BottomNav 3タブ表示崩れなし
    - Home/races/race詳細のコンセンサス・split meter・予測数・ヒーロー予測総数が公式AIのみ
    - race詳細の予測カードに My AI(マイケル・ジョーダンAI)が出ない
    - ranking タブが「公式AI」一択、カードに My AI 出ない(AI別/ブランド別/モデル別すべて公式のみ)
    - /my-ai 直URL は生存(一覧3件・作成/削除フォーム表示)、通常ナビから到達不可
  - 既知の課題(今回スコープ外・別フェーズ候補):
    - モデル別ランキングの予測数が少ない: 既存予測データに aiModel/aiModelId 未付与のため(Phase 3-5b-2 以降で対応)

- [x] Phase 3-5b-2: ranking ヒーロー集計の単位統一（B案）
  - 問題: ヒーロー「対象」=イベント数 vs「的中」=全AI的中数合計 で単位がズレ、
    「対象11・的中16」と的中が対象を上回って見えた（d950b43 以前からの既存課題）
  - 方針: B案。ヒーロー3数値を全て「公式AIの確定予測数」単位に揃える
  - 実装(app/ranking/page.tsx のみ、+3/-6):
    - headerTarget(イベント数)の const 定義を削除
    - ヒーロー1枚目を headerFinished に差し替え、ラベル「対象」→「確定予測」
    - ヒーロー2枚目 headerHits のラベル「的中」→「的中予測」
    - 的中率(headerHits/headerFinished)は無変更（内部的に元から一貫）
  - 触っていない: buildRankings / aggregateByBrand / aggregateByModel / lib/stats.ts /
    targetEvents・finishedEvents 本体 / sourceFilter・My AI非表示ロジック / Firestoreデータ
  - commit: f848923 fix(ranking): unify hero stats to official-AI prediction units
  - 本番検証済み:
    - AI別=確定47/的中16/率34%、モデル別=確定12/的中3/率25% で単位が揃い、
      的中が母数を超えない表示に。ランキングカード本体・全集計軸切替は従来どおり

- [x] Phase 4-a-1: notifications の races read → events read 移行（公開面の races read 廃止 第1弾）
  - 方針: 公開面の races read を優先廃止。読み取りソースを events に移し、集計対象は公式AIのみ
  - 実装(app/notifications/page.tsx のみ):
    - collection(db,"races") onSnapshot を削除 → events 本体 onSnapshot + collectionGroup("predictions") の2本購読(eventId fallback)
    - normalizeRaceToEvent/LegacyRaceData の使用を外し normalizeEventDocToEvent に差し替え
    - pendingResultEvents/finishedEvents/totalPredictions/カード分母を officialPreds (source!=="user" && !myAiId) 基準に絞り、My AI 予測しかないイベントは通知に出さない
  - 触っていない(保全): my-ai/page.tsx・my-ai/[id]/page.tsx・race/[slug]・TopBar・admin
  - LegacyRaceData/normalizeRaceToEvent は lib/events.ts に残置（My AI 互換層）
  - commit: 510113a
  - 本番検証: notifications 正常表示、分母が公式AIのみ(ホームと一致)、欠落なし

- [x] Phase 4-a-2: TopBar の通知バッジ簡略化・races read 削除（公開面の races read 完全消滅）
  - 方針: TopBar の動的バッジを events に移行せず、バッジ数字を廃止して races read を削除。
    全ページ共通コンポーネントに collectionGroup 2本購読を載せる過剰投資を避け、
    公開面の races read を消すことを優先（MVP の信頼性・軽さ優先）
  - 実装(components/TopBar.tsx のみ、+2/-45):
    - races 購読の useEffect 全体・pendingCount useState・バッジ表示ブロックを削除
    - helper(hasPredictions/hasResult)・型(RaceDoc)・Firestore import(collection/onSnapshot/db)・
      useEffect import を削除（useState は open state で残す）
    - 🔔 アイコン・/notifications リンク・ハンバーガー通知項目は残す
    - events + collectionGroup は載せない（バッジ復活せず）
  - commit: e5bbf3e
  - 本番検証: 全ページでバッジ消失・🔔残存・通知導線2箇所生存・崩れなし
  - 結果: TopBar の Firestore read がゼロ。公開面の races read が完全消滅

- [x] Phase 4-c: deleteEvent 正式方式（events/predictions/races のアトミック削除）
  - 方針: 一時無効化を解除し、events/{id}/predictions/* + events/{id} + races/{id} を writeBatch でアトミック削除
  - 実装(app/admin/edit/[id]/page.tsx のみ):
    - getDocs(events/{id}/predictions) で件数取得
    - predictionsSnapshot.size > 450 の安全ガード
    - confirm に「AI予測 N 件」を動的表示
    - writeBatch で predictions / events / races を delete
    - DELETE_DISABLED_DURING_EVENTS_MIGRATION フラグと一時停止テキストを削除
    - getDocs を import 追加、未使用化した deleteDoc を削除
  - votes は意図的に削除対象外
    - orphan は表示被害なしと判断し、cleanup フェーズに回す
    - コードコメントにも明記
  - 実装上の教訓:
    - 初回の部分置換で古いコード（冒頭confirm / await deleteDoc断片 / 二重catch / 二重setSaving）が混在しかけたため、deleteEvent 関数を丸ごと確定版に置換して一本化した
  - commit: e8c18a8
  - 本番検証:
    - 東京都知事選(id: YKrijBuDCwSqEVy5zKFt)を削除
    - confirm に「AI予測 4 件」を表示
    - Firebase Console で races/{id} と events/{id} の消滅を確認
    - events/{id}/predictions/* は writeBatch の delete 対象に含め、batch commit 成功を確認
    - /admin/results の件数が結果待ち3→2、総数14→13に減少
    - 他イベント無傷、新規孤立なし

- [x] Phase 4-d-1: admin create の races 新規作成廃止（events 起点に変更）
  - commit: eb973fe feat(admin): drop races write from event creation, generate id from events
  - 対象: app/admin/page.tsx
  - 内容:
    - addDoc(collection(db, "races")) を廃止。races doc を作成しなくなった
    - id 生成を doc(collection(db, "events")) 起点に変更。eventRef.id を使用
    - events/{id} と events/{id}/predictions/* を writeBatch で atomic に作成（Phase 2b のベストエフォートから完全 atomic へ）
    - races/{id} は作成されなくなった
  - 本番検証:
    - テストイベント(id: 4aOeWvsWOHb8Oq61CGpq)を作成
    - events/{id} 作成・events/{id}/predictions/* 作成を Firestore Console で確認
    - races/{id} が作成されないことを Firestore Console で確認
    - /race/{id} の表示が正常であることを確認
    - deleteEvent で削除。races が存在しないイベントでも deleteEvent が壊れないことを確認
    - 検証後 DB は events/races 各13件に復帰

- [x] Phase 4-d-2: admin edit/results の races update 廃止（deleteEvent の races delete は維持）
  - commit: f106a05 feat(admin): drop races write from edit/results (keep deleteEvent races delete)
  - 対象:
    - app/admin/edit/[id]/page.tsx
    - app/admin/results/page.tsx
  - 内容:
    - saveEvent の batch.update(races) 削除（resultWinner/result/meta を races に書くのを廃止）
    - generatePrediction の batch.update(races) 削除（races.predictions[] 配列更新を廃止）
    - generatePrediction の preservedPredictions 変数を削除（races.predictions 配列更新専用につき不要）
    - saveResult の batch.update(races) 削除（races 側 resultWinner/result を廃止）
    - deleteEvent の batch.delete(doc(db, "races", id)) は意図的に維持
  - ⚠️ deleteEvent の batch.delete(doc(db, "races", id)) は意図的に維持する。削除しない。
    理由:
    これは write(set/update) ではなく delete。
    races doc を削除するために必要な Phase 4-c の正式方式。
    「races write 全廃」と「races delete 維持」は両立する。
    4-d-5 で firestore.rules を閉じる際も、races の create/update は拒否するが、
    delete は isAdmin で残す必要がある。deleteEvent が legacy races doc を削除するため。
  - 機械確認:
    - races set/update/addDoc/setDoc = 0件（admin/edit・admin/results 両ファイル）
    - deleteEvent races delete = 1件（app/admin/edit/[id]/page.tsx L352）
    - preservedPredictions = 0件
  - 本番検証:
    - saveEvent: 阪神vs巨人で venue/startsAt 編集 → events のみ更新、races は未更新
    - saveResult: 皐月賞で結果「ロブチェン」入力 → events.result.winner のみ更新、races は未更新
    - generatePrediction: 阪神vs巨人で Grok 生成 → events/{id}/predictions に Grok 追加、他AI predictions 無傷、races.predictions は未更新
    - 公開UIは events 読みで正常表示
  - 判定:
    - 4-d-1 / 4-d-2 完了
    - admin create/edit/results/generatePrediction の races write は廃止済み
    - 残る races 操作は deleteEvent の batch.delete(races/{id}) のみ
    - deleteEvent の races delete は意図的に維持
    - DB は検証後も整合状態

- [x] Phase 4-d-3: race/[slug] の joinMyAi 死んだ導線削除・races write 完全消滅
  - commit: f0b4c1d refactor(race): remove dead joinMyAi path and races write from race detail
  - 対象: app/race/[slug]/page.tsx のみ（-123/+2）
  - 内容:
    - joinMyAi 関数本体（updateDoc(doc(db,"races",slug)) 含む）を削除
    - selectedMyAiId / joining state を削除
    - selectedMyAi / selectedMyAiAlreadyJoined useMemo を削除
    - myAis useEffect 内の selectedMyAiId 参照・setSelectedMyAiId 呼び出しを削除、dep [] に修正
    - updateDoc import を削除
    - コメントアウト済み My AI 参加 UI ブロック（37行）を削除
    - myAis state・onSnapshot(collection(db,"myAis"))・myAis prop・isMyAiPrediction 等の表示ロジックは維持
    - my-ai/page.tsx・my-ai/[id]/page.tsx の races read は据え置き（My AI legacy 層）
  - 効果: race/[slug] から races への write（updateDoc）が消滅。コード全体で races write がゼロに

- [x] Phase 4-d-4: votes orphan cleanup 確認
  - 削除済みイベント 2件の orphan vote を votes コレクションで確認
    - YKrijBuDCwSqEVy5zKFt（東京都知事選、Phase 4-c で削除済み）
    - 4aOeWvsWOHb8Oq61CGpq（テストイベント、Phase 4-d-1 検証後削除済み）
  - 調査結果: 両イベントとも votes コレクションに orphan doc なし
  - 削除実施なし。votes は表示被害なし。コード変更なし・commit なし

- [x] Phase 4-d-5: firestore.rules の races ブロックを create/update 拒否に変更
  - commit: fecd5ae feat(rules): deny races create/update, keep read and admin delete
  - 対象: firestore.rules（races ブロックのみ）
  - 変更内容:
    - before: `allow create, update, delete: if isAdmin();`
    - after:
      - `allow read: if true;`（維持・My AI legacy read 用）
      - `allow create, update: if false;`（拒否・races は write 先ではない）
      - `allow delete: if isAdmin();`（維持・deleteEvent の races doc cleanup 用）
  - events / votes / myAis / predictions / isAdmin 関数は無変更
  - deploy: Firebase Console から手動反映済み（firebase-tools 未セットアップのため Console paste）
    - Git の firestore.rules と本番 Console の内容が一致していることを確認済み
  - 本番確認:
    - /my-ai・/my-ai/[id] 正常表示（races read 維持）
    - 公開ページ（ホーム/race詳細/ランキング）正常
    - 全機能無傷

- [x] Phase 5-b-1: ranking/stats の countable prediction 判定を isCountablePrediction() に集約
  - commit: 7dadb62 refactor(stats): centralize countable prediction guard
  - 背景: 結果判定ロジック調査で、ranking は Pattern A 動的計算・prediction.outcome は未使用・isMock===true で分母除外、と判明。isMock 未付与の旧データや mock 予測が miss 扱いで混入する理論上のリスクを確認したが、API保証(isMock と predictionSource は常にペア)・バックフィル仕様・本番数値照合の3証拠から「現時点の実害なし」と判定。よって予防的堅牢化として実施。
  - 変更:
    - lib/events.ts に isCountablePrediction(prediction) を追加（getResultWinner の直後）
    - lib/stats.ts の集計ガード（aggregateByBrand / aggregateByModel）を helper 化
    - app/ranking/page.tsx の buildRankings 集計ガードを helper 化
  - helper の判定方針:
    - isMock === true は除外
    - predictionSource === "mock" は除外（多層防御。isMock の補助ガード）
    - main 空は除外
    - isMock missing / predictionSource missing だけでは除外しない（旧公式AIデータを落とさない）
    - 将来 status が failed/skipped/omitted の除外はコメントで明示（status 未導入のため未実装）
  - 維持:
    - source filter（source!=="user" && !myAiId）は helper 外で維持
    - isFinished / if(!winner)return を維持
    - Pattern A 動的計算（pick===winner）を維持
    - prediction.outcome 参照なし
    - Firestore 書き込みなし
  - 本番確認: ランキング数値が前回と完全一致（確定予測52・的中17・的中率32.7%、ChatGPT41.7% / DeepSeek41.7% / Gemini33.3% / Claude16.7% / Grok25%、順位）。予防的堅牢化成功。
  - 対象外（今回触らない）:
    - race詳細 / notifications / normalize の判定共通化（5-b-2 候補）
    - stored outcome 書き戻し
    - status 新規
    - backfill
    - Firestore操作

- [x] Phase 5-b-2: 表示系 hit/miss/pending 判定を getPredictionStatus() に集約
  - commit: 4674c05 refactor(display): centralize hit/miss/pending judgment in getPredictionStatus
  - 背景: 表示系の hit/miss/pending 判定が race詳細/ai/my-ai の4箇所で別々に書かれていた
    （判定ロジックは全箇所同一、文言のみ画面ごとに差異）。判定ロジックを共通 helper に集約し、
    散在を解消。文言・mock扱いは各画面従来どおり維持。
  - 実装:
    - lib/events.ts に getPredictionStatus(prediction, resultWinner) を追加（isCountablePrediction の直後）
    - 両側 trim（pick も winner も trim）/ 3値（"hit"|"miss"|"pending"）
    - mock 除外なし / prediction.outcome 参照なし（Pattern A 動的計算のみ）
    - 適用: race詳細(getPredictionResult ラッパー内) / ai/[slug](buildStats) /
      my-ai/[id](buildStats) / my-ai/page(buildMyAiStats)
    - ai/[slug]・my-ai/[id] は hit:boolean|null 構造を維持するため
      `status === "pending" ? null : status === "hit"` の変換ブリッジで helper 化（集計本体は不変）
  - 役割分離: isCountablePrediction()=ranking 分母用(boolean) / getPredictionStatus()=表示用(3値)。混ぜない。
  - 維持（文言は各画面従来どおり・統一しない）:
    - ai/[slug] は「予測中 / 的中 / 不的中」のまま
    - race詳細・my-ai は「判定待ち / 的中 / 外れ」のまま
    - normalizeEventDocToEvent / normalizeRaceToEvent 変更なし
    - notifications 変更なし / stored outcome なし / Firestore 書き込みなし / mock 表示変更なし
  - 本番確認（4画面・表示が従来どおり）:
    - race詳細（ベルギーVSエジプト）: 5公式AI全員「外れ」表示 正常
    - ai/[slug]（ChatGPT）: 的中率41.7%・的中5・予測13・確定12、文言「予測中/的中/不的中」維持
    - my-ai一覧: 作成AI3・予測4・的中1、数値維持
    - my-ai/[id]（King Ai）: 的中率50%・的中1・予測2、文言「判定待ち/外れ」維持
  - trim 統一の安全性: main は生成パイプライン（admin create の .trim() / parsePredictionOutput の
    pickCandidate exact match）で常に trim 済み、winner も saveResult/getResultWinner で trim 済み。
    両側 trim 統一で表示変化リスクゼロ（事前調査で確認）。

- [x] Phase 5-b-3: PredictionRunStatus 設計調査・今は実装しない判断
  - 種別: docs 設計記録のみ。コード変更なし。
  - 結論:
    - `PredictionRunStatus` は今すぐ実装しない。
    - 型追加・生成時 status 付与・UI変更・backfill・Event側メタ追加は行わない。
    - 現時点では `isMock` / `predictionSource: "mock"` を分母除外の正本として維持する。
  - 調査で判明した事実:
    - failed は現状、mock fallback として保存される（`isMock: true` + `predictionSource: "mock"`）。
    - `isCountablePrediction()` により mock は ranking / stats の分母から除外済み。
      そのため、分母上の実害は現時点で抑えられている。
    - ただし Firestore 上では以下を区別できない:
      API失敗 / timeout / provider throw / APIキー未設定による意図的 mock
    - 失敗理由は `console.error` に出るだけで、Firestore には保存されない。
    - omitted（prediction doc 不在）はコード上起こりうる:
      - admin create の生成ループは `!response.ok` で throw し、以降のAIの prediction doc が作られない可能性がある。
      - edit 再生成は個別 try/catch のため、一部AIだけ欠落する可能性がある。
      - 表示・ranking は `forEach` / `find` ベースで、prediction 欠落自体は許容する。
    - ただし、本番データ上で omitted が実在するか、頻度がどの程度かは未確認。
    - `prediction.status` / `failedAIs` / `omittedAIs` / `participatedAIs` / `errorReason` / `generatedAt` は現行コードには未実装。
    - `aiModelId` は既存の prediction 型・保存処理で使用中。
    - 公式AIは5体: ChatGPT / Claude / Gemini / DeepSeek / Grok
    - 公式AI設定の正本候補は `lib/ai/ai-config.ts` の `AI_CONFIGS`。
      ただし、イベント作成・再生成・ranking・stats では公式AIリストがリテラル重複しており、
      `AI_CONFIGS` から自動導出されていない（同期ズレリスク）。
  - 設計判断:
    1. `PredictionRunStatus` は今すぐ実装しない。
       理由: 現時点では読む側が無く、型だけ追加すると宙に浮くため。
    2. MVPでは `isMock` / `predictionSource: "mock"` を分母除外の正本として維持する。
    3. 将来 status を入れる場合は案Bを基本にする:
       - `isMock` 正本維持。`PredictionRunStatus` は failed/omitted/success を区別する付加情報。
       - `isCountablePrediction()` の主軸はすぐには変えない。
    4. 命名は `PredictionRunStatus` とする。
       5-b-2 の `PredictionStatus = "hit" | "miss" | "pending"` は表示結果用であり、
       生成ライフサイクル用 status と混同しない。
    5. omitted は prediction doc 不在ケースなので、Prediction側 status だけでは表現できない。
       将来的には Event側メタ または 全公式AI分の stub prediction doc のどちらかが必要。
    6. status 実装より前に、公式AIリストの正本化が必要。
       `AI_CONFIGS` から公式AI一覧を導出し、リテラル重複を解消することが omitted 判定の前提。
    7. status に再着手する時の最初の確認は、本番 Firestore で prediction 件数を確認し、
       omitted の実在性を判定すること。
  - Event側メタの位置づけ:
    - `participatedAIs` / `failedAIs` / `omittedAIs` / `consensusTargetCount` / `accuracyTargetCount` は
      プロジェクト方針ファイル上は候補として存在する。
    - ただし、現行コード・MIGRATION_STATUS 上では未実装。5-b-3 では実装しない。
  - 今回行わないこと:
    - `PredictionRunStatus` 型追加 / prediction doc への status 保存
    - `status: "success"` の生成時付与 / `status: "failed"` の mock fallback 付与
    - `isCountablePrediction()` の status 対応 / mock/failed のUI表示変更
    - backfill / Event側メタ追加 / 公式AIリスト正本化
  - 判断根拠:
    分母は `isMock` で既に安全（5-b-1 実証済み）。omitted の本番実在は未確認。
    status を読む側が今は無い。
    → 使う側が無い型を先に入れるのは over-engineering。
      使う時に型と実装を同時に入れる方針（5-b-1 での outcome 後送りと同じ判断軸）。

- [x] 公式AIリスト正本化: client-safe official AI names source へ一元化
  - commit: 2960c96 refactor(ai): centralize official AI names in lib/ai/official-ai.ts
  - 目的:
    - admin create / edit regenerate / ranking / stats に散らばっていた公式AI名リテラル重複を解消
    - 将来のAI追加・削除時のズレ事故を防ぐ
    - omitted 検出設計の前提となる「本来いるべき公式AI一覧」を明確化
  - 実装:
    - `lib/ai/official-ai.ts` を新規作成
    - `OFFICIAL_AI_NAMES` を client-safe な公式AI名・順序の正本として定義
    - 順序は `ChatGPT → Claude → Gemini → DeepSeek → Grok`
    - `OfficialAiName` 型を `OFFICIAL_AI_NAMES` から導出
    - `isOfficialAiName()` を公式AI判定 helper として追加
    - `OFFICIAL_AI_NAME_SET` は内部実装として非 export
  - 置換:
    - `app/admin/page.tsx`: 公式AI生成ループを `OFFICIAL_AI_NAMES` に置換
    - `app/admin/edit/[id]/page.tsx`: 全AI再生成ループと再生成ボタン表示を `OFFICIAL_AI_NAMES` に置換
    - `app/ranking/page.tsx`: ローカル `new Set([...])` を削除し `isOfficialAiName()` に置換
    - `lib/stats.ts`: ローカル `new Set([...])` を削除し `isOfficialAiName()` に置換
  - client/server 境界:
    - `lib/ai/ai-config.ts` は server/API 用設定であり、client component から import しない
    - `ai-config.ts` には `process.env` / API key env名 / provider / baseUrl / modelId が含まれるため、client-safe な `official-ai.ts` に分離
    - `official-ai.ts` は `process.env` / API key / provider / baseUrl / Node専用 import を含まない純粋な定数ファイル
  - 挙動不変:
    - 公式AI名の表記・順序は変更なし
    - admin create の生成順は変更なし
    - admin edit の再生成ボタン順は変更なし
    - ranking / stats の公式AI判定対象は変更なし
  - 本番確認:
    - `/ranking`: 確定52 / 的中17 / 的中率32.7% が前回と一致。ChatGPT 41.7% / DeepSeek 41.7% / Gemini 33.3% / Claude 16.7% / Grok 25% が前回と一致
    - `/admin`: イベント作成画面・AI予測生成UIが正常
    - `/admin/edit`: 再生成ボタン順が `ChatGPT → Claude → Gemini → DeepSeek → Grok`、AI予測数5件が正常
    - `/ai/[slug]`: ChatGPT詳細の的中率41.7% / 的中5 / 予測13 / 確定12 が正常
  - 設計上の注意:
    - `official-ai.ts` と `ai-config.ts` の `displayName` は手動同期が必要
    - 今回は `ai-config.ts` から導出しない（理由: client/server 境界を守るため）
    - 将来さらに厳密に一元化する場合は、server/API設定と client-safe メタ情報の責務分離を再設計する

- [x] mock 表示改善 Step1: ai/[slug] 集計の mock 除外
  - commit: 4091dd0 fix(ai): exclude mock predictions from AI detail stats
  - 目的:
    - `app/ai/[slug]/page.tsx` のローカル `buildStats()` に `isCountablePrediction()` を適用
    - 公式AI fallback mock が AI詳細ページの的中率・的中数・確定数・recent list に混入するのを防ぐ
    - 5-b-1 で ranking / stats に適用した countable 判定を、AI詳細ページの独自集計にも適用する
  - 実装:
    - `app/ai/[slug]/page.tsx` のみ変更（2行追加）
    - `isCountablePrediction` を `lib/events` から import
    - `buildStats()` で prediction を stats / recent に入れる前に `isCountablePrediction(prediction)` を確認
    - false の場合は early return（forEach の return）
    - `stats.total` / `stats.finished` / `stats.hit` / `stats.categories` / `stats.recent` すべてから mock を除外
  - 維持したもの:
    - `getPredictionStatus()` の3値判定は変更なし
    - `hit: boolean | null` 変換は変更なし
    - `lib/events.ts` は変更なし
    - race詳細・My AI系・文言・docs 以外のコードは変更なし
  - 本番確認:
    - `ai/[slug]` の ChatGPT 詳細: 的中率 41.7% / 的中 5 / 不的中 7 / 確定 12
    - ranking の ChatGPT: 的中率 41.7% / 的中 5 / 外れ 7 / 予測数 12
    - AI詳細ページの的中率・的中数・確定数が ranking の同じ意味の指標と整合
    - AI詳細ページの総予測数 13 は pending 1件を含むため、ranking の確定 countable 12 と完全一致しなくてよい（設計どおり）
  - 設計上の注意:
    - 成功条件は「的中率・的中数・確定数の整合」であり「総予測数の完全一致」ではない
    - AI詳細ページの `stats.total` は pending を含む設計（`total = finished + pending`）
    - ranking 側の「予測数」は確定済み countable 件数として扱われる
    - 本番現データでは mock 実在なし（数値変化なし）。将来 API失敗 fallback mock が発生しても混入しない

- [x] mock 表示改善 Step2: race詳細の mock を「判定不可」表示 + consensus/support 系から除外
  - commit: 405914a fix(race): show mock predictions as unavailable and exclude from consensus
  - 目的:
    - race詳細で公式AI fallback mock が結果確定後に「外れ」赤表示される問題を修正
    - mock を「そのAIが外した予測」と誤認させない
    - mock はカード上には残し、透明性を保ちながら「判定不可」として表示する
    - mock fallback のランダム候補を AI consensus / support / podium に混ぜない
  - 実装:
    - `lib/events.ts`
      - `PredictionDisplayStatus = PredictionStatus | "unavailable"` を追加
      - `getPredictionDisplayStatus()` を追加
      - `isCountablePrediction(prediction)` が false の場合は `"unavailable"` を返す
      - countable な prediction では既存の `getPredictionStatus()` に委譲
    - `app/race/[slug]/page.tsx`
      - `getPredictionResult()` が `getPredictionDisplayStatus()` を使用
      - `"unavailable"` の場合は `判定不可` / `bg-gray-100 text-gray-500`
      - 既存の `判定待ち` / `的中` / `外れ` は変更なし
      - PredictionCard から mock を消さず、カードとして残す
    - consensus / support 系:
      - `buildConsensus()` の filter に `isCountablePrediction(p)` を追加
      - `buildPodiumData()` の filter に `isCountablePrediction(p)` を追加
      - render-level に `countableOfficialPreds` を追加
      - split meter / legend / CandidateCard の支持率分母は `countableOfficialPreds` を使用
      - AI予測数バッジと PredictionCard ループは `officialPreds` のまま維持
  - 維持したもの:
    - `getPredictionStatus()` は3値 `hit | miss | pending` のまま
    - `isCountablePrediction()` 本体は変更なし
    - PredictionCard 表示から mock を削除しない
    - 文言統一は行わない
    - My AI 系は触らない
    - Firestore 書き込みなし
  - 安全性確認:
    - CandidateCard は `totalPredictions = 0` でも `rate = 0` になる既存ガードあり（L320〜323）
    - `NaN%` / 0除算リスクなし
  - 本番確認:
    - mock が無い通常イベントでは表示差分なし（`officialPreds === countableOfficialPreds`）
    - ベルギーVSエジプト: 5公式AIすべて通常どおり「外れ」赤表示。AIコンセンサス / split meter / legend / CandidateCard が従来どおり
    - サークルインターネット: 4公式AIの的中/外れ表示が正常。既存表示を壊していない
  - 挙動:
    - mock が無い race詳細では表示・支持率・コンセンサスは従来どおり
    - mock がある race詳細では、PredictionCard は「外れ」赤ではなく「判定不可」グレーになる
    - mock は consensus / podium / split meter / legend / CandidateCard 支持率分母から除外される

## 現在の Source of Truth

writes:

- races: admin write 全廃（4-d-1/4-d-2）+ race/[slug] joinMyAi 廃止（4-d-3）。rules でも create/update 拒否（4-d-5）。
  残る races 操作は deleteEvent の batch.delete(races/{id}) のみ（コード・rules とも意図的維持）
- events: 全 admin write が events のみに集約済み
  - 作成(4-d-1 atomic writeBatch) + 結果入力(3-4a→4-d-2) + 編集メタ(3-4b-1→4-d-2) + 予測再生成(3-4b-2→4-d-2)
  - deleteEvent: events/{id}/predictions/* + events/{id} + races/{id} の writeBatch アトミック削除（Phase 4-c）
    - races/{id} の delete は legacy races doc を消すために維持（write ではなく delete）
  - Phase 3-4c の削除一時停止フラグは解除済み

rules（races ブロック現状）:
- `allow read: if true;`（My AI legacy read 用に維持）
- `allow create, update: if false;`（4-d-5 で拒否。コードからの write がゼロのため）
- `allow delete: if isAdmin();`（deleteEvent の races doc cleanup 用に維持）

reads:

- events: home / races一覧 / ranking / ai/[slug] / admin結果入力 / admin編集 / race/[slug] / notifications
- races: My AI 専用(app/my-ai/page.tsx・app/my-ai/[id]/page.tsx) のみ残り（意図的残置）
  - My AI は MVP モック・将来作り直し前提につき events 移行しない（下記 My AI 方針参照）
  - 公開面の races read は Phase 4-a-2 完了により完全消滅

公開UIの予測表示・集計・コンセンサス・ランキング・通知は officialPreds(source!=="user" && !myAiId)基準に統一済み(Phase 3-5b-1 / 4-a-1)
TopBar の Firestore read がゼロに。🔔 アイコン・通知導線は残存（件数はバッジなし、/notifications で確認）

#### TopBar バッジ将来復活の展望
TopBar バッジを将来復活させるなら、events に集計済みフィールド
(officialPredictionCount / hasOfficialPredictions / resultStatus 等)を信頼できる形で持たせてから、
events 本体のみ軽く読む（理想は siteStats のような1ドキュメント read）。
現 predictionCount は generatePrediction 時に更新されず信頼できないため、今は復活させない。
My AI データ・/my-ai ページ・作成削除機能は保全(非表示のみ)

### My AI 方針（誤着手防止）

My AI データは MVP 時点ではモックであり、将来は利用者APIベースで作り直す前提。
本格対応は MVP 後、サッカー / NFL などの展開後。
そのため現時点では my-ai の events 移行は行わない。
my-ai は races read のまま据え置き、LegacyRaceData / normalizeRaceToEvent は My AI 互換層として残置する。

## 次のフェーズ

Phase 3-5b-3 以降の候補:

- aiModel/aiModelId バックフィル(既存予測データへの付与 → モデル別ランキングの充実、Firestore書き込みを伴う)

Phase 4: races 読み取りの完全廃止

- [x] Phase 4-d-1 / 4-d-2: races write 廃止完了（上記「完了フェーズ」参照）
- [x] Phase 4-d-3: race/[slug] joinMyAi 死んだ導線削除・races write 消滅（commit f0b4c1d）
  - My AI legacy ページ(my-ai/page.tsx・my-ai/[id]/page.tsx)の races read は据え置き
- [x] Phase 4-d-4: votes orphan cleanup 確認（orphan なし・削除なし）
- [x] Phase 4-d-5: firestore.rules で races の create/update を拒否（commit fecd5ae）
  - races の read は My AI 用に残す
  - races の delete は isAdmin で残す（deleteEvent が legacy races doc を削除するため）
- [x] Phase 4-d-6: 最終 docs 整理（本 commit）

**Phase 4-d 完了**: races collection への新規 write は全廃（コード + rules 両面）。
races に残るのは read（My AI legacy）と delete（deleteEvent cleanup）のみ。
events が全 write を受け、公開面は events 読みで完結。

Phase 5: 集計堅牢化

- [x] Phase 5-b-1: isCountablePrediction() 集約（commit 7dadb62、上記「完了フェーズ」参照）
- [x] Phase 5-b-2: getPredictionStatus() 集約（commit 4674c05、上記「完了フェーズ」参照）
- [x] 5-b-3: PredictionRunStatus 設計調査・今は実装しない判断（上記「完了フェーズ」参照）
  - mock の表示変更（「判定不可」化）は Step2 で完了（commit 405914a）。failed/omitted の表示変更は将来の status 実装時に合わせて対応
- 5-b-3 派生の将来候補（実装する場合の前提順序）:
  - [x] 前提: 公式AIリストの正本一元化 → `lib/ai/official-ai.ts` に完了（commit 2960c96）
  - 次: omitted 検出設計（Event側メタ or 全AI分 stub prediction doc）→ `PredictionRunStatus` 導入
- mock 表示改善（5-b-1 の延長）:
  - [x] Step1: `ai/[slug]` buildStats に `isCountablePrediction()` 適用（commit 4091dd0）
    - ranking / lib/stats.ts と同じ countable 判定を AI詳細ページの独自集計にも適用
    - 的中率・的中数・確定数が ranking と整合
  - [x] Step2: race詳細の mock を「判定不可」表示 + consensus/support 系から除外（commit 405914a）
    - race詳細で公式AI fallback mock が結果確定後に「外れ」赤表示される問題を修正
    - mock はカード上に残し「判定不可」グレーとして表示する
    - mock は consensus / podium / split meter / legend / CandidateCard 支持率分母から除外
  - これにより、公式AI fallback mock については以下の扱いが確立:
    - 表示上は存在を隠さない
    - ただし「外れ」と誤表示しない
    - 的中率・recent list・consensus・support には混ぜない
  - My AI 系（別フェーズ）: `my-ai/[id]` / `my-ai/page` の legacy mock 集計・表示混入
    - My AI は MVP 非優先・将来機能扱いのため今回対象外
- omitted の本番実在確認（任意・別アクション）:
  Firebase Console で predictions サブコレクションが5件未満のイベントがあるか目視確認。
  あれば公平性の論点として再検討（ただし的中率・表示は欠落があっても壊れない）。

保留:
- My AI(将来作り直し) / LegacyRaceData削除 / aiModelバックフィル / TopBarバッジ復活
- My AI 系 mock 集計・表示混入（別フェーズ）:
  - `my-ai/[id]` / `my-ai/page` の legacy mock 集計・表示混入
  - `buildStats()` / `buildMyAiStats()` に `isCountablePrediction()` を追加すれば解決するが
  - My AI は MVP 非優先・将来機能扱いのため今回対象外
- 文言統一（候補）: 「予測中 vs 判定待ち」「不的中 vs 外れ」= UI方針の別決定事項。判定ロジックは 5-b-2 で共通化済み。
- status / failure / omission handling（5-b-3 調査済み）:
  - 現時点では `PredictionRunStatus` は実装しない。
  - `isMock` / `predictionSource: "mock"` を当面の分母除外正本として維持。
  - status 実装の前提条件:
    1. 本番 Firestore で predictions 件数を確認し、omitted の実在性を確認
    2. [x] 公式AIリストを `lib/ai/official-ai.ts` に一元化
       - 完了: commit 2960c96
       - admin create / edit regenerate / ranking / stats のリテラル重複は解消済み
    3. Event側メタ or stub prediction doc のどちらで omitted を表現するか決定
- 公式AIリスト正本化:
  - 完了。`lib/ai/official-ai.ts` を client-safe な公式AI名・順序の正本とする。
  - admin create / edit 再生成 / ranking / stats のリテラル重複は解消済み。
  - omitted 検出設計の前提は一段進んだ。
  - 残る未実装: omitted の本番実在確認 / Event側メタ or stub prediction doc の設計 / PredictionRunStatus の実装 / mock/failed のUI表示変更
- stored outcome/settlement 永続化: 中長期では有効だが、MVP では ranking/UI の正本を Pattern A 動的計算に維持する。events.result.winner と prediction.outcome の二重管理によるズレを避けるため、学習DB開始時または post-MVP で再検討する（捨てたのではなく意図的に後送り）。

改善候補:
- firebase-tools 未セットアップのため Phase 4-d-5 の rules deploy は Firebase Console 手動だった。
  将来の rules 変更のため `npm install -g firebase-tools` + `firebase login` + `firebase use <project-id>` を整えると、
  Git 正本のまま `firebase deploy --only firestore:rules` で反映でき、Console 手動反映のズレリスクが消える

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
- votes: Phase 4-c では削除対象外。イベント削除後 orphan になりうるため、Phase 4-d cleanup で扱う
- テストレース(id: lm8bFnPWFM6DGvfQMsOX) は events/races に現存。将来の削除テストまたは cleanup 候補として記録

## 本番欠損パターン調査結果（HEAD=8577647 / 2026-07時点）

### 調査概要

Result Settlement に着手する前に、本番 Firestore（kompari-48dba）の読み取り専用調査を実施した。
調査スクリプトは `kompari-factor-check/check-predictions-audit.mjs`（リポジトリ外）で Firestore REST API を使用。
write / delete は一切行っていない。

### 確認した実データ

- events 総数：13件
- all predictions 総数：61件（events/{id}/predictions サブコレクション合計）
- AI識別フィールド：`ai`（全61件に存在。`aiName` フィールドは未実在）
- event 紐付けフィールド：`eventId`（全61件に存在）
- `outcome` フィールド：全61件に存在（`miss:28 / hit:17 / pending:16`）
- `predictionSource` フィールド：58件に存在（全て `"official-ai"`）
- `source` フィールドの値：`"official"` / `"user"`（61件中に混在）
- `aiProvider` / `aiModel` / `aiModelId`：各19件のみ存在（新規作成分のみ付与、旧データには未付与）

### 欠損パターンの確定

以下の4パターンで切り分けを実施した。

| パターン | 本番実在 | 詳細 |
|---|---|---|
| prediction doc 自体が存在しない | **あり（8件）** | 全8件が Grok |
| `isMock: true` の mock doc として存在 | **なし（0件）** | 本番に isMock: true は0件 |
| `status: "failed"` / `status: "omitted"` として存在 | **なし（0件）** | `status` フィールド自体が本番未実在 |
| フィールド名揺れによる見かけ上の欠落 | 一部あり | `aiProvider`/`aiModel`/`aiModelId` は旧データに未付与。ただし AI識別の `ai` フィールドは全61件に存在するため、集計には影響なし |

### 数値についての注記

all predictions 総数（61件）と official missing count（8件）は別概念として扱う。
61件の内訳（公式 / 非公式 / legacy / My AI 別件数）は本調査では未分解であり、確定していない。
したがって、`13 × 5 = 65 件が期待値で 65 - 61 = 4` といった単純計算による関連づけは行わない。
確定している事実は「official missing = 8件、すべてGrok」のみ。

### Grok 欠落 8件の扱い

Grok が欠落している 8 events は以下のとおり（全て prediction doc 不在）：

| event title | eventId | 結果 |
|---|---|---|
| サークルインターネット | 7aCBzjFroS3saXfrPB27 | 未確定 |
| ウィザーズVSブルズ | 8kUrRnIAPuIHfjhSCchK | 未確定 |
| 日本ダービー | bOA9hyBdbZZILPYVBh8a | 結果済み |
| 皐月賞 | jloyotwTKe4pL4qaEVaW | 結果済み |
| テストレース | lm8bFnPWFM6DGvfQMsOX | 結果済み |
| 日本対アイスランド | r3pibRKQiL0gjmPrG9tg | 未確定 |
| 日本グランプリ | uPb5FRKeXMR79R9nAPth | 結果済み |
| 日本ダービー | zTNPut4MyJqoAlKNDHRu | 結果済み |

これらは Grok が公式AIに追加される前に作成されたイベントである。

**後追い再生成は行わない**。
理由：結果確定済みイベントを含む過去イベントに後から予測を追加すると、「予測は事前に行われた」という Kompari の信頼性を壊すため。

これらのイベントにおいて Grok は、settlement / accuracy / ranking の分母に含めない。
「外れ」ではなく「prediction doc 不在」として扱う。

### Result Settlement への含意

Result Settlement は、存在する prediction doc のみを対象に hit / miss を確定する。

現時点では以下を新規実装しない：

- mock 用の新規抽象化
- `status: "failed"` 用の分岐
- `status: "omitted"` 用の分岐
- `PredictionRunStatus` の新規導入

理由：本番 Firestore 上に mock / failed / omitted / status 系データが実在しないため、
これらを扱う実装を先に入れても発動しない死んだコードになる。

既存の `isCountablePrediction()` による mock 除外ガードは維持する。
Result Settlement 側で mock / status 抽象化を新たに増やさない。

## Result Settlement 既存資産調査結果（outcome非権威 / result.winner SoT）

### 調査概要

Result Settlement 実装方針を決める前に、`outcome` フィールドがコード上でどこで・誰によって・何を根拠に設定されているかを読み取り専用で調査した。
調査対象：`lib/events.ts` / `lib/stats.ts` / `app/admin/**` / `app/ranking/page.tsx` / `app/ai/[slug]/page.tsx` / `app/race/[slug]/page.tsx` / `kompari-backfill/backfill.mjs`。
コード変更・Firestore write・commit はなし。

### 確認した実データ（補足）

- `outcome` 全 prediction doc に存在（miss:28 / hit:17 / pending:16）
- `pending` 16件の内訳：正規 pending 5件（結果未設定）/ stale pending 11件（結果あり・outcome未更新）

stale pending の詳細：

| event | result.winner | pending件数 | 原因 |
|---|---|---|---|
| ベルギー VS エジプト | 引き分け | 5 | backfill時は結果なし→pending。saveResult は outcome を更新しない |
| 皐月賞 | ロブチェン | 4 | 同上 |
| ウィザーズVSブルズ | ウィザーズ | 1 (ChatGPT) | 結果確定後に予測を再生成 → outcome:"pending" にリセット |
| 阪神 vs 巨人 | 巨人勝利 | 1 (Grok) | 結果確定後に Grok 追加 → creation は常に pending |
| フランス VS セネガル | **未設定** | 5 | 正規 pending（結果未確定） |

### outcome の書き込み箇所

| ファイル | 関数 | 書き込む値 | 種別 |
|---|---|---|---|
| `app/admin/page.tsx` | `createEvent()` | `"pending"` 固定 | 初期値 |
| `app/admin/edit/[id]/page.tsx` | `generatePrediction()` | `"pending"` 固定 | 再生成リセット |
| `kompari-backfill/backfill.mjs` | `computeOutcome()` | hit/miss/pending 計算 | Phase 2.5 の一回限り |
| `lib/events.ts:normalizeEventDocToEvent` | — | 動的 hit/miss | **メモリのみ。Firestore に書き戻さない** |

`saveResult()` は `events/{id}.result` を更新するが、`predictions.outcome` は更新しない（コード確認済み）。
Firestore 上に存在する `outcome: "hit"/"miss"` は、Phase 2.5 バックフィルが一度だけ書いたもの。

### outcome の読み取り箇所

現行の表示・集計・ranking はいずれも `prediction.outcome` を参照しない。

| 箇所 | 手法 |
|---|---|
| `lib/stats.ts`（aggregateByBrand / aggregateByModel） | `isFinished && pick === winner` で動的計算 |
| `app/ranking/page.tsx`（buildRankings） | `pick === winner` で動的計算 |
| `app/ai/[slug]/page.tsx`（buildStats） | `getPredictionStatus(prediction, resultWinner)` → 動的計算 |
| `app/race/[slug]/page.tsx` | `getPredictionDisplayStatus()` → 動的計算 |
| `lib/events.ts:normalizeEventDocToEvent` | `p.outcome === "pending" && isFinished` の場合のみ動的補完（メモリ返却値） |

### actualResult / resultCheckedAt の所在

コード上・本番データ上ともに未実在。`outcome` 判定に使われるフィールドは存在しない。

### source と predictionSource の意味確定

| フィールド | 型 | 代入箇所 | 意味 |
|---|---|---|---|
| `source` | `"official" \| "user"` | admin 作成・編集で `"official"` 明示、backfill で `"user"` コピー | legacy 2値フィールド。公式AI vs My AI |
| `predictionSource` | `"official-ai" \| "my-ai" \| "custom-ai" \| "mock" \| "manual"` | API route が成功時 `"official-ai"`、失敗時 `"mock"` を設定 | 細粒度ソース分類 |

`source: "user"` は My AI 予測を意味する。全ページで `p.source !== "user" && !p.myAiId` フィルタにより公開集計・consensus・ranking から除外済み。

Result Settlement 実装時は、`predictionSource` だけでなく `source` / `myAiId` / `isCountablePrediction()` の関係を再確認する。フィールド名のみで My AI 混入を断定しない。

### 設計判断

#### Result Settlement の Single Source of Truth

Result Settlement の SoT は `events/{id}.result.winner` とする。

hit / miss は以下の派生値として扱う。

```
events.result.winner + prediction.main → 動的突合 → hit / miss
```

#### outcome の位置づけ

`outcome` は保存されているが、現行の表示・集計・ranking の正本ではない。

現時点では `outcome` を権威値に昇格させない。`saveResult()` 実行時に `predictions.outcome` を一括更新する処理も追加しない。

理由：

- `result.winner` と `predictions.outcome` の二重管理が発生するため
- winner 修正時に outcome 再計算が必要になり、整合性負債を増やすため
- 現行 UI / ranking / stats はすでに `result.winner` ベースの動的計算で成立しているため
- stale pending は現行画面に実害がないため

#### stale pending 11件の扱い

直ちに修正すべき機能バグではなく、過去 backfill / 再生成処理由来の非権威フィールド残骸として扱う。

将来 `outcome` を派生キャッシュとして使う必要が出た場合のみ、`result.winner` を SoT として再計算する。

#### 将来の高速化・集計最適化

件数増加で動的計算コストが問題になった場合でも、`outcome` を SoT にする必要はない。

`events.result.winner` を SoT に保ったまま、派生キャッシュとして再計算する方針をとる。

```
SoT:   events.result.winner
Derived: hit / miss calculation / AI accuracy stats / ranking aggregates / optional cached outcome
```

この構造により、winner 修正時も SoT を直して派生値を再計算すればよく、二重管理を避けられる。

### Result Settlement への含意

Result Settlement の大規模新規実装は現時点では不要。

現行の機能は以下で成立している。

```
saveResult() → events.result.winner 更新
→ UI / ranking / stats が prediction.main と winner を動的突合
→ hit / miss 表示・集計
```

Result Settlement は「ゼロからの新規実装」ではなく、既存ロジックの補完 / 自動化フェーズとして扱う。

今後必要になる可能性がある限定的改善：

- result 入力 UI の安全性確認
- `result.winner` の型・値の揺れ防止
- winner 修正時の影響範囲整理
- 将来の派生キャッシュ設計
- audit metadata / result source / checkedAt の必要性検討

これらは `outcome` 権威値化とは別問題として扱う。

## result.winner 安全性確認 / Candidate ID 前提調査

### 調査概要

Result Settlement の SoT を `events/{id}.result.winner` に確定したことを受け、winner の入力・保存・突合が安全か、および Candidate ID / Canonical Identity 導入の要否を読み取り専用で調査した。
コード読解に加え、本番 Firestore は保存済み運用方針（script / REST 直接接続は行わない）に従い、Firebase Console の目視確認のみで裏取りした。コード変更・Firestore write・commit（本記録を除く）はなし。

この記録は設計判断の記録であり、Candidate ID 実装・候補編集警告実装・Settlement 追加実装の指示ではない。

### 1. winner入力は構造的に安全

- `result.winner` は `app/admin/results/page.tsx` の `<select>` から選択される。自由入力欄は存在しない。
- 通常経路では `<select>` の `<option>` は `getCandidates(event)` が返す配列のみで構成されるため、UI上は候補外の値を選べない（fallback の扱いは 3 節参照）。
- `saveResult()` は `winner.trim()` を保存し、空文字の場合は `result: null` に戻す（`app/admin/results/page.tsx`）。同様の `.trim()` は `app/admin/edit/[id]/page.tsx` の `saveEvent()` にもある。
- winner 未設定時は `getResultWinner()` が `undefined/null/""` を一律 `""` に正規化し、`ranking` / `ai/[slug]` / `race/[slug]` / `my-ai` 系画面すべてが同じ経路で pending 扱いにする（一貫性を確認済み）。

### 2. prediction.main は候補ホワイトリスト経由

- 実AIプロバイダ（openai-compatible / gemini / anthropic の3経路すべて）は `lib/ai/parse.ts` の `parsePredictionOutput()` を経由する。
- `parsePredictionOutput()` 内の `pickCandidate()` は `candidates.includes(v)` による完全一致ホワイトリスト判定を行う。AIが候補外の自由文字列を返しても、そのまま保存されず `candidates[0] ?? "未定"` にフォールバックする。
- mock 経路（`app/api/generate-prediction/route.ts` の `pickTopThree()`）も、`normalizeCandidates()` で trim 済みの `candidates` 配列を rotate して返すのみで、候補外の値を生成しない。
- admin作成時（`app/admin/page.tsx`）・edit再生成時（`app/admin/edit/[id]/page.tsx`）とも、event 保存に使う `candidates` 変数とAI予測生成リクエストに渡す `candidates` は同一変数であり、生成時点では母集団は一致する。

### 3. getCandidates fallback の追加発見

- `app/admin/results/page.tsx` の `getCandidates(event)` は、`event.candidates` が空でなければそれをそのまま返す。
- `event.candidates` が空の場合のみ、`event.predictions` の `main / second / third` から winner 選択肢を再構成する fallback がある。legacy データ・候補配列欠損データの救済として機能する。
- そのため「winner は常に `event.candidates` 由来」と単純化しない。正しくは「通常は `event.candidates`、`event.candidates` が空のときのみ predictions 由来 fallback」。fallback 経路では母集団は「predictions 自身の集合」になるが、winner はその集合内からしか選べないため選択肢外に出ることはない。

### 4. 正規化と判定 helper

- `getResultWinner()`（`lib/events.ts`）は `event.result?.winner || event.resultWinner || ""` を trim して返す。
- `getPredictionStatus(prediction, resultWinner)` は `prediction.main` と `resultWinner` の両側を trim してから `===` で比較する（3値: hit/miss/pending）。
- `getPredictionDisplayStatus()` は `isCountablePrediction()` が false（mock / main空）の場合に `unavailable` を返し、それ以外は `getPredictionStatus()` に委譲する。
- `normalizeEventDocToEvent()`（`events` コレクションの実読み込み経路）にも同等の動的判定ロジックが独立して存在し、`p.main?.trim() === winner` で hit/miss をメモリ上でのみ補完する。
- 比較は文字列ベースの厳密等価だが、通常経路では winner・prediction.main とも同じ trim 済み candidates 母集団に由来するため、表記揺れによる誤判定リスクは構造的に低い。
- `outcome` は非権威フィールドであり、表示・ranking・stats はすべて `result.winner` ベースの動的計算を使う（698節の既存調査を再確認）。

### 5. 候補編集ドリフト経路はコード上存在

- `app/admin/edit/[id]/page.tsx` の `saveEvent()` は `event.candidates` を含む event ドキュメントを更新するが、`predictions` サブコレクションには一切書き込まない。
- そのため、候補テキストを事後編集し、影響を受ける予測を再生成しない場合、既存の `prediction.main` が新しい `event.candidates` から外れる可能性がコード上ある。
- `resultWinner` には自己防衛機構があり（候補テキスト編集時、新候補に含まれなくなれば自動クリアされる）が、同様の保護は `predictions.main` には存在しない。
- 公式AI予測は `generatePrediction()` / `generateAllPredictions()` で手動再生成できるが、My AI（`source: "user"`）予測は一括再生成の対象外であり、UI文言でも「My AIの予測はそのまま残ります」と明示されている。特に取り残されやすい。
- 現行UIには「候補リストを変更した場合は、公式AI予測も再生成してください」等の静的な注意書きが2箇所あるが、保存時の強制チェックや再生成必須化のロジックはない。
- これは silent hit→miss 化の潜在経路である。ただし本番実害は 6 節の Firebase Console 目視確認では検出されなかった。

### 6. Firebase Console 目視確認結果

本番 Firestore への script / REST 直接接続は、保存済み運用方針に従い実施しなかった。全 13 events / 61 predictions を Firebase Console で目視確認した。

- フル確認：`8kUrRnIAPuIHfjhSCchK`（ウィザーズVSブルズ、category: nba、candidates: `["ウィザーズ", "ブルズ"]`、winner: `ウィザーズ`）— official AI 4件 + My AI 1件（`マイケル・ジョーダンAI` / `source: "user"` / `myAiId` あり）を確認し、全 `prediction.main` が candidates に完全一致。
- フル確認：日本VSオランダ — 全5 prediction が candidates に完全一致。
- 残り11イベントも Firebase Console 目視でドリフトなしを確認。

結論：

- 本番ドリフト実在なし（生の完全一致ベースでも trim後一致ベースでも不一致は検出されなかった）
- official AI drift なし
- My AI drift なし

### 7. stale pending の実例確認

- 上記 `8kUrRnIAPuIHfjhSCchK`（ウィザーズVSブルズ）で、winner は `ウィザーズ`、ChatGPT の `prediction.main` は `ブルズ`。動的計算では miss になる。
- ただし stored `outcome` は `pending` のままだった。これは 721節「outcome の書き込み箇所」に記録済みの stale pending 実例（結果確定後に予測を再生成し `outcome:"pending"` にリセットされたケース）と同一事象であることを、本調査で改めて確認した。
- `outcome` が非権威フィールドであり、Result Settlement の SoT が `events/{id}.result.winner` であることを再確認した。表示・ranking・stats は動的判定を使うため、現時点で実害はない。

### 8. Candidate ID 判定

```
Candidate ID は MVP直近では不要。
ただし再検討条件あり。
```

判断根拠：

- winner と prediction.main は通常経路で同じ candidates 母集団から来る（1〜2節）。
- `pickCandidate()` によって候補外の自由文字列がそのまま保存される経路が構造的に防がれている。
- Firebase Console による本番確認（6節）でも、生の完全一致・trim後一致のいずれの基準でもドリフトは検出されなかった。
- 5節の候補編集ドリフトは実在する経路だが、Candidate ID を導入しても「管理者が候補配列自体を書き換え、かつ再生成しない」という運用上の問題までは解決しない。MVPでは編集時警告・影響チェック・再生成促進の方が低コストで直接的。

再検討条件：

- 本番で `prediction.main` が `event.candidates` から外れる実ドリフトが将来見つかった場合
- 候補編集機能を拡張する場合
- My AI 外部API化（方針13.4）により、ホワイトリスト外の値が入りうる設計に変わった場合
- 多カテゴリ展開で候補同一性が複雑化した場合
- 外部データ連携により候補の別名・ID・表記揺れ管理が必要になった場合

### 9. 今後の対応候補（実装未確定）

- 候補編集時に、既存 `predictions.main` が新 `candidates` に含まれるかチェックする
- 外れる prediction がある場合、保存前に警告する
- 公式AI予測の再生成を促す
- My AI予測は一括再生成対象外であることを admin/edit 画面上により明示する
- admin/edit 画面に「候補編集により既存予測とズレる可能性」をより強く表示する
- Candidate ID は将来の再検討候補として保留する

いずれも本記録時点では実装しない。

## Firestore バックアップ確立(2026-07-04)

### 設定完了項目

- Blaze プラン切り替え済み
- 予算アラート設定済み
  - Google Cloud Billing
  - 月額 ¥1,000
  - しきい値 50% / 90% / 100%
  - 予算アラートは通知であり、課金停止ではない
- PITR 有効化済み
  - 保持 7日
  - 1分粒度
  - 記録開始: 2026-07-03 20:02 UTC+9
- Firestore 日次スケジュールバックアップ設定済み
  - daily
  - retention 30日
  - 初回スナップショット生成: 2026-07-04

### Retention and Cost Tradeoff

- 現状データは極小規模
  - 13 events
  - 61 predictions
- 現状ではコストは無視できる範囲
- PITR 7日を超える中期保険として30日を選択
- 最大98日固定にはしていない
- データ量増加時に retention は見直す前提

### Restore test 結果

- 本番 `(default)` には復元していない
- 新DB `restore-test-20260704` へ復元
- 復元後に確認した項目
  - events 13件
  - predictions subcollection
  - result.winner
  - prediction.main
  - source / predictionSource
  - legacy races
- restore test 成功
- テストDB `restore-test-20260704` は確認後に削除済み
- 本番 `(default)` は無傷
- バックアップ取得だけでなく、復元できることまで確認済み

### Operational conclusion

- Firestore backup phase is complete
- write / migration 系フェーズへ進む前提条件を満たした
- 今後の write / migration 作業前には、必ず最新バックアップの存在を確認する
- `docs/FIRESTORE_BACKUP_PROCEDURE.md` の Pre-Write Phase Checklist に従う
- Firestore / Google Cloud Console 操作は人間が行う
- Claude Code は記録・手順書・確認リスト作成のみ担当
- 本番DBへ直接 restore しない
- restore / clone は必ず新DBで確認する

## 候補編集drift予防 実装(2026-07-04)

### 背景

- winner安全性調査（本ドキュメント「result.winner 安全性確認 / Candidate ID 前提調査」節）で確認された、唯一の実在drift経路への予防的ハードニング
- drift経路：`saveEvent()` が `events/{id}` の `candidates` を更新しても、既存 `predictions.main` を追従させない
- 本番実害は未検出（Firebase Console目視確認済み、既存調査参照）
- 今回は実害対応ではなく、予防目的の実装

### 実装内容

- 採用案：B案（保存前drift検出 + confirm、blockはしない）
- 対象ファイル：`app/admin/edit/[id]/page.tsx`
- `saveEvent()` の Firestore write 前に drift 検出を追加
- drift がある場合のみ confirm を表示
- Cancel なら保存中断
- OK なら従来どおり保存継続
- Firestore 書き込み構造は変更していない

### drift判定基準

- `prediction.main.trim()` が、新しい `candidates` の trim 後集合に含まれない場合に drift 対象
- 比較は trim 後で行う（既存 `getPredictionStatus()` の正規化粒度と揃える）
- mock / non-countable は除外
  - `isMock === true`
  - `predictionSource === "mock"`
  - `prediction.main` なし
  - `prediction.main.trim()` が空

### warning仕様

- confirm では official AI と My AI / user prediction を件数分離して表示
- My AI / user prediction の判定基準：`source === "user"` または `myAiId` が存在
- 最大5件まで詳細を表示、6件以上は「他N件」と表示
- confirm 文面に以下を明記
  - 保存後は公式AI予測の再生成を推奨
  - My AI / user prediction は自動更新されない

### helper方針

- `findDriftedPredictions` は `app/admin/edit/[id]/page.tsx` 内のローカル関数として実装
- `lib/events.ts` などへの共通helper切り出しは行っていない
- 理由：
  - 今回は admin/edit 専用のUI警告であるため
  - 将来、他画面でも再利用する必要が出たら共通helperへ昇格する

### 動作確認

- ローカル `npm run dev` で確認済み
- 対象イベント：`8kUrRnIAPuIHfjhSCchK`（ウィザーズ vs ブルズ）
- 候補 `ウィザーズ` を一時的に `ウィザーズ_test` に変更して drift 状態を作成
- confirm が1回発火
- confirm 文面で以下を確認
  - 公式AI: 1件
  - My AI / user prediction: 0件
  - 詳細: `Gemini: ウィザーズ`
  - `My AI / user prediction は自動更新されません`
- Cancel 相当で保存中断を確認
- 保存成功alertは発火しなかった
- OK保存は行っていない
- リロード後、候補リストと result winner が元のままであることを確認
- 本番Firestoreには不要な変更を保存していない

### やらなかったこと

- `predictions.main` の自動書き換えはしていない
- official AI / My AI の自動再生成はしていない
- 保存の hard block はしていない
- `result.winner` は変更していない
- `outcome` は変更していない
- stored `outcome` を権威化していない
- Candidate ID は導入していない
- Firestore schema変更はしていない
- migration はしていない
- firestore.rules は変更していない

### commit / push

- implementation commit: `4f7dd79 feat(admin): warn on candidate edit drift before save`
- push済み
- origin/main 反映済み

## settledAt 導入 Step 1(saveResult主経路)

### 位置づけ

- Step 1（saveResult主経路のみ）
- 「settledAt導入完了」ではない

### 定義

- `result.settledAt` = そのeventに初めて `result.winner` が保存された時刻
- 初回確定時刻として扱う

### 挙動

- winner修正時は settledAt を更新しない
- 既存 settledAt は保持する
- legacy（winnerあり・settledAtなし）は再編集しても settledAt を後付けしない
- retroactive backfill しない
- winner clear時は既存どおり `result: null` に戻す

### 実装

- `app/admin/results/page.tsx` の `saveResult()` に3条件分岐を追加
- trimmedWinner非空 かつ previousSettledAt無し かつ previousWinner無し の場合のみ settledAt を新規付与
- `lib/events.ts` の result型に optional `settledAt` を追加

### 非接触

- `result.winner` のSoT性
- `getResultWinner()`
- ranking
- stats
- 確定判定（`getResultWinner` 真偽値）
- stored outcome
- mock / non-countable 除外
- 以上はいずれも無変更

### Known Uncovered Write Paths

- createEvent（`app/admin/page.tsx`）経由の `result.winner` 書き込みには settledAt が付かない
- saveEvent（`app/admin/edit/[id]/page.tsx`）経由の `result.winner` 書き込みには settledAt が付かない
- この2経路からの結果入力は winnerあり・settledAtなし を生む
- 次PRで対応し、3経路分散するなら共通helper化を検討する

### 別PR / 今回スコープ外

- resultUpdatedAt
- resultSource
- result revision履歴
- 結果確定後のprediction再生成guard
- settledAt表示UI

### 後方互換

- winnerあり・settledAtなし = 確定済みだが時刻不明
- 既存データはこの状態を許容する
- 読み側は settledAt 欠損を許容する

### 動作確認

- 通常運用で次に結果入力する際、Firebase Consoleで `result.settledAt` 付与を確認する
- 本番テスト書き込みはしない

### commit

- `abaaadd feat(settlement): record result.settledAt on first winner save`
- pushed to main

## settledAt 導入 Step 2(saveEvent経路)

### 位置づけ

- Step 2
- `app/admin/edit/[id]/page.tsx` の saveEvent 経路に settledAt 対応を追加
- Step 1（saveResult）と同型の既存イベント編集経路への対応
- 「settledAt導入完了」ではない
- createEvent は未対応で Step 3 に残る

### 定義

- `result.settledAt` = そのeventに初めて `result.winner` が保存された時刻
- 初回確定時刻として扱う

### 挙動

- 未確定イベントに winner を新規設定した場合のみ settledAt を付与
- winner修正時は settledAt を更新しない
- 既存 settledAt は保持する
- legacy（winnerあり・settledAtなし）は再編集しても settledAt を後付けしない
- retroactive backfill しない
- winner clear時は `result: null` に戻す

### 実装

- `app/admin/edit/[id]/page.tsx` の `saveEvent()` 内、resultValue 構築部分のみ変更
- `previousWinner = event?.result?.winner`
- `previousSettledAt = event?.result?.settledAt`
- previousSettledAt があれば保持
- previousSettledAt がなく previousWinner もない場合だけ `serverTimestamp()` を付与
- helper化はしていない
- `lib/events.ts` は変更していない
- `app/admin/results/page.tsx` の saveResult は変更していない
- `app/admin/page.tsx` の createEvent は変更していない

### 非接触

- candidate edit drift warning
- `findDriftedPredictions`
- `window.confirm`
- category / title / venue / startsAt / candidates の更新
- `result.winner` のSoT性
- `getResultWinner`
- ranking
- stats
- 確定判定
- stored outcome
- mock / non-countable 除外
- 以上はいずれも無変更

### Known Uncovered Write Path

- `app/admin/page.tsx` の createEvent 経路は未対応
- createEvent経由で resultWinner を保存した場合、まだ settledAt は付かない
- Step 3で対応予定

### 別PR / 今回スコープ外

- createEvent対応
- helper化
- resultUpdatedAt
- resultSource
- result revision履歴
- 結果確定後のprediction再生成guard
- settledAt表示UI
- Firestore migration
- retroactive backfill

### 動作確認

- npm run build 成功
- git diff --check 成功
- 本番Firestoreへのテスト書き込みはしていない
- 通常運用で次に admin/edit から結果入力・修正する際、Firebase Consoleで `result.settledAt` の付与・保持を確認する方針

### commit

- `baed39e feat(settlement): record result.settledAt on saveEvent path`
- pushed to main

## settledAt 導入 Step 3(createEvent経路) / 全経路完了

### 位置づけ

- Step 3
- `app/admin/page.tsx` の createEvent 経路に settledAt 対応を追加
- createEvent は新規作成経路のため、既存 result は構造的に存在しない
- そのため Step 1 / Step 2 の previousWinner / previousSettledAt / legacy 判定は不要
- winner が入力されていれば、常に初回確定として `settledAt: serverTimestamp()` を付与する
- winner 未入力時は `result: null` の既存挙動を維持

### 全経路完了

- saveResult 経路: `abaaadd feat(settlement): record result.settledAt on first winner save`
- saveEvent 経路: `baed39e feat(settlement): record result.settledAt on saveEvent path`
- createEvent 経路: `603eb5b feat(settlement): record result.settledAt on createEvent path (Step 3)`
- 既知の result.winner 書き込み3経路すべてに settledAt 付与が揃った
- Known Uncovered Write Path は解消

### 定義

- `result.settledAt` = そのeventに初めて `result.winner` が保存された時刻
- 初回確定時刻として扱う
- `result.winner` が確定判定のSoT
- settledAt は補助メタデータ

### Step 3の挙動

- createEvent で winner 入力あり:
  - `result: { winner, settledAt: serverTimestamp() }`
- createEvent で winner 未入力:
  - `result: null`
- createEvent は新規作成なので legacy 判定は存在しない
- retroactive backfill はしない

### Step 1 / Step 2との一貫性

- saveResult / saveEvent では、既存イベント編集のため3条件分岐を維持
- winner修正時は settledAt を更新しない
- 既存 settledAt は保持する
- legacy（winnerあり・settledAtなし）は再編集しても settledAt を後付けしない
- winner clear時は `result: null` に戻す
- createEvent は新規作成のため、winner があれば常に初回確定として settledAt を付与する

### 非接触

- predictions サブコレクション
- prediction.outcome
- outcome:"pending"
- ranking
- stats
- 確定判定
- `getResultWinner`
- `getPredictionStatus`
- `isCountablePrediction`
- mock / non-countable 除外
- candidates / title / venue / startsAt / category / slug / predictionCount
- createdAt / updatedAt
- saveResult
- saveEvent
- `lib/events.ts`
- Firestore rules
- migration
- 以上はいずれも無変更

### helper化判断

- 現時点では helper化を見送る
- 理由:
  - saveResult / saveEvent は既存イベント編集経路で、同一の3条件分岐
  - createEvent は新規作成経路で、winner があれば常に settledAt 付与の単純ケース
  - createEvent だけ条件が異なるため、3経路を無理に1つのhelperへ吸収すると、呼び出し側から条件が見えにくくなる
  - 現状の重複は if 2段 × 2箇所程度で小さい
  - 今は各経路で条件が明示されている可読性を優先する
- 将来 resultUpdatedAt / resultSource / result revision履歴など settlement metadata が増える段階で再検討する

### 別PR / 今回スコープ外

- resultUpdatedAt
- resultSource
- result revision履歴
- 結果確定後のprediction再生成guard
- settledAt表示UI
- Firestore migration
- retroactive backfill
- helper化

### 動作確認

- npm run build 成功
- git diff --check 成功
- 本番Firestoreへのテスト書き込みはしていない
- 通常運用で次に admin から winner 入力ありの event 作成を行う自然な機会に、Firebase Consoleで `result.settledAt` 付与を確認する方針

### commit

- `603eb5b feat(settlement): record result.settledAt on createEvent path (Step 3)`
- pushed to main

## 結果確定後 prediction 再生成 guard Step 1(admin/edit)

### 背景

- winner安全性調査・settledAt調査で、結果確定後に prediction を再生成できる信頼性リスクが確認されていた
- 確定後に再生成された prediction は predictedAt が現在時刻に更新され、outcome:"pending" に戻り、既存predictionを上書きし得る
- isCountablePrediction / ranking / stats は predictedAt と settledAt の時系列を見ないため、事後生成データが分母に混ざるリスクがある
- 本番でも、ウィザーズVSブルズのChatGPT、阪神vs巨人のGrok が結果確定後に再生成された実例として MIGRATION_STATUS.md に記録済み
- 「予測は事前に行われたものだけを記録する」という信頼性方針に基づき、事後生成を予防する
- Grok欠落8件で「後追い再生成しない」と決めた思想と同じ

### 方針

- warning + confirm ではなく block を採用
- confirm はOKすれば事後生成データが作れてしまうため、信頼性対策として不十分
- postSettlementGenerated flag + 集計除外は、ranking / stats / 表示設計を伴うため今回スコープ外
- 今回は事後生成データを構造的に作らせないことを優先する

### 実装

- 対象ファイル: `app/admin/edit/[id]/page.tsx`
- `isResultSettled` を追加
- 判定は `Boolean(event?.result?.winner || event?.result?.settledAt)`
- `result.winner` が確定判定のSoT
- `settledAt` は防御的な補助シグナル
- settledAtあり / winnerなし の不整合状態も確定済みとして block 対象
- `generatePrediction()` 冒頭に function-level block を追加
- `generateAllPredictions()` 冒頭にも function-level block を追加
- 確定済みeventでは `batch.set` まで到達しない
- 単体AI再生成ボタンに `isResultSettled` を disabled 条件として追加
- 全AI再生成ボタンにも `isResultSettled` を disabled 条件として追加
- 確定済み時は「結果確定済みのため、予測の生成・再生成はできません。」の理由文を表示

### 二段guard

- UI disable:
  - 確定済みeventでは単体AI再生成ボタンを押せない
  - 確定済みeventでは全AI再生成ボタンを押せない

- function-level block:
  - UIをすり抜けても `generatePrediction()` で return
  - `generateAllPredictions()` でも return
  - `generateAllPredictions()` は1回だけ alert して return
  - `generatePrediction(aiName, true)` の silent 呼び出しにより alert 連打を避ける構造

### 期待挙動

- 未確定event:
  - 単体AI再生成可能
  - 全AI再生成可能
  - 既存どおり prediction 生成可能

- result.winnerあり:
  - 単体AI再生成ボタン disabled
  - 全AI再生成ボタン disabled
  - `generatePrediction()` を直接呼んでも return
  - `generateAllPredictions()` を直接呼んでも return
  - `batch.set` まで到達しない
  - predictedAt を更新しない
  - outcome:"pending" に戻さない
  - 既存predictionを上書きしない

- result.winner + settledAtあり:
  - 同様に block

- settledAtあり / winnerなし:
  - 通常は作らない不整合状態だが、防御的に block

### 非接触

- outcome:"pending" の書き込み内容
- predictedAt: serverTimestamp() の書き込み内容
- batch.set の prediction 書き込み構造
- saveEvent の resultValue / settledAt 実装
- saveEvent の category / title / venue / startsAt / candidates 更新
- saveResult
- createEvent
- `lib/events.ts`
- ranking
- stats
- `getResultWinner`
- `getPredictionStatus`
- `isCountablePrediction`
- Firestore rules
- migration
- postSettlementGenerated flag
- 以上はいずれも無変更

### saveEvent非接触

- 同じ `app/admin/edit/[id]/page.tsx` 内にある saveEvent は今回止めていない
- 確定済みイベントでも、イベント情報・候補・結果修正・削除自体は引き続き可能
- 今回止めるのは prediction の生成・再生成のみ

### ローカル目視確認

- 実施済み
- 対象event: ウィザーズVSブルズ `8kUrRnIAPuIHfjhSCchK`
- admin/edit で確定済みeventを表示
- 全AI再生成ボタン disabled を確認
- ChatGPT再生成 / Grok生成を含む公式AI個別ボタン disabled を確認
- 「結果確定済みのため、予測の生成・再生成はできません。」の表示を確認
- 通常時の候補編集案内文が非表示であることも確認
- ボタンはクリックしていない
- 本番Firestoreへのテスト書き込みなし
- ブラウザ自動化の screenshot/find は Firestore の永続WebSocket接続による document_idle 待機でタイムアウトしたため、javascript_tool による DOM readyState / disabled 属性確認に切り替えた
- ページ自体は正常ロード済みで、DOM検査結果は有効

### 残る判断 / Known

- createEvent時に winner 入力済みで prediction も生成する「同時生成ケース」は今回スコープ外
- これは既存確定済みeventの事後再生成ではなく、作成時の同時生成であり性質が異なる
- 必要なら別PRで扱う
- 将来 Grok欠落補完など正当な例外生成が必要になった場合は、postSettlementGenerated flag + ranking/stats除外 + 表示設計を別フェーズで検討する
- 現時点では例外経路を作らず、blockを優先

### 動作確認

- npm run build 成功
- git diff --check 成功
- ローカルDOM確認済み
- 本番Firestoreへのテスト書き込みなし

### commit

- `222b685 feat(admin): block prediction regeneration on settled events`
- pushed to main

## guard Step 2(Case E): createEvent 同時生成ケースの判断

### 背景

- Post-Settlement Prediction Regeneration Guard Step 1 では、admin/edit の確定後 prediction 再生成を block した
- Step 1 の対象は、既存の結果確定済みeventに対して後から prediction を再生成できる事後生成リスクだった
- 残る論点として、createEvent 時に winner 入力済みで prediction も生成する Case E を調査した
- Case E は「結果確定後に後から prediction を足す」のではなく、event作成時に result と prediction を同時に保存するケース

### 調査で確認したこと

- createEvent の winner入力欄はデフォルト空
- 未来イベントの通常作成では winner は空のまま作成される
- winner を入れて作成した場合、predictions と result(winner + settledAt) は同一 batch で保存される
- prediction.predictedAt は serverTimestamp()
- result.settledAt も serverTimestamp()
- predictedAt と settledAt は同一 batch 内で付与されるため、時系列上はほぼ同時
- Step 1 が防いだ predictedAt > settledAt の事後生成とは性質が異なる

### 2つの実態パターン

- パターン1: 未来イベント登録時の誤入力
  - 本来 winner は空のはずだが、誤って winner を入れてしまうケース
  - デフォルト空なので、うっかり埋まるというより、明示的に入力しない限り発生しにくい

- パターン2: 過去イベントの結果込み投入
  - 過去に終わったイベントを、result と prediction を含めて手動投入するケース
  - ダミーデータ・過去イベント投入・検証データ投入として正当な運用になり得る
  - block するとこの正当用途を阻害する

### 判断

- Case E は guard不要と判断する
- block は行わない
- warning + confirm も今回は行わない
- UI copy の追加もしない
- flag保存もしない

### 理由

- Case E は時系列上、事後生成ではなく同時生成
- Step 1 の「確定後に prediction を後から足さない」という線には直接抵触しない
- winner入力欄はデフォルト空であり、誤入力リスクは限定的
- 過去イベント投入という正当用途が存在し得る
- block は強すぎる
- warning は正当な過去投入のたびにノイズになる可能性がある
- postSettlementGenerated flag や類似flagは、ranking/stats除外や表示設計を伴うため今回スコープ外
- 同時投入された prediction が本当に事前に作られたものかどうかは、UI guard ではなく運用ルール・データソース信頼性の問題

### Step 1との整合

- Step 1:
  - 確定済みeventに対する後追い再生成を block
  - predictedAt が settlement 後になる事後生成を防いだ

- Case E:
  - event作成時に result と prediction が同時に保存される
  - predictedAt と settledAt はほぼ同時
  - Step 1 と同じ block ルールを機械的に適用する対象ではない

### 非実装

今回、以下は実装しない。

- createEvent の block
- createEvent の warning + confirm
- winner欄の UI copy 追加
- simultaneousResultPrediction などのflag追加
- postSettlementGenerated flag追加
- ranking / stats 除外
- outcome の意味変更
- result.winner のSoT変更
- result.settledAt の意味変更
- migration
- Firestore rules変更

### 再検討条件

以下の場合は、Case E guard を再検討する。

- createEvent の winner欄が将来、誤って埋まりやすいUIに変わった場合
- 過去イベント投入の運用が廃止され、winner入力が誤操作しか生まなくなった場合
- 同時投入predictionの信頼性が問題化し、データソース単位の区別が必要になった場合
- 外部公開・ランキング集計において、同時投入predictionを明確に区別する必要が出た場合
- historical import / demo data / verified pre-event prediction などのデータ種別管理が必要になった場合

### 残る設計論点

- 将来、過去イベント投入を正式運用するなら、predictionSource / importSource / verifiedPreEvent などのデータ由来管理を検討する余地がある
- ただし、これは Case E のguardではなく、データ出所・監査性設計の問題
- 現時点では最小MVPの信頼性方針として、admin/edit の事後再生成blockまでで十分

### 結論

- Case E は未対応の穴ではない
- 調査の結果、Step 1の事後生成リスクとは別物と判断
- 現時点では guard不要
- 実装PRは作らない
- 判断をdocsに記録してクローズ

## Public UI Primary Accent Alignment (commit 9773279)

確定デザインSoT(primary accent = Kompari Green #0A7A3F、青は情報用副次色)への整合として、公開UIで primary accent として誤用されていた青を brand token に置換した。

### Code commit

- `9773279 style: align public UI primary accent to Kompari Green`

### 追加

- `app/globals.css` の `@theme inline` に brand token 3種を追加
  - `--color-brand: #0A7A3F`
  - `--color-brand-soft: #22C55E`
  - `--color-brand-tint: #E8F5EE`
- `--color-brand-soft` はヒーローグラデーションの明側専用として用途制限コメントを追加

### 置換対象

以下の公開UI primary accent 用途を brand token に置換した。

- BottomNav active
- TopBar ロゴ / メニュー active
- 各ヒーローグラデーション
- 主要CTA
- 主見出し強調
- AIコンセンサス本命強調
- AI支持率強調

### 意図的に維持した blue

以下は info / state / category / brand identification として意味を持つため維持した。

- 判定待ち / 予測中バッジ
- consensus lean chip
- カテゴリバッジ
- 候補順位バッジ（非勝者blue / 勝者green の状態対比）
- 対抗ラベル
- Gemini識別色
- 検索focus ring
- データ根拠を見る toggle

### 非対象

以下は今回触っていない。

- admin
- MyAI
- 法務ページ
- hit/miss 判定ロジック
- ranking / stats 計算
- trust UI
- /results
- body背景グラデーション
- Design System 全面移行

### Validation

- npm run build succeeded
- brand-soft はヒーローグラデーション内、token定義、用途制限コメントに限定
- CTA / text / badge / progress bar への brand-soft 誤用なし
- blue residue check で GREEN候補の置換漏れなし
- 残存 blue は BLUE維持として意図的に残したもののみ

### Known follow-ups

- globals.css の body背景に残る濃紺グラデーションは白基調SoTとの整合観点で別途確認する
- 今回は brand token の最小追加のみ。primary / info / surface / ink 等の semantic token 全面整備は Design System 移行PRに委ねる
- 結果ページ / trust UI 設計は別タスクとして継続する

## Hotfix: brand token runtime CSS variable 化 (commit 92a88bb)

Public UI Primary Accent Alignment（commit 9773279）の副作用として、全ヒーロー（home / races / race detail / ranking / TopBar ハンバーガーヘッダー）の背景グラデーションが白飛びしていた不具合を修正した。

### 原因

Tailwind v4 の `@theme inline` に定義した変数は、utility クラス生成時にリテラル値へ展開されるのみで、`:root` に実CSS変数として出力されない。

そのため `bg-brand` / `text-brand` などのクラス経由は正常動作するが、インラインstyleに手書きした `linear-gradient(..., var(--color-brand) ...)` は参照先の実CSS変数が存在せず、ブラウザが background 宣言ごと破棄し、computed backgroundImage が none になっていた。

### 修正

`app/globals.css` の `:root` に brand token 3種を明示追加。

- `--color-brand: #0A7A3F`
- `--color-brand-soft: #22C55E`
- `--color-brand-tint: #E8F5EE`

`@theme inline` 側は無変更。これにより class 経由と inline style の `var()` 参照の両方が動作する。

インラインstyle 5箇所の直値置換は不要だった。

### 実測確認

getComputedStyle で `--color-brand` が空でないこと、ヒーローの computed backgroundImage が正しいグラデーションに解決することを直接確認。

race detail / home の両ヒーロー復活を目視確認。

## trust UI Phase 1: 予測 vs 結果 並置 (commit aad5f68)

race detail の PredictionCard に「答え合わせ」ブロックを追加。

本命（予測）と result.winner（結果）を近接表示し、予測から結果への対比をカード上部で読めるようにした。

### 実装

- Picks（本命 / 対抗 / 穴）の直後、reason より前に答え合わせブロックを挿入
- 表示: `予測: {prediction.main} → 結果: {resultWinner || "未確定"}`
- 記号 ◯ / ✕ は使わず矢印のみ
- 的中 / 外れの色表現は右上の既存判定バッジに一任
- 旧下段「結果:」ブロックは撤去し、二重表示を防止
- `isCountablePrediction` で gating し、判定不可（mock / non-countable）カードでは非表示
- 判定ロジック `getResultWinner` / `getPredictionDisplayStatus` 等は無変更
- consensus セクションは無変更

### SoT整合

result.winner が確定判定の唯一の根拠という構造を維持。

答え合わせブロックは既存データの表示再配置のみで、新たな判定・集計を持たない。

## 検証教訓: static check では runtime CSS 不具合を検出できない

hotfix の原因である runtime CSS変数未解決は、`npm run build` 成功と `rg` 残存チェックをすり抜け、getComputedStyle 実測でのみ検出された。

### 今後の規律

インラインstyleで CSS変数 `var(--xxx)` を参照する変更、または CSS変数の定義場所を変える変更を行う場合、build / rg に加えて以下の実測を検証必須とする。

- `getComputedStyle(document.documentElement).getPropertyValue("--xxx")` が空でないこと
- 該当要素の computed style が `none` や意図しない値になっていないこと

実測できない環境では commit を保留する。

## Phase 2 候補（記録のみ・未着手）

race detail の AIコンセンサスセクションは、全AI一致でも本命が外れた場合に「全会一致」バッジが勝ち誇った緑のまま残り、コンセンサスが外れた事実を示していない。

実例: ベルギー vs エジプト。全5AI本命=ベルギー、結果=引き分け、全AI外れ。

コンセンサス答え合わせ（top consensus candidate と result.winner の突合表示）が Phase 2 の主題。

`buildConsensus` 自体は触らず、表示専用の派生で実現する。

Phase 2 は今回実装しない。

## trust UI Phase 2: AIコンセンサス答え合わせ (commit b711d17)

race detail のAIコンセンサスセクションに、結果確定後の「コンセンサス本命 vs 結果」の答え合わせ表示を追加した。
全AI一致でも本命が外れた場合、それを隠さず同一セクション内で示す。

### 実装

- Podium 直後・Split meter 直前に答え合わせブロックを挿入
- コンセンサス本命（consensusMainName）は buildPodiumData の重み付き順位（mainCount*2+secondCount）ではなく、countableOfficialPreds の prediction.main を trim 正規化して純粋集計した表示専用の派生値。同率トップは配列順で最初の候補
- resultWinner（getResultWinner 由来、trim 済み）と文字列完全一致で判定。両側 trim で比較の対称性を維持
- 3分岐: 的中（green） / 全AI外れ（red、本命が全AI一致かつ外れ） / コンセンサス外れ（amber、多数派が外し一部が的中）
- 表示条件: resultWinner あり かつ countableOfficialPreds > 0 かつ consensusMainName あり。未確定時は非表示
- buildConsensus / buildPodiumData / getConsensusChip は無変更。consensusChip（全会一致バッジ等）の既存表示も無変更

### 実機確認

- 全AI外れ（red）: ベルギー vs エジプト（全5AI本命=ベルギー、結果=引き分け）
- コンセンサス的中（green）: ハイチ vs スコットランド（4/5AI本命=スコットランド、結果=スコットランド、Claude のみ外し）
- amber は該当イベント未存在のため実機未確認。green/red が正しく出るため分岐構造は健全

### 設計メモ: Phase 1 無色 / Phase 2 色付きの理由

Phase 1（各AIカードの答え合わせ帯）は無色、Phase 2（コンセンサス答え合わせ）は色付きで、一見不統一に見えるが意図的。原則は「status の責務は一箇所が担う」。

Phase 1 は右上の判定バッジが的中/外れを担うため帯は無色でよい。
Phase 2 はセクションレベルの判定バッジが存在せず、この帯自身が唯一の status 表示となるため色を持つ。担い手が違うだけで原則は共通。

### Phase 2.5 候補（記録のみ・未着手）

少数派的中の可視化（多数派が外し少数派のAIだけが当てたケースのハイライト）は今回スコープ外。「誰が少数派か/定義/本命のみか対抗含むか」の設計が必要なため別PRとする。

## trust UI Phase 3: 結果確定時刻（settledAt）表示 (commit a6458cb)

race detail のヒーローに result.settledAt を表示。Kompari が「結果は確定後に記録されたものだ」と示す trust 表示。

### 実装

- toSettledAtDate（unknown -> Date|null）: 表示専用パーサ。firebase Timestamp を import せず、toDate 関数の有無で判定するダックタイピング。null/undefined・Date・string・number・変換失敗はすべて null にフォールバックし、想定外の型でもページを落とさない
- formatSettledAt（Date -> string）: 「M月D日 HH:mm」形式。Intl.DateTimeFormat で timeZone: "Asia/Tokyo" 固定、hourCycle: "h23"。serverTimestamp() は UTC 基準のため、TZ 固定なしだと本番（Vercel=UTC）で時刻がずれる。既存 formatStartsAt は string 前提のため流用せず別実装
- 表示位置: ヒーロー統計3タイル（候補/AI予測/結果）の直後、独立1行
- 3状態: resultWinner なし=非表示 / settledAt Date化成功=「結果確定: 時刻」/ settledAt なし・変換失敗=「結果確定済み（時刻記録なし）」
- lib/events.ts・normalizeEventDocToEvent・settledAt 型定義は無変更。getResultWinner 等の判定ロジック、Phase 1/2 の答え合わせブロックも無変更

### 検証メモ1: 主経路はローカル注入で検証、実Timestamp発火は初回確定時に確認

本番 Firestore には settledAt 付きの確定イベントが現状1件も存在しない（settledAt 導入以降、新規の結果確定書き込みがまだ行われていないため。既存確定イベントは全て導入前=legacy）。そのため Timestamp様 -> Date -> JST整形の主経路は、ローカルで toDate() を持つ一時オブジェクトを注入して検証した（表示「7月5日 14:30」で JST 正常、[object Object]/Invalid Date なし、検証後コード完全削除・rg残存0件確認）。Firestore が実際に返す Timestamp オブジェクトでの初回発火は、次に新規結果確定を行った際に実データで最終確認すること。

### 検証メモ2: legacy に現在時刻を後付けしない（設計判断）

既存 legacy イベントに admin 再保存で settledAt を付ける案は採らない。過去確定イベントに serverTimestamp() を付けると、実際の確定時刻ではなく「再保存した時刻」が記録され、Kompari の「データを正直に出す」思想に反する。legacy は「時刻記録なし」のまま残すのが正しい。settledAt は今後の新規結果確定から自然に入る。「時刻記録なし」は不完全な表示ではなく、過去データに対する正直な表示である。

## trust UI Phase 4: 結果確定後の予測書き換え trust note (commit 308387d)

race detail の結果確定済みイベントに、Kompari の運用方針を伝える1行 note を表示。「結果確定後にAI予測を書き換えない設計です。」

### 実装

- Phase 3 の settledAt 表示直下、resultWinner 条件ブロック内に独立1行
- 表示条件: resultWinner あり（settledAt の有無は問わない）。admin/edit の isResultSettled も winner 主判定のため条件を揃えた
- text-[10px] text-white/60（settledAt の text-white/70 より控えめ）
- イベント単位で1回。各AIカード・コンセンサスセクションには出さない
- 判定ロジック・Phase 1-3 表示・toSettledAtDate/formatSettledAt は無変更

### predictedAt 個別時刻表示を見送った理由

調査で predictedAt は両公式AI経路（createEvent / generatePrediction）とも serverTimestamp() 付与済み・型追加だけで表示可能と判明したが、以下の時刻揺れがあるため trust 表現には使わないと判断:

- createEvent 同時生成（Case E）: predictedAt と settledAt が同一 batch でほぼ同時刻になり、「予測が結果より先」を時刻で証明できない
- legacy: 締切ガード導入前に確定後生成された実例が現存（ウィザーズvsブルズ ChatGPT、阪神vs巨人 Grok）。個々のデータに「必ず結果確定前に作成された」と断定できない
- My AI: 書き込み経路が削除済みで、既存 legacy データの付与状況が追跡不能

将来 predictedAt を settledAt と対比表示する場合は、Case E/legacy/My AI の扱いを整理してから。

### 文言を「設計です」に抑えた理由

候補「ブロックされています」「必ず結果確定前に作成された」は不採用。

- guard はクライアント側（admin/edit の JS ロジック）のみ。firestore.rules（41-49行目）は predictions の write を isAdmin() だけで許可し、winner/settledAt を条件にしていない。ルール層での強制ではないため「ブロック」は過大主張
- legacy に確定後生成の実例があるため「必ず確定前」は個々のデータに対し偽

「設計です」= 標準管理画面での運用方針の説明にとどめ、実態と一致させた。

### 将来施策: rules レベルでの確定後 write 禁止（未実装）

firestore.rules に「result.winner/settledAt があるイベントの predictions write を拒否する」ルールを追加すれば、guard がアプリ層でなくデータアクセス層で強制され、trust note を「ブロックされています」の断定形に強化できる。ただし rules 変更は本番セキュリティに直結するため、影響範囲（admin の正当な操作を阻害しないか等）を精査してから別途検討する。

## CLAUDE.md 整地: AI予測生成の実装状況を実態に合わせて修正

CLAUDE.md のAI予測生成関連の記述が古くなっていたため整地した。実装コードの変更はなし。

- 実AI呼び出し構造（callOpenAiCompatible / callGemini / callAnthropic による provider 別呼び出し構造）は実装済み
- 本番の実AI稼働状況はAPIキー設定に依存し、今回は未確認（「実AIで本番稼働中」とは断定しない）
- APIキー未設定、または実呼び出し失敗時は mock fallback する
- 比較AIは5種（ChatGPT/Claude/Gemini/DeepSeek/Grok）。Grokは実装済み（lib/ai/official-ai.ts で正本化、commit 2960c96）
- predictions は `events/{eventId}/predictions/{predictionId}` サブコレクションに保存（races.predictions ではない）
- My AI参加の `joinMyAi` 経路は Phase 4-d-3 で削除済み。現在 active な書き込み導線はなし
- createEvent は5AI逐次呼び出し（forループ、Promise.all未使用）で、1AI失敗時はイベント作成全体が失敗する all-or-nothing 構造。failed/omitted を示す status フィールドは明示保存しておらず、失敗AIは prediction ドキュメントが存在しない「欠落」状態として扱われる
- 8.2（My AI参加とFirestore rulesの不整合）・9.3（予測データの保存先）セクションにも `races.predictions` という古い記述が残存しているが、今回の修正スコープ外のため未修正のまま残した

## CLAUDE.md 整地 hotfix: 8.2 / 9.3 の legacy prediction 記述を整理

前回スコープ外として残した8.2・9.3を修正した。実装コードの変更はなし。

- 8.2「My AI参加とFirestore rulesの不整合」: `joinMyAi` 削除済み（Phase 4-d-3）により不整合自体が解消済みである旨を明記し、legacy note として整理。将来My AI書き込みを復活させる場合の再検討事項として対策候補を残した
- 9.3「予測データの保存先」: 「未決定」から「決定済み・実装済み」に変更。正は `events/{eventId}/predictions/{predictionId}` サブコレクション（Phase 2b で移行済み）、旧 `races.predictions` 配列は legacy と明記
- `rg -n "races\.predictions" CLAUDE.md` の残存3件はすべて過去形・legacy文脈であることを確認済み（現行の保存先・書き込み経路として読める記述はゼロ）

## createEvent 部分欠落経路調査（read-only、実装変更なし）

運用報告「一括作成ボタンでイベントは作成されたが、1AIだけ予測が欠けた」ことがある、という記憶と、createEvent の all-or-nothing 構造の矛盾を read-only で調査した。

- 現在の `/admin` createEvent 一括作成経路は all-or-nothing と確認した
- `createPredictionsBeforeSave()` / `generatePredictions()` の5AIループでは、`response.ok === false` 時に throw し、skip / continue / 握りつぶし経路はない
- `route.ts` が502を返した場合も、admin 側では `response.ok === false` として throw し、部分成功で続行しない
- `batch.commit()` は予測生成完了後に実行されるため、1AI失敗時は event 本体も predictions も保存されない
- `generated` が4件だけになって batch へ進む現在コード上の経路は存在しない
- したがって、現在の `/admin` 一括作成で「イベントは作成されたが1AIだけ欠ける」は構造的に起こり得ない
- 1AIだけ欠ける状態は、現在コードでは `/admin/edit/[id]` の `generatePrediction()` / `generateAllPredictions()` 経路なら説明できる
- admin/edit は1AIごとに個別 batch commit し、失敗しても外側に例外を伝播せず、他AI処理を続けるため、部分成功が起こり得る
- 過去実装では、初期の手入力フォーム時代（API呼び出し導入前）に空欄予測を filter して保存する部分成功構造があったが、AI API呼び出し導入以降の createEvent は一貫して all-or-nothing
- 運用記憶の「一括ボタンで1AIだけ欠けた」は、現在コードから見ると admin/edit 後追い生成・全AI再生成・個別再生成との記憶混同の可能性が最も高い
- createEvent は現時点で修正不要
- failed / omitted schema や部分成功化は今すぐ実装しない
- 次に同様の欠落が再発した場合は、発生日時・操作画面（`/admin` か `/admin/edit/[id]` か）・欠落AI名を記録して再調査する

## buildStats 重複解消 read-only 調査(実装なし・現状維持で確定)

MVP本線(Ranking精度)の整地のため、stats集計の分散状況を read-only 調査した。
結論: 今すぐ実装で解消する必要はない。official 側の計算は既に一致しており、
実害のある表示ズレは確認されなかった。

### 調査で確定した現状
- 的中率の算出式(hits/finished)は5実装すべて同一
- getResultWinner / isCountablePrediction / getPredictionStatus は
  official 側(lib/stats.ts / ranking の buildRankings / ai[slug] の
  buildStats)で既に共有され正しく使われている
- 差分は3点に集約:
  1. データソース: official=events+predictions サブコレクション(SoT) /
     My AI=races コレクション(legacy、Phase 4-d-1 以降の新規は反映されず凍結)
  2. mock除外: official は isCountablePrediction 適用済み /
     My AI 系(my-ai / my-ai[id])は未適用
  3. 未確定の扱い: ranking の "ai" モードだけ total===finished(確定済みのみ)、
     "brand"/"model" モードと ai[slug] は未確定も total に含む

### 既知の負債として残す2点(今回は触らない)
1. ranking "ai" モードの total 定義が他モード("brand"/"model")と異なる。
   同じ「予測数」が画面によって確定済みのみ/全件で揺れる。
   直すと ranking の表示数値が変わる[表示変化リスク]=リファクタでなく
   仕様変更のため、将来 ranking を触る時に統一を検討。今は据え置き
2. My AI 系の isCountablePrediction 未適用 + races 凍結。
   既存記録(570・578-579行目)どおりで、今回の再調査で記録が今も正確と確認。
   My AI は公開UIから非表示化済み(preservation without display)のため
   ズレは latent(現在ユーザーに見えない)。本番実データの isMock:true は0件で
   実害も顕在化していない。My AI 再設計プロジェクトの一部としてまとめて対処

### 集約の判断
lib/metrics.ts への集約は今回見送り。official 側の helper は既に共通化済みで、
残る共通化候補([表示不変]なもの)はコード構造の整理に留まり実害改善が薄い。
[表示変化リスク]のある統一(ranking total 定義、My AI への
isCountablePrediction 追加)は仕様変更として別途扱う。

## consensus snapshot 永続化 read-only 調査（実装なし・現状維持で確定）

確定時点のコンセンサス、つまり「何AIが何を本命にしたかの分布」を Firestore に永続化すべきか read-only で調査した。

結論: 今は consensus snapshot を永続化しない。docs 記録で閉じる。

### 調査で確定した現状

- 現在のコンセンサスは `app/race/[slug]/page.tsx` で render 時に predictions から再計算している
- Firestore に保存された consensus snapshot を読む箇所は存在しない
- consensus 関連計算は複数箇所に分散している
  - `buildConsensus`
  - `buildPodiumData`
  - Phase 2 の consensus answer-check 用インライン計算
  - `getConsensusChip`
- `buildConsensus` と Phase 2 answer-check は `isCountablePrediction` を使う
- `getConsensusChip` は mock 除外 / `isCountablePrediction` の適用がなく、将来的には整理候補
- ただし現時点の本番データでは `isMock: true` が実害化していないため、緊急修正対象ではない

### 確定後 consensus drift の扱い

- 確定後にコンセンサスが失われる問題は過去に実在した
  - ウィザーズvsブルズ
  - 阪神vs巨人
- これらは guard 導入前に、結果確定後の prediction 再生成が起きた例
- guard 導入後は、通常の `admin/edit` 操作では post-settlement prediction regeneration は block 済み
- 一方、`firestore.rules` は settled event の predictions write を rules レベルでは禁止していない
- 現在の rules は admin 権限に対して predictions create / update / delete を許可しており、`result.winner` / `settledAt` の有無を条件にした制約はない
- したがって分類は「通常操作ではほぼ守られているが、rules レベルでは完全防御ではない」

### 予防（rules guard）と記録（snapshot）の整理

「確定後にコンセンサスが失われる」問題への対処には、2つのアプローチがある。

1. rules guard
   - Firestore rules で、結果確定後の predictions write を禁止する
   - 予測が変わらないようにする「予防」のアプローチ

2. consensus snapshot 永続化
   - 確定時点の consensus を Firestore に保存する
   - 仮に predictions が変わっても記録を残す「記録」のアプローチ

今回の判断では、予防である rules guard の方が snapshot より根本的。

理由:

- predictions が確定後に変わらなければ、render 時計算が常に確定時点と一致する
- その場合、snapshot の主要価値である Result UI の安定は自然に達成される
- snapshot は Firestore 書き込み増加、schema追加、live再計算との二重管理、SoT 問題を生む
- rules guard は既存の render 時計算を維持しつつ、確定後の predictions 改変を構造的に防げる

### snapshot に残る価値

rules guard で代替できない snapshot の残余価値もある。

- 確定時点の countable 判定基準の監査ログ
- 将来 `isCountablePrediction` の基準が変わった場合の復元手段
- 確定時点の prediction doc IDs / countable AI 集合の記録
- 将来の Result ページ一級市民化や分析データ資産

ただし、これらは MVP 現段階では緊急度が低い。

### 見送りの理由

- snapshot 永続化は Firestore 書き込み増加を伴う
- live 再計算と snapshot の二重管理が発生する
- snapshot と predictions がズレた場合の SoT 問題が生じる
- legacy event に snapshot なしの不均一状態が生じる
- snapshot 誤り時の修正手順が未設計
- 確定後保護は通常操作では guard により達成済み
- MVP 本線への費用対効果は高くない

### 将来やる場合の順序

1. rules guard が snapshot より先
   - 「変わっても記録する」より、「変わらないようにする」方が trust の土台としてシンプル

2. rules guard の前提条件
   - 前回 feasibility 調査では「可能だが追加調査が必要」と判定済み
   - Case E、つまり `createEvent` で predictions と result を同時生成するケースとの rules 評価整合が要確認
   - Firebase CLI / emulator 環境が未整備
   - 本番 rules 直接適用はリスクが高い
   - rules guard 着手前に emulator 環境整備が必要

3. snapshot の再検討タイミング
   - Result ページ一級市民化
   - consensus history / audit log が明確に必要になった時
   - `isCountablePrediction` など判定基準変更が具体化した時

### 副次発見

race詳細内に consensus 計算が3系統に分散している。

- `buildConsensus`
- Phase 2 answer-check 用インライン計算
- `getConsensusChip`

`getConsensusChip` だけ mock 除外 / `isCountablePrediction` が未適用。

ただし本番 `isMock: true` は実害化しておらず、現時点では低優先度。
buildStats 調査で見た構造と同型の「既知・低実害」負債として扱う。

将来 consensus 計算を触る時に統一を検討する。

## Result ページ PR-1: `/results` 一覧ページ追加

`/results` を新規追加した。

目的は、確定済みイベントの「答え合わせ一覧」を提供すること。
`/races?status=finished` は予測一覧の結果済みフィルタ、`/results` はAI予測と実際の結果を比較する答え合わせ入口として役割を分ける。

今回のスコープ:

- `/results` 一覧ページのみ
- 確定済みイベントのみ表示
- winner 表示
- consensus favorite → result の答え合わせ表示
- consensus 支持数 count / total 表示
- 既存 `/race/[slug]` へのリンク
- legacy `races` は含めない
- BottomNav / TopBar は未変更
- URL移行は未実施
- trust UI component 化は未実施

今回やらないこと:

- BottomNav 4タブ化
- TopBar変更
- `/results/[slug]`
- `/races` → `/events` 移行
- trust UI component 化
- Firestore schema / rules / write 変更

実装上の注意:

- consensus answer-check は race詳細 Phase 2 と同じ判定基準
- `/results` では1イベント分を受け取るローカル関数として一覧向けに実装
- settledAt / startsAt は Date 化してからソート
- 白基調・グリーンアクセント `#0A7A3F`

## Result ページ PR-2: ホーム導線追加

ホームの「結果入力済み」セクションのヘッダーに `/results` への導線を追加した。

今回のスコープ:

- `app/page.tsx` のみ変更
- 「結果入力済み」見出し付近に `/results` へのリンクを追加
- 既存の件数表示は維持
- 結果プレビュー対象条件は変更なし
- `finishedEvents.slice(0, 3)` は変更なし
- BottomNav / TopBar は未変更
- `/results` ページ自体は未変更

目的は、PR-1で追加した `/results` 一覧ページへ、ホームから低リスクに到達できるようにすること。

BottomNav 4タブ化は未実施。
`/results` の価値確認後に別PRで判断する。

## Firestore events/predictions はテスト fixture（本番資産ではない）

現在の Firestore の `events` / `predictions` は、UI・予測フロー・表示の動作確認のために手入力したテストデータであり、本番の歴史的資産ではない。

個別に正史データとして保持する必要はない。

Event Auto Creation 導入時に、既存の手入力テスト `events` とその `predictions` はまとめて削除し、自動生成イベントに置き換えてよい。

過去 docs で「Guard 既知実例」等として参照した個別イベントも、この fixture 前提の下では保護対象ではない。

自動化リセット後に同様の検証が必要な場合は、必要最小限の fixture を改めて投入する。

## Event Auto Creation PR-1: importer foundation

event型に source系フィールドを additive 追加(source=データ出所 / creationSource=作成経路 の2軸)。lib/event-import.ts に RawEventSource 型と変換関数、fixtures/ に競馬sample、scripts/ に dry-run を追加。Firestore書き込み・予測生成接続なし。sourceId ベースの決定的id採番で重複検出の土台を用意。実書き込みは後続PR。

## Event Auto Creation PR-2: ガード付き実書き込み importer

デフォルト dry-run、--write フラグ時のみ Firestore write。dry-run 経路では Firestore import / 初期化 / getDoc も行わず、純粋な変換とログ出力のみ。deterministic id を get で存在確認し、既存なら skip して上書きしない。source 系フィールドを書き込み、必要に応じて normalize で optional 転記(UI無変更)。予測生成・テストデータ削除は後続PR。実 --write 実行は Console 確認とセットで人間が手動実行する。

## Event Auto Creation PR-2.5: importer の --write を Admin SDK 経路に変更

client SDK 未認証実行は firestore.rules の isAdmin() を満たせず permission-denied になるため、server-side の Admin SDK に差し替え。firebase-admin 導入、scripts 用 Admin 初期化 helper、認証は GOOGLE_APPLICATION_CREDENTIALS 経由のサービスアカウント鍵パスで扱う。サービスアカウントJSON・秘密鍵は gitignore 済みで commit 禁止。.env.local.example には環境変数名のみ記載。dry-run は Firebase 非接触維持。実 --write は鍵設定 + Console確認とセットで人間が手動実行する。

## Event Auto Creation PR-3: 手入力テストデータ削除スクリプト

source未設定の event を削除対象、source設定済み(importer製)を残す機械判定。デフォルト dry-run、--delete フラグ時のみ削除。削除対象一覧と残す一覧を事前表示し、fixture-sample-race-2026-11-08-01 が残ることを確認できる。predictions サブコレクションを先に削除してから event 本体を削除し、orphan を回避。実削除は dry-run 確認後に人間が手動実行する。

## PR-3 実削除完了

人間が `scripts/delete-legacy-events/delete.ts --delete` を実行し、手入力テストデータの削除が完了した。

実行結果:

- 削除対象 events: 9件
- 削除した predictions docs: 44件
- 削除した events: 9件
- 残した source付き events: 1件
- 残った event: `fixture-sample-race-2026-11-08-01`(source=manual-fixture / creationSource=importer)
- Firebase Console で events が1件のみになったことを確認済み

削除前:

- 手入力テストevent 9件 + predictions 44件 + importer sample 1件

削除後:

- importer製sample 1件のみ(source / sourceId / sourceUrl / creationSource 保持、predictionsなし)

これにより、Event Auto Creation の土台作り(型追加・importer・Admin SDK write path・guarded deletion)は一区切りとする。次フェーズは manual-fixture ではなく、JRA 等の実データ寄りの source をどう取り込むかの検討に進む。

## PR-4a: 予測生成に mock禁止モード(allowMock)を追加

importer製 sample event(`fixture-sample-race-2026-11-08-01`)への1AI手動生成テストで「実AIの応答だけが保存される」ことを保証するため、`/api/generate-prediction` に `allowMock?: boolean` を追加した。`allowMock === false` の場合、実API呼び出し失敗(キー未設定/呼び出し例外/timeout)時に mock フォールバックへ進まず、`{ mockBlocked: true }` 付きの502を返す。`allowMock` 未指定/true は既存挙動(mock フォールバック可)を維持する。

`app/admin/edit/[id]/page.tsx` の `generatePrediction` に `options: { allowMock? }` を追加し、AI別ボタン(1AI手動生成)からのみ `{ allowMock: false }` を渡す。`generateAllPredictions`(全AI一括)は引数を変更しておらず、`allowMock` 未指定のまま = 既存挙動維持(mock フォールバック可)。API失敗時は `response.ok` チェック後の `throw` が Firestore `batch.set`/`batch.commit` より前にあるため、strict生成が失敗しても既存 prediction は上書きされない。

### P1 follow-up(未対応、別PRで扱う)

`lib/ai/parse.ts` の `pickCandidate` は、AI出力の `main`/`second`/`third` が `candidates` 配列と完全一致しない場合、無警告で `candidates[0]` 等へ差し替える。全角半角・空白・言い換え等の表記ゆれで発生しうる。この場合 `reason`/`evidence` の説明内容と実際に保存された `main` が食い違う静かなデータ不整合が起き、結果的中判定が実際のAI意図とズレる恐れがある。`allowMock=false` はこの問題を検知・防止しない(実APIが「候補外の文字列」を返した場合でも、parse.ts側で候補内の値に差し替えられるため、API自体は成功として扱われる)。対応は次回 importer製 event で実際にAI生成→表記ゆれの実例が観測されたタイミング、または本格的な外部データ取り込み(JRA等)を検討する際に着手する。

## PR-4: source付き event で中核ループ一周完結

importer製 sample event `fixture-sample-race-2026-11-08-01` で、source付き event による中核ループを一周確認した。

確認したループ:

```text
event
→ prediction
→ consensus
→ result
→ ranking
```

確認内容:

- 対象 event:
  - `events/fixture-sample-race-2026-11-08-01`
  - `source = manual-fixture`
  - `sourceId = sample-race-2026-11-08-01`
  - `creationSource = importer`
- 5AIを strict mode(`allowMock:false`)で1つずつ手動生成
  - ChatGPT
  - Claude
  - Gemini
  - DeepSeek
  - Grok
- 全 prediction で以下を確認
  - `isMock: false`
  - `predictionSource: "official-ai"`
  - `source: "official"`
  - `eventId: "fixture-sample-race-2026-11-08-01"`
  - `outcome: "pending"`
- 各AIの `main` / `second` / `third` は candidates 6件のいずれかと完全一致
- 今回の sample では candidate label 表記ゆれは発生しなかった
- 5AI本命分布:
  - ChatGPT: コンパスウィナー
  - Claude: レッドヴァリアント
  - DeepSeek: コンパスウィナー
  - Gemini: コンパスウィナー
  - Grok: コンパスウィナー
- consensus:
  - コンパスウィナー 4/5 AI
  - レッドヴァリアント 1/5 AI
- result:
  - `result.winner = "レッドヴァリアント"`
  - `result.settledAt` 記録済み
- consensus答え合わせ:
  - consensus本命: コンパスウィナー
  - result: レッドヴァリアント
  - コンセンサス外れ
- AI別判定:
  - Claude: 的中
  - ChatGPT / Gemini / DeepSeek / Grok: 外れ
- `/ranking` 反映:
  - Claude: 1戦1的中、100%
  - 他4AI: 1戦0的中、0%
  - 全体: 予測数5、的中1、的中率20%

### outcome フィールドの確認

result確定後も、5AIすべての prediction doc で `outcome: "pending"` のまま不変であることを Firestore で確認した。

これは、hit/miss を prediction doc に保存する設計ではなく、表示時・集計時に `prediction.main === result.winner` で動的判定していることを示す。

この挙動は、result訂正時の再計算漏れを避ける観点で望ましい。

ただし、`outcome: "pending"` フィールドが残り続けること自体は follow-up とする。将来このフィールドを参照する実装が入ると、動的判定方針と二重管理になる可能性がある。

### follow-up 項目

以下は未対応。優先度付きで記録する。

#### P1 / UI: confidence 自己申告値の表示

公開ページで `confidence` の自己申告値が以下のように表示されている。

```text
自信度 low%
自信度 medium%
```

問題:

- `confidence` はAIの自己申告値であり、検証可能な数値ではない
- `low / medium` は文字列であり、`%` を付ける表示は破損している
- Kompari の検証可能性原則に反する
- 5AI分並ぶと、信頼できる実績値のように見えるリスクがある

対応方針候補:

- 推奨: 公開ページから confidence 表示を非表示にする
- 代替: 表示する場合は `%` を外し、`自信度(AI申告): low` のように自己申告であることを明示する

対応タイミング:

- 中核ループ一周完了直後の最優先UI修正候補

#### P1: pickCandidate 完全一致依存

`lib/ai/parse.ts` の `pickCandidate` は、AI出力の `main` / `second` / `third` が candidates と完全一致しない場合、無警告で `candidates[0]` などに差し替える。

問題:

- 全角半角、空白、表記ゆれ、言い換えで発生しうる
- AIの reasoning と保存された `main` が食い違う可能性がある
- hit/miss 判定が実際のAI意図とズレる恐れがある

今回の sample では未発生。

対応タイミング:

- 実運用で表記ゆれが観測された時
- JRA等の外部データ取り込み時
- Candidate ID 導入検討時

#### P2: predictionCount フィールドの不一致

event doc の `predictionCount` は `0` のまま。

一方で、実際の predictions subcollection は5件存在し、公開ページの「AI予測 5」は subcollection / collectionGroup の実数で正しく表示されている。

現時点の実害:

- なし

今後の判断:

- `predictionCount` を生成時に同期するか
- 表示や集計では使わない派生キャッシュとして扱うか
- 不要なら将来廃止するか

#### P2: outcome フィールドの存在

全 prediction が result確定後も `outcome: "pending"` のまま。

hit/miss は動的判定で表示・集計されているため、現時点では `outcome` は未使用または補助的フィールドの可能性がある。

今後の判断:

- read-only 調査で `outcome` の参照箇所を確認する
- 未使用なら廃止候補
- 使用している場合は、動的判定方針との矛盾がないか確認する

#### P2: manual-fixture sample のランキング反映

今回の sample は `source = manual-fixture` の検証用 event だが、現在は `/ranking` に反映されている。

現時点では、中核ループ検証のため有効。

今後の判断:

- MVP公開前に manual-fixture / sample データをランキングに含めるかを決める
- 本番成績から除外する場合、source または creationSource による除外ルールが必要

## outcome フィールド廃止: デッドフィールドと確定し、生成時書き込み・正規化再計算・型定義を削除

read-only調査(前セクションのP2 follow-up)で、`outcome` フィールドは以下を確認した。

- 書き込み: 常に固定 `"pending"`。hit/miss で保存されるケースは存在しない
- 読み取り: `lib/events.ts` の正規化関数(`normalizeEventDocToEvent` / `normalizeRaceToEvent`)内で hit/miss を再計算していたが、その再計算結果を消費するコードは app/lib/components/scripts のどこにも存在しない
- hit/miss判定は全て `prediction.main === result.winner` の動的判定(`getPredictionStatus` / `getPredictionDisplayStatus` / `buildRankings` / `aggregateByBrand` / `aggregateByModel`)で独立して行われており、`outcome` とは無関係
- `docs/FIRESTORE_BACKUP_PROCEDURE.md` でも `outcome` は非権威(non-authoritative)と既に明記済み

以上により判定Aが確定したため、以下を削除した。

- `app/admin/page.tsx`: 新規イベント作成時の predictions サブコレクション書き込みから `outcome: "pending"` を削除
- `app/admin/edit/[id]/page.tsx`: AI予測生成/再生成時の predictions ドキュメント書き込みから `outcome: "pending"` を削除
- `lib/events.ts`: `normalizeEventDocToEvent` / `normalizeRaceToEvent` 内の hit/miss 再計算ロジック(`computedOutcome`)と、返り値オブジェクトへの `outcome` プロパティ付与を削除
- `lib/events.ts`: `KompariPrediction` / `KompariPredictionDoc` 型定義から `outcome?:` / `outcome:` フィールドを削除

hit/miss判定・consensus・ranking集計のロジック(`main === winner` の動的判定)自体には一切手を加えていない。

既存Firestore doc に保存済みの `outcome` フィールドは物理削除せず放置する(読まれないフィールドのため実害なし)。物理削除は将来のデータ整理でまとめて行う。

## 公開UIコピー・カテゴリ表示を実装済みスコープ(競馬)に整合

read-only調査で、公開UI(ホームヒーロー・イベント一覧ヘッダー・metadata・ランキング/イベント一覧のカテゴリタブ)が、未実装カテゴリ(スポーツ/株価/暗号資産/選挙等)とMy AIを実装済みのように見せていることを確認した。confidence削除・outcome廃止に続く「実体のない表示を看板から消す」対応として、以下を実施した。

- `lib/categories.ts`: `eventCategories` 本体・`EventCategory` 型はそのまま残し、公開ページ向けの派生配列 `publicEventCategories`(`horse_racing` のみ)を追加
- `app/races/page.tsx` / `app/ranking/page.tsx`: カテゴリタブの描画元を `eventCategories` → `publicEventCategories` に切替。`categoryFilter` state・フィルタロジック・集計ロジック(`buildRankings` / `aggregateByBrand` / `aggregateByModel`)は無変更
- `app/page.tsx` / `app/races/page.tsx`: ヒーロー/ヘッダーのコピーを「競馬・スポーツ・金融・選挙」等の未実装カテゴリ言及から、競馬スコープの文言に変更
- `app/layout.tsx`: `siteDescription`(`description` / `openGraph.description` / `twitter.description` が参照する単一定数)から未実装カテゴリと My AI 訴求を除去し、競馬予測比較の文言に変更

`app/admin/*` / `app/my-ai/page.tsx` のカテゴリ選択肢は `eventCategories`(全8カテゴリ)のまま変更していない。将来カテゴリを解禁する際は `publicEventCategories` のフィルタ条件を広げるだけでよい。

## manual-fixture sample event を公開ページ・公開集計から除外

read-only調査で判定Aが確定した。`source = "manual-fixture"` の importer製sample event(`fixture-sample-race-2026-11-08-01`)が、PR-4の中核ループ検証で実predictionと確定resultを持つに至ったため、`/ranking`・`/results`・`/ai/[slug]`等の公開ページに「実績」として混入していた(例: `/ranking`でClaude 1/1的中100%等の具体的な数値として反映)。

- `lib/events.ts`: event-level guard `isPublicEvent(event)` を追加。`event.source !== "manual-fixture"` の完全一致のみで判定する
  - `creationSource === "importer"` は使わない(将来の本番自動取込も同じ値を使う可能性があるため)
  - `sourceId` / `id` への文字列部分一致(`includes("sample")`等)は使わない(将来の本番データが偶然一致するリスクがあるため)
  - `source` 未設定(admin経由の通常イベント)は public 扱いのまま変更なし
  - `isCountablePrediction`(prediction-level)には混ぜていない。event-levelの別ガードとして分離
- `app/page.tsx` / `app/races/page.tsx` / `app/results/page.tsx` / `app/ranking/page.tsx` / `app/ai/[slug]/page.tsx`: events取得直後に `publicEvents = events.filter(isPublicEvent)` を導出し、featuredEvent・件数集計・一覧・結果確定判定・ranking集計(`buildRankings` / `aggregateByBrand` / `aggregateByModel`)・AI詳細成績の母集団をすべて `publicEvents` に統一。集計ロジック本体(`buildRankings`/`aggregateByBrand`/`aggregateByModel`/`getResultWinner`/`isCountablePrediction`/`getPredictionStatus`)は無変更
  - これらのページはpredictionsを `collectionGroup` で取得後 `normalizeEventDocToEvent` により各eventオブジェクトへネストして保持する設計のため、event配列を絞るだけでpredictionも連動して除外される(predictionを別途フィルタする必要はなかった)
- `app/race/[slug]/page.tsx`: 直接URLアクセス(`/race/fixture-sample-race-2026-11-08-01`)も軽微な変更で対応。正規化直後に `isPublicEvent` を判定し、falseなら既存の「イベントが見つかりません」not found状態に寄せた(詳細ページの構造変更なし)
- `app/admin/*` / `app/my-ai/*` / `lib/stats.ts` / `lib/event-import.ts` / `scripts/*` / Firestoreデータは無変更

既存sampleの物理削除、および `isSample` / `visibility` 等の明示フィールド化は別フェーズとする。実データが投入されるまでは、上記ページが軒並み空状態表示になる(既存の空状態UIをそのまま利用、崩れないことを確認済み)。

## PR-1: URL移行 /races→/events, /race/[slug]→/events/[slug]

データ層はFirestore `events` collectionに移行済みだが公開URLが`/races`・`/race/[slug]`のまま残っていたため、カテゴリ非依存のEvent概念に合わせてURLを`/events`系へ移行した。

- `app/races` → `app/events`、`app/race/[slug]` → `app/events/[slug]` へフォルダ改名(`git mv`)。旧`app/races`・`app/race`は残していない
- 内部リンク15ファイル・21箇所を`/events`系へ更新(`components/BottomNav.tsx` / `components/TopBar.tsx` / `app/page.tsx` / `app/events/page.tsx` / `app/events/[slug]/page.tsx` / `app/results/page.tsx` / `app/ranking/page.tsx` / `app/ai/[slug]/page.tsx` / `app/my-ai/page.tsx` / `app/my-ai/[id]/page.tsx` / `app/notifications/page.tsx` / `app/disclaimer/page.tsx` / `app/admin/page.tsx` / `app/admin/edit/[id]/page.tsx` / `app/admin/results/page.tsx`)
- `next.config.ts` に旧URL保護のための `redirects()` を追加(`/races`→`/events`、`/race/:slug`→`/events/:slug`、いずれも`permanent: true`)。追加前は`redirects`/`rewrites`未設定の空に近い設定だったため既存設定との競合なし
- param名は`slug`のまま維持。`doc(db, "events", slug)`でFirestoreドキュメントidにそのまま使う設計は変更していない。`KompariEventDoc.slug`フィールド自体は元々write-onlyの未使用フィールドで、doc id===slugが常に保証されているため、リネームの必要性はなかった
- PR-4a由来のsample除外ガード(`isPublicEvent`)は`app/events/[slug]/page.tsx`にそのまま引き継がれ、新パスでも機能を維持している

今回やらないこと: BottomNav 4タブ化・「予測」→「イベント」ラベル変更・結果タブ追加・TopBarメニュー再編は別PR(PR-2)。SSR・`generateMetadata`・動的OGP・canonicalは別PR(PR-3)。Firestoreデータ・admin機能の仕様は無変更。

## PR-3a: /events/[slug] の動的metadata/OGP対応(案W: metadata-only)

PR-3事前調査で、SSR化なしに`layout.tsx`(server component)へ`generateMetadata`だけ追加する案W(metadata-only)が成立すると確認済みだったため、その方針で実装した。

- `app/events/[slug]/layout.tsx` を新設(server component)。`generateMetadata`をexportし、`params`(`Promise<{ slug: string }>`)を`await`して`slug`を取得、event本体のtitleのみを使いtitle/description/openGraph/twitterを動的生成する。既存の`app/events/[slug]/page.tsx`("use client"、`onSnapshot`購読)は無変更
- `lib/firebase-server.ts` を新設。`firebase/auth`(`getAuth`/`GoogleAuthProvider`)・`firebase-admin`のいずれもimportせず、既存の`NEXT_PUBLIC_FIREBASE_*`環境変数と`firebase/firestore`の`getDoc`だけで1回読みする。`events`コレクションはFirestore rulesで公開read(`allow read: if true`)のため、Admin SDK・秘密鍵は不要。クライアント側の`lib/firebase.ts`とはアプリ名を分離(`kompari-server`)し、app instanceを共有しない
- `predictions`サブコレクションは読まない。consensus算出もしない。使うのは`event.title`のみ
- `isPublicEvent`(`lib/events.ts`)を再利用し、`source === "manual-fixture"`のsample eventはmetadata取得時にnullを返して汎用metadataにフォールバックする(公開除外方針と整合)
- event取得不可・sample・環境変数不足時はthrowせず、汎用metadata(`"Kompari | AI予測比較"`)にフォールバックする
- キャッシュ/revalidateの指定は今回入れていない。使用フィールドが`event.title`のみ(登録時固定、result確定後も変わらない)のため、鮮度対策が現時点で不要と判断。consensusや結果をmetadataに含める段階(別PR)でまとめて検討する

今回やらないこと: 既存page.tsxの変更、SSR化、server wrapper化、predictions取得、consensus算出、動的OGP画像(`@vercel/og`)、Admin SDK、Firestoreデータ変更。実在public eventでの動的metadata実確認は、初回実データ投入後に別途行う。

## /admin 新規作成を「イベント作成のみ」に変更(mock許容予測の作成時混入を排除)

`/admin` の新規作成画面から予測生成導線を廃止し、event doc作成専用にした。AI予測生成は `/admin/edit/[id]` のAI別strictボタン(`allowMock:false`)に一本化する。

- `app/admin/page.tsx`: `createPredictionsBeforeSave()` / `generatePredictions()` / 「AI予測生成」プレビューボタン / 予測プレビューUI(生成済みAI予測カード) / 不要になった `predictions` state・`KompariPrediction`/`OFFICIAL_AI_NAMES` importを削除
- `createEvent` は event doc(`events/{id}`)のみを書き込む。predictions subcollectionへの書き込みを行わない。`predictionCount` は `0` 固定
- 作成後の遷移先を `/events/${eventId}` から `/admin/edit/${eventId}` に変更
- 実AI予測は `/admin/edit/[id]` のAI別strict生成ボタン(`allowMock:false`)で生成する運用に統一
- `app/admin/edit/[id]/page.tsx` は無変更(既存のstrict生成・`allowMock:false`ロジックはそのまま)
- 効果: `/admin` からの新規作成時にmock許容予測がFirestoreへ書かれる経路が構造的になくなり、初回実データ投入時のmock混入リスクを排除した

## Gemini modelIdを gemini-3.1-flash-lite に更新(旧モデル404対応)

初回実データ投入でGeminiのみ実AI呼び出しに失敗しmock混入した件を調査し、原因と対応をまとめた。

- 原因調査: 最小疎通テストで `gemini-2.5-flash` が Google から明示404 `"no longer available"` を返すことを実測確認(提供終了)
- `gemini-3.5-flash` を次候補として複数回(計4回)疎通確認したが、いずれも503 `"high demand"` で失敗。MVPの安定運用には不安ありと判断し不採用
- `gemini-3.1-flash-lite` は generateContent 最小疎通に成功(response: `"OK"`)。非preview固定モデルであることを `models.list()` でも確認済み
- `lib/ai/ai-config.ts` の Gemini `devModelId` / `prodModelId` を両方とも `gemini-3.1-flash-lite` に更新。`model` 表示名も `aiModel` として prediction docに保存されるため、将来のモデル別成績追跡に備えて `"Gemini 3.1 Flash Lite"` に変更
- 教訓: `models.list()` に載っていても `generateContent` が404/503になる場合があるため、モデルID変更時は必ず実生成疎通確認を先に行ってから反映する
- `latest` alias(`gemini-flash-latest` 等)とpreviewモデルは、モデル別成績追跡の一貫性と安定運用の観点から採用しない

### 初回実データ・中核ループ一周(2026-07-10)
- 笠松1R C13組(実在レース)で event→5AI予測→consensus→result→hit/miss→
  results→ranking を実データで一周完了。event id: uHYjIV6DcRZLKSM2Xu9N
- 5AI全て isMock:false / strict生成。予測は発走前完了(予測は結果に先立つ)
- 結果 winner=ホウライショウ、全AI不的中(コンセンサスも外れ)を一貫反映
- Gemini モデル陳腐化(gemini-2.5系 404廃止)を実測で解決し
  gemini-3.1-flash-lite に更新(commit a3c4d51)
- 詳細な経緯・発見・次回再開地点は
  docs/session-records/2026-07-10-first-realdata-coreloop.md 参照
- モデル運用の設計方針は docs/MODEL_OPERATIONS_BACKLOG.md(v1.1)に集約
- [P2] predictionCount 不整合(0のまま・実カウントは5・表示は正・実害なし)。
  次回 read-only 調査で SoTか派生値か確認、派生値なら廃止検討
- [要調査] 表示名(aiModel) vs 実 modelId(aiModelId) の乖離が複数AIで疑われる。
  全AI棚卸しと格上げ検討(session-record §4 参照)
