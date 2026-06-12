"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { VoteButtons } from "@/components/VoteButtons";
import { getCategoryEmoji, getCategoryLabel } from "@/lib/categories";
import {
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

function getResultWinner(event: KompariEvent) {
  return event.result?.winner || event.resultWinner || "";
}

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

function getPredictionResult(
  prediction: KompariPrediction,
  resultWinner: string
) {
  if (!resultWinner) {
    return {
      label: "判定待ち",
      className: "bg-blue-50 text-blue-700",
    };
  }

  if (prediction.main === resultWinner) {
    return {
      label: "的中",
      className: "bg-green-50 text-green-700",
    };
  }

  return {
    label: "外れ",
    className: "bg-red-50 text-red-700",
  };
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

function getAiInitial(prediction: KompariPrediction) {
  if (prediction.ai === "ChatGPT") return "GPT";
  if (prediction.ai === "Claude") return "C";
  if (prediction.ai === "Gemini") return "G";
  if (prediction.ai === "DeepSeek") return "DS";

  return prediction.ai.slice(0, 2).toUpperCase();
}

function aiIconStyle(prediction: KompariPrediction, myAis: MyAi[]) {
  if (isMyAiPrediction(prediction, myAis)) {
    return {
      background: "#6366f1",
      color: "#ffffff",
    };
  }

  if (prediction.ai === "ChatGPT") {
    return {
      background: "#10b981",
      color: "#ffffff",
    };
  }

  if (prediction.ai === "Claude") {
    return {
      background: "#f97316",
      color: "#ffffff",
    };
  }

  if (prediction.ai === "Gemini") {
    return {
      background: "#2563eb",
      color: "#ffffff",
    };
  }

  if (prediction.ai === "DeepSeek") {
    return {
      background: "#4f46e5",
      color: "#ffffff",
    };
  }

  return {
    background: "#111827",
    color: "#ffffff",
  };
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
  const result = getPredictionResult(prediction, resultWinner);
  const myAi = isMyAiPrediction(prediction, myAis);

  return (
    <article className="rounded-[26px] border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <Link
          href={getAiProfileLink(prediction, myAis)}
          className="flex items-center gap-3"
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold"
            style={aiIconStyle(prediction, myAis)}
          >
            {getAiInitial(prediction)}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold">{prediction.ai}</h3>

              <span
                className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                  myAi
                    ? "bg-blue-50 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {myAi ? "My AI" : "公式AI"}
              </span>
            </div>

            <p className="mt-1 text-xs font-bold text-gray-400">
              詳細プロフィールを見る
            </p>
          </div>
        </Link>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${result.className}`}
        >
          {result.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-blue-50 p-3">
          <div className="text-[11px] font-bold text-gray-500">本命</div>
          <div className="mt-1 truncate text-sm font-extrabold text-blue-700">
            {prediction.main || "-"}
          </div>
        </div>

        <div className="rounded-2xl bg-gray-50 p-3">
          <div className="text-[11px] font-bold text-gray-400">対抗</div>
          <div className="mt-1 truncate text-sm font-extrabold">
            {prediction.second || "-"}
          </div>
        </div>

        <div className="rounded-2xl bg-gray-50 p-3">
          <div className="text-[11px] font-bold text-gray-400">信頼度</div>
          <div className="mt-1 text-sm font-extrabold">
            {formatConfidence(prediction.confidence)}
          </div>
        </div>
      </div>

      {prediction.third && (
        <div className="mt-3 rounded-2xl bg-gray-50 p-3">
          <div className="text-xs font-bold text-gray-400">3番手</div>
          <div className="mt-1 font-extrabold">{prediction.third}</div>
        </div>
      )}

      {resultWinner && (
        <div className="mt-3 rounded-2xl bg-gray-50 p-3">
          <div className="text-xs font-bold text-gray-400">結果</div>
          <div className="mt-1 font-extrabold">{resultWinner}</div>
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-gray-50 p-3">
        <div className="mb-1 text-xs font-bold text-gray-400">予測理由</div>
        <p className="text-sm font-semibold leading-6 text-gray-700">
          {prediction.reason ||
            "このAIは、候補全体のバランスを比較して本命を選んでいます。"}
        </p>
      </div>

      {prediction.evidence && (
        <div className="mt-3 rounded-2xl bg-gray-50 p-3">
          <div className="mb-1 text-xs font-bold text-gray-400">根拠</div>
          <p className="text-sm font-semibold leading-6 text-gray-700">
            {prediction.evidence}
          </p>
        </div>
      )}

      <div className="mt-4">
        <VoteButtons eventId={eventId} ai={prediction.ai} />
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
      className={`rounded-[24px] border p-4 shadow-sm ${
        isWinner ? "border-green-100 bg-green-50" : "border-gray-100 bg-white"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-extrabold ${
              isWinner
                ? "bg-green-600 text-white"
                : "bg-blue-50 text-blue-700"
            }`}
          >
            {index + 1}
          </div>

          <div>
            <h3 className="font-extrabold">{candidate}</h3>
            <p className="mt-1 text-xs font-bold text-gray-400">
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

      <div className="rounded-2xl bg-gray-50 p-3">
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
      <main className="min-h-screen bg-[#f5f5f7] text-[#111827]">
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
      <main className="min-h-screen bg-[#f5f5f7] text-[#111827]">
        <TopBar />

        <div className="mx-auto max-w-[430px] px-4 pb-28 pt-8">
          <section className="rounded-[24px] bg-white p-5 text-center shadow-sm">
            <h1 className="text-xl font-extrabold">
              イベントが見つかりません
            </h1>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              このイベントは削除された可能性があります。
            </p>

            <Link
              href="/races"
              className="mt-5 block rounded-2xl bg-blue-700 py-3 text-sm font-bold text-white"
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
    <main className="min-h-screen bg-[#f5f5f7] text-[#111827]">
      <TopBar />

      <div className="mx-auto max-w-[430px] px-4 pb-28 pt-4">
        <section className="mb-5 overflow-hidden rounded-[32px] bg-white shadow-sm">
          <div
            className="p-5 text-white"
            style={{
              background:
                "linear-gradient(135deg, #2563eb 0%, #1d4ed8 45%, #172554 100%)",
            }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold tracking-[0.18em] text-white">
                EVENT DETAIL
              </span>

              <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-blue-700">
                {getStatusLabel(event)}
              </span>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-950/35 px-3 py-1 text-xs font-bold text-blue-50 ring-1 ring-white/20">
                {getCategoryEmoji(event.category)}{" "}
                {getCategoryLabel(event.category)}
              </span>

              {event.startsIn && (
                <span className="rounded-full bg-blue-950/35 px-3 py-1 text-xs font-bold text-blue-50 ring-1 ring-white/20">
                  {event.startsIn}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-black leading-tight">
              {event.title}
            </h1>

            <p className="mt-3 text-sm font-semibold leading-6 text-blue-50">
              {event.venue || "開催情報未入力"}
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">候補</div>
                <div className="mt-1 text-2xl font-extrabold text-blue-700">
                  {candidates.length}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">
                  AI予測
                </div>
                <div className="mt-1 text-2xl font-extrabold text-gray-900">
                  {event.predictions.length}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">結果</div>
                <div className="mt-1 truncate text-sm font-extrabold text-gray-900">
                  {resultWinner || "未入力"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[26px] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">AIコンセンサス</h2>

            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              本命集計
            </span>
          </div>

          <div className="space-y-3">
            {consensus.slice(0, 5).map((item, index) => (
              <div key={item.name} className="rounded-2xl bg-gray-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${
                        index === 0
                          ? "bg-blue-700 text-white"
                          : "bg-white text-gray-600"
                      }`}
                    >
                      {index + 1}
                    </div>

                    <div className="truncate font-extrabold">{item.name}</div>
                  </div>

                  <div className="shrink-0 text-sm font-extrabold text-blue-700">
                    {item.count}/{event.predictions.length}
                  </div>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-2 rounded-full bg-blue-700"
                    style={{ width: `${item.rate}%` }}
                  />
                </div>
              </div>
            ))}

            {consensus.length === 0 && (
              <div className="rounded-2xl bg-gray-50 p-4 text-center text-sm font-bold text-gray-400">
                まだAI予測がありません
              </div>
            )}
          </div>
        </section>

        {/* 将来対応: My AI参加機能 — Firestoreルール修正後に有効化 (see docs/AUDIT.md T-01)
        <section className="mb-5 rounded-[26px] bg-white p-4 shadow-sm">
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
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold outline-none"
              >
                {myAis.map((myAi) => (
                  <option key={myAi.id} value={myAi.id}>{myAi.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={joinMyAi}
                disabled={joining || selectedMyAiAlreadyJoined}
                className="w-full rounded-2xl bg-blue-700 py-4 text-sm font-extrabold text-white disabled:bg-gray-300"
              >
                {joining ? "参加中..." : selectedMyAiAlreadyJoined ? "このMy AIは参加済み" : "このイベントに参加させる"}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-gray-50 p-4 text-center">
              <div className="text-sm font-bold text-gray-500">まだMy AIがありません</div>
              <Link href="/my-ai" className="mt-3 block rounded-2xl bg-blue-700 py-3 text-sm font-bold text-white">
                My AIを作成する
              </Link>
            </div>
          )}
        </section>
        */}

        <section className="mb-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setTab("predictions")}
            className={`py-4 text-sm font-extrabold ${
              tab === "predictions"
                ? "bg-blue-700 text-white"
                : "text-gray-600"
            }`}
          >
            AI予測
          </button>

          <button
            type="button"
            onClick={() => setTab("candidates")}
            className={`py-4 text-sm font-extrabold ${
              tab === "candidates"
                ? "bg-blue-700 text-white"
                : "text-gray-600"
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
              <div className="rounded-[24px] bg-white p-6 text-center shadow-sm">
                <div className="text-3xl">🤖</div>
                <div className="mt-3 text-sm font-bold text-gray-500">
                  まだAI予測がありません
                </div>
              </div>
            )}
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
              <div className="rounded-[24px] bg-white p-6 text-center text-sm font-bold text-gray-400 shadow-sm">
                候補リストがありません
              </div>
            )}
          </section>
        )}

        <section className="mt-5">
          <Link
            href="/races"
            className="block rounded-2xl bg-white py-4 text-center text-sm font-bold text-gray-700 shadow-sm"
          >
            一覧へ戻る
          </Link>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}