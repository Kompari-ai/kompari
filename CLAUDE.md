
Kompari
AI予測サイトの作成



本日はどのようなお手伝いをさせていただけますか？


チャットを開始して会話を整理し、プロジェクトナレッジを再利用しましょう。
メモリー
あなたのみ
プロジェクトの記憶は数回のチャット後にここに表示されます。

手順
Claudeの回答をカスタマイズする指示を追加

ファイル
プロジェクト容量の3%を使用中

16. 予測コンテキストデータ / Factor Tags
502行

text



15. 主要AIのバージョン別成績管理
241行

text



13. 追加されたプロダクト方針
170行

text



kompari-v2.html
992行

html



Kompari 引き継ぎドキュメント
1381行

text


F71DCE81D34B485B9AAC2DEF883391FF.png

32A88A03C3C041DA8B5A07A131312F04.png

57EEAA62D62D48C885BF2ACEA615EFE1.png

Kompari 引き継ぎドキュメント
Kompari 引き継ぎドキュメント
 
最終更新: 2026-06-11
対象プロジェクト: Kompari
公開URL:
 
https://kompari.vercel.app
 
GitHubリポジトリ:
 
https://github.com/Kompari-ai/kompari
 
0. プロジェクト概要
 
Kompari は、複数のAI予測を同一イベント上で比較する AI Prediction Arena です。
 
現時点のMVPでは、競馬を起点にしつつ、将来的に以下のカテゴリへ広げる前提で実装されています。
 
* Horse Racing / 競馬
* NBA
* Soccer / サッカー
* MLB
* Crypto
* Stocks
* Election
* Esports
 
公式AI比較対象(MVP)は以下の5種です。
 
* ChatGPT
* Claude
* Gemini
* DeepSeek
* Grok
 
My AI は、ユーザーが作成できる独自AI風プロフィールです。MVPの公式AI比較対象ではなく、将来機能 / 非MVP扱いとして整理します(joinMyAi経路削除済み、詳細はセクション5.3参照)。
現時点ではユーザー認証・所有者管理は未実装です。
 
⸻
 
1. 技術スタック
 
1.1 フレームワーク / バージョン
 
package.json で確認済み。
 
{
  "name": "kompari",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "firebase": "^12.13.0",
    "next": "16.2.6",
    "openai": "^6.39.0",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.6",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
 
1.2 言語
 
* TypeScript
* React / TSX
 
1.3 CSS手法
 
* Tailwind CSS v4
* app/globals.css
* 各TSX内で Tailwind utility class を直接指定
 
1.4 DB / ORM
 
* DB: Firebase Firestore
* ORM: 未使用
 
使用中のFirestore collection:
 
races
myAis
votes
 
1.5 認証
 
* Firebase Auth
* Googleログイン
* 現時点では管理画面のみ認証付き
* 一般ユーザー向けログインは未着手
 
管理者判定は以下の環境変数で行う。
 
NEXT_PUBLIC_ADMIN_EMAIL
 
1.6 デプロイ先
 
* Vercel
 
1.7 使用中の外部API
 
実装済み・使用中:
 
Firebase Authentication
Firebase Firestore
 
実装済み・本番稼働状況は未確認:
 
openai / @anthropic-ai/sdk / @google/genai パッケージ
OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY / DEEPSEEK_API_KEY / XAI_API_KEY
 
app/api/generate-prediction/route.ts は、実AI呼び出し構造(callOpenAiCompatible / callGemini / callAnthropic による provider 別呼び出し構造)を実装済みです。
APIキーが設定されており実呼び出しが成功すればそのAIの実際の応答を使用し、APIキー未設定または実呼び出し失敗時は mock fallback(候補リストとAI名に応じたテンプレート予測)を返します。
本番環境で実際にAPIキーが設定され実AIが稼働しているか、mock fallbackのままかは、今回のdocs整地時点では未確認です。「実AIで本番稼働中」と断定しないこと。
 
⸻
 
2. フォルダ構成
 
主要構成は以下です。
 
kompari
├─ app
│  ├─ layout.tsx
│  ├─ page.tsx
│  ├─ globals.css
│  ├─ favicon.ico
│  │
│  ├─ admin
│  │  ├─ layout.tsx
│  │  ├─ page.tsx
│  │  ├─ edit
│  │  │  └─ [id]
│  │  │     └─ page.tsx
│  │  └─ results
│  │     └─ page.tsx
│  │
│  ├─ ai
│  │  └─ [slug]
│  │     └─ page.tsx
│  │
│  ├─ api
│  │  └─ generate-prediction
│  │     └─ route.ts
│  │
│  ├─ disclaimer
│  │  └─ page.tsx
│  ├─ my-ai
│  │  ├─ page.tsx
│  │  └─ [id]
│  │     └─ page.tsx
│  ├─ notifications
│  │  └─ page.tsx
│  ├─ privacy
│  │  └─ page.tsx
│  ├─ race
│  │  └─ [slug]
│  │     └─ page.tsx
│  ├─ races
│  │  └─ page.tsx
│  ├─ ranking
│  │  └─ page.tsx
│  └─ terms
│     └─ page.tsx
│
├─ components
│  ├─ BottomNav.tsx
│  ├─ EntryTable.tsx
│  ├─ Hero.tsx
│  ├─ PredictionCard.tsx
│  ├─ SupportDistribution.tsx
│  ├─ TopBar.tsx
│  └─ VoteButtons.tsx
│
├─ data
│  └─ events.ts
│
├─ lib
│  ├─ categories.ts
│  ├─ events.ts
│  └─ firebase.ts
│
├─ firebase.json
├─ firestore.rules
├─ package.json
├─ tsconfig.json
├─ next.config.ts
└─ eslint.config.mjs
 
2.1 主要ファイルの役割
 
app/layout.tsx
 
* サイト全体のRootLayout
* metadata設定済み
* lang="ja" 設定済み
* タイトルは Kompari | AI Prediction Arena
 
app/page.tsx
 
* トップページ
* イベント総数、予測中、AI予測数を表示
* 注目イベント
* すぐ使う導線
* 予測中イベント
* 結果入力済みイベント
* 公開ページから管理メニューは削除済み
 
app/races/page.tsx
 
* イベント一覧
* Firestore races を購読
* カテゴリフィルタ
* ステータスフィルタ
* キーワード検索
* AIコンセンサス本命をカード上に表示
 
app/race/[slug]/page.tsx
 
* イベント詳細ページ
* Firestore races/{id} を購読
* AIコンセンサス表示
* My AI参加
* AI予測 / 候補リスト タブ
* AI別PredictionCard
* 候補カード
* VoteButtons
 
app/ranking/page.tsx
 
* AI的中ランキング
* Firestore races の結果入力済みイベントから集計
* AIごとの的中数、対象数、的中率を算出
 
app/my-ai/page.tsx
 
* My AI一覧
* My AI作成
* My AIごとの予測数、的中数、的中率を集計
* My AI削除UIあり
 
注意: Firestore rules上、一般ユーザーのMy AI削除は制限される可能性があります。
 
app/my-ai/[id]/page.tsx
 
* My AI詳細
* My AIの予測履歴
* カテゴリ別成績
* 最近の予測
 
app/ai/[slug]/page.tsx
 
* 公式AI詳細
* 対象AI:
    * ChatGPT
    * Claude
    * Gemini
    * DeepSeek
* AIごとの予測履歴、的中率、カテゴリ別成績
 
app/admin/layout.tsx
 
* 管理画面共通レイアウト
* Firebase Auth Googleログイン
* NEXT_PUBLIC_ADMIN_EMAIL とログイン中メールを比較
* 管理者以外は管理画面を利用不可
 
app/admin/page.tsx
 
* 管理者用イベント作成画面
* 候補を入力
* 公式AI予測を生成
* Firestore events に保存(races write は Phase 4-d-1 で全廃)
* 5AI(ChatGPT/Claude/Gemini/DeepSeek/Grok)を for ループで逐次呼び出し(Promise.all未使用)。1AI失敗時は event 作成全体が失敗する all-or-nothing 構造
 
app/admin/results/page.tsx
 
* 結果入力画面
* 未入力/入力済みフィルタ
* カテゴリフィルタ
* キーワード検索
* resultWinner と result.winner を保存
 
app/admin/edit/[id]/page.tsx
 
* イベント編集
* カテゴリ、タイトル、会場、開始/締切、候補、結果を編集
* 公式AI予測の再生成
* イベント削除
 
app/api/generate-prediction/route.ts
 
* AI予測生成API
* 実AI呼び出し構造(callOpenAiCompatible / callGemini / callAnthropic)を実装済み。APIキー未設定・実呼び出し失敗時は mock fallback
* failed/omitted を示す status フィールドは明示保存していない。失敗AIは prediction ドキュメントが存在しない「欠落」状態として扱われる
* title, category, aiName, candidates を受け取り、予測JSONを返す
 
components/TopBar.tsx
 
* 上部ナビ
* 左上ハンバーガーメニュー
* 通知バッジ
* 公開メニューから /admin と /admin/results への導線は削除済み
* 管理画面判定用の /admin 処理は残している
 
components/BottomNav.tsx
 
* 下部ナビ
* 管理リンクなし
 
components/VoteButtons.tsx
 
* AI予測に対する「いいね / うーん」投票
* Firestore votes に保存
* localStorage で同一ブラウザの投票状態を保持
 
lib/events.ts
 
* KompariEvent / KompariPrediction / LegacyRaceData の型
* 旧 race データを新しい event 概念に寄せる normalizeRaceToEvent
 
lib/categories.ts
 
* EventCategory
* カテゴリラベル
* カテゴリアイコン
 
lib/firebase.ts
 
* Firebase App
* Firestore
* Firebase Auth
* GoogleAuthProvider
 
⸻
 
3. 実装済み機能
 
3.1 公開画面
 
画面	パス	状態	内容
トップ	/	完成/MVP	イベント数、予測中、AI予測数、注目イベント、導線表示
イベント一覧	/races	完成/MVP	一覧、カテゴリ/状態/キーワードフィルタ
イベント詳細	/race/[slug]	仮実装	機能は動作。最終イメージ風UIへの改修は未着手
ランキング	/ranking	完成/MVP	結果入力済みイベントから的中率を集計
My AI一覧	/my-ai	仮実装	作成・一覧・統計あり。所有者管理は未着手
My AI詳細	/my-ai/[id]	仮実装	My AI別の成績・履歴表示
公式AI詳細	/ai/[slug]	完成/MVP	ChatGPT/Claude/Gemini/DeepSeekの成績表示
通知	/notifications	仮実装	結果未入力イベントを表示。ただし管理者向け導線が残る
利用規約	/terms	仮実装	ページあり
プライバシー	/privacy	仮実装	ページあり
免責事項	/disclaimer	仮実装	ページあり
 
3.2 管理画面
 
画面	パス	状態	内容
管理ログイン	/admin配下	完成/MVP	Googleログイン + 管理者メール判定
イベント作成	/admin	完成/MVP	イベント作成、候補入力、公式AI予測生成
結果入力	/admin/results	完成/MVP	結果保存、ランキング反映
イベント編集	/admin/edit/[id]	完成/MVP	イベント編集、予測再生成、削除
 
3.3 動作確認済み
 
以下は実際に動作確認済み。
 
・npm run build 成功
・GitHub push 成功
・Vercel公開URL表示
・トップページ表示
・イベント一覧表示
・イベント詳細表示
・My AI作成
・My AI参加
・投票
・ランキング表示
・管理者ログイン
・イベント作成
・結果入力
・Firestore rules反映
・公開トップから管理メニュー削除
・左上メニューから管理リンク削除
 
⸻
 
4. データモデル
 
4.1 EventCategory
 
lib/categories.ts
 
export type EventCategory =
  | "horse_racing"
  | "nba"
  | "soccer"
  | "mlb"
  | "crypto"
  | "stocks"
  | "election"
  | "esports";
export const eventCategories: {
  value: EventCategory;
  label: string;
  shortLabel: string;
  emoji: string;
}[] = [
  {
    value: "horse_racing",
    label: "Horse Racing / 競馬",
    shortLabel: "競馬",
    emoji: "🐎",
  },
  {
    value: "nba",
    label: "NBA",
    shortLabel: "NBA",
    emoji: "🏀",
  },
  {
    value: "soccer",
    label: "Soccer / サッカー",
    shortLabel: "サッカー",
    emoji: "⚽",
  },
  {
    value: "mlb",
    label: "MLB",
    shortLabel: "MLB",
    emoji: "⚾",
  },
  {
    value: "crypto",
    label: "Crypto",
    shortLabel: "Crypto",
    emoji: "₿",
  },
  {
    value: "stocks",
    label: "Stocks",
    shortLabel: "Stocks",
    emoji: "📈",
  },
  {
    value: "election",
    label: "Election",
    shortLabel: "Election",
    emoji: "🗳️",
  },
  {
    value: "esports",
    label: "Esports",
    shortLabel: "Esports",
    emoji: "🎮",
  },
];
 
4.2 Prediction
 
lib/events.ts
 
export type KompariPrediction = {
  ai: string;
  main: string;
  second?: string;
  third?: string;
  confidence?: string;
  reason?: string;
  evidence?: string;
  // official AI or user-created AI
  source?: "official" | "user";
  // Firestore ID for My AI
  myAiId?: string;
};
 
4.3 Event
 
lib/events.ts
 
export type KompariEvent = {
  id: string;
  category: EventCategory;
  title: string;
  // 候補リスト
  candidates: string[];
  startsAt?: string;
  participants?: string[];
  predictions: KompariPrediction[];
  result?: {
    winner?: string;
    second?: string;
    third?: string;
  };
  venue?: string;
  startsIn?: string;
  resultWinner?: string;
  createdAt?: unknown;
};
 
4.4 LegacyRaceData
 
lib/events.ts
 
export type LegacyRaceData = {
  id: string;
  category?: string;
  title?: string;
  venue?: string;
  startsIn?: string;
  resultWinner?: string;
  candidates?: string[];
  predictions?: KompariPrediction[];
  createdAt?: unknown;
  result?: {
    winner?: string;
    second?: string;
    third?: string;
  };
};
 
4.5 normalizeRaceToEvent
 
lib/events.ts
 
export function normalizeRaceToEvent(race: LegacyRaceData): KompariEvent {
  const predictions = race.predictions || [];
  return {
    id: race.id,
    category: normalizeCategory(race.category),
    title: race.title || "無題のイベント",
    candidates: normalizeCandidates(race.candidates, predictions),
    startsAt: undefined,
    participants: [],
    predictions,
    result: race.resultWinner
      ? {
          winner: race.resultWinner,
        }
      : race.result || undefined,
    venue: race.venue || "",
    startsIn: race.startsIn || "",
    resultWinner: race.resultWinner || race.result?.winner || "",
    createdAt: race.createdAt,
  };
}
 
4.6 My AI
 
app/my-ai/page.tsx / app/my-ai/[id]/page.tsx / app/race/[slug]/page.tsx
 
type MyAi = {
  id: string;
  name: string;
  style: string;
  strengthCategory: string;
  description: string;
  createdAt?: unknown;
};
 
イベント詳細側では createdAt を持たないローカル型も使用。
 
type MyAi = {
  id: string;
  name: string;
  style: string;
  strengthCategory: string;
  description: string;
};
 
4.7 Vote
 
components/VoteButtons.tsx
 
type VoteType = "up" | "down" | null;
type VoteButtonsProps = {
  eventId: string;
  ai: string;
};
type VoteCounts = {
  up: number;
  down: number;
};
 
app/ai/[slug]/page.tsx / app/my-ai/[id]/page.tsx
 
type VoteDoc = {
  eventId?: string;
  ai?: string;
  up?: number;
  down?: number;
};
 
4.8 AI成績 / 的中率
 
公式AI詳細側:
 
type RecentPrediction = {
  eventId: string;
  title: string;
  category: string;
  main: string;
  confidence?: string;
  resultWinner: string;
  hit: boolean | null;
};
type AiStats = {
  total: number;
  finished: number;
  hit: number;
  pending: number;
  hitRate: number;
  categories: Record<
    string,
    {
      total: number;
      finished: number;
      hit: number;
      rate: number;
    }
  >;
  recent: RecentPrediction[];
};
 
My AI詳細側:
 
type MyAiPredictionRow = {
  eventId: string;
  title: string;
  category: string;
  main: string;
  confidence?: string;
  resultWinner: string;
  hit: boolean | null;
};
type MyAiStats = {
  total: number;
  finished: number;
  hit: number;
  pending: number;
  hitRate: number;
  categories: Record<
    string,
    {
      total: number;
      finished: number;
      hit: number;
      rate: number;
    }
  >;
  recent: MyAiPredictionRow[];
};
 
的中判定ロジック:
 
const hit = isFinished ? prediction.main === resultWinner : null;
 
的中率:
 
stats.hitRate =
  stats.finished > 0
    ? Math.round((stats.hit / stats.finished) * 1000) / 10
    : 0;
 
カテゴリ別的中率:
 
item.rate =
  item.finished > 0
    ? Math.round((item.hit / item.finished) * 1000) / 10
    : 0;
 
4.9 Firestore collection
 
races
 
イベント本体。
 
主なフィールド:
 
{
  category: string;
  title: string;
  venue: string;
  startsIn: string;
  candidates: string[];
  resultWinner: string;
  result: {
    winner?: string;
    second?: string;
    third?: string;
  } | null;
  predictions: KompariPrediction[];
  createdAt: serverTimestamp();
}
 
myAis
 
My AI本体。
 
{
  name: string;
  style: string;
  strengthCategory: string;
  description: string;
  createdAt: serverTimestamp();
}
 
votes
 
AI予測への投票。
 
ドキュメントID:
 
`${eventId}__${encodeURIComponent(ai)}`
 
保存内容:
 
{
  eventId: string;
  ai: string;
  up: number;
  down: number;
  updatedAt: serverTimestamp();
}
 
⸻
 
5. AI予測パイプライン
 
5.1 現在の状態
 
AI予測生成は、実AI呼び出し構造(callOpenAiCompatible / callGemini / callAnthropic による provider 別呼び出し構造)を実装済みです。
APIキー未設定、または実呼び出し失敗時は mock fallback します。稼働状態(実AI / mock)はAPIキー設定に依存し、本番の実際の設定状況は今回のdocs整地時点では未確認です。「実AIで本番稼働中」とは断定しません。
 
実装済みの流れは以下。
 
管理画面 /admin
  ↓
OFFICIAL_AI_NAMES = ["ChatGPT", "Claude", "Gemini", "DeepSeek", "Grok"](lib/ai/official-ai.ts に正本化)
  ↓
各AI名ごとに /api/generate-prediction へPOST(forループで逐次、Promise.all未使用)
  ↓
API route が実API呼び出し(成功時)または mock fallback(APIキー未設定・失敗時)で main / second / third / confidence / reason / evidence を返す
  ↓
Firestore events/{eventId}/predictions/{predictionId} サブコレクションに保存(Phase 2b 以降。races write は Phase 4-d-1 で全廃)
 
createEvent 経由では、5AI逐次呼び出し中に1AIでも失敗すると event 作成全体が失敗する all-or-nothing 構造です。failed/omitted を示す status フィールドは明示保存しておらず、失敗AIは prediction ドキュメントが存在しない「欠落」状態として扱われます。
 
5.2 公式AI予測生成
 
app/admin/page.tsx
 
import { OFFICIAL_AI_NAMES } from "@/lib/ai/official-ai";
// OFFICIAL_AI_NAMES = ["ChatGPT", "Claude", "Gemini", "DeepSeek", "Grok"]
for (const aiName of OFFICIAL_AI_NAMES) {
  const response = await fetch("/api/generate-prediction", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: title.trim(),
      category,
      aiName,
      candidates,
    }),
  });
  if (!response.ok) {
    throw new Error(`${aiName}の予測生成に失敗しました`);
  }
  const data = (await response.json()) as KompariPrediction;
  generated.push({
    ...data,
    ai: aiName,
    source: "official",
  });
}
 
5.3 My AI参加時の予測生成(削除済み・過去の実装)
 
かつて app/race/[slug]/page.tsx に、My AI参加時に races.predictions へ updateDoc で追記する joinMyAi 経路が存在しましたが、Phase 4-d-3 で削除済みです。
 
現在、My AI を新規参加させる active な書き込み導線はコード上存在しません。既存の My AI 予測データは、削除された経路が過去に書き込んだ legacy データとして races コレクションに残っています。
 
My AI は MVP非優先 / 将来機能として整理します。将来的な外部API連携での作り直しを前提とした保留状態です。
 
5.4 API route
 
app/api/generate-prediction/route.ts
 
実装済みの主な処理:
 
* runtime = "nodejs"
* POSTのみ
* title 必須
* category デフォルトは horse_racing
* aiName デフォルトは ChatGPT
* candidates が2件未満ならカテゴリ別デフォルト候補を利用
* AI名に応じて候補順をローテーション
* main, second, third, confidence, reason, evidence を返す
 
5.5 使用プロンプト全文
 
mock fallback経路(APIキー未設定・実呼び出し失敗時)では、外部AI APIへのプロンプト送信自体を行わず、API route内のテンプレート関数(下記)で理由文を生成しています。
 
実API呼び出し経路では、lib/ai/prompt.ts の buildPredictionPrompt がプロンプトを構築し、各provider(callOpenAiCompatible / callGemini / callAnthropic)から呼び出されています(存在確認済み: 2026-07-05)。プロンプト全文の内容・設計意図は今回のdocs整地では調査していません。
 
mock fallback時のテンプレート関数:
 
function categoryReason(
  category: string,
  aiName: string,
  title: string,
  main: string,
  candidates: string[]
) {
  // カテゴリごとに固定文言を返す
}
function categoryEvidence(category: string) {
  // カテゴリごとに固定文言を返す
}
 
5.6 出力JSONスキーマ
 
現在の /api/generate-prediction の返却形式。
 
{
  ai: string;
  main: string;
  second: string;
  third: string;
  confidence: string;
  reason: string;
  evidence: string;
}
 
Firestore保存時は以下の拡張が入る。
 
公式AI:
 
{
  ...data,
  ai: aiName,
  source: "official"
}
 
My AI:
 
{
  ...data,
  ai: selectedMyAi.name,
  source: "user",
  myAiId: selectedMyAi.id
}
 
⸻
 
6. 環境変数
 
.env.local に必要なキー。
 
値は伏せる。
 
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
XAI_API_KEY=
NEXT_PUBLIC_ADMIN_EMAIL=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
 
注意:
 
NEXT_PUBLIC_ADMIN_EMAIL が .env.local 内で重複していたことがある。
最終的には1つに整理すること。
 
6.1 Firebase初期化
 
lib/firebase.ts
 
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
 
⸻
 
7. Firestore rules
 
現在採用したルール方針。
 
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null
        && request.auth.token.email == "g0930035@gmail.com";
    }
    // イベント本体
    // 一般ユーザーは閲覧のみ
    // 作成・編集・削除は管理者だけ
    match /races/{raceId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }
    // 投票
    // 一般ユーザーも投票できる
    // 削除は管理者だけ
    match /votes/{voteId} {
      allow read: if true;
      allow create, update: if true;
      allow delete: if isAdmin();
    }
    // My AI
    // 一般ユーザーも作成はできる
    // 編集・削除は管理者だけ
    match /myAis/{aiId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if isAdmin();
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
 
firebase.json
 
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
 
重要:
 
ローカルの firestore.rules をGit管理している。
ただし、Firebase Consoleへの反映は自動ではない。
Firebase CLIでdeployするか、Firebase Console側にも反映が必要。
 
⸻
 
8. 既知のバグ・技術的負債
 
8.1 本物のAI API連携(実装済み・稼働状況未確認)
 
実AI呼び出し構造(callOpenAiCompatible / callGemini / callAnthropic による provider 別呼び出し構造)は実装済み。
未確認事項: 本番でAPIキーが実際に設定され実AIが稼働しているか、mock fallbackのままか。
 
8.2 My AI参加とFirestore rulesの不整合(解消済み・legacy note)
 
過去、My AI参加(joinMyAi)は races.predictions を配列更新で追記していました。当時のrulesでは races の update は管理者のみに制限されており、一般ユーザーがMy AI参加を行うとrules上失敗する可能性がある、という不整合が存在していました。
 
joinMyAi 経路は Phase 4-d-3 で削除済みのため、この不整合を生む書き込み経路自体が現在は存在せず、問題は発生しません。
 
将来、My AIの外部API連携仕様(セクション13.4)などでMy AI予測の新規書き込み経路を復活させる場合は、現行rules(events/{eventId}/predictions の create/update も isAdmin() のみ)のもとで同種の不整合が再発しうるため、以下を再検討する必要があります。
 
対策候補(将来My AI書き込みを復活させる場合):
 
・ユーザー認証を入れる
・myAis に ownerUid を持たせる
・predictions サブコレクションへの書き込みをAPI Route/Cloud Functions経由にする
 
8.3 My AI所有者管理が未実装
 
myAis に ownerUid がない。
誰が作成したMy AIか識別できない。
 
8.4 My AI編集が未実装
 
My AIの作成・削除UIはあるが、編集UIは未実装。
 
8.5 My AI削除UIとrulesの不整合
 
app/my-ai/page.tsx に deleteMyAi があるが、Firestore rulesでは myAis の delete は管理者のみ。
一般ユーザーが削除すると失敗する可能性がある。
 
8.6 通知ページに管理者向け導線が残っている
 
/notifications 内に以下のような管理者向け導線がある。
 
/admin
/admin/results
 
公開ページとして見せる場合は、非管理者には表示しない、または管理者ページ扱いにする必要がある。
 
8.7 PowerShellでの文字化け
 
Terminal上の Get-Content で日本語が文字化けして表示されることがある。
ただし、サイト上・VSCode上で正常表示されている場合は修正不要。
 
注意:
 
PowerShell上の文字化けだけを見てファイルを全文置き換えしないこと。
 
8.8 race というURL名が残っている
 
将来的には event に統一したい方針。
現時点では以下が残っている。
 
/race/[slug]
races collection
LegacyRaceData
 
8.9 データ正規化が暫定
 
normalizeRaceToEvent で旧raceデータをevent風に変換している。
最終的にはFirestore側のデータモデルも events に統一した方がよい。
 
8.10 予測精度の検証ロジックは単純
 
現在の的中判定は、
 
prediction.main === resultWinner
 
のみ。
 
2位・3位的中、部分点、カテゴリ別の異なる判定条件などは未実装。
 
8.11 投票は匿名・ブラウザ依存
 
投票はlocalStorageで同一ブラウザの投票状態を保持している。
ユーザーIDや不正投票対策は未実装。
 
8.12 SEO / OGP画像
 
metadataは更新済みだが、専用OG画像は未着手。
 
⸻
 
9. 未決定事項
 
9.1 本物のAI API連携方式(実装済み・稼働状況未確認)
 
実装済み: OpenAI / Anthropic / Gemini 互換の各providerを実APIで呼ぶ構造(lib/ai/providers/)を採用。
APIキー未設定・実呼び出し失敗時は mock fallback。
未確認: 本番でのAPIキー設定状況、実際の稼働率。
 
9.2 My AIの所有者管理
 
未決定。
 
候補:
 
・Firebase Auth必須にする
・匿名作成を許す
・ownerUidをmyAisに持たせる
・My AI作成後の編集/削除を本人だけ許可する
 
9.3 予測データの保存先(決定済み・実装済み)
 
正: events/{eventId}/predictions/{predictionId} サブコレクション(Phase 2b で移行済み)。
 
旧: races.predictions 配列に保存(legacy。races write は Phase 4-d-1 で全廃済み、現行の新規書き込み経路はない)。
 
サブコレクション化により解消された課題:
 
・配列更新による複数人参加時の競合
・rulesでの細かい制御のしづらさ(predictions を races 本体と別に create/update/delete 制御可能に)
 
残課題:
 
・My AI参加の権限制御(現行rulesでは predictions の create/update も isAdmin() のみ。My AI書き込みを復活させる場合は別途設計が必要。セクション8.2参照)
 
9.4 URL設計
 
未決定。
 
現状:
 
/race/[slug]
/races
 
将来案:
 
/event/[id]
/events
 
9.5 収益化
 
未着手。
 
候補:
 
・広告
・有料My AI
・高度な分析機能
・API提供
 
9.6 対象カテゴリの優先順位
 
未決定。
 
実装カテゴリは存在するが、どのカテゴリを先に伸ばすかは未決定。
 
現実的な優先候補:
 
1. 競馬
2. NBA / サッカー
3. Crypto
4. Stocks
5. Election / Esports
 
9.7 法務・免責の最終確認
 
未着手。
 
利用規約、プライバシー、免責ページはあるが、専門家レビューは未実施。
 
⸻
 
10. 直近のTODO
 
優先順。
 
10.1 詳細ページUIを添付イメージ風に改善
 
対象:
 
app/race/[slug]/page.tsx
 
目的:
 
・上部イベントカードをより予測アプリ風にする
・AI総合予測カードを追加
・AIコンセンサスをもっと大きく見せる
・My AI参加欄を補助機能として下げる
・AI別予測カードを見やすくする
 
壊してはいけないもの:
 
・Firestore読み込み
・normalizeRaceToEvent
・My AI参加
・VoteButtons
・AI予測 / 候補リスト タブ
・結果入力済み時の的中判定
 
10.2 通知ページの公開/管理者向け整理
 
対象:
 
app/notifications/page.tsx
 
現状、通知ページに /admin への導線がある。
公開ユーザーに見せるなら削除、管理者ページにするなら /admin 配下へ移動。
 
10.3 My AI参加の権限設計
 
現状rulesでは一般ユーザーが races を更新できない。
My AI参加を一般公開するなら設計変更が必要。
 
候補:
 
・Firebase Auth導入
・ownerUid追加
・predictionsをsubcollection化
・API Route経由で安全に追記
 
10.4 本物のAI API連携(実装済み・残課題あり)
 
対象:
 
app/api/generate-prediction/route.ts
 
実装済み:
 
・OpenAI / Anthropic / Gemini 互換API呼び出し(lib/ai/providers/)
・プロンプト構築(lib/ai/prompt.ts の buildPredictionPrompt、詳細な内容は未調査)
・APIキー未設定・失敗時の mock fallback
 
未確認・残課題:
 
・本番でのAPIキー設定状況
・createEvent は5AI逐次呼び出し(forループ、Promise.all未使用)で、1AI失敗時はイベント作成全体が失敗する all-or-nothing 構造
・failed/omitted を示す status フィールドは明示保存していない。失敗AIは prediction ドキュメントが存在しない「欠落」状態として扱われる
 
10.5 My AI編集機能
 
対象:
 
app/my-ai/[id]/page.tsx
app/my-ai/page.tsx
 
やること:
 
・My AI名
・スタイル
・得意カテゴリ
・説明文
 
10.6 Firestore rulesの本番化
 
現状MVPルール。
本番では以下が必要。
 
・ownerUid
・request.auth.uid
・作成者のみ編集/削除
・投票の不正対策
・API Route/Cloud Functions利用検討
 
10.7 OGP画像
 
未着手。
 
やること:
 
・Kompari用OG画像作成
・metadataに画像URL追加
・SNS共有時の見栄え改善
 
10.8 UI最終調整
 
対象:
 
トップ
イベント一覧
イベント詳細
ランキング
My AI
AI詳細
通知
 
やること:
 
・空状態の見栄え
・デモデータの見せ方
・スマホ430px幅での余白
・下部ナビとの重なり
・カード内の情報量
 
10.9 デモデータ整備
 
すでにデモデータは投入済み。
ただし、引き継ぎ後は以下を確認すること。
 
・予測中イベント
・結果入力済みイベント
・My AI
・ランキング反映用データ
 
10.10 法務ページの最終レビュー
 
対象:
 
/terms
/privacy
/disclaimer
 
現状ページは存在するが、正式リリース前に文言レビューが必要。
 
⸻
 
11. 引き継ぎ時の注意
 
11.1 PowerShellでdynamic routeを読む場合
 
[slug] や [id] を含むパスは -LiteralPath を使う。
 
Get-Content -Raw -LiteralPath "app/race/[slug]/page.tsx"
Get-Content -Raw -LiteralPath "app/my-ai/[id]/page.tsx"
Get-Content -Raw -LiteralPath "app/ai/[slug]/page.tsx"
 
通常パスは以下でよい。
 
Get-Content -Raw "app/page.tsx"
Get-Content -Raw "app/api/generate-prediction/route.ts"
 
11.2 文字化け対応
 
Terminalで文字化けしても、ブラウザ表示・VSCode表示が正常なら修正不要。
文字化けを理由に安易に Set-Content で全文置き換えしない。
 
11.3 変更時の基本確認
 
毎回以下を実行。
 
npm run build
git status
 
成功後にコミット。
 
git add .
git commit -m "変更内容"
git push
 
11.4 現在の完成度
 
目安:
 
MVP公開β版: 85%前後
完成UI: 60%前後
本格サービス: 60%未満
収益化前提: 45〜50%程度
 
現時点では、機能追加よりも以下が重要。
 
・詳細ページUI改善
・My AI権限設計
・本物のAI API連携
・通知ページの管理者導線整理
 
⸻
 
12. 新担当者への最初の推奨作業
 
最初にやるべき順番。
 
1. npm install
2. .env.local を設定
3. npm run build
4. npm run dev
5. /, /races, /race/[slug], /ranking, /my-ai を確認
6. Firebase ConsoleでFirestore rules確認
7. /admin にGoogleログインできるか確認
8. app/race/[slug]/page.tsx のUI改修から開始
 
以上。


Kompari
AI予測サイトの作成



本日はどのようなお手伝いをさせていただけますか？


チャットを開始して会話を整理し、プロジェクトナレッジを再利用しましょう。
メモリー
あなたのみ
プロジェクトの記憶は数回のチャット後にここに表示されます。

手順
Claudeの回答をカスタマイズする指示を追加

ファイル
プロジェクト容量の3%を使用中

16. 予測コンテキストデータ / Factor Tags
502行

text



15. 主要AIのバージョン別成績管理
241行

text



13. 追加されたプロダクト方針
170行

text



kompari-v2.html
992行

html



Kompari 引き継ぎドキュメント
1381行

text


F71DCE81D34B485B9AAC2DEF883391FF.png

32A88A03C3C041DA8B5A07A131312F04.png

57EEAA62D62D48C885BF2ACEA615EFE1.png

13. 追加されたプロダクト方針
 
以下は、現時点では未実装だが、今後のKompariの方向性として決定した内容。
 
13.1 予測テーマの自動生成
 
現時点では、管理者がイベントを作成している。
 
将来的には、予測対象となるテーマ自体をAIが自動で提案・生成する方針。
 
例:
 
・今夜のNBA注目カード
・週末の競馬重賞
・ビットコイン24時間後価格
・主要株価指数の翌営業日予測
・注目選挙の勝敗予測
 
AIが以下を行う想定。
 
1. 予測に適したテーマを探す
2. イベント候補を作成する
3. 候補者・チーム・銘柄・価格レンジなどを整理する
4. Kompari上に予測イベントとして登録する
 
実装状況:
 
未着手
 
⸻
 
13.2 結果判定の自動化
 
現時点では、管理者が /admin/results から結果を入力している。
 
将来的には、結果判定もAIが外部データソースを参照して自動で行う方針。
 
想定する参照先:
 
・スポーツAPI
・競馬結果API
・暗号資産価格API
・株価API
・選挙結果データ
・その他の信頼できる外部データソース
 
AIの役割:
 
1. 外部APIや公開データを参照する
2. イベントの結果を判定する
3. Kompari上の result / resultWinner を更新する
4. 各AI予測の的中・外れを自動反映する
 
実装状況:
 
未着手
 
⸻
 
13.3 人間ユーザーの役割
 
Kompariでは、人間ユーザーは予測そのものを直接投稿するのではなく、AIが出した予測に対して反応する立場とする。
 
想定する人間ユーザーの行動:
 
・AI予測にいいねする
・AI予測にうーんを押す
・コメントする
・気になるAIをフォローする
・My AIを登録する
・ランキングを見る
 
現時点の実装状況:
 
いいね / うーん: 実装済み
コメント: 未着手
フォロー: 未着手
 
⸻
 
13.4 My AI の将来仕様
 
現時点の My AI は、ユーザーが名前・スタイル・得意カテゴリ・説明文を登録する簡易的なAIプロフィールである。
 
将来的には、ユーザーが自分で作成したAIのAPIをKompariに登録し、そのAIを主要AIと競わせる仕様にする。
 
想定仕様:
 
1. ユーザーが自作AIまたは外部AIのAPIエンドポイントを登録する
2. KompariがイベントごとにそのAPIへ予測リクエストを送る
3. 返ってきた予測を主要AIと同じ形式で表示する
4. 的中率・ランキング・履歴を主要AIと同じ土俵で集計する
 
費用負担:
 
My AIのAPI利用料金は、そのMy AIを登録したユーザー本人が負担する方針。
Kompari側が外部ユーザーAIの推論費用を負担しない。
 
必要になる設計:
 
・My AI所有者管理
・APIキー / エンドポイント登録
・利用料金の責任範囲明記
・不正API対策
・タイムアウト処理
・レスポンスJSONスキーマ検証
・API失敗時の表示
 
実装状況:
 
未着手
 
⸻
 
13.5 主要AIに Grok を追加(実装済み)
 
主要AIの比較対象に Grok を追加する方針。実装済み。
 
主要AI(5種):
 
・ChatGPT
・Claude
・Gemini
・DeepSeek
・Grok
 
実装済みの内容:
 
・lib/ai/official-ai.ts の OFFICIAL_AI_NAMES に Grok を含む5種を正本化
・lib/ai/ai-config.ts に Grok の設定(モデル、XAI_API_KEY)を追加
・AI予測生成APIで Grok を処理
・ランキング集計対象に Grok を含む
 
未確認事項:
 
・Grok用のAIプロフィールページ表示、アイコン/色設定が個別対応済みかは今回のdocs整地では未調査
・本番でGrok APIが実際にAPIキー設定され稼働しているかは未確認
 
実装状況:
 
実装済み(commit 2960c96 で公式AIリスト正本化)
 
⸻
 
14. 更新後の長期構想
 
Kompariの最終構想は、単なるAI予測表示サービスではなく、以下の流れを自動化したAI予測競技場である。
 
AIが予測テーマを見つける
↓
主要AIとMy AIが予測する
↓
人間ユーザーがいいね・コメントで反応する
↓
外部API等を参照してAIが結果を判定する
↓
的中率・信頼度・人気がランキング化される
 
これにより、Kompariは以下を可視化するサービスになる。
 
・どのAIが何に強いか
・どのMy AIが優秀か
・人間が支持したAI予測は当たるのか
・AIごとの予測傾向
・カテゴリ別のAI成績
 
現時点では、イベント作成・結果入力・My AI登録はMVP実装であり、完全自動化は未着手。


Kompari
AI予測サイトの作成



本日はどのようなお手伝いをさせていただけますか？


チャットを開始して会話を整理し、プロジェクトナレッジを再利用しましょう。
メモリー
あなたのみ
プロジェクトの記憶は数回のチャット後にここに表示されます。

手順
Claudeの回答をカスタマイズする指示を追加

ファイル
プロジェクト容量の3%を使用中

16. 予測コンテキストデータ / Factor Tags
502行

text



15. 主要AIのバージョン別成績管理
241行

text



13. 追加されたプロダクト方針
170行

text



kompari-v2.html
992行

html



Kompari 引き継ぎドキュメント
1381行

text


F71DCE81D34B485B9AAC2DEF883391FF.png

32A88A03C3C041DA8B5A07A131312F04.png

57EEAA62D62D48C885BF2ACEA615EFE1.png

15. 主要AIのバージョン別成績管理
 
以下は、現時点では未実装だが、今後の重要方針として決定した内容。
 
15.1 基本方針
 
主要AIについては、AI単体の総合成績だけでなく、モデルバージョンごとの成績も保存・集計・表示する。
 
例:
 
ChatGPT
├─ ChatGPT 全体の成績
├─ GPT-5.5 の成績
├─ GPT-5 の成績
└─ GPT-4.1 の成績
 
同様に、Claude、Gemini、DeepSeek、Grok についても、バージョン単位で成績を管理する。
 
目的:
 
・AIブランド全体としての強さを見られる
・モデルバージョンごとの実力差を見られる
・新モデルが旧モデルより本当に強いか検証できる
・カテゴリ別に、どのモデルが何に強いか比較できる
 
実装状況:
 
未着手
 
⸻
 
15.2 ユーザー体験
 
ユーザーはAI詳細ページやランキングページで、以下を直感的に切り替えて確認できるようにする。
 
例: ChatGPT詳細ページ
 
ChatGPT 総合
GPT-5.5
GPT-5
GPT-4.1
 
表示する指標:
 
・総予測数
・結果確定済み数
・的中数
・的中率
・カテゴリ別的中率
・最近の予測
・バージョンごとの順位
 
ランキングページでは、以下の2種類を切り替えられるようにする。
 
1. AIブランド別ランキング
   例: ChatGPT / Claude / Gemini / DeepSeek / Grok
2. モデルバージョン別ランキング
   例: GPT-5.5 / Claude Fable 5 / Gemini 3 / Grok 4 など
 
実装状況:
 
未着手
 
⸻
 
15.3 データモデル変更案
 
現状の KompariPrediction は ai のみを持っている。
 
現状:
 
export type KompariPrediction = {
  ai: string;
  main: string;
  second?: string;
  third?: string;
  confidence?: string;
  reason?: string;
  evidence?: string;
  source?: "official" | "user";
  myAiId?: string;
};
 
将来的には、AIブランドとモデルバージョンを分けて保存する。
 
変更案:
 
export type KompariPrediction = {
  // 表示名。例: "ChatGPT", "Claude", "Gemini", "DeepSeek", "Grok", "My AI Name"
  ai: string;
  // AIブランド。例: "chatgpt", "claude", "gemini", "deepseek", "grok"
  aiProvider?: string;
  // モデル名。例: "GPT-5.5", "Claude Fable 5", "Gemini 3 Pro", "Grok 4"
  aiModel?: string;
  // モデルバージョン識別子。例: "gpt-5.5", "claude-fable-5"
  aiModelId?: string;
  main: string;
  second?: string;
  third?: string;
  confidence?: string;
  reason?: string;
  evidence?: string;
  source?: "official" | "user";
  myAiId?: string;
};
 
注意:
 
既存データには aiProvider / aiModel / aiModelId が存在しないため、
後方互換のために ai のみでも表示・集計できるようにする必要がある。
 
実装状況:
 
未着手
 
⸻
 
15.4 ランキング集計方針
 
ランキングは、以下の2階層で集計する。
 
AIブランド単位
 
例:
 
ChatGPT 全体
Claude 全体
Gemini 全体
DeepSeek 全体
Grok 全体
 
集計キー:
 
prediction.aiProvider || prediction.ai
 
モデルバージョン単位
 
例:
 
GPT-5.5
Claude Fable 5
Gemini 3 Pro
DeepSeek V3
Grok 4
 
集計キー:
 
prediction.aiModelId || prediction.aiModel || prediction.ai
 
的中判定は現状と同じく、まずは以下で行う。
 
prediction.main === resultWinner
 
実装状況:
 
未着手
 
⸻
 
15.5 AI詳細ページの将来仕様
 
現状の /ai/[slug] は、AI名単位で成績を表示している。
 
将来的には、以下のように拡張する。
 
/ai/chatgpt
 
表示内容:
 
・ChatGPT全体の成績
・モデル別成績一覧
・GPT-5.5の成績
・GPT-5の成績
・GPT-4.1の成績
・カテゴリ別の強さ
・最近の予測履歴
 
UI案:
 
上部:
ChatGPT 総合成績カード
タブ:
総合 / モデル別 / カテゴリ別 / 履歴
モデル別:
GPT-5.5
GPT-5
GPT-4.1
 
実装状況:
 
未着手
 
⸻
 
15.6 My AIとの関係
 
My AIについても、将来的に外部APIを登録する仕様になった場合は、以下を持たせる可能性がある。
 
type MyAi = {
  id: string;
  name: string;
  style: string;
  strengthCategory: string;
  description: string;
  apiEndpoint?: string;
  apiModelName?: string;
  ownerUid?: string;
};
 
ただし、My AIは基本的にユーザー独自AIとして扱うため、主要AIのようなブランド/バージョン階層とは別管理にする。
 
実装状況:
 
未着手
 
⸻
 
15.7 実装時の注意
 
実装時は、既存データを壊さないようにする。
 
既存予測データ:
 
prediction.ai = "ChatGPT"
 
新データ:
 
prediction.ai = "ChatGPT"
prediction.aiProvider = "chatgpt"
prediction.aiModel = "GPT-5.5"
prediction.aiModelId = "gpt-5.5"
 
移行方針:
 
・既存データは ai のみで集計可能にする
・新規予測から aiProvider / aiModel / aiModelId を保存する
・ランキング画面ではブランド別/モデル別を切り替え可能にする
・AI詳細ページではブランド全体とモデル別を両方表示する
 
実装状況:
 
未着手


Kompari
AI予測サイトの作成



本日はどのようなお手伝いをさせていただけますか？


チャットを開始して会話を整理し、プロジェクトナレッジを再利用しましょう。
メモリー
あなたのみ
プロジェクトの記憶は数回のチャット後にここに表示されます。

手順
Claudeの回答をカスタマイズする指示を追加

ファイル
プロジェクト容量の3%を使用中

16. 予測コンテキストデータ / Factor Tags
502行

text



15. 主要AIのバージョン別成績管理
241行

text



13. 追加されたプロダクト方針
170行

text



kompari-v2.html
992行

html



Kompari 引き継ぎドキュメント
1381行

text


F71DCE81D34B485B9AAC2DEF883391FF.png

32A88A03C3C041DA8B5A07A131312F04.png

57EEAA62D62D48C885BF2ACEA615EFE1.png

16. 予測コンテキストデータ / Factor Tags
 
以下は、現時点では未実装だが、Kompariの長期的な重要方針として追加する。
 
16.1 基本方針
 
Kompariでは、各予測イベントに対して、単なる候補・予測・結果だけでなく、予測に影響しうる細かい条件データを構造化して保存する。
 
これを 予測コンテキストデータ または Factor Tags と呼ぶ。
 
目的:
 
・AIが予測時に参照できる補助情報を増やす
・ユーザーが細かい条件で予測イベントを検索できるようにする
・「どの条件が当たりやすさに関係したか」を後から分析できるようにする
・AIごとの得意条件、苦手条件を可視化する
 
実装状況:
 
未着手
 
⸻
 
16.2 対象データの分類
 
予測イベントごとに、以下のようなメタデータを保存できるようにする。
 
Environment & Situation
 
イベントの環境・状況データ。
 
Weather_Type
Special_Weather
Temperature
Humidity
Barometric_Pressure
Ambient_Sound
Season
Calendar_Event
Lunar_Calendar
Time_Zone
Moon_Phase
Location_Type
Venue_Category
Venue_Name
 
利用例:
 
・雨の日の競馬
・屋外スタジアムの夜間試合
・低気圧の日のパフォーマンス
・満月の日の勝率
・週末開催のイベント
 
⸻
 
Character / Participant Profile
 
選手、馬、チーム、候補者、AIモデルなど、予測対象となる主体のプロフィールデータ。
 
Age
Gender
Height_cm
Weight_kg
Body_Type
Dominant_Hand_Foot
Nationality
Birthplace_Residence
Languages
Current_Job
Career_Length
Achievements
Appearance_Tags
 
注意:
 
個人情報・センシティブ情報を扱う場合は、公開情報または本人が提供した情報に限定する。
民族、信仰、思想、家族構成などは、予測に必要な場合でも慎重に扱う。
 
実装時は、まずスポーツ選手・競走馬・チームなど、公開データとして扱いやすいものから開始する。
 
⸻
 
Object / Equipment Properties
 
道具、装備、車両、衣服、使用アイテムなどのデータ。
 
Brand_Manufacturer
Country_of_Origin
Production_Date
Product_Edition
Item_Class
Primary_Material
Power_Source
Condition
Primary_Color
Secondary_Color
Color_Finish
Design_Style
Modification_Tags
 
利用例:
 
・競走馬の馬具
・選手のシューズ
・車両スペック
・道具変更後の成績
・ユニフォーム色と勝率
 
⸻
 
Region / Faction
 
地域、チーム、勢力、国、コミュニティに関するデータ。
 
Faction_Name
Population
Geography_Type
Political_System
Approval_Rating
Security_Level
Economic_Gap
Infrastructure_Status
Community_Personality
Primary_Industry
Cultural_Taboos
 
利用例:
 
・ホーム地域の支持率
・政治イベントの地域別傾向
・都市型チームと地方型チーム
・インフラ障害時のイベント影響
 
⸻
 
Jinx & Superstition
 
ジンクス、験担ぎ、ルーティン、隠れ条件のデータ。
 
Trigger_Action
Pre_Match_Restriction
Abstinence_Target
Lucky_Gear
Lucky_Charm
Power_Food
Lucky_Number
Jinx_Condition
 
利用例:
 
・雨の日は勝率が上がる
・特定の実況者の時は負けやすい
・特定のユニフォーム色で成績が良い
・満月の日に荒れやすい
・大安開催のイベントで本命が勝ちやすい
 
⸻
 
16.3 予測時の使い方
 
AIが予測を行う際、イベント本体の情報に加えて、上記のコンテキストデータを参照する。
 
予測入力イメージ:
 
イベント名:
レイカーズ vs ウォリアーズ
カテゴリ:
NBA
候補:
レイカーズ / ウォリアーズ
通常情報:
順位、直近成績、怪我人、対戦成績
追加コンテキスト:
Weather_Type: 晴れ
Location_Type: 完全屋内
Venue_Name: Crypto.com Arena
Time_Zone: 夜間
Calendar_Event: 週末
Jinx_Condition: ホームチームは週末夜の試合に強い
 
AIの出力では、どの条件を重視したかも表示する。
 
表示例:
 
ChatGPTの予測:
本命: レイカーズ
重視した条件:
・ホーム開催
・週末夜の試合
・直近5試合の得点傾向
・主力選手の出場状況
 
実装状況:
 
未着手
 
⸻
 
16.4 ユーザー向け表示
 
イベント詳細ページでは、AI予測の下に補助情報として表示する。
 
表示例:
 
この予測に使われた注目条件
天候: 晴れ
会場: 完全屋内
時間帯: 夜間
開催日: 週末
ジンクス: ホームチームが週末夜に強い
 
AI別に、重視した条件を表示する。
 
ChatGPTが重視:
ホーム成績 / 直近成績 / 怪我人
Claudeが重視:
対戦相性 / 守備効率 / 試合間隔
Grokが重視:
SNS上の盛り上がり / 直近ニュース / 番狂わせ要素
 
実装状況:
 
未着手
 
⸻
 
16.5 検索・絞り込み機能
 
ユーザーが細かい条件でイベントや予測を検索できるようにする。
 
検索例:
 
・雨の日の競馬だけを見る
・屋外イベントだけを見る
・満月の日の予測を見る
・台風の日の予測を見る
・大安の日の予測を見る
・Grokが穴狙いした予測を見る
・ChatGPT 5.5が低気圧の日に出した予測を見る
・My AIがジンクスを重視した予測を見る
 
必要な検索軸:
 
カテゴリ
AI名
AIモデルバージョン
天候
季節
時間帯
会場
候補者/チーム/馬
タグ
ジンクス
結果
的中/外れ
 
実装状況:
 
未着手
 
⸻
 
16.6 データモデル案
 
現時点の KompariEvent には、詳細なコンテキストデータは存在しない。
 
将来的には、イベントに context を追加する。
 
export type EventContext = {
  environment?: {
    weatherType?: string;
    specialWeather?: string;
    temperature?: number;
    humidity?: number;
    barometricPressure?: number | string;
    ambientSound?: string;
  };
  temporal?: {
    season?: string;
    calendarEvent?: string;
    lunarCalendar?: string;
    timeZone?: string;
    moonPhase?: string;
  };
  location?: {
    locationType?: string;
    venueCategory?: string;
    venueName?: string;
  };
  factorTags?: string[];
  jinx?: {
    triggerAction?: string;
    preMatchRestriction?: string;
    abstinenceTarget?: string[];
    luckyGear?: string;
    luckyCharm?: string;
    powerFood?: string;
    luckyNumber?: number;
    jinxCondition?: string;
  };
};
 
KompariEvent の変更案:
 
export type KompariEvent = {
  id: string;
  category: EventCategory;
  title: string;
  candidates: string[];
  startsAt?: string;
  participants?: string[];
  predictions: KompariPrediction[];
  result?: {
    winner?: string;
    second?: string;
    third?: string;
  };
  venue?: string;
  startsIn?: string;
  resultWinner?: string;
  createdAt?: unknown;
  context?: EventContext;
};
 
実装状況:
 
未着手
 
⸻
 
16.7 予測ごとの使用ファクター
 
各AIがどの条件を重視したかを保存するため、KompariPrediction に以下を追加する案。
 
export type PredictionFactor = {
  key: string;
  label: string;
  value?: string | number;
  weight?: number;
  direction?: "positive" | "negative" | "neutral";
  note?: string;
};
 
KompariPrediction の変更案:
 
export type KompariPrediction = {
  ai: string;
  aiProvider?: string;
  aiModel?: string;
  aiModelId?: string;
  main: string;
  second?: string;
  third?: string;
  confidence?: string;
  reason?: string;
  evidence?: string;
  source?: "official" | "user";
  myAiId?: string;
  usedFactors?: PredictionFactor[];
};
 
表示例:
 
usedFactors:
[
  {
    key: "home_advantage",
    label: "ホーム開催",
    value: "レイカーズ",
    weight: 0.8,
    direction: "positive",
    note: "ホームでの直近成績が良い"
  },
  {
    key: "injury_risk",
    label: "怪我人リスク",
    value: "ウォリアーズ主力1名欠場",
    weight: 0.6,
    direction: "negative",
    note: "得点力低下の可能性"
  }
]
 
実装状況:
 
未着手
 
⸻
 
16.8 Firestore設計案
 
MVPでは races ドキュメント内に context を持たせる。
 
races/{eventId}
  title
  category
  candidates
  predictions
  result
  context
 
将来的に検索性を高める場合は、タグやファクターを別collectionに分離する。
 
eventFactors/{factorId}
  eventId
  category
  key
  label
  value
  tags
 
または、
 
events/{eventId}/factors/{factorId}
 
検索・分析を重視するなら、最終的には以下のような構成が望ましい。
 
events
predictions
predictionFactors
eventFactors
aiModels
myAis
votes
comments
 
実装状況:
 
未着手
 
⸻
 
16.9 実装時の優先順位
 
最初から全項目を実装すると重くなるため、段階的に進める。
 
Phase 1
 
イベントに基本コンテキストだけ追加。
 
Weather_Type
Season
Time_Zone
Location_Type
Venue_Name
factorTags
 
Phase 2
 
AI予測ごとに usedFactors を追加。
 
・AIが重視した条件
・条件ごとのプラス/マイナス
・簡単な理由
 
Phase 3
 
検索機能を追加。
 
・天候で検索
・時間帯で検索
・AIモデルで検索
・的中/外れで検索
・ジンクスで検索
 
Phase 4
 
分析機能を追加。
 
・雨の日に強いAI
・夜間イベントに強いAI
・低気圧の日に弱いAI
・ジンクス重視予測の的中率
・カテゴリ別ファクターランキング
 
実装状況:
 
未着手
 
⸻
 
16.10 注意点
 
この仕組みはKompariの差別化要素になる一方で、以下に注意する。
 
・個人情報やセンシティブ情報を無制限に収集しない
・公開情報、API提供情報、ユーザーが明示的に提供した情報に限定する
・人種、信仰、思想、健康状態などは慎重に扱う
・予測根拠として表示する場合、断定的に書きすぎない
・ジンクス系は「参考情報」「傾向」として扱う
・本命予測の根拠と、エンタメ要素を分けて表示する
 
特に、ジンクスや験担ぎデータは面白いが、科学的根拠が弱い場合もあるため、表示上は以下のように扱う。
 
参考ファクター
隠れ条件
オカルト指標
エンタメ要素
 
実装状況:
 
未着手
