"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { getCategoryEmoji, getCategoryLabel } from "@/lib/categories";
import {
  getResultWinner,
  normalizeRaceToEvent,
  type KompariEvent,
  type KompariPrediction,
  type LegacyRaceData,
} from "@/lib/events";

type AiProfile = {
  name: string;
  label: string;
  description: string;
  style: string;
  icon: string;
  iconBg: string;
  accent: string;
};

type VoteDoc = {
  eventId?: string;
  ai?: string;
  up?: number;
  down?: number;
};

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

const aiProfiles: Record<string, AiProfile> = {
  chatgpt: {
    name: "ChatGPT",
    label: "総合バランス型AI",
    description:
      "幅広い情報を整理し、候補全体を比較しながら、もっとも妥当性の高い予測を出すAIです。",
    style: "バランス重視",
    icon: "GPT",
    iconBg: "#10b981",
    accent: "#059669",
  },
  claude: {
    name: "Claude",
    label: "慎重分析型AI",
    description:
      "文脈やリスクを丁寧に確認し、極端な予測よりも安定した判断を重視するAIです。",
    style: "慎重・文脈重視",
    icon: "C",
    iconBg: "#f97316",
    accent: "#ea580c",
  },
  gemini: {
    name: "Gemini",
    label: "データ探索型AI",
    description:
      "複数の比較材料を広く確認し、全体の流れや外部要因を踏まえて予測するAIです。",
    style: "データ・比較重視",
    icon: "G",
    iconBg: "#2563eb",
    accent: "#2563eb",
  },
  deepseek: {
    name: "DeepSeek",
    label: "逆張り探索型AI",
    description:
      "人気や多数派に寄りすぎず、見落とされやすい候補や別シナリオも検討するAIです。",
    style: "逆張り・探索重視",
    icon: "DS",
    iconBg: "#4f46e5",
    accent: "#4f46e5",
  },
};

function formatConfidence(confidence?: string) {
  if (!confidence) return "-";
  if (confidence.includes("%")) return confidence;
  return `${confidence}%`;
}

function isOfficialAiPrediction(
  prediction: KompariPrediction,
  aiName: string
) {
  return (
    prediction.ai === aiName &&
    prediction.source !== "user" &&
    !prediction.myAiId
  );
}

function buildStats(events: KompariEvent[], aiName: string): AiStats {
  const stats: AiStats = {
    total: 0,
    finished: 0,
    hit: 0,
    pending: 0,
    hitRate: 0,
    categories: {},
    recent: [],
  };

  events.forEach((event) => {
    const prediction = event.predictions.find((item) =>
      isOfficialAiPrediction(item, aiName)
    );

    if (!prediction) return;

    const resultWinner = getResultWinner(event);
    const isFinished = !!resultWinner;
    const hit = isFinished ? prediction.main === resultWinner : null;

    stats.total += 1;

    if (!stats.categories[event.category]) {
      stats.categories[event.category] = {
        total: 0,
        finished: 0,
        hit: 0,
        rate: 0,
      };
    }

    stats.categories[event.category].total += 1;

    if (isFinished) {
      stats.finished += 1;
      stats.categories[event.category].finished += 1;

      if (hit) {
        stats.hit += 1;
        stats.categories[event.category].hit += 1;
      }
    } else {
      stats.pending += 1;
    }

    stats.recent.push({
      eventId: event.id,
      title: event.title,
      category: event.category,
      main: prediction.main,
      confidence: prediction.confidence,
      resultWinner,
      hit,
    });
  });

  stats.hitRate =
    stats.finished > 0
      ? Math.round((stats.hit / stats.finished) * 1000) / 10
      : 0;

  Object.keys(stats.categories).forEach((category) => {
    const item = stats.categories[category];

    item.rate =
      item.finished > 0
        ? Math.round((item.hit / item.finished) * 1000) / 10
        : 0;
  });

  return stats;
}

function categoryRows(stats: AiStats) {
  return Object.entries(stats.categories)
    .map(([category, value]) => ({
      category,
      ...value,
    }))
    .sort((a, b) => {
      if (b.rate !== a.rate) return b.rate - a.rate;
      return b.total - a.total;
    });
}

function resultLabel(hit: boolean | null) {
  if (hit === null) return "予測中";
  if (hit) return "的中";
  return "不的中";
}

function resultClass(hit: boolean | null) {
  if (hit === null) return "bg-blue-50 text-blue-700";
  if (hit) return "bg-green-50 text-green-700";
  return "bg-red-50 text-red-700";
}

function aggregateVotes(votes: VoteDoc[], aiName: string) {
  return votes.reduce<{ up: number; down: number }>(
    (sum, vote) => {
      if (vote.ai !== aiName) return sum;

      return {
        up: sum.up + Number(vote.up || 0),
        down: sum.down + Number(vote.down || 0),
      };
    },
    {
      up: 0,
      down: 0,
    }
  );
}

export default function AiProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const profile = aiProfiles[slug];

  const [events, setEvents] = useState<KompariEvent[]>([]);
  const [votes, setVotes] = useState<VoteDoc[]>([]);

  useEffect(() => {
    const q = query(collection(db, "races"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((document) => {
        const data = {
          id: document.id,
          ...document.data(),
        } as LegacyRaceData;

        return normalizeRaceToEvent(data);
      });

      setEvents(list);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "votes"), (snapshot) => {
      const list = snapshot.docs.map((document) => {
        return {
          ...document.data(),
        } as VoteDoc;
      });

      setVotes(list);
    });

    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    if (!profile) return buildStats(events, "");
    return buildStats(events, profile.name);
  }, [events, profile]);

  const voteStats = useMemo(() => {
    if (!profile) {
      return {
        up: 0,
        down: 0,
      };
    }

    return aggregateVotes(votes, profile.name);
  }, [profile, votes]);

  const popularityScore = voteStats.up - voteStats.down;
  const categories = useMemo(() => categoryRows(stats), [stats]);

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#F2F4F8] text-[#0F172A]">
        <TopBar />

        <div className="mx-auto max-w-[430px] px-4 pb-28 pt-8">
          <section className="rounded-[18px] border border-[#E8ECF2] bg-white p-5 text-center shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <h1 className="text-xl font-extrabold">AIが見つかりません</h1>

            <Link
              href="/ranking"
              className="mt-5 block rounded-2xl bg-blue-700 py-3 text-sm font-bold text-white"
            >
              ランキングへ戻る
            </Link>
          </section>
        </div>

        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F4F8] text-[#0F172A]">
      <TopBar />

      <div className="mx-auto max-w-[430px] px-4 pb-28 pt-4">
        <section className="mb-5 overflow-hidden rounded-[18px] border border-[#E8ECF2] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div
            className="p-5 text-white"
            style={{
              background:
                "linear-gradient(150deg, #0B1F4B 0%, #13307A 60%, #1D5BFF 130%)",
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold tracking-[0.18em] text-white">
                OFFICIAL AI
              </span>

              <span className="text-xs font-bold text-blue-100">
                AI PROFILE
              </span>
            </div>

            <div className="mb-5 flex items-center gap-4">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] text-xl font-extrabold text-white shadow-lg"
                style={{ backgroundColor: profile.iconBg }}
              >
                {profile.icon}
              </div>

              <div>
                <h1 className="text-3xl font-extrabold leading-tight text-white">
                  {profile.name}
                </h1>

                <div
                  className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-xs font-extrabold"
                  style={{ color: profile.accent }}
                >
                  {profile.label}
                </div>
              </div>
            </div>

            <p className="text-sm font-semibold leading-6 text-blue-50">
              {profile.description}
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">
                  的中率
                </div>

                <div
                  className="mt-1 text-2xl font-extrabold"
                  style={{ color: profile.accent }}
                >
                  {stats.hitRate}%
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">的中</div>

                <div className="mt-1 text-2xl font-extrabold text-gray-900">
                  {stats.hit}
                </div>

                <div className="mt-1 text-[10px] font-bold text-gray-400">
                  HIT
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">
                  予測数
                </div>

                <div className="mt-1 text-2xl font-extrabold text-gray-900">
                  {stats.total}
                </div>

                <div className="mt-1 text-[10px] font-bold text-gray-400">
                  PICKS
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-gray-100 bg-white text-center">
            <div className="p-3">
              <div className="text-[11px] font-bold text-gray-400">結果済</div>
              <div className="mt-1 text-[15px] font-extrabold">
                {stats.finished}
              </div>
            </div>

            <div className="p-3">
              <div className="text-[11px] font-bold text-gray-400">予測中</div>
              <div className="mt-1 text-[15px] font-extrabold">
                {stats.pending}
              </div>
            </div>

            <div className="p-3">
              <div className="text-[11px] font-bold text-gray-400">種別</div>
              <div className="mt-1 text-sm font-extrabold text-blue-700">
                公式AI
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold">人気</h2>

            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              スコア {popularityScore}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-green-50 p-4">
              <div className="text-xs font-bold text-green-700">
                👍 いいね
              </div>
              <div className="mt-1 text-2xl font-extrabold text-green-700">
                {voteStats.up}
              </div>
            </div>

            <div className="rounded-2xl bg-red-50 p-4">
              <div className="text-xs font-bold text-red-700">
                👎 うーん
              </div>
              <div className="mt-1 text-2xl font-extrabold text-red-700">
                {voteStats.down}
              </div>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4">
              <div className="text-xs font-bold text-gray-400">人気</div>
              <div className="mt-1 text-2xl font-extrabold">
                {popularityScore}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h2 className="mb-4 text-[15px] font-extrabold">基本情報</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-gray-50 p-4">
              <div className="text-xs font-bold text-gray-400">
                予測スタイル
              </div>

              <div
                className="mt-2 inline-block rounded-full px-3 py-1 text-sm font-extrabold"
                style={{
                  backgroundColor: `${profile.iconBg}18`,
                  color: profile.accent,
                }}
              >
                {profile.style}
              </div>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4">
              <div className="text-xs font-bold text-gray-400">参加形式</div>

              <div className="mt-2 text-[15px] font-extrabold">公式AI</div>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold">実績サマリー</h2>

            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {stats.hit}/{stats.finished}
            </span>
          </div>

          <div className="rounded-2xl bg-blue-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-600">的中率</span>

              <span className="text-2xl font-extrabold text-blue-700">
                {stats.hitRate}%
              </span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-white">
              <div
                className="h-3 rounded-full bg-blue-700"
                style={{ width: `${stats.hitRate}%` }}
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white p-2">
                <div className="text-[11px] font-bold text-gray-400">的中</div>
                <div className="mt-1 font-extrabold">{stats.hit}</div>
              </div>

              <div className="rounded-xl bg-white p-2">
                <div className="text-[11px] font-bold text-gray-400">
                  不的中
                </div>
                <div className="mt-1 font-extrabold">
                  {stats.finished - stats.hit}
                </div>
              </div>

              <div className="rounded-xl bg-white p-2">
                <div className="text-[11px] font-bold text-gray-400">
                  予測中
                </div>
                <div className="mt-1 font-extrabold">{stats.pending}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold">カテゴリ別成績</h2>

            <span className="text-xs font-bold text-gray-400">
              {categories.length}分野
            </span>
          </div>

          <div className="space-y-3">
            {categories.map((item) => (
              <div key={item.category} className="rounded-2xl bg-gray-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-extrabold">
                    {getCategoryEmoji(item.category)}{" "}
                    {getCategoryLabel(item.category)}
                  </div>

                  <div className="text-[15px] font-extrabold text-blue-700">
                    {item.rate}%
                  </div>
                </div>

                <div className="mb-2 flex items-center justify-between text-xs font-bold text-gray-400">
                  <span>
                    予測 {item.total}件 / 結果 {item.finished}件
                  </span>

                  <span>的中 {item.hit}件</span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-2 rounded-full bg-blue-700"
                    style={{ width: `${item.rate}%` }}
                  />
                </div>
              </div>
            ))}

            {categories.length === 0 && (
              <div className="rounded-2xl bg-gray-50 p-4 text-center text-sm font-bold text-gray-400">
                まだカテゴリ別成績がありません
              </div>
            )}
          </div>
        </section>

        <section className="mb-5 rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold">最近の予測</h2>

            <span className="text-xs font-bold text-gray-400">
              {stats.recent.length}件
            </span>
          </div>

          <div className="space-y-3">
            {stats.recent.slice(0, 10).map((row) => (
              <Link
                key={`${row.eventId}-${row.main}`}
                href={`/race/${row.eventId}`}
                className="block rounded-2xl border border-gray-100 bg-gray-50 p-3"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-blue-700">
                      {getCategoryEmoji(row.category)}{" "}
                      {getCategoryLabel(row.category)}
                    </div>

                    <div className="font-extrabold">{row.title}</div>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${resultClass(
                      row.hit
                    )}`}
                  >
                    {resultLabel(row.hit)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-white p-2">
                    <div className="text-xs font-bold text-gray-400">本命</div>
                    <div className="font-extrabold">{row.main}</div>
                  </div>

                  <div className="rounded-xl bg-white p-2">
                    <div className="text-xs font-bold text-gray-400">
                      信頼度
                    </div>
                    <div className="font-extrabold">
                      {formatConfidence(row.confidence)}
                    </div>
                  </div>
                </div>

                {row.resultWinner && (
                  <div className="mt-2 rounded-xl bg-white p-2 text-sm">
                    <div className="text-xs font-bold text-gray-400">結果</div>
                    <div className="font-extrabold">{row.resultWinner}</div>
                  </div>
                )}
              </Link>
            ))}

            {stats.recent.length === 0 && (
              <div className="rounded-2xl bg-gray-50 p-4 text-center text-sm font-bold text-gray-400">
                まだこのAIの予測はありません
              </div>
            )}
          </div>
        </section>

        <Link
          href="/ranking"
          className="block rounded-[18px] border border-[#E8ECF2] bg-white py-4 text-center font-bold text-gray-600 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
        >
          ランキングへ戻る
        </Link>
      </div>

      <BottomNav />
    </main>
  );
}