# Kompari コードベース監査レポート

最終更新: 2026-06-13  
目的: 引き継ぎ可能な部分と作り直すべき部分の仕分け

---

## 凡例

| 記号 | 意味 |
|------|------|
| ✅ 実装済み | 本番品質。そのまま引き継げる |
| ⚠️ 仮実装 | 動くが不完全・問題あり。修正すれば使える |
| ❌ モックのみ | 見た目は動くが内部は偽データ。作り直しが必要 |

---

## 1. 公開画面

### / — トップページ (`app/page.tsx`)

**判定: ✅ 実装済み**

- Firestoreリアルタイム購読: 動作
- イベント総数 / 予測中 / AI予測数の集計: 動作
- 注目イベント・予測中・結果入力済みの3セクション: 動作
- `EventCard`コンポーネント（ページ内定義）: 正常動作
- 空状態表示: あり

**引き継ぎ: そのまま使用可**

---

### /races — イベント一覧 (`app/races/page.tsx`)

**判定: ⚠️ 仮実装（小バグあり）**

- Firestoreリアルタイム購読: 動作
- キーワード検索 / ステータスフィルタ / カテゴリフィルタ: 動作
- AIコンセンサス本命の表示: 動作
- **バグ: ヘッダーに「作成」ボタン（`/admin`リンク）が全ユーザーに表示される**
  - `app/races/page.tsx` L214–219

**修正方針: 管理者判定で非表示にするか削除**

---

### /race/[slug] — イベント詳細 (`app/race/[slug]/page.tsx`)

**判定: ⚠️ 仮実装（Firestoreルール競合あり）**

- Firestoreリアルタイム購読: 動作
- AIコンセンサス集計・バーグラフ表示: 動作
- AI予測カード表示 / 的中判定バッジ: 動作
- 候補リストタブ: 動作
- VoteButtons統合: 動作
- **致命的バグ: My AI参加が一般ユーザーには失敗する**
  - `updateDoc(doc(db, "races", slug))` はFirestoreルール上 `isAdmin()` のみ許可
  - 一般ユーザーがMy AI参加ボタンを押すとエラーになる
  - `app/race/[slug]/page.tsx` L505

**修正方針: Firestoreルールを修正するかAPI Route経由で更新**

---

### /ranking — AI的中ランキング (`app/ranking/page.tsx`)

**判定: ✅ 実装済み**

- Firestoreから集計: 動作（クライアント側集計）
- 公式AI / My AI フィルタ: 動作
- カテゴリフィルタ: 動作
- 的中率算出ロジック: 正確
- 最近の判定履歴: 動作
- **軽微な問題: 空状態に `/admin/results` リンクが含まれる（一般ユーザーにも表示）**

**引き継ぎ: ほぼそのまま使用可**

---

### /my-ai — My AI一覧・作成 (`app/my-ai/page.tsx`)

**判定: ⚠️ 仮実装（ルール競合あり）**

- My AI作成（Firestoreへの保存）: 動作
- My AI一覧表示・成績集計: 動作
- **バグ: 削除UIが一般ユーザーには失敗する**
  - `deleteDoc(doc(db, "myAis", id))` はFirestoreルール上 `isAdmin()` のみ許可
  - `app/my-ai/page.tsx` L205–218
- `ownerUid` なし: 誰が作成したか管理できない
- My AI編集機能: 未実装

**修正方針: 削除ボタンを管理者のみ表示 or Firestoreルール修正**

---

### /my-ai/[id] — My AI詳細 (`app/my-ai/[id]/page.tsx`)

**判定: ✅ 実装済み**

- My AI個別の成績・カテゴリ別・最近の予測: 動作
- いいね/うーん集計: 動作
- 空状態: あり

**引き継ぎ: そのまま使用可**

---

### /ai/[slug] — 公式AI詳細 (`app/ai/[slug]/page.tsx`)

**判定: ✅ 実装済み（ハードコード部分あり）**

- 対応slug: `chatgpt`, `claude`, `gemini`, `deepseek`（ハードコード）
- 成績・カテゴリ別・人気スコア: 動作
- 存在しないslugへの404処理: あり
- **将来のGrok追加時は `aiProfiles` に手動追加が必要**
  - `app/ai/[slug]/page.tsx` L62–103

**引き継ぎ: そのまま使用可**

---

### /notifications — 通知 (`app/notifications/page.tsx`)

**判定: ⚠️ 仮実装（管理者導線が公開されている）**

- 結果未入力イベント一覧: 動作
- **問題: 「すぐ行う操作」に `/admin/results` と `/admin` リンクが一般ユーザーにも表示**
  - `app/notifications/page.tsx` L200–215, L86–89

**修正方針: 管理者リンクを削除するか、管理者のみ表示切り替え**

---

### /terms, /privacy, /disclaimer — 法務ページ

**判定: ⚠️ 仮実装（文言未確認）**

- ページ自体は存在・表示される
- 文言は正式レビュー未実施

---

## 2. 管理画面

### /admin/layout.tsx — 管理画面共通認証

**判定: ✅ 実装済み**

- Firebase Auth (Googleログイン): 動作
- `NEXT_PUBLIC_ADMIN_EMAIL` との照合: 動作
- 未ログイン / 非管理者 それぞれの拒否画面: あり
- `.env.local` 未設定時のガード: あり

---

### /admin — イベント作成 (`app/admin/page.tsx`)

**判定: ✅ 実装済み**

- カテゴリ / タイトル / 会場 / 開始時期 / 候補リスト入力: 動作
- 公式AI予測の事前生成・保存: 動作（モック予測）
- `canCreate` バリデーション: あり

---

### /admin/results — 結果入力 (`app/admin/results/page.tsx`)

**判定: ✅ 実装済み**

- イベント一覧 + フィルタ: 動作
- セレクトボックスでの結果選択・即時保存: 動作
- AIコンセンサス確認: 動作
- 編集ページへの遷移: 動作

---

### /admin/edit/[id] — イベント編集 (`app/admin/edit/[id]/page.tsx`)

**判定: ✅ 実装済み**

- タイトル / 候補リスト / 結果 / 公式AI予測の再生成: 動作
- 全AI一括再生成: 動作
- イベント削除: 動作
- 候補変更時の結果リセット: 動作

---

## 3. APIルート

### /api/generate-prediction (`app/api/generate-prediction/route.ts`)

**判定: ❌ モックのみ**

実際のAI APIは一切呼ばれていない。内部動作:

1. 候補リストをAI名に応じたオフセットで回転させる
2. 本命・対抗・3番手を機械的に決定
3. 信頼度はAI名によるハードコード（ChatGPT: 72%, Claude: 68%, Gemini: 70%, DeepSeek: 64%）
4. 予測理由・根拠はカテゴリ別テンプレート文字列

**結果として全AIが似た予測を出す（候補ローテーションのズレのみ）**

**作り直しが必要:**
- OpenAI / Anthropic / Gemini / DeepSeek 各APIの実装
- プロンプト設計
- JSONスキーマ強制
- APIキー未設定時のフォールバック維持

---

## 4. コンポーネント

### components/TopBar.tsx

**判定: ✅ 実装済み**

- 通知バッジ（結果未入力件数）: Firestoreから動的取得
- ハンバーガーメニュー: 動作（管理リンクなし）
- 管理画面判定・ログアウトボタン: 動作

---

### components/BottomNav.tsx

**判定: ✅ 実装済み（未確認）**

- 管理リンクなし（確認済み）

---

### components/VoteButtons.tsx

**判定: ✅ 実装済み**

- Firestoreトランザクションによる安全な投票: 動作
- `localStorage` による同一ブラウザの投票状態保持: 動作
- 投票取り消し（同じボタン再押し）: 動作

---

### components/EntryTable.tsx, Hero.tsx, PredictionCard.tsx, SupportDistribution.tsx

**判定: ❌ 未使用デッドコード**

- app/ 配下のどのページからもimportされていない
- `PredictionCard` は `/race/[slug]/page.tsx` 内でページローカルに再定義されている
- **削除推奨**

---

## 5. ライブラリ

### lib/events.ts

**判定: ✅ 実装済み**

- `KompariEvent` / `KompariPrediction` / `LegacyRaceData` の型定義: 適切
- `normalizeRaceToEvent()`: 旧データとの後方互換を保っている
- **軽微な技術的負債: `getResultWinner()` ヘルパーがほぼすべてのページで重複定義されている**

---

### lib/categories.ts

**判定: ✅ 実装済み**

- 8カテゴリの定義・emoji・ラベル: 完備

---

### lib/firebase.ts

**判定: ✅ 実装済み**

- `getApps()` による重複初期化防止: あり
- `db`, `auth`, `googleProvider` エクスポート: 適切

---

## 6. Firestoreルール (`firestore.rules`)

**判定: ⚠️ 仮実装（機能競合あり）**

| collection | read | create | update/delete |
|-----------|------|--------|--------------|
| races | 全員 | 管理者のみ | 管理者のみ |
| votes | 全員 | 全員 | 削除は管理者のみ |
| myAis | 全員 | 全員 | 管理者のみ |

**問題点:**

1. **My AI参加** → `races` への `updateDoc` → 管理者のみ → **一般ユーザーは失敗**
2. **My AI削除UI** → `myAis` への `deleteDoc` → 管理者のみ → **一般ユーザーは失敗**
3. 管理者メールアドレスが `firestore.rules` にハードコードされている（`.env.local` の `NEXT_PUBLIC_ADMIN_EMAIL` と一致させる必要がある）

---

## 7. 引き継ぎ判定サマリー

### そのまま引き継げる

- `/` トップページ
- `/races` イベント一覧（軽微修正後）
- `/ranking` ランキング
- `/my-ai/[id]` My AI詳細
- `/ai/[slug]` 公式AI詳細
- 管理画面3画面（layout / create / results / edit）
- `TopBar` / `BottomNav` / `VoteButtons`
- `lib/` 全ファイル
- Firebaseインフラ全体

### 修正してから引き継ぐ

- `/race/[slug]` → My AI参加のFirestoreルール競合を解消
- `/my-ai` → 削除UIのFirestoreルール競合を解消
- `/notifications` → 管理者リンクを非表示化
- `/races` → 管理者向け「作成」ボタンを非表示化
- Firestoreルール → My AI参加の `races.update` をどう扱うか決定

### 作り直すべき

- `app/api/generate-prediction/route.ts` → 本物のAI API連携
- `components/EntryTable.tsx` → 削除
- `components/Hero.tsx` → 削除
- `components/PredictionCard.tsx` → 削除
- `components/SupportDistribution.tsx` → 削除
