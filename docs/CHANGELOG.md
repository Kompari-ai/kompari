# Kompari CHANGELOG

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
