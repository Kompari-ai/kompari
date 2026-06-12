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
`firestore.rules` に管理者メールアドレスがハードコードされている（`"g0930035@gmail.com"`）。

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
