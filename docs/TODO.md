# TODO / Next Session Notes

## 16-B-3b-2-beta: Factor Tags prompt instruction rollout

### Current status

- Factor Tags prompt instruction has been enabled locally.
- Main code commit:
  - `657ddb6 feat(ai): enable Factor Tags prompt instruction (16-B-3b-2-beta)`
- This commit changes only:
  - `lib/ai/prompt.ts`
  - `includeFactors = false` → `includeFactors = true`
- NOTE:
  - Because `657ddb6` is committed, the local working tree has `includeFactors=true`.
  - Running the dev server locally will now include Factor Tags in prompts.
  - This is expected.
  - Production is unaffected until `git push`.
- The code commit has NOT been pushed yet.
- Production is NOT changed yet.
- Vercel has NOT redeployed this change yet.
- `.claude/` remains untracked and should not be committed.

### Local validation summary

Before/after local route tests were completed with 5 official AIs:

- Gemini: PASS
- ChatGPT: PASS
- Claude: PASS
- Grok: PASS
- DeepSeek: PASS after retry validation

DeepSeek evidence validation:

- Initial after:
  - evidence 55 chars / 46% of before
  - judged borderline / not enough for immediate push
- retry-1:
  - evidence 74 chars / 62% of before
  - individual horse-specific rationale returned
- retry-2:
  - evidence 103 chars / 87% of before
  - individual horse-specific rationale returned
- Conclusion:
  - Initial DeepSeek evidence shortening appears to be one-time generation variance.
  - It does not appear to be structural degradation caused by the Factor Tags prompt instruction.

Validation files are outside the repository:

- `C:\Users\toriniku\Desktop\kompari-factor-check\before.json`
- `C:\Users\toriniku\Desktop\kompari-factor-check\after.json`
- `C:\Users\toriniku\Desktop\kompari-factor-check\deepseek-retry-1.json`
- `C:\Users\toriniku\Desktop\kompari-factor-check\deepseek-retry-2.json`

Do not add these files to git.

### Expected local git log

Expected local log, most recent first:

```text
<docs commit>  docs(todo): add Factor Tags production rollout checklist
657ddb6        feat(ai): enable Factor Tags prompt instruction (16-B-3b-2-beta)
35548fc        feat(ai): prepare Factor Tags prompt instruction behind disabled flag (16-B-3b-2-alpha)
```

The docs commit may be the latest local commit.
The important code commit for Factor Tags enablement is `657ddb6`.

### Next session checklist

Start with state confirmation only:

```bash
git status --short
git log --oneline -5
git status -sb
```

Confirm:

* Working tree has no unexpected changes.
* `.claude/` may remain untracked.
* Local main is ahead of origin/main.
* The Factor Tags code commit `657ddb6` is included in local history.
* The docs TODO commit may be the latest local commit.
* No API keys or `.env.local` values are displayed.

### Production rollout steps

Only after state confirmation:

1. Push local commits:

```bash
git push origin main
```

2. Confirm Vercel deployment completed successfully.

3. Run one production verification prediction.

Production verification should confirm:

* Prediction still returns:

  * main
  * second
  * third
  * confidence
  * reason
  * evidence
* `usedFactors` is present.
* `usedFactors` count is 3 to 5.
* `factorKeys` is present.
* No mock/fallback response.
* reason/evidence are not obviously degraded.
* No API error.
* Firestore save behavior is expected.

### Production verification caution

Local validation used direct route tests without Firestore persistence.

Production verification may create real Firestore prediction data.
Before running production verification, decide whether to use:

* a dedicated test event, or
* a real event that is acceptable to store predictions for.

Do not run broad or repeated production tests unless necessary.

### Rollback plan

Recommended rollback:

1. Set `includeFactors=false` in `lib/ai/prompt.ts`.
2. Commit the one-line rollback.
3. Push the rollback.
4. Confirm Vercel redeploy.
5. Re-test production prediction.

This is simpler and clearer than `git revert` because the rollback is a one-line change.

Use `git revert` only if there is a specific reason to preserve an exact revert history.

### Do not do

* Do not commit `.claude/`.
* Do not commit `kompari-factor-check` files.
* Do not display `.env.local` values.
* Do not display API keys.
* Do not run broad node process kills.
* Do not run unnecessary real API calls.

---

# Kompari MVP TODO

**スコープ: 競馬のみ・手動運用（管理者がイベント作成・結果入力）**  
最終更新: 2026-06-13

優先順は「ユーザーが壊れた体験をしないか」→「管理者が運用できるか」→「見た目」の順。

---

## P0 — リリースブロッカー（合計 ~3h）

これが直っていないとサービスとして成立しない。

---

### T-01 My AI参加のFirestoreルール競合を解消

**見積: 45分**

**問題:**  
`/race/[slug]` でMy AI参加ボタンを押すと `updateDoc(doc(db, "races", slug))` を呼ぶが、Firestoreルールで `races` のupdateは管理者のみ。一般ユーザーが押すとパーミッションエラーで失敗する。

**対応方針（どちらか選ぶ）:**

**A: API Route経由（推奨）**  
`/api/join-event` という新APIルートを作り、そこで Firestore Admin SDK を使って `predictions` 配列を追加する。クライアントから Firestore を直接触らせない。

**B: Firestoreルールの緩和**  
`races/{raceId}` のupdateに「認証済みユーザーならpredictionsフィールドのみ追加可」を追加する。ただし Firestoreルールでのフィールドレベル制御は複雑で、他フィールドを書き換えられるリスクがある。

**修正ファイル:**  
- `app/race/[slug]/page.tsx` L455–516（joinMyAi関数）
- `firestore.rules` または 新規 `app/api/join-event/route.ts`

---

### T-02 My AI削除のFirestoreルール競合を解消

**見積: 20分**

**問題:**  
`/my-ai` の削除ボタンが `deleteDoc(doc(db, "myAis", id))` を呼ぶが、Firestoreルールでは削除は管理者のみ。一般ユーザーが押すとエラー。

**対応方針:**  
削除UIは現時点では管理者のみ表示にする（画面に認証状態を持ち込むか、削除ボタン自体を非表示にする）。My AI削除は管理者が `/admin` 経由で行う運用にしてよい。

**修正ファイル:**  
- `app/my-ai/page.tsx` L205–218（deleteMyAi関数、L400の削除ボタン）

---

### T-03 /notifications から管理者リンクを除去

**見積: 15分**

**問題:**  
`/notifications` の「すぐ行う操作」セクションに `/admin/results` と `/admin` へのリンクがある。一般ユーザーが押すとGoogleログイン画面に飛ぶ（直接的な害はないが、混乱を招く）。

**修正内容:**  
`app/notifications/page.tsx` L200–215 の「結果入力」「イベント作成」の2ボタンを削除。「ランキング確認」「予測を見る」の2ボタンのみ残す。  
NotificationCard（L86–89）の「結果入力へ」ボタンも削除し「詳細を見る」のみにする。

**修正ファイル:**  
- `app/notifications/page.tsx`

---

### T-04 /races の管理者リンクを非表示化

**見積: 10分**

**問題:**  
`app/races/page.tsx` L214–219 に全ユーザーに表示される「作成」ボタン（`/admin`リンク）がある。

**修正内容:**  
ボタンを削除するだけでOK（管理者は直接URLで /admin にアクセスできる）。

**修正ファイル:**  
- `app/races/page.tsx` L214–219

---

## P1 — 運用品質（合計 ~5h）

P0完了後、管理者が快適に運用するために必要。

---

### T-05 デッドコード削除

**見積: 15分**

使われていないコンポーネントを削除してリポジトリを整理する。

削除対象:
- `components/EntryTable.tsx`
- `components/Hero.tsx`
- `components/PredictionCard.tsx`
- `components/SupportDistribution.tsx`

削除後に `npm run build` で確認。

---

### T-06 startsIn を日時フィールドに変更

**見積: 1.5h**

**現状:**  
`startsIn` は自由入力のテキスト（例: "明日18:00"）。日を過ぎても自動更新されないので「あと3時間」などが残り続ける。

**修正内容:**  
- 管理画面の入力をdatetimeに変える（`<input type="datetime-local">`）
- Firestoreには ISO8601文字列で保存
- 一覧・詳細での表示は「〇月〇日 18:00」形式にフォーマット
- `normalizeRaceToEvent` の `startsIn` の扱いを更新

**修正ファイル:**  
- `app/admin/page.tsx`
- `app/admin/edit/[id]/page.tsx`
- `lib/events.ts`

---

### T-07 共通ヘルパー `getResultWinner` を lib に集約

**見積: 30分**

**現状:**  
`getResultWinner()` が以下6ファイルで重複定義されている:
- `app/page.tsx`
- `app/races/page.tsx`
- `app/race/[slug]/page.tsx`
- `app/ranking/page.tsx`
- `app/my-ai/page.tsx`
- `app/notifications/page.tsx`
- `app/admin/results/page.tsx`

**修正内容:**  
`lib/events.ts` に `export function getResultWinner(event: KompariEvent)` を追加し、全ページからimportする。

---

### T-08 /notifications ページの整理

**見積: 30分（T-03完了後）**

T-03で管理者リンクを除去した後、一般ユーザー向けの通知として整理する。

**修正内容:**  
- ヘッダーの説明文を「結果待ちのイベント一覧」に変更
- 「すぐ行う操作」セクションを「ランキングを見る」「予測を見る」の2ボタンに変更
- ページの目的を「結果が出たイベントのお知らせ」に絞る（将来の通知基盤として）

---

### T-09 Firestoreルールのメール依存を env で管理

**見積: 30分**

**現状:**  
`firestore.rules` に管理者メールアドレスがハードコードされている（`"<ADMIN_EMAIL>"`）。

**問題:**  
- `NEXT_PUBLIC_ADMIN_EMAIL` の値と手動で同期が必要
- Firebase CLIでdeployしなければ反映されない

**修正内容:**  
ルール自体は変えられないが、現在のルールが `.env.local` の `NEXT_PUBLIC_ADMIN_EMAIL` と一致しているかチェックするスクリプトまたはREADMEコメントを追加する。Firebase Console側のルールが正しいメールになっているか確認。

---

### T-10 空状態の改善

**見積: 1h**

以下の空状態が質素すぎる or 管理者向け導線が含まれる:

- `/ranking` 空状態 → `/admin/results` リンクを `/races` に変更
- `/my-ai` 空状態 → 問題なし
- `/race/[slug]` のAI予測0件状態 → 問題なし
- `/races` 0件状態 → 問題なし

主にランキングの空状態修正のみ対応。

**修正ファイル:**  
- `app/ranking/page.tsx` L479–484（空状態の「結果入力へ」ボタンを変更）

---

## P2 — 品質向上（合計 ~8h）

MVPリリース後に対応。

---

### T-11 AI予測の本物API連携（競馬のみ）

**見積: 3–4h**

**現状:**  
`/api/generate-prediction` は完全なモック。候補リストの機械的ローテーションで予測を生成している。

**最小対応（競馬のみ・OpenAIのみ）:**

1. `app/api/generate-prediction/route.ts` にOpenAI API呼び出しを追加
2. 競馬向けプロンプトを設計（候補名・レース名・カテゴリを渡す）
3. GPT-4.1 mini / GPT-4o mini で `main`, `second`, `third`, `confidence`, `reason` を返す
4. `OPENAI_API_KEY` 未設定時は現行モックのフォールバック維持
5. ChatGPT以外（Claude / Gemini / DeepSeek）はAPIキーが揃うまでモック継続

**修正ファイル:**  
- `app/api/generate-prediction/route.ts`
- `.env.local`（OPENAI_API_KEY 設定）

---

### T-12 My AI参加に最低限の認証要件を追加（T-01実装後）

**見積: 2h**

T-01でAPI Route経由にした後、以下を追加:

- My AI参加にFirebase Authを要求（未ログインは作成画面へ誘導）
- `myAis` に `createdByBrowser`（UIDの代わりに `localStorage` token）を保存し、自分が作ったMy AIのみ削除可能にする（Firebase Auth未導入の場合の代替）

---

### T-13 詳細ページ(/race/[slug])のUIブラッシュアップ

**見積: 2h**

**現状:**  
AIコンセンサスセクション → My AI参加セクション → タブ（AI予測 / 候補リスト）の順で表示されているが、My AI参加が前に来すぎている。

**修正内容:**  
1. イベントヘッダーカードをより見やすく（startsAt の表示など）
2. My AI参加欄を下に移動（タブの後ろ）
3. AI予測カードに「なぜこの候補を選んだか」の展開表示を追加（`reason` フィールドはすでにある）

---

## P3 — 将来機能（スコープ外・メモのみ）

現MVPには含めない。実装判断は別途。

| 機能 | 概要 |
|------|------|
| My AI所有者管理 | Firebase Auth導入・ownerUid保存 |
| Grok追加 | `aiProfiles` と `officialAis` に追加 |
| OGP画像 | SNS共有用の画像生成 |
| AIバージョン別成績 | `aiModel` フィールド追加・ランキング拡張 |
| 予測コンテキストデータ | Factor Tags の実装 |
| 結果判定の自動化 | 外部APIを使った自動結果入力 |
| コメント機能 | イベント・AI予測へのコメント |

---

## 作業順序の推奨

```
P0（T-01 → T-02 → T-03 → T-04）
  ↓ npm run build で確認
P1（T-05 → T-07 → T-06 → T-08 → T-09 → T-10）
  ↓ 動作確認・Vercel deploy
P2（T-11 → T-13 → T-12）
```

**P0だけで合計約1.5h。P0完了後に即Vercel deploy可能。**

---

## チェックリスト（P0完了基準）

- [ ] My AI参加ボタンを一般ユーザーが押しても壊れない
- [ ] My AI削除ボタンを一般ユーザーが押しても壊れない（または非表示）
- [ ] /notifications に管理者リンクが表示されない
- [ ] /races に管理者向け「作成」ボタンが表示されない
- [ ] `npm run build` が通る
- [ ] Vercel deployが成功する

---

## 予測データ独立コレクション移行（Step1+2）— 着手前に決めること

別チャットで Step1+2 の指示文（`lib/events.ts` に型追加 + `lib/predictions.ts` 新設）が用意済み。ただし事前調査（15 完了後）で、指示文の前提と現状のズレ、および新スキーマ `KompariPredictionDoc` の設計論点が判明したため、着手前に以下を決める。

### 指示文の要修正点

- 指示文に「15-B-5 で `lib/stats.ts` に作った正規化マップを再利用」とあるが、そのようなマップは存在しない（あるのは `OFFICIAL_AI_NAMES` の allowlist のみ）。
  → 指示文の当該箇所を削除し、必要な変換は `lib/predictions.ts` 内に独自定義する。

### 新スキーマ `KompariPredictionDoc` の設計論点（要決定）

1. **confidence の数値化ルール**:
   現状 `confidence` は string で実データがバラバラ（`"medium"` `"high"` `"72%"` 等）。新型は `confidence: number`（0–100）+ `confidenceRaw: string`（原文）に分離する設計。
   → `"medium"` / `"high"` / `"low"` を何点に変換するか、ルールを決める必要がある。
   （現状の画面で `"medium%"` という不正表示も出ており、数値/原文分離は良い方向）
2. **picks をネストするか**:
   現状 `main`/`second`/`third` はフラット。新型は `picks: { main, second, third }` とネスト。
   → ネストにする実利が不明確。既存コードは `prediction.main` を多数参照しており、変換コストが増える。フラット維持で良いか、設計者の意図を確認。
3. **predictionText の扱い**:
   新型に `predictionText`（予測の地の文）があるが現状に該当フィールドなし。
   → 旧データ移行時は空になる。任意（optional）にするか、`main` 等から生成するか決める。
4. **outcome の持たせ方**:
   新型は予測ドキュメント自体に `outcome: "hit" | "miss" | null` を持つ設計（現状は集計時に `getResultWinner` で動的判定）。方針16・My AIランキングに有用。
   → 旧データ移行時は `races.result` と突き合わせて算出するか `null` にするか決める。

### 現状確認で判明した既知事項（再調査不要）

- `LegacyRaceData` は実在し `normalizeRaceToEvent` で使用中（指示文の「残す」はOK）。
- `predictions` 独立コレクションはコード上ゼロ参照（現状 races 埋め込みのみ）。
- `lib/predictions.ts` は未存在（新規作成でOK）。
- モックフォールバック予測は `aiProvider`/`aiModel`/`aiModelId` が欠ける → 移行時に null チェック必須。これは「モック汚染」問題と同根。
- この移行は方針16（sourceContext/reasoning/confidence数値化）の土台。16と一体で設計する。

### 進め方（次回）

新スキーマの4論点を決める → 指示文を修正 → Step1+2（型追加+読み取りヘルパー、既存を呼ばない安全な追加のみ）→ build確認 → 以降のStepへ。

→ 上記の論点整理を踏まえた正式方針は次節「predictions 新スキーマの方向性」を参照。

---

## predictions 新スキーマの方向性（方針16 vs 移行指示文の整理）

方針16ドキュメント（`usedFactors` ベースのファクター構造化）と、別チャット由来の predictions 移行指示文（独立コレクション化・`outcome`/`confidence`数値化等）には設計差分がある。両者を比較し、「いいとこ取り」で正式方針を整理する。

### 方針16の方向性

- 現状の `KompariPrediction` 構造を大きく変えない。
- `main` / `second` / `third` はフラットのまま。
- `reason` / `evidence` / `confidence` も現状維持。
- 追加の中心は `usedFactors?: PredictionFactor[]`。
- `PredictionFactor` は `key` / `label` / `value` / `weight` / `direction` / `note` 等を持つ構造化ファクター。

### 移行指示文の方向性

- `predictions` を races 埋め込みから独立コレクションへ移す。
- `outcome` / `predictedAt` / `evaluatedAt` など、予測単位の状態を持たせる。
- `confidence` を number 化し、`confidenceRaw` を持たせる。
- `picks` / `reasoning` / `predictionText` / `sourceContext` などの新構造を含む。

### 採用したい方向性

- predictions は将来的に独立コレクション化する（方針16.5 の検索・分析の前提）。
  - AI別・モデル別・的中/外れ別・条件別で予測を検索・分析しやすくなる。
- `outcome` / `status` / `predictedAt` / `evaluatedAt` のような予測単位の状態管理は将来性がある。
- `confidence` は数値用と原文用に分ける方向が望ましい。
  - 例: `confidence: number | null`
  - 例: `confidenceRaw: string | null`
- モック汚染対策として `isMock` または `predictionSource: "real-api" | "mock"` を持たせる方向も検討する。

### 方針16を優先したい部分

- ファクター情報は、緩い `sourceContext: Record<string, unknown>` よりも、方針16の `usedFactors?: PredictionFactor[]` を優先する。
- `PredictionFactor` は構造化されたデータにする。
  - 「ChatGPTが重視した要因」「Grokが穴狙いした根拠」「雨の日の競馬予測」などを検索・分析できるようにするため。
  - `Record<string, unknown>` は柔軟だが中身がバラバラになりやすく、検索・集計に向かない。

### 保留・再検討する部分

- `main` / `second` / `third` を `picks` にネストするかは未決定。
  - 現状コードは `prediction.main` を多数参照しているため、実利が明確でなければ移行初期はフラット維持が安全。
- `reason` を `reasoning` に改名するかは未決定（単なる改名なら移行コストに見合うか要検討）。
- `predictionText` は optional 扱いが安全（現状データに対応フィールドがないため必須にしない）。
- `confidence` 数値化の変換ルールは未決定。
  - `high` / `medium` / `low` を何点にするか決める必要がある。
  - 変換できないものは `confidence: null`、原文を `confidenceRaw` に残す方針が安全。

### 次回の進め方

1. まず正式な `PredictionDocument` / `PredictionFactor` 型を設計する。
2. 独立コレクション化・outcome保持・confidence数値化の将来性は取り入れる。
3. ファクター情報は `sourceContext` ではなく、方針16の `usedFactors: PredictionFactor[]` を軸にする。
4. `picks` / `reasoning` / `predictionText` は、必要性を再確認してから採用判断する。
5. スキーマ確定後に、`lib/predictions.ts` へ型と変換ヘルパーだけ追加する。
6. Firestore 書き込み変更・既存データ移行はさらに後の段階に分ける。
7. 移行とスキーマ再設計を同時に進めない。

---

## 方針16 Factor Tags — Phase 1 正式設計（実装前の確定事項）

### `PredictionFactor` 型（構造化ファクター）

```ts
type PredictionFactor = {
  key: string;        // 固定リストから選択。該当なしのみ custom:xxx
  label: string;      // 表示用の日本語ラベル
  direction: "positive" | "negative" | "neutral";
  note?: string;      // 補足理由
  value?: string | number | boolean;  // Phase 1 では任意（将来用）
  weight?: number;                     // Phase 1 では任意（将来用）
};
```

- Phase 1 で AI に必ず出させる項目: `key` / `label` / `direction` / `note`。
- `value` / `weight` は型に用意するが Phase 1 では必須にしない。
  理由: `weight` はAI間で基準がブレる（ChatGPTの0.8とGrokの0.8が同義とは限らない）。
- 重要度は `weight` ではなく「配列順」で表す（`usedFactors[0]`=最重視、`[1]`=2番目…）。

### `PredictionDocument` への持たせ方

```ts
usedFactors?: PredictionFactor[];  // 表示・分析用（リッチな構造）
factorKeys?: string[];             // 検索用（key だけの配列）
```

- `factorKeys` は Firestore の `array-contains` 検索用に別途持つ。
  （`usedFactors[].key` では `array-contains` が効かないため非正規化して持つ）
- 例: `usedFactors=[{key:"home_advantage",label:"ホーム開催",direction:"positive",note:"..."}]`
      `factorKeys=["home_advantage"]`

### factor key 正式リスト（命名規則: 小文字スネークケース）

**共通キー**（カテゴリ横断で同じ意味で使えるものだけ）:

| key | 意味 |
|---|---|
| `weather` | 天候 |
| `news_sentiment` | ニュース材料 |
| `market_sentiment` | 市場・世論の流れ |
| `odds_movement` | オッズ・人気の動き |
| `historical_record` | 過去実績 |
| `data_uncertainty` | 情報不足・不確実性 |
| `risk_event` | リスクイベント |

**競馬キー**（MVP中心。厚めに用意）:

| key | 意味 |
|---|---|
| `horse_form` | 馬の近走成績 |
| `horse_condition` | 馬体・仕上がり |
| `jockey` | 騎手 |
| `trainer` | 調教師 |
| `track_condition` | 馬場状態 |
| `distance_fit` | 距離適性 |
| `course_fit` | コース適性 |
| `draw` | 枠順 |
| `pace` | 展開・ペース |
| `weight_carried` | 斤量 |
| `bloodline` | 血統 |
| `odds_value` | 妙味・過小評価 |

**スポーツ共通キー**:

| key | 意味 |
|---|---|
| `team_form` | チームの直近調子 |
| `player_condition` | 選手状態 |
| `injury` | 怪我・欠場 |
| `home_advantage` | ホームアドバンテージ |
| `head_to_head` | 対戦成績 |
| `schedule_fatigue` | 日程疲労 |
| `tactical_matchup` | 戦術相性 |
| `motivation` | モチベーション |

**株・暗号資産キー**:

| key | 意味 |
|---|---|
| `macro_trend` | マクロ環境 |
| `technical_signal` | テクニカル指標 |
| `volume` | 出来高・取引量 |
| `earnings` | 決算 |
| `valuation` | 割安・割高 |
| `regulation` | 規制 |
| `liquidity` | 流動性 |
| `risk_event` | リスクイベント（共通と共有） |

注: `recent_form` / `condition` は共通から外し、各カテゴリの具体キー（`horse_form`/`horse_condition`、`team_form`/`player_condition`）に寄せた。AIが「共通の `condition` と `horse_condition` のどちらを使うか」迷うのを防ぐため。

### 運用ルール

- AIへの指示: 「最も重視した factor を3〜5個、重要度の高い順に選ぶ。標準キーから選び、該当しない場合のみ `custom:xxx` を使う」。
- 1予測あたり: 最小3個 / 最大5個 / 推奨3個。
- `custom:xxx` は許可するが、集計・検索では標準キーとは分けて扱う（標準キーのみを一級の集計対象とする。allowlist 思想と同じ）。

### 置き場所

- factor key の固定リストは `lib/factors.ts` に一元管理する。
- 参照箇所: 予測生成プロンプト / `PredictionDocument` 型 / 検索UI / ランキング分析 / 管理画面。
- `ai-config.ts` や `stats.ts` には置かない（今日 allowlist が2か所に分散して保守コストになった反省から、最初から1ファイルに集約）。

### 次回の進め方

1. この確定リストで `lib/factors.ts` の型と固定リストを作る（実装の第一歩）。
2. その後 `PredictionDocument` / `PredictionFactor` を `lib/predictions.ts` に入れる。
3. さらにその後、予測生成プロンプトに「factor を3〜5個選ぶ」指示を組み込む。

※ いずれも「追加のみ・既存を呼ばない」安全な段階から。移行とスキーマ再設計は同時に進めない。

---

## 16-B-3b-2 — Factor Tags プロンプト確定文面（次回これを実装する）

### 進め方（調査で確定済み）

- `buildFactorInstruction(category)` を新設し、user プロンプト末尾に `includeFactors` フラグで条件付き連結する。
  例: `const user = \`${baseUser}${includeFactors ? buildFactorInstruction(input.category) : ""}\`;`
- 品質が落ちたら `includeFactors = false` に戻すだけで即 revert できる形にする。
- factor 指示は予測本体の指示の「後ろ」に置く（本体優先）。
- key 一覧は `getFactorKeysForCategory(category)` の key と、`lib/factors.ts` の label を「key: label」のペアで列挙する（`getFactorLabel` で label を引く）。

### 確定プロンプト文面

```
【重視した要因 usedFactors について】
あなたが上記の予測で重視した要因を、以下のリストから3〜5個、重要度の高い順に選び、
usedFactors 配列で返してください。

選べる要因一覧: {getFactorKeysForCategory(category) から作った "key: label" の一覧}

各要因は次の形式で返してください。
{
  "key": "jockey",
  "label": "騎手",
  "direction": "positive",
  "note": "騎手の相性が良く、勝ち切る可能性を高めるため。"
}

ルール:
- key は上の一覧にある key をそのまま使う。
- label は上の一覧にある対応 label をそのまま使う。
- direction は、あなたの main 予測に対する影響として判断する。
  - "positive": main 予測を後押しする要因
  - "negative": main 予測に対する不安・減点要因
  - "neutral": 中立、または不確実性を示す要因
- note は、その要因を重視した理由を日本語1文で短く書く。
- 最も重視した要因を配列の先頭に置く。
- 原則として上の一覧から選ぶ。どうしても該当する key がない場合のみ
  "custom:任意の英数字" を使う。
- factorKeys は返さない（システム側で usedFactors から作成する）。
- value / weight は今回は返さない。

重要:
- 必ず main / second / third / confidence / reason / evidence を優先して正確に返す。
- usedFactors は予測本体を補足するための情報。
- usedFactors の作成で迷っても、予測本体の品質を落とさない。
```

### 次回 16-B-3b-2 の手順

1. factor 指示前に、各社1件ずつ予測を生成して main/reason/evidence を記録（ビフォー）。
2. `buildFactorInstruction(category)` を上記文面で実装（`includeFactors` フラグ付き）。
3. ローカルで1社ずつ実API確認: Gemini → ChatGPT → Claude → DeepSeek → Grok → 5社一括。
4. 各社で: main/reason/evidence が正常、usedFactors が3〜5個、key が標準 or `custom:`、
   direction が3値、factorKeys が usedFactors から導出、Claude が崩れても本体無事。
5. ビフォー/アフター比較で予測本体の品質が劣化していないか判定。
6. 問題なければ本番 push。劣化が見られたら `includeFactors=false` で即 revert。
