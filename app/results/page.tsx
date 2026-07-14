"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, collectionGroup, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { getCategoryEmoji, getCategoryLabel } from "@/lib/categories";
import {
  getResultWinner,
  isOfficialPrediction,
  isPublicEvent,
  normalizeEventDocToEvent,
  type KompariEvent,
  type KompariEventDoc,
  type KompariPredictionDoc,
} from "@/lib/events";
import {
  parsePredictionBatch,
  type RawPredictionDocInput,
} from "@/lib/prediction-read";

type ConsensusAnswer = {
  label: string;
  className: string;
};

type ResultSummary = {
  resultWinner: string;
  consensusMainName: string;
  consensusMainCount: number;
  consensusTotal: number;
  answer: ConsensusAnswer;
};

// race詳細 Phase 2 の getConsensusAnswerLabel と同じ判定基準・同じ文言。
// 1イベント分を受け取る一覧向けのローカル関数として、コピーではなく書き直す。
// consensusTotal === 0(countable な公式予測が無い)の場合のみ「判定不可」を追加する。
function buildResultSummary(event: KompariEvent): ResultSummary {
  const resultWinner = getResultWinner(event);

  const countableOfficialPreds = event.predictions.filter((p) =>
    isOfficialPrediction(p)
  );

  const consensusMainCounts: Record<string, number> = {};
  countableOfficialPreds.forEach((p) => {
    const main = (p.main || "").trim();
    if (!main) return;
    consensusMainCounts[main] = (consensusMainCounts[main] || 0) + 1;
  });

  let consensusMainName = "";
  let consensusMainCount = 0;
  for (const [name, count] of Object.entries(consensusMainCounts)) {
    if (count > consensusMainCount) {
      consensusMainName = name;
      consensusMainCount = count;
    }
  }

  const consensusTotal = countableOfficialPreds.length;

  let answer: ConsensusAnswer;
  if (consensusTotal === 0 || !consensusMainName) {
    answer = { label: "判定不可", className: "bg-gray-100 text-gray-500" };
  } else if (consensusMainName === resultWinner) {
    answer = { label: "コンセンサス的中", className: "bg-green-50 text-green-700" };
  } else if (consensusMainCount === consensusTotal) {
    answer = { label: "全AI外れ", className: "bg-red-50 text-red-700" };
  } else {
    answer = { label: "コンセンサス外れ", className: "bg-amber-50 text-amber-700" };
  }

  return { resultWinner, consensusMainName, consensusMainCount, consensusTotal, answer };
}

// settledAt/startsAt(unknown/string)を表示・ソート専用のDateへ変換する。判定には使わない。
// race詳細 Phase 3 の toSettledAtDate と同じ、toDate() の有無によるダックタイピング方針。
function toDateSafe(value: unknown): Date | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object") {
    const maybeTimestamp = value as { toDate?: unknown };
    if (typeof maybeTimestamp.toDate === "function") {
      try {
        const date = (maybeTimestamp.toDate as () => Date)();
        return date instanceof Date && !isNaN(date.getTime()) ? date : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

// ソート基準時刻。settledAtを優先、無ければstartsAt、どちらも変換できなければnull(末尾)。
function getSortTime(event: KompariEvent): number | null {
  const settledAtDate = toDateSafe(event.result?.settledAt);
  if (settledAtDate) return settledAtDate.getTime();

  const startsAtDate = toDateSafe(event.startsAt);
  if (startsAtDate) return startsAtDate.getTime();

  return null;
}

export default function ResultsPage() {
  const [eventDocs, setEventDocs] = useState<KompariEventDoc[] | null>(null);
  const [predsMap, setPredsMap] = useState<Map<string, KompariPredictionDoc[]> | null>(null);

  useEffect(() => {
    const eventsUnsub = onSnapshot(
      query(collection(db, "events"), orderBy("createdAt", "desc")),
      (snap) => {
        setEventDocs(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as KompariEventDoc))
        );
      }
    );

    const predsUnsub = onSnapshot(collectionGroup(db, "predictions"), (snap) => {
      // P6-5a: 同一snapshotから、shape validation用のraw入力(event別)と、
      // 既存の結果入力UI用の完全doc(event別、Firestoreの実doc IDを docId として付帯)を
      // 同時に構築する。rawはこのコールバック内のローカル変数としてのみ存在し、
      // Reactのstateへは一切保存しない。
      const rawInputsByEvent = new Map<string, RawPredictionDocInput[]>();
      const fullDocsByEvent = new Map<
        string,
        Array<{ docId: string; prediction: KompariPredictionDoc }>
      >();

      for (const d of snap.docs) {
        const raw = d.data();
        const pred = raw as KompariPredictionDoc;
        const eventId = pred.eventId || d.ref.parent.parent?.id;
        if (!eventId) continue;

        if (!rawInputsByEvent.has(eventId)) rawInputsByEvent.set(eventId, []);
        rawInputsByEvent.get(eventId)!.push({
          raw,
          context: { eventId, predictionId: d.id },
        });

        if (!fullDocsByEvent.has(eventId)) fullDocsByEvent.set(eventId, []);
        fullDocsByEvent.get(eventId)!.push({ docId: d.id, prediction: pred });
      }

      // event単位でparsePredictionBatchを呼び、shapeDiagnosticsのpredictionId
      // (= 呼び出し時にcontext.predictionIdへ渡したd.id)を、そのeventのinvalid ID集合とする。
      // 保存済みprediction.predictionIdフィールドには一切依存しない。
      const map = new Map<string, KompariPredictionDoc[]>();
      for (const [eventId, inputs] of rawInputsByEvent.entries()) {
        const batchResult = parsePredictionBatch(inputs);

        const invalidIds = new Set(
          batchResult.shapeDiagnostics.map((diagnostic) => diagnostic.predictionId)
        );

        const validDocs = (fullDocsByEvent.get(eventId) ?? [])
          .filter((entry) => !invalidIds.has(entry.docId))
          .map((entry) => entry.prediction);

        map.set(eventId, validDocs);
      }

      setPredsMap(map);
    });

    return () => {
      eventsUnsub();
      predsUnsub();
    };
  }, []);

  const events = useMemo<KompariEvent[] | null>(() => {
    if (!eventDocs || !predsMap) return null;
    return eventDocs.map((doc) => normalizeEventDocToEvent(doc, predsMap.get(doc.id) ?? []));
  }, [eventDocs, predsMap]);

  // 公開ページはmanual-fixture(sample)eventを実績として見せない。
  const publicEvents = useMemo<KompariEvent[] | null>(() => {
    if (!events) return null;
    return events.filter(isPublicEvent);
  }, [events]);

  const finishedEvents = useMemo(() => {
    if (!publicEvents) return [];

    return publicEvents
      .filter((event) => !!getResultWinner(event))
      .sort((a, b) => {
        const timeA = getSortTime(a);
        const timeB = getSortTime(b);

        if (timeA === null && timeB === null) return 0;
        if (timeA === null) return 1;
        if (timeB === null) return -1;

        return timeB - timeA;
      });
  }, [publicEvents]);

  const loaded = events !== null;

  return (
    <main className="min-h-screen bg-[#F2F4F8] text-[#0F172A]">
      <TopBar />

      <div className="mx-auto max-w-[430px] px-4 pb-28 pt-6">
        <div className="mb-5">
          <h1 className="text-[22px] font-extrabold">結果</h1>
          <p className="mt-1 text-[12px] font-semibold text-gray-500">
            AI予測と実際の結果を答え合わせ
          </p>
        </div>

        {!loaded && (
          <div className="py-10 text-center text-sm text-gray-500">
            読み込み中...
          </div>
        )}

        {loaded && finishedEvents.length === 0 && (
          <div className="rounded-[18px] border border-[#E8ECF2] bg-white p-6 text-center text-sm text-gray-500 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            まだ結果が確定したイベントはありません。
          </div>
        )}

        {loaded && finishedEvents.length > 0 && (
          <div className="space-y-3">
            {finishedEvents.map((event) => {
              const summary = buildResultSummary(event);

              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="block rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[10.5px] font-bold text-brand">
                      {getCategoryEmoji(event.category)} {getCategoryLabel(event.category)}
                    </span>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${summary.answer.className}`}
                    >
                      {summary.answer.label}
                    </span>
                  </div>

                  <div className="text-[14px] font-extrabold leading-snug">
                    {event.title}
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    結果:{" "}
                    <span className="font-bold text-gray-900">
                      {summary.resultWinner}
                    </span>
                  </div>

                  {summary.consensusMainName && (
                    <div className="mt-1 text-xs text-gray-500">
                      AI本命:{" "}
                      <span className="font-bold text-gray-900">
                        {summary.consensusMainName}
                      </span>
                      （{summary.consensusMainCount}/{summary.consensusTotal} AI）
                    </div>
                  )}

                  <div className="mt-3 text-[11px] font-bold text-brand">
                    詳しく見る →
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
