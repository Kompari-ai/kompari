"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { eventCategories } from "@/lib/categories";
import {
  normalizeEventDocToEvent,
  type KompariEvent,
  type KompariEventDoc,
  type KompariPrediction,
  type KompariPredictionDoc,
} from "@/lib/events";

const officialAis = ["ChatGPT", "Claude", "Gemini", "DeepSeek", "Grok"];

function parseCandidates(text: string) {
  return text
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function defaultCandidateText(category: string) {
  if (category === "nba") {
    return "ホームチーム勝利\nアウェイチーム勝利\n接戦で延長戦";
  }

  if (category === "soccer") {
    return "ホームチーム勝利\nアウェイチーム勝利\n引き分け";
  }

  if (category === "mlb") {
    return "ホームチーム勝利\nアウェイチーム勝利\nロースコア決着";
  }

  if (category === "crypto") {
    return "上昇シナリオ\n横ばいシナリオ\n下落シナリオ";
  }

  if (category === "stocks") {
    return "上昇\n横ばい\n下落";
  }

  if (category === "election") {
    return "候補A優勢\n候補B優勢\n接戦";
  }

  if (category === "esports") {
    return "チームA勝利\nチームB勝利\nフルセット決着";
  }

  return "1番人気馬\n先行馬\n差し馬";
}

function isOfficialPrediction(prediction: KompariPrediction, aiName: string) {
  return (
    prediction.ai === aiName &&
    prediction.source !== "user" &&
    !prediction.myAiId
  );
}

type PredictionIdInput = { ai?: string | null; myAiId?: string | null };

function makePredictionId(pred: PredictionIdInput): string {
  const rawId = pred.myAiId || pred.ai || "unknown";
  return String(rawId).replace(/\//g, "_").trim() || "unknown";
}

function removeUndefinedFields<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );
}

export default function AdminEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [event, setEvent] = useState<KompariEvent | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [category, setCategory] = useState("horse_racing");
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [candidateText, setCandidateText] = useState("");
  const [resultWinner, setResultWinner] = useState("");

  const [saving, setSaving] = useState(false);
  const [generatingAi, setGeneratingAi] = useState("");

  useEffect(() => {
    // undefined = not yet received first snapshot; null = doc does not exist
    let eventDocData: KompariEventDoc | null | undefined = undefined;
    let predictionsData: KompariPredictionDoc[] | undefined = undefined;
    let formInitialized = false;

    function tryNormalize(fromEventDoc: boolean) {
      if (eventDocData === undefined || predictionsData === undefined) return;

      if (eventDocData === null) {
        setEvent(null);
        setLoaded(true);
        return;
      }

      const normalized = normalizeEventDocToEvent(eventDocData, predictionsData);
      setEvent(normalized);

      // Initialize form on first full load; re-init if event doc changes after that
      if (!formInitialized || fromEventDoc) {
        setCategory(normalized.category);
        setTitle(normalized.title);
        setVenue(normalized.venue || "");
        setStartsAt(normalized.startsAt || "");
        setCandidateText((normalized.candidates || []).join("\n"));
        setResultWinner(
          normalized.result?.winner || normalized.resultWinner || ""
        );
        formInitialized = true;
      }

      setLoaded(true);
    }

    const unsubEvent = onSnapshot(doc(db, "events", id), (snapshot) => {
      if (snapshot.exists()) {
        eventDocData = {
          id: snapshot.id,
          ...snapshot.data(),
        } as KompariEventDoc;
      } else {
        eventDocData = null;
      }
      tryNormalize(true);
    });

    const unsubPredictions = onSnapshot(
      collection(db, "events", id, "predictions"),
      (snapshot) => {
        predictionsData = snapshot.docs.map((d) => ({
          ...d.data(),
          predictionId: d.id,
        })) as KompariPredictionDoc[];
        tryNormalize(false);
      }
    );

    return () => {
      unsubEvent();
      unsubPredictions();
    };
  }, [id]);

  const candidates = useMemo(() => parseCandidates(candidateText), [
    candidateText,
  ]);

  const resultOptions = useMemo(() => {
    if (!resultWinner) return candidates;

    if (candidates.includes(resultWinner)) return candidates;

    return [resultWinner, ...candidates];
  }, [candidates, resultWinner]);

  const currentPredictions = event?.predictions || [];

  const saveEvent = async () => {
    if (!title.trim()) {
      alert("イベント名を入力してください");
      return;
    }

    if (candidates.length < 2) {
      alert("候補リストを2つ以上入力してください");
      return;
    }

    try {
      setSaving(true);

      const trimmedTitle = title.trim();
      const trimmedVenue = venue.trim();
      const trimmedResultWinner = resultWinner.trim();
      const resultValue = trimmedResultWinner ? { winner: trimmedResultWinner } : null;
      const batch = writeBatch(db);
      batch.update(doc(db, "races", id), {
        category,
        title: trimmedTitle,
        venue: trimmedVenue,
        startsAt: startsAt || null,
        candidates,
        resultWinner: trimmedResultWinner,
        result: resultValue,
      });
      batch.update(doc(db, "events", id), {
        category,
        title: trimmedTitle,
        venue: trimmedVenue,
        startsAt: startsAt || null,
        candidates,
        result: resultValue,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

      alert("イベントを更新しました");
    } catch (error) {
      console.error(error);
      alert("イベント更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const generatePrediction = async (aiName: string, silent = false) => {
    if (!event) return;

    if (!title.trim()) {
      alert("イベント名を入力してください");
      return;
    }

    if (candidates.length < 2) {
      alert("候補リストを2つ以上入力してください");
      return;
    }

    try {
      setGeneratingAi(aiName);

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
        throw new Error("AI予測の生成に失敗しました");
      }

      const data = (await response.json()) as KompariPrediction;

      const nextPrediction: KompariPrediction = {
        ...data,
        ai: aiName,
        source: "official",
      };

      const preservedPredictions = currentPredictions.filter(
        (prediction) => !isOfficialPrediction(prediction, aiName)
      );

      const predictionId = makePredictionId(nextPrediction);
      const batch = writeBatch(db);

      // races: maintain existing full update (meta + predictions array)
      batch.update(doc(db, "races", id), {
        category,
        title: title.trim(),
        venue: venue.trim(),
        startsAt: startsAt || null,
        candidates,
        predictions: [...preservedPredictions, nextPrediction],
      });

      // events predictions subcollection: full replace (set, not update) to clean stale fields
      const predDoc: Record<string, unknown> = {
        ...nextPrediction,
        eventId: id,
        predictionId,
        outcome: "pending",
        predictedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      batch.set(
        doc(db, "events", id, "predictions", predictionId),
        removeUndefinedFields(predDoc)
      );

      // events doc: sync meta fields (no top-level resultWinner, no predictions array)
      batch.update(doc(db, "events", id), {
        category,
        title: title.trim(),
        venue: venue.trim(),
        startsAt: startsAt || null,
        candidates,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      if (!silent) {
        alert(`${aiName}の予測を再生成しました`);
      }
    } catch (error) {
      console.error(error);
      alert(`${aiName}の予測再生成に失敗しました`);
    } finally {
      setGeneratingAi("");
    }
  };

  const generateAllPredictions = async () => {
    for (const aiName of officialAis) {
      await generatePrediction(aiName, true);
    }

    alert("公式AI予測を再生成しました");
  };

  const deleteEvent = async () => {
    const ok = confirm(
      "このイベントを削除しますか？\n削除すると、AI予測・結果・ランキング集計からも消えます。"
    );

    if (!ok) return;

    try {
      setSaving(true);

      await deleteDoc(doc(db, "races", id));

      alert("イベントを削除しました");
      router.push("/admin/results");
    } catch (error) {
      console.error(error);
      alert("イベント削除に失敗しました");
    } finally {
      setSaving(false);
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
          <section className="rounded-3xl bg-white p-5 text-center shadow-sm">
            <h1 className="text-xl font-extrabold">
              イベントが見つかりません
            </h1>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              このイベントは削除された可能性があります。
            </p>

            <Link
              href="/admin/results"
              className="mt-5 block rounded-2xl bg-blue-700 py-3 text-sm font-bold text-white"
            >
              結果入力へ戻る
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
        <section className="mb-5 rounded-3xl bg-blue-700 p-5 text-white">
          <div className="mb-2 text-xs opacity-80">ADMIN EDIT</div>
          <h1 className="text-2xl font-extrabold">イベント編集</h1>
          <p className="mt-2 text-sm opacity-80">
            イベント名、候補リスト、結果、公式AI予測をあとから修正できます。
          </p>
        </section>

        <section className="mb-5 rounded-3xl bg-white p-4 shadow-sm">
          <div className="mb-3 text-center text-sm font-extrabold text-gray-600">
            管理メニュー
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/admin"
              className="rounded-2xl bg-gray-100 py-3 text-center text-sm font-bold text-gray-700"
            >
              イベント作成
            </Link>

            <Link
              href="/admin/results"
              className="rounded-2xl bg-blue-700 py-3 text-center text-sm font-bold text-white"
            >
              結果入力
            </Link>
          </div>

          <Link
            href={`/race/${id}`}
            className="mt-3 block rounded-2xl border border-gray-200 bg-white py-3 text-center text-sm font-bold text-gray-600"
          >
            詳細ページを見る
          </Link>
        </section>

        <section className="mb-5 space-y-4 rounded-3xl bg-white p-4 shadow-sm">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-gray-500">
              カテゴリ
            </span>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3"
            >
              {eventCategories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.emoji} {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold text-gray-500">
              イベント名
            </span>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：阪神 vs 巨人 / BTC 週末予測"
              className="w-full rounded-xl border border-gray-200 px-3 py-3"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold text-gray-500">
              開催場所・補足
            </span>

            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="例：甲子園 / 2026年6月第1週"
              className="w-full rounded-xl border border-gray-200 px-3 py-3"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold text-gray-500">
              開始日時
            </span>

            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-3"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold text-gray-500">
              候補リスト
            </span>

            <textarea
              value={candidateText}
              onChange={(e) => {
                setCandidateText(e.target.value);

                const nextCandidates = parseCandidates(e.target.value);

                if (
                  resultWinner &&
                  nextCandidates.length > 0 &&
                  !nextCandidates.includes(resultWinner)
                ) {
                  setResultWinner("");
                }
              }}
              placeholder={
                "候補を1行ずつ入力\n例：阪神勝利\n巨人勝利\n引き分け"
              }
              className="min-h-36 w-full rounded-xl border border-gray-200 px-3 py-3"
            />

            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-gray-400">
                現在の候補数：{candidates.length}件
              </span>

              <button
                type="button"
                onClick={() => {
                  const ok = confirm(
                    "現在の候補リストを、カテゴリ標準候補に置き換えますか？"
                  );

                  if (!ok) return;

                  setCandidateText(defaultCandidateText(category));
                  setResultWinner("");
                }}
                className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600"
              >
                標準候補を入れる
              </button>
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold text-gray-500">
              結果 winner
            </span>

            <select
              value={resultWinner}
              onChange={(e) => setResultWinner(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3"
            >
              <option value="">未入力</option>

              {resultOptions.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="mb-5 rounded-3xl bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">公式AI予測を再生成</h2>

            <button
              type="button"
              onClick={generateAllPredictions}
              disabled={!!generatingAi || saving}
              className="rounded-full bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:bg-gray-300"
            >
              全AI再生成
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {officialAis.map((aiName) => {
              const exists = currentPredictions.some((prediction) =>
                isOfficialPrediction(prediction, aiName)
              );

              return (
                <button
                  key={aiName}
                  type="button"
                  onClick={() => generatePrediction(aiName)}
                  disabled={!!generatingAi || saving}
                  className={`rounded-2xl px-3 py-4 text-sm font-bold ${
                    exists
                      ? "bg-blue-50 text-blue-700"
                      : "bg-gray-100 text-gray-700"
                  } disabled:bg-gray-200 disabled:text-gray-400`}
                >
                  {generatingAi === aiName
                    ? "再生成中..."
                    : exists
                    ? `${aiName} 再生成`
                    : `${aiName} 生成`}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-xs font-bold leading-5 text-gray-400">
            候補リストを変更した場合は、公式AI予測も再生成してください。My
            AIの予測はそのまま残ります。
          </p>
        </section>

        <section className="mb-5 rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-extrabold">保存前の確認</h2>

          <div className="space-y-3">
            <div className="rounded-2xl bg-gray-50 p-3">
              <div className="text-xs font-bold text-gray-400">候補数</div>
              <div className="mt-1 text-lg font-extrabold">
                {candidates.length}件
              </div>
            </div>

            <div className="rounded-2xl bg-gray-50 p-3">
              <div className="text-xs font-bold text-gray-400">AI予測数</div>
              <div className="mt-1 text-lg font-extrabold">
                {currentPredictions.length}件
              </div>
            </div>

            <div className="rounded-2xl bg-gray-50 p-3">
              <div className="text-xs font-bold text-gray-400">結果</div>
              <div className="mt-1 text-lg font-extrabold">
                {resultWinner || "未入力"}
              </div>
            </div>

            <div className="rounded-2xl bg-blue-50 p-3 text-sm leading-6 text-gray-700">
              候補リストを大きく変更すると、すでに生成済みのAI予測と内容がずれる場合があります。
              変更後は「公式AI予測を再生成」してください。
            </div>
          </div>
        </section>

        <div className="space-y-3">
          <button
            type="button"
            onClick={saveEvent}
            disabled={saving || !!generatingAi}
            className="w-full rounded-2xl bg-blue-700 py-4 font-bold text-white disabled:bg-gray-300"
          >
            {saving ? "処理中..." : "イベントを更新"}
          </button>

          <button
            type="button"
            onClick={deleteEvent}
            disabled={saving || !!generatingAi}
            className="w-full rounded-2xl bg-red-50 py-4 font-bold text-red-700 disabled:text-gray-300"
          >
            イベントを削除
          </button>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
