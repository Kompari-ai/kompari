"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { VoteButtons } from "@/components/VoteButtons";
import { getCategoryEmoji, getCategoryLabel } from "@/lib/categories";
import { getAiColors, getAiInitial } from "@/lib/ai-colors";
import {
  formatStartsAt,
  getConsensusChip,
  getResultWinner,
  normalizeRaceToEvent,
  type KompariEvent,
  type KompariPrediction,
  type LegacyRaceData,
} from "@/lib/events";

type MyAi = {
  id: string;
  name: string;
  style: string;
  strengthCategory: string;
  description: string;
};

type Tab = "predictions" | "candidates";

function getStatusLabel(event: KompariEvent) {
  return getResultWinner(event) ? "結果入力済み" : "予測中";
}

function getCandidateList(event: KompariEvent) {
  if (event.candidates && event.candidates.length > 0) {
    return event.candidates;
  }

  const fallback = new Set<string>();

  event.predictions.forEach((prediction) => {
    if (prediction.main) fallback.add(prediction.main);
    if (prediction.second) fallback.add(prediction.second);
    if (prediction.third) fallback.add(prediction.third);
  });

  return Array.from(fallback);
}

function buildConsensus(event: KompariEvent) {
  const counts: Record<string, number> = {};

  event.predictions.forEach((prediction) => {
    if (!prediction.main) return;

    counts[prediction.main] = (counts[prediction.main] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      rate:
        event.predictions.length > 0
          ? Math.round((count / event.predictions.length) * 100)
          : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function buildPodiumData(event: KompariEvent) {
  const mainCounts: Record<string, number> = {};
  const secondCounts: Record<string, number> = {};

  event.predictions.forEach((p) => {
    if (p.main) mainCounts[p.main] = (mainCounts[p.main] || 0) + 1;
    if (p.second) secondCounts[p.second] = (secondCounts[p.second] || 0) + 1;
  });

  const allNames = new Set([
    ...Object.keys(mainCounts),
    ...Object.keys(secondCounts),
  ]);

  return Array.from(allNames)
    .map((name) => ({
      name,
      mainCount: mainCounts[name] || 0,
      secondCount: secondCounts[name] || 0,
    }))
    .sort((a, b) => {
      const scoreA = a.mainCount * 2 + a.secondCount;
      const scoreB = b.mainCount * 2 + b.secondCount;
      return scoreB - scoreA;
    })
    .slice(0, 3);
}


function getPredictionResult(
  prediction: KompariPrediction,
  resultWinner: string
) {
  if (!resultWinner) {
    return { label: "判定待ち", className: "bg-blue-50 text-blue-700" };
  }

  if (prediction.main === resultWinner) {
    return { label: "的中", className: "bg-green-50 text-green-700" };
  }

  return { label: "外れ", className: "bg-red-50 text-red-700" };
}

function formatConfidence(confidence?: string) {
  if (!confidence) return "-";
  if (confidence.includes("%")) return confidence;
  return `${confidence}%`;
}

function isMyAiPrediction(prediction: KompariPrediction, myAis: MyAi[]) {
  if (prediction.source === "user") return true;
  if (prediction.myAiId) return true;

  return myAis.some((myAi) => myAi.name === prediction.ai);
}

function findMyAi(prediction: KompariPrediction, myAis: MyAi[]) {
  if (prediction.myAiId) {
    return myAis.find((myAi) => myAi.id === prediction.myAiId) || null;
  }

  return myAis.find((myAi) => myAi.name === prediction.ai) || null;
}

function getAiProfileLink(prediction: KompariPrediction, myAis: MyAi[]) {
  const matchedMyAi = findMyAi(prediction, myAis);

  if (matchedMyAi) {
    return `/my-ai/${matchedMyAi.id}`;
  }

  return `/ai/${prediction.ai.toLowerCase()}`;
}

function PredictionCard({
  eventId,
  prediction,
  resultWinner,
  myAis,
}: {
  eventId: string;
  prediction: KompariPrediction;
  resultWinner: string;
  myAis: MyAi[];
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const colors = isMyAiPrediction(prediction, myAis)
    ? {
        bg: "#6366f1",
        text: "#ffffff",
        border: "#6366f1",
        bgLight: "#ede9fe",
        textDark: "#4c1d95",
      }
    : getAiColors(prediction.ai);

  const isMyAi = isMyAiPrediction(prediction, myAis);
  const result = getPredictionResult(prediction, resultWinner);

  return (
    <article
      className="rounded-[18px] border border-[#E8ECF2] bg-white shadow-sm overflow-hidden"
      style={{ borderLeftColor: colors.border, borderLeftWidth: "4px" }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-[9px] mb-3">
          <Link href={getAiProfileLink(prediction, myAis)} className="shrink-0">
            <div
              className="w-8 h-8 rounded-[10px] flex items-center justify-center text-sm font-extrabold"
              style={{ background: colors.bg, color: colors.text }}
            >
              {isMyAi
                ? prediction.ai.slice(0, 1).toUpperCase()
                : getAiInitial(prediction.ai)}
            </div>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-extrabold leading-none">
                {prediction.ai}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isMyAi
                    ? "bg-purple-50 text-purple-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {isMyAi ? "My AI" : "公式AI"}
              </span>
            </div>
            {prediction.confidence && (
              <div className="mt-0.5 text-[11px] text-gray-500 font-semibold">
                自信度 {formatConfidence(prediction.confidence)}
              </div>
            )}
          </div>

          <span
            className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${result.className}`}
          >
            {result.label}
          </span>
        </div>

        {/* Picks */}
        <div className="flex flex-col gap-1.5 my-3">
          {prediction.main && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[10px] font-extrabold px-[7px] py-0.5 rounded-[6px] bg-red-50 text-red-700 min-w-[36px] text-center shrink-0">
                本命
              </span>
              <span className="font-extrabold truncate">{prediction.main}</span>
            </div>
          )}
          {prediction.second && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[10px] font-extrabold px-[7px] py-0.5 rounded-[6px] bg-blue-50 text-blue-700 min-w-[36px] text-center shrink-0">
                対抗
              </span>
              <span className="font-bold truncate">{prediction.second}</span>
            </div>
          )}
          {prediction.third && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[10px] font-extrabold px-[7px] py-0.5 rounded-[6px] bg-amber-50 text-amber-700 min-w-[36px] text-center shrink-0">
                穴
              </span>
              <span className="font-bold truncate">{prediction.third}</span>
            </div>
          )}
        </div>

        {/* Reason */}
        {prediction.reason && (
          <p className="text-xs leading-[1.65] text-[#334155] mb-2">
            {prediction.reason}
          </p>
        )}

        {/* Evidence fold */}
        {prediction.evidence && (
          <>
            <button
              type="button"
              onClick={() => setEvidenceOpen(!evidenceOpen)}
              className="text-[11.5px] font-bold text-blue-700 py-1"
            >
              {evidenceOpen
                ? "データ根拠を閉じる ▴"
                : "データ根拠を見る ▾"}
            </button>
            {evidenceOpen && (
              <div className="bg-[#F8FAFC] rounded-[10px] px-3 py-2.5 text-[11.5px] text-[#475569] leading-[1.8] mt-1 whitespace-pre-line">
                {prediction.evidence}
              </div>
            )}
          </>
        )}

        {/* Result */}
        {resultWinner && (
          <div className="mt-2 rounded-[10px] bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500">
            結果: <span className="text-gray-900 font-extrabold">{resultWinner}</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-[#E8ECF2]">
          <VoteButtons eventId={eventId} ai={prediction.ai} />
        </div>
      </div>
    </article>
  );
}

function CandidateCard({
  candidate,
  index,
  consensusCount,
  totalPredictions,
  resultWinner,
}: {
  candidate: string;
  index: number;
  consensusCount: number;
  totalPredictions: number;
  resultWinner: string;
}) {
  const rate =
    totalPredictions > 0
      ? Math.round((consensusCount / totalPredictions) * 100)
      : 0;

  const isWinner = resultWinner === candidate;

  return (
    <div
      className={`rounded-[18px] border p-4 shadow-sm ${
        isWinner ? "border-green-200 bg-green-50" : "border-[#E8ECF2] bg-white"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-[10px] text-sm font-extrabold ${
              isWinner
                ? "bg-green-600 text-white"
                : "bg-blue-50 text-blue-700"
            }`}
          >
            {index + 1}
          </div>

          <div>
            <h3 className="font-extrabold">{candidate}</h3>
            <p className="mt-0.5 text-xs font-bold text-gray-400">
              本命支持 {consensusCount}件
            </p>
          </div>
        </div>

        {isWinner && (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-green-700">
            結果
          </span>
        )}
      </div>

      <div className="rounded-[10px] bg-gray-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500">AI支持率</span>
          <span className="text-xs font-extrabold text-blue-700">{rate}%</span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white">
          <div
            className="h-2 rounded-full bg-blue-700"
            style={{ width: `${rate}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function RaceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [event, setEvent] = useState<KompariEvent | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [myAis, setMyAis] = useState<MyAi[]>([]);
  const [tab, setTab] = useState<Tab>("predictions");
  const [selectedMyAiId, setSelectedMyAiId] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const ref = doc(db, "races", slug);

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      if (snapshot.exists()) {
        const data = {
          id: snapshot.id,
          ...snapshot.data(),
        } as LegacyRaceData;

        setEvent(normalizeRaceToEvent(data));
      } else {
        setEvent(null);
      }

      setLoaded(true);
    });

    return () => unsubscribe();
  }, [slug]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "myAis"), (snapshot) => {
      const list = snapshot.docs.map((document) => {
        return {
          id: document.id,
          ...document.data(),
        } as MyAi;
      });

      setMyAis(list);

      if (!selectedMyAiId && list.length > 0) {
        setSelectedMyAiId(list[0].id);
      }
    });

    return () => unsubscribe();
  }, [selectedMyAiId]);

  const candidates = useMemo(() => {
    if (!event) return [];
    return getCandidateList(event);
  }, [event]);

  const resultWinner = event ? getResultWinner(event) : "";

  const consensus = useMemo(() => {
    if (!event) return [];
    return buildConsensus(event);
  }, [event]);

  const podiumData = useMemo(() => {
    if (!event) return [];
    return buildPodiumData(event);
  }, [event]);

  const consensusChip = useMemo(() => {
    if (!event) return null;
    return getConsensusChip(event.predictions);
  }, [event]);

  const consensusMap = useMemo(() => {
    const map: Record<string, number> = {};

    consensus.forEach((item) => {
      map[item.name] = item.count;
    });

    return map;
  }, [consensus]);

  const selectedMyAi = useMemo(() => {
    return myAis.find((myAi) => myAi.id === selectedMyAiId) || null;
  }, [myAis, selectedMyAiId]);

  const selectedMyAiAlreadyJoined = useMemo(() => {
    if (!event || !selectedMyAi) return false;

    return event.predictions.some((prediction) => {
      if (prediction.myAiId === selectedMyAi.id) return true;
      return prediction.ai === selectedMyAi.name;
    });
  }, [event, selectedMyAi]);

  const joinMyAi = async () => {
    if (!event) return;

    if (!selectedMyAi) {
      alert("参加させるMy AIを選んでください");
      return;
    }

    if (candidates.length < 2) {
      alert("候補が2つ以上必要です");
      return;
    }

    if (selectedMyAiAlreadyJoined) {
      alert("このMy AIはすでに参加しています");
      return;
    }

    try {
      setJoining(true);

      const response = await fetch("/api/generate-prediction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: event.title,
          category: event.category,
          aiName: selectedMyAi.name,
          aiStyle: selectedMyAi.style,
          aiDescription: selectedMyAi.description,
          strengthCategory: selectedMyAi.strengthCategory,
          candidates,
        }),
      });

      if (!response.ok) {
        throw new Error("My AI予測の生成に失敗しました");
      }

      const data = (await response.json()) as KompariPrediction;

      const nextPrediction: KompariPrediction = {
        ...data,
        ai: selectedMyAi.name,
        source: "user",
        myAiId: selectedMyAi.id,
      };

      await updateDoc(doc(db, "races", slug), {
        predictions: [...event.predictions, nextPrediction],
      });

      alert(`${selectedMyAi.name}を参加させました`);
    } catch (error) {
      console.error(error);
      alert("My AIの参加に失敗しました");
    } finally {
      setJoining(false);
    }
  };

  if (!loaded) {
    return (
      <main className="min-h-screen bg-[#F2F4F8] text-[#0F172A]">
        <TopBar />

        <div className="mx-auto max-w-[430px] px-4 py-10 text-center text-gray-500">
          読み込み中...
        </div>

        <BottomNav />
      </main>
    );
  }

  if (!event) {
    return (
      <main className="min-h-screen bg-[#F2F4F8] text-[#0F172A]">
        <TopBar />

        <div className="mx-auto max-w-[430px] px-4 pb-28 pt-8">
          <section className="rounded-[18px] bg-white p-5 text-center shadow-sm border border-[#E8ECF2]">
            <h1 className="text-xl font-extrabold">
              イベントが見つかりません
            </h1>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              このイベントは削除された可能性があります。
            </p>

            <Link
              href="/races"
              className="mt-5 block rounded-[12px] bg-blue-700 py-3 text-sm font-bold text-white"
            >
              イベント一覧へ戻る
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
        {/* Event header card */}
        <section className="mb-4 overflow-hidden rounded-[18px] bg-white border border-[#E8ECF2] shadow-sm">
          <div
            className="p-5 text-white"
            style={{
              background:
                "linear-gradient(150deg, #0B1F4B 0%, #13307A 60%, #1D5BFF 130%)",
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold tracking-[0.18em] text-white">
                {getCategoryEmoji(event.category)}{" "}
                {getCategoryLabel(event.category)}
              </span>

              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold text-white">
                {getStatusLabel(event)}
              </span>
            </div>

            <h1 className="text-[20px] font-extrabold leading-tight">
              {event.title}
            </h1>

            <p className="mt-1 text-[11px] font-semibold text-blue-200">
              {event.venue || "開催情報未入力"}
              {(event.startsAt || event.startsIn) && (
                <> ｜ {event.startsAt ? formatStartsAt(event.startsAt) : event.startsIn}</>
              )}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[12px] bg-white/10 p-2.5">
                <div className="text-[10px] text-white/65">候補</div>
                <div className="mt-0.5 text-xl font-extrabold">
                  {candidates.length}
                </div>
              </div>

              <div className="rounded-[12px] bg-white/10 p-2.5">
                <div className="text-[10px] text-white/65">AI予測</div>
                <div className="mt-0.5 text-xl font-extrabold">
                  {event.predictions.length}
                </div>
              </div>

              <div className="rounded-[12px] bg-white/10 p-2.5">
                <div className="text-[10px] text-white/65">結果</div>
                <div className="mt-0.5 truncate text-sm font-extrabold">
                  {resultWinner || "未入力"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Consensus section */}
        <section className="mb-4 rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <b className="text-[14px] font-extrabold">👑 AIコンセンサス</b>
            {consensusChip && (
              <span
                className={`text-[10.5px] font-bold px-2.5 py-1 rounded-full ${
                  consensusChip.type === "unan"
                    ? "bg-green-50 text-green-700"
                    : consensusChip.type === "lean"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {consensusChip.label}
              </span>
            )}
          </div>

          {/* Podium */}
          {podiumData.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {podiumData.map((item, i) => (
                <div
                  key={item.name}
                  className={`rounded-[12px] border p-2.5 text-center ${
                    i === 0
                      ? "bg-amber-50 border-amber-200"
                      : "bg-gray-50 border-[#E8ECF2]"
                  }`}
                >
                  <div
                    className={`text-[10px] font-extrabold ${
                      i === 0 ? "text-amber-700" : "text-gray-400"
                    }`}
                  >
                    {i + 1}位予想
                  </div>
                  <div className="text-[12px] font-extrabold mt-1 leading-snug truncate">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-gray-400 font-semibold mt-1">
                    {item.mainCount > 0 && `本命${item.mainCount}`}
                    {item.mainCount > 0 && item.secondCount > 0 && "・"}
                    {item.secondCount > 0 && `対抗${item.secondCount}`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Split meter */}
          {event.predictions.length > 0 ? (
            <>
              <div className="h-[10px] rounded-full overflow-hidden flex gap-[2px]">
                {event.predictions.map((p, i) => (
                  <div
                    key={`seg-${p.ai}-${i}`}
                    className="flex-1 h-full"
                    style={{ background: getAiColors(p.ai).bg }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-[10px] gap-y-[5px] mt-[7px]">
                {event.predictions.map((p, i) => (
                  <span
                    key={`leg-${p.ai}-${i}`}
                    className="text-[10.5px] text-[#64748B] font-semibold flex items-center gap-1 whitespace-nowrap"
                  >
                    <span
                      className="w-2 h-2 rounded-[3px] inline-block shrink-0"
                      style={{ background: getAiColors(p.ai).bg }}
                    />
                    {p.ai}→{p.main}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-[12px] bg-gray-50 p-4 text-center text-sm font-bold text-gray-400">
              まだAI予測がありません
            </div>
          )}
        </section>

        {/* 将来対応: My AI参加機能 — Firestoreルール修正後に有効化 (see docs/AUDIT.md T-01)
        <section className="mb-4 rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">My AIを参加させる</h2>
            <Link href="/my-ai" className="text-xs font-extrabold text-blue-700">
              作成する
            </Link>
          </div>
          {myAis.length > 0 ? (
            <div className="space-y-3">
              <select
                value={selectedMyAiId}
                onChange={(e) => setSelectedMyAiId(e.target.value)}
                className="w-full rounded-[12px] border border-[#E8ECF2] bg-white px-4 py-3 text-sm font-bold outline-none"
              >
                {myAis.map((myAi) => (
                  <option key={myAi.id} value={myAi.id}>{myAi.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={joinMyAi}
                disabled={joining || selectedMyAiAlreadyJoined}
                className="w-full rounded-[12px] bg-blue-700 py-4 text-sm font-extrabold text-white disabled:bg-gray-300"
              >
                {joining ? "参加中..." : selectedMyAiAlreadyJoined ? "このMy AIは参加済み" : "このイベントに参加させる"}
              </button>
            </div>
          ) : (
            <div className="rounded-[12px] bg-gray-50 p-4 text-center">
              <div className="text-sm font-bold text-gray-500">まだMy AIがありません</div>
              <Link href="/my-ai" className="mt-3 block rounded-[12px] bg-blue-700 py-3 text-sm font-bold text-white">
                My AIを作成する
              </Link>
            </div>
          )}
        </section>
        */}

        {/* Tab switcher */}
        <section className="mb-4 flex bg-[#E7EBF2] rounded-[12px] p-[3px]">
          <button
            type="button"
            onClick={() => setTab("predictions")}
            className={`flex-1 py-2 text-sm font-bold rounded-[10px] transition-colors ${
              tab === "predictions"
                ? "bg-white text-[#0F172A] shadow-sm"
                : "text-[#64748B]"
            }`}
          >
            AI予測
          </button>

          <button
            type="button"
            onClick={() => setTab("candidates")}
            className={`flex-1 py-2 text-sm font-bold rounded-[10px] transition-colors ${
              tab === "candidates"
                ? "bg-white text-[#0F172A] shadow-sm"
                : "text-[#64748B]"
            }`}
          >
            候補リスト
          </button>
        </section>

        {tab === "predictions" && (
          <section className="space-y-3">
            {event.predictions.map((prediction, index) => (
              <PredictionCard
                key={`${prediction.ai}-${prediction.myAiId || index}`}
                eventId={event.id}
                prediction={prediction}
                resultWinner={resultWinner}
                myAis={myAis}
              />
            ))}

            {event.predictions.length === 0 && (
              <div className="rounded-[18px] border border-[#E8ECF2] bg-white p-6 text-center shadow-sm">
                <div className="text-3xl">🤖</div>
                <div className="mt-3 text-sm font-bold text-gray-500">
                  まだAI予測がありません
                </div>
              </div>
            )}

            {/* My AI参加プレースホルダー */}
            <div className="rounded-[18px] border border-dashed border-blue-200 bg-blue-50/40 p-4 text-center">
              <b className="text-[13.5px] font-extrabold text-blue-700">
                ＋ あなたのAIを参加させる
              </b>
              <p className="mt-1 text-[11px] text-gray-500">
                My AIを作成してこのイベントに予測参加できます
              </p>
              <Link
                href="/my-ai"
                className="mt-3 inline-block rounded-[10px] bg-blue-700 px-4 py-2 text-xs font-extrabold text-white"
              >
                My AIを作成する
              </Link>
            </div>
          </section>
        )}

        {tab === "candidates" && (
          <section className="space-y-3">
            {candidates.map((candidate, index) => (
              <CandidateCard
                key={`${candidate}-${index}`}
                candidate={candidate}
                index={index}
                consensusCount={consensusMap[candidate] || 0}
                totalPredictions={event.predictions.length}
                resultWinner={resultWinner}
              />
            ))}

            {candidates.length === 0 && (
              <div className="rounded-[18px] border border-[#E8ECF2] bg-white p-6 text-center text-sm font-bold text-gray-400 shadow-sm">
                候補リストがありません
              </div>
            )}
          </section>
        )}

        <section className="mt-5">
          <Link
            href="/races"
            className="block rounded-[12px] border border-[#E8ECF2] bg-white py-4 text-center text-sm font-bold text-gray-700 shadow-sm"
          >
            一覧へ戻る
          </Link>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
