# Kompari CHANGELOG

---

## 2026-06-13 — P1: cleanup and datetime support

### T-07 共通ヘルパー `getResultWinner` を lib に集約

- `lib/events.ts` に `export function getResultWinner(event: KompariEvent): string` を追加
- 以下9ファイルのローカル定義を削除し、`@/lib/events` からのimportに統一:
  - `app/page.tsx`
  - `app/races/page.tsx`
  - `app/race/[slug]/page.tsx`
  - `app/ranking/page.tsx`
  - `app/my-ai/page.tsx`
  - `app/my-ai/[id]/page.tsx`
  - `app/notifications/page.tsx`
  - `app/ai/[slug]/page.tsx`
  - `app/admin/results/page.tsx`

### T-06 `startsIn` を日時フィールドに変更

**`lib/events.ts`**
- `LegacyRaceData` に `startsAt?: string` を追加
- `normalizeRaceToEvent` が `race.startsAt` を `KompariEvent.startsAt` にマッピングするよう変更（後方互換: `startsIn` はそのまま保持）
- `export function formatStartsAt(startsAt?: string): string` を追加（「6月13日(土) 15:40」形式）

**`app/admin/page.tsx` / `app/admin/edit/[id]/page.tsx`**
- `startsIn` state を `startsAt` に改名
- 入力を `<input type="datetime-local">` に変更（ラベルも「開始時期」→「開始日時」）
- Firestore 保存フィールドを `startsAt` に変更（旧 `startsIn` は削除）

**表示ページ（`app/page.tsx`, `app/races/page.tsx`, `app/race/[slug]/page.tsx`）**
- `event.startsAt` があれば `formatStartsAt()` で「6月13日(土) 15:40」形式を表示
- 旧データは `event.startsIn` にフォールバック（後方互換）

### T-08 /notifications ページの整理

**`app/notifications/page.tsx`**
- ページタイトルを「通知」→「結果待ちイベント」に変更
- 説明文を管理者向けから一般ユーザー向けに修正
- stats ラベル「未入力」→「結果待ち」
- カードバッジ「結果未入力」→「結果待ち」
- セクション「結果未入力イベント」→「結果待ちイベント」
- 操作ボタンセクション「すぐ行う操作」→「ページへ移動」、「ランキング確認」→「ランキングを見る」
- 空状態の文言を修正

### T-09 Firestoreルールのメール照合 (確認のみ)

- `firestore.rules` の管理者メール と `.env.local` の `NEXT_PUBLIC_ADMIN_EMAIL` が **一致していることを確認 ✓**
- ルール自体は変更なし

### 追加: docs内の管理者メールアドレスを伏せ字化

- `docs/TODO.md` 内の管理者メールアドレスを `<ADMIN_EMAIL>` に置換
- `docs/AUDIT.md`, `firestore.rules` は対象外（仕様通り）

### 確認

- `npm run build` 成功（TypeScript エラーなし）
- 全14ルートの静的・動的生成が正常完了

---

## 2026-06-13 — P0対応（管理者導線除去・未使用ファイル削除）

### 削除

- `components/EntryTable.tsx` — アプリ内でimportされていない未使用コンポーネント
- `components/Hero.tsx` — 同上
- `components/PredictionCard.tsx` — 同上（ページ内ローカル実装に置き換え済み）
- `components/SupportDistribution.tsx` — 同上

### 修正: 公開ページから管理者導線を除去

**`app/races/page.tsx`**
- ヘッダー右上の「作成」ボタン（`/admin` リンク）を削除

**`app/notifications/page.tsx`**
- `NotificationCard` の「結果入力へ」ボタン（`/admin/results` リンク）を削除。「詳細を見る」のみ残存
- 「すぐ行う操作」セクションから「結果入力」`/admin/results` と「イベント作成」`/admin` の2ボタンを削除。「ランキング確認」「予測を見る」のみ残存

**`app/ranking/page.tsx`**
- ランキング空状態の「結果入力へ」ボタン（`/admin/results` リンク）を削除。「イベント一覧へ」1ボタンに変更

### 修正: My AI関連UIを非表示化（コード保持・将来対応）

**`app/race/[slug]/page.tsx`**
- My AI参加セクション全体を JSX コメントで非表示化
- コメント内に「将来対応: My AI参加機能 — Firestoreルール修正後に有効化 (see docs/AUDIT.md T-01)」を明記
- 関連する state / useEffect / useMemo / joinMyAi 関数はコードとして保持

**`app/my-ai/page.tsx`**
- My AI削除ボタンを JSX コメントで非表示化
- コメント内に「将来対応: My AI削除 — Firestoreルール修正後に有効化 (see docs/AUDIT.md T-02)」を明記
- `deleteMyAi` 関数はコードとして保持

### 確認

- `npm run build` 成功（TypeScript エラーなし）
- 全14ルートの静的・動的生成が正常完了

### 未対応（次フェーズ）

- Firestoreルール修正（My AI参加 / 削除の権限設計）: `docs/TODO.md` T-01, T-02 参照
- `startsIn` の日時フィールド化: `docs/TODO.md` T-06 参照
- 本物のAI API連携: `docs/TODO.md` T-11 参照
