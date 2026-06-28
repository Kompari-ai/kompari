"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import {
  eventCategories,
  getCategoryEmoji,
  getCategoryLabel,
} from "@/lib/categories";
import {
  getResultWinner,
  normalizeEventDocToEvent,
  type KompariEvent,
  type KompariEventDoc,
  type KompariPredictionDoc,
} from "@/lib/events";

type StatusFilter = "all" | "open" | "finished";

function goTo(path: string) {
  window.location.assign(path);
}

function isFinished(event: KompariEvent) {
  return !!getResultWinner(event);
}

function getCandidates(event: KompariEvent) {
  if (event.candidates && event.candidates.length > 0) {
    return event.candidates;
  }

  const names = new Set<string>();

  event.predictions.forEach((prediction) => {
    if (prediction.main) names.add(prediction.main);
    if (prediction.second) names.add(prediction.second);
    if (prediction.third) names.add(prediction.third);
  });

  return Array.from(names);
}

function getConsensus(event: KompariEvent) {
  const counts: Record<string, number> = {};

  event.predictions.forEach((prediction) => {
    if (!prediction.main) return;
    counts[prediction.main] = (counts[prediction.main] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export default function AdminResultsPage() {
  const [eventDocs, setEventDocs] = useState<KompariEventDoc[] | null>(null);
  const [predsMap, setPredsMap] = useState<Map<string, KompariPredictionDoc[]> | null>(null);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [savingId, setSavingId] = useState("");

  const events = useMemo<KompariEvent[] | null>(() => {
    if (!eventDocs || !predsMap) return null;
    return eventDocs.map((d) => normalizeEventDocToEvent(d, predsMap.get(d.id) ?? []));
  }, [eventDocs, predsMap]);

  useEffect(() => {
    const eventsUnsub = onSnapshot(
      query(collection(db, "events"), orderBy("createdAt", "desc")),
      (snap) => {
        setEventDocs(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as KompariEventDoc))
        );
      }
    );
    const predsUnsub = onSnapshot(
      collectionGroup(db, "predictions"),
      (snap) => {
        const map = new Map<string, KompariPredictionDoc[]>();
        for (const d of snap.docs) {
          const pred = d.data() as KompariPredictionDoc;
          const eventId = pred.eventId || d.ref.parent.parent?.id;
          if (!eventId) continue;
          if (!map.has(eventId)) map.set(eventId, []);
          map.get(eventId)!.push(pred);
        }
        setPredsMap(map);
      }
    );
    return () => { eventsUnsub(); predsUnsub(); };
  }, []);

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((event) => {
      const resultWinner = getResultWinner(event);
      const finished = !!resultWinner;

      if (statusFilter === "open" && finished) return false;
      if (statusFilter === "finished" && !finished) return false;

      if (categoryFilter !== "all" && event.category !== categoryFilter) {
        return false;
      }

      const text = [
        event.title,
        event.venue,
        event.startsIn,
        event.category,
        ...getCandidates(event),
        ...event.predictions.map((prediction) => prediction.ai),
      ]
        .join(" ")
        .toLowerCase();

      if (keyword.trim() && !text.includes(keyword.trim().toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [events, keyword, statusFilter, categoryFilter]);

  const openCount = (events ?? []).filter((event) => !isFinished(event)).length;
  const finishedCount = (events ?? []).filter((event) => isFinished(event)).length;

  const saveResult = async (event: KompariEvent, winner: string) => {
    try {
      setSavingId(event.id);

      const trimmedWinner = winner.trim();
      const resultValue = trimmedWinner ? { winner: trimmedWinner } : null;
      const batch = writeBatch(db);
      batch.update(doc(db, "events", event.id), {
        result: resultValue,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      console.error(error);
      alert(
        "結果の保存に失敗しました。Googleログイン中のメールアドレスとFirestoreルールを確認してください。"
      );
    } finally {
      setSavingId("");
    }
  };

  const clearResult = async (event: KompariEvent) => {
    await saveResult(event, "");
  };

  if (events === null) {
    return (
      <main className="min-h-screen bg-[#f5f5f7] text-[#111827]">
        <TopBar />
        <div className="mx-auto max-w-[430px] px-4 py-10 text-center text-sm font-bold text-gray-400">
          読み込み中...
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
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold tracking-[0.18em] text-white">
                ADMIN
              </span>

              <button
                type="button"
                onClick={() => goTo("/admin")}
                className="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-blue-700"
              >
                作成
              </button>
            </div>

            <h1 className="text-3xl font-black leading-tight">結果入力</h1>

            <p className="mt-3 text-sm font-semibold leading-6 text-blue-50">
              各イベントの結果を入力すると、AIランキングに反映されます。
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">
                  未入力
                </div>
                <div className="mt-1 text-2xl font-extrabold text-gray-900">
                  {openCount}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">
                  入力済み
                </div>
                <div className="mt-1 text-2xl font-extrabold text-gray-900">
                  {finishedCount}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">総数</div>
                <div className="mt-1 text-2xl font-extrabold text-gray-900">
                  {events.length}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[26px] bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-extrabold text-gray-700">
            管理メニュー
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => goTo("/admin")}
              className="rounded-2xl bg-gray-100 py-4 text-center text-sm font-extrabold text-gray-700"
            >
              イベント作成
            </button>

            <button
              type="button"
              onClick={() => goTo("/admin/results")}
              className="rounded-2xl bg-blue-700 py-4 text-center text-sm font-extrabold text-white"
            >
              結果入力
            </button>
          </div>

          <button
            type="button"
            onClick={() => goTo("/ranking")}
            className="mt-3 w-full rounded-2xl border border-gray-200 bg-white py-4 text-center text-sm font-extrabold text-gray-700"
          >
            ランキング確認
          </button>
        </section>

        <section className="mb-5 rounded-[26px] bg-white p-4 shadow-sm">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-gray-500">
              キーワード検索
            </span>

            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="イベント名・候補・AI名で検索"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white"
            />
          </label>

          <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`py-4 text-sm font-extrabold ${
                statusFilter === "all"
                  ? "bg-blue-700 text-white"
                  : "text-gray-600"
              }`}
            >
              すべて
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("open")}
              className={`py-4 text-sm font-extrabold ${
                statusFilter === "open"
                  ? "bg-blue-700 text-white"
                  : "text-gray-600"
              }`}
            >
              未入力
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("finished")}
              className={`py-4 text-sm font-extrabold ${
                statusFilter === "finished"
                  ? "bg-blue-700 text-white"
                  : "text-gray-600"
              }`}
            >
              入力済み
            </button>
          </div>

          <div className="mt-4 overflow-x-auto pb-1">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-extrabold ${
                  categoryFilter === "all"
                    ? "bg-blue-700 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                すべて
              </button>

              {eventCategories.map((category, index) => (
                <button
                  key={`${category.value}-${category.label}-${index}`}
                  type="button"
                  onClick={() => setCategoryFilter(category.value)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-extrabold ${
                    categoryFilter === category.value
                      ? "bg-blue-700 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {category.emoji} {category.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">対象イベント</h2>

          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-500 shadow-sm">
            {filteredEvents.length}件表示
          </span>
        </section>

        <section className="space-y-4">
          {filteredEvents.map((event) => {
            const candidates = getCandidates(event);
            const resultWinner = getResultWinner(event);
            const consensus = getConsensus(event);
            const saving = savingId === event.id;

            return (
              <article
                key={event.id}
                className="rounded-[26px] bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 text-[11px] font-extrabold text-blue-700">
                      {getCategoryEmoji(event.category)}{" "}
                      {getCategoryLabel(event.category)}
                    </div>

                    <h3 className="text-lg font-extrabold leading-snug">
                      {event.title}
                    </h3>

                    <p className="mt-1 text-xs font-bold text-gray-400">
                      {event.venue || "開催情報未入力"}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ${
                      resultWinner
                        ? "bg-blue-50 text-blue-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {resultWinner ? "結果入力済み" : "結果未入力"}
                  </span>
                </div>

                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-gray-50 p-3">
                    <div className="text-[11px] font-bold text-gray-400">
                      候補
                    </div>
                    <div className="mt-1 text-lg font-extrabold">
                      {candidates.length}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-3">
                    <div className="text-[11px] font-bold text-gray-400">
                      AI予測
                    </div>
                    <div className="mt-1 text-lg font-extrabold">
                      {event.predictions.length}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-3">
                    <div className="text-[11px] font-bold text-gray-400">
                      状態
                    </div>
                    <div className="mt-1 text-sm font-extrabold">
                      {resultWinner ? "入力済" : "未入力"}
                    </div>
                  </div>
                </div>

                {consensus.length > 0 && (
                  <div className="mb-3 rounded-2xl bg-blue-50 p-3">
                    <div className="mb-2 text-xs font-bold text-gray-500">
                      AIコンセンサス本命
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {consensus.slice(0, 3).map((item, index) => (
                        <span
                          key={`${event.id}-consensus-${item.name}-${index}`}
                          className="rounded-full bg-white px-3 py-2 text-xs font-extrabold text-blue-700"
                        >
                          {item.name} {item.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-gray-500">
                    結果 winner
                  </span>

                  <select
                    value={resultWinner}
                    onChange={(e) => saveResult(event, e.target.value)}
                    disabled={saving}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm font-bold outline-none disabled:bg-gray-100"
                  >
                    <option value="">未入力にする</option>

                    {candidates.map((candidate, index) => (
                      <option
                        key={`${event.id}-candidate-option-${candidate}-${index}`}
                        value={candidate}
                      >
                        {candidate}
                      </option>
                    ))}
                  </select>
                </label>

                {resultWinner && (
                  <div className="mt-3 rounded-2xl bg-blue-50 p-4 text-center">
                    <div className="text-xs font-bold text-gray-500">
                      現在の結果
                    </div>
                    <div className="mt-1 text-xl font-extrabold text-blue-700">
                      {resultWinner}
                    </div>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => saveResult(event, resultWinner)}
                    disabled={saving}
                    className="rounded-2xl bg-blue-700 py-4 text-sm font-extrabold text-white disabled:bg-gray-300"
                  >
                    {saving ? "保存中..." : "結果を保存"}
                  </button>

                  <button
                    type="button"
                    onClick={() => clearResult(event)}
                    disabled={saving}
                    className="rounded-2xl bg-gray-100 py-4 text-sm font-extrabold text-gray-700 disabled:bg-gray-200"
                  >
                    クリア
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => goTo(`/race/${event.id}`)}
                    className="rounded-2xl border border-gray-200 bg-white py-4 text-center text-sm font-extrabold text-gray-700"
                  >
                    詳細を見る
                  </button>

                  <button
                    type="button"
                    onClick={() => goTo(`/admin/edit/${event.id}`)}
                    className="rounded-2xl border border-gray-200 bg-white py-4 text-center text-sm font-extrabold text-gray-700"
                  >
                    編集する
                  </button>
                </div>
              </article>
            );
          })}

          {filteredEvents.length === 0 && (
            <div className="rounded-[26px] bg-white p-6 text-center shadow-sm">
              <div className="text-3xl">🔎</div>

              <h3 className="mt-3 text-lg font-extrabold">
                対象イベントがありません
              </h3>

              <p className="mt-2 text-sm font-bold leading-6 text-gray-500">
                検索条件を変えるか、新しいイベントを作成してください。
              </p>

              <button
                type="button"
                onClick={() => goTo("/admin")}
                className="mt-5 w-full rounded-2xl bg-blue-700 py-4 text-sm font-extrabold text-white"
              >
                イベント作成へ
              </button>
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </main>
  );
}