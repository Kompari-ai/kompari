# Kompari 作業記録: 初回実データ投入・中核ループ実データ一周(2026-07-10)

種別: セッション記録 / 運用ログ
関連文書: `docs/MIGRATION_STATUS.md`(技術移行SoT) / Kompari モデル運用・レース後学習バックログ v1.1 / `15._主要AIのバージョン別成績管理` / `lib/ai/ai-config.ts`

---

## 1. サマリ(今日の到達点)

初の実在レース(笠松1R C13組)で、Kompari MVP の成功条件である中核ループを実データで一周完了した。

Event → 5AI Prediction → Consensus → Result Settlement → Hit/Miss → Results → Ranking

- 都合のよい成功例ではなく、初回結果が全AI不的中という事実もそのまま記録・反映した。
  「当たった時だけ見せるサイトではない」ことを実データで実証。
- 途中で Gemini のモデル陳腐化障害が発生したが、疎通確認を徹底して解決し、5AI全て
  mockなし(isMock:false)の実予測で揃えた。
- MVP の中核が実データで動くことが証明され、運用を回す/品質を上げるフェーズに入った。

---

## 2. 初回実データ投入の詳細

- イベント: 笠松1R C13組 / 笠松競馬場 ダート1400m 右 / 2026-07-10 10:50 発走 / 晴・良
- Firestore event id: uHYjIV6DcRZLKSM2Xu9N
- 作成方法: /admin で手動作成(source未設定 = 公開対象、isPublicEvent通過、predictionCount:0固定)
- 予測生成: /admin/edit のAI別strictボタン(allowMock:false)で5AIを1つずつ生成
- 5AI全て isMock:false / predictionSource:"official-ai" / source:"official" で保存
- 予測は発走前(朝 4:03〜5:31)に完了、結果確定は 18:48
  → 「予測は結果に先立つ」原則を実データで満たした

### 結果と判定

- 勝ち馬: ホウライショウ(4番)。2着フランシュフック、3着オータムメモリー
  (Kompari は winner=1着のみ入力。2着3着は現状スキーマ外)
- result.winner="ホウライショウ"(candidatesと完全一致) / settledAt 記録(Asia/Tokyo)
- 5AIの本命: フェスティヴフリー(Claude/DeepSeek/Gemini/Grok=4) / ラインシュトラール(ChatGPT=1)
- 全AI不的中。コンセンサス(フェスティヴフリー優勢 4/5)も外れ
- hit/miss(main===winner動的判定)・コンセンサス答え合わせ・/results・
  /ranking(5AI全て 0/1 = 0%)まで一貫して反映
- 補足: Gemini は対抗にホウライショウを入れていた(公式的中率には混ぜない=外れ。
  将来のTop3分析指標で拾える種類のデータ)

---

## 3. 障害対応の記録: Gemini モデル陳腐化

### 経緯

- 初回投入時、Gemini のみ実AI失敗 → mock混入(isMock:true / predictionSource:"mock")が発生。
  公開画面に「判定不可」バッジ付きで表示され、利用者誤認の実例となった。
- 原因切り分け(実測):
  - キー・課金・認証は正常。Google AI Studio で 404 NotFound を確認。
  - 疎通テストで gemini-2.5-flash が 404 "no longer available"(恒久廃止)と確定。
  - 代替 gemini-3.5-flash は3回リトライ全て 503(継続的高負荷)で本番運用に不安、見送り。
  - gemini-3.5-flash-lite は 404(存在しない=名前の推測失敗)。
  - gemini-3.1-flash-lite が generateContent 成功(200/"OK")を確認し採用。
- 修正: lib/ai/ai-config.ts の Gemini を dev/prod とも gemini-3.1-flash-lite に更新(commit a3c4d51)。
  Gemini のみ strict 再生成し isMock:false を確認、5AI揃えた。

### 教訓(モデル運用バックログ v1.1 に知識化済み)

- モデル一覧(models.list)に載っていても generateContent が 404/503 を返す事例が実在する。
  モデルID変更時は generateContent での疎通確認を先に行い、当て推量でコードに入れない。
- 404(恒久廃止)と 503(一時/継続高負荷)は別種。複数回503が続くモデルは本番運用に不安。
- 最新より「実疎通済み・非preview・固定ID・安定」を優先する。latest エイリアスは
  成績追跡の再現性を損なうため避ける。
- mock は「作らない・保存しない・見せない」で断つ。予測失敗AIは「不参加」と表示する。

---

## 4. 今日の重要な発見: 表示名 vs modelId の乖離(要調査)

Gemini を追う過程で、Gemini 以外の複数AIでも「表示モデル名」と「実際に呼び出している modelId」が
乖離している可能性が判明した。現状の Firestore 保存値:

| AI | 表示名(aiModel) | 実 modelId(aiModelId) | provider | 乖離 |
|---|---|---|---|---|
| ChatGPT | GPT-5.5 | gpt-5.4-mini | openai | 表示は5.5だが実体は5.4-mini |
| Claude | Claude Opus 4.8 | claude-haiku-4-5-20251001 | anthropic | 表示はOpusだが実体はhaiku |
| DeepSeek | DeepSeek V4 Pro | deepseek-v4-flash | deepseek | 表示はProだが実体はflash |
| Gemini | Gemini 3.1 Flash Lite | gemini-3.1-flash-lite | google | 一致(今回修正で揃えた) |
| Grok | Grok 4.3 | grok-4.3 | xai | 一致 |

論点:
- 利用者は「Claude Opus 4.8 が予測」と見るが、実際は haiku が応答している可能性がある。
- これは Kompari の信頼原則「どのモデルが予測したかを正直に記録・表示する」に照らして、
  表示名の見直し、または実 modelId の格上げ(上位モデルへ)のいずれかが必要になりうる。
- 当初「Gemini だけ廉価軽量版」と認識していたが、実は複数AIで同種の乖離が起きている疑い。

対応(将来・read-only調査):
- 全AIについて「表示名(aiModel)」「実 modelId」「実際に応答したモデル」を突き合わせる棚卸しを行う。
- 各AIについて、より上位/新しいモデルが安定して generateContent を通すか疎通確認し、
  格上げ可能なものは格上げする(モデル運用バックログ 論点1・優先度B「モデル格上げの定期再検証」に統合)。
- 表示名を実体に合わせるか、実体を表示名に合わせるかは、利用者納得感と可用性の両面で判断する。

---

## 5. follow-up 残課題(未対応・優先度付き)

- [P2] predictionCount 不整合: event doc の predictionCount が 0 のまま。
  実際には predictions サブコレクションに5件存在。作成時0固定 + edit のstrict個別生成が
  加算しない設計に起因。公開ページの予測数は collectionGroup 実カウントで正しく表示される
  ため実害なし。次回 read-only 調査で「どこで読み書きされ SoTか派生値か」を確認し、
  outcome と同様に派生値なら廃止を検討(派生値は保存せず導出する原則)。
- [要調査] 表示名 vs modelId 乖離(上記 §4)。全AIの棚卸しと格上げ検討。
- [参照] mock「作らない・保存しない・見せない」徹底 / モデルヘルスチェック / 不参加表示の設計は
  モデル運用バックログ v1.1 優先度A。次の改善フェーズで read-only 調査から着手
  (predictionCount調査・表示名乖離調査を相乗り可能)。

---

## 6. 次回の再開地点(推奨順)

1. 本セッション記録・一周完了を docs/MIGRATION_STATUS.md へ記録(軽い・文脈保全)
2. 本番URL(kompari.vercel.app)と OGP を実イベントで確認(実eventでの初確認)
3. mock「作らない・保存しない・見せない」の read-only 調査(バックログ優先度A)
   - この調査に predictionCount の読み書き箇所調査、表示名 vs modelId 乖離の棚卸しを相乗りさせると効率的
4. 2件目の実レース投入(運用を回す)
5. predictionCount:0 の整合性対処 / 表示名乖離への対応(格上げ or 表示修正)

いずれも今日の一周が土台。どの項目もブロッカーではなく、その日の優先度で選んでよい。

---

## 7. 記録メタ

- 中核ループ一周: 実データで完了(2026-07-10)
- Gemini モデル修正: commit a3c4d51(gemini-2.5系 → gemini-3.1-flash-lite)
- /admin 作成フローの mock 排除: commit ea520ce(event作成のみ・予測はeditでstrict生成)
- モデル運用方針: Kompari モデル運用・レース後学習バックログ v1.1 に確定
- 公開状態: kompari.vercel.app に実データ1件(笠松1R C13組)。sample除外guardで公開面は実データのみ
