"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import {
  eventCategories,
  getCategoryEmoji,
  getCategoryLabel,
} from "@/lib/categories";
import {
  getResultWinner,
  isOfficialPrediction,
  isResultTerminal,
  normalizeEventDocToEvent,
  type KompariEvent,
  type KompariEventDoc,
  type KompariPredictionDoc,
} from "@/lib/events";
import { findWinnersOutsideCandidates } from "@/lib/result-write-guard";
import { buildResultWriteUpdates } from "@/lib/result-write";
import {
  ResultRevisionConflictError,
  ResultRevisionValidationError,
  buildResultRevisionEntry,
  canCorrectSingleWinner,
  planSingleWinnerCorrection,
  resolveCurrentRevision,
  resultRevisionDocId,
} from "@/lib/result-revision";
import { classifyPredictionSourceForDiagnostics } from "@/lib/prediction-diagnostics";
import {
  parsePredictionBatch,
  type ParsePredictionBatchResult,
  type RawPredictionDocInput,
} from "@/lib/prediction-read";

type StatusFilter = "all" | "open" | "finished";

// saveResultが実際に呼出し元へ返す結果(PR-2e-0a、pure scaffolding)。
// metadata/initial-settlementはrevisionを持たない(revisionを書かない・使わないため)。
// single-winner-correctionのみ、transactionが採番した訂正後のrevision(nextRevision)を持つ。
// 訂正前の基準revisionではないことに注意。
type SaveResultOutcome =
  | {
      ok: true;
      kind: "metadata";
      winner: string;
    }
  | {
      ok: true;
      kind: "initial-settlement";
      winner: string;
    }
  | {
      ok: true;
      kind: "single-winner-correction";
      winner: string;
      nextRevision: number;
    }
  | {
      ok: false;
      reason:
        | "cancelled"
        | "blocked"
        | "conflict"
        | "validation-error"
        | "failed";
    };

// PR-2e-0b: select変更はローカルdraftのみを更新し(Firestore writeなし)、
// 「結果を保存」ボタン押下時にのみsaveResultを起動する契約のための型。
type DraftResult = {
  selected: string;
  baseWinner: string;
  baseRevision: number;
  version: number;
};

type ExpectedResultState = {
  winner: string;
  revision: number;
};

// saveResult成功後、snapshotで反映されるまでの間、連続保存を止めるための
// 未ack保存結果。nextRevisionはsingle-winner-correctionのtransactionが実際に
// 採番した訂正後revisionで、draft.baseRevision(訂正前の基準revision)とは別物。
type PendingResultSave =
  | {
      kind: "initial-settlement";
      winner: string;
      version: number;
    }
  | {
      kind: "single-winner-correction";
      winner: string;
      nextRevision: number;
      version: number;
    };

// P6-4b: event行のreason簡易内訳を安定表示するための固定順序。
// Firestore snapshot/Mapの挿入順に依存させないため、field順(main→ai→isMock→predictionSource)
// →同一field内はreason markerの昇順、という静的な順序をハードコードする。
const REASON_DISPLAY_ORDER = [
  "main-blank",
  "main-missing",
  "main-non-string",
  "ai-blank",
  "ai-missing",
  "ai-non-string",
  "isMock-non-boolean",
  "mock-source-conflict",
  "predictionSource-invalid",
] as const;

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

  event.predictions.filter(isOfficialPrediction).forEach((prediction) => {
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
  // P6-4a: 診断用のshape parse結果(event別)。predsMapとは別に、同一snapshot
  // callback内で構築する。rawは保持せず、parsePredictionBatchの戻り値のみ保存する。
  const [parsedPredsMap, setParsedPredsMap] = useState<Map<string, ParsePredictionBatchResult> | null>(null);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [savingId, setSavingId] = useState("");

  // PR-2e-0b: select変更中のローカルdraftと、保存後snapshot ackを待っている
  // pending保存結果。Event ID(string)をkeyにしたMap。
  const [draftMap, setDraftMap] = useState<Map<string, DraftResult>>(
    () => new Map()
  );

  const [pendingMap, setPendingMap] =
    useState<Map<string, PendingResultSave>>(
      () => new Map()
    );

  // Event単位のdraft世代カウンタ。draft/pendingが削除されても値は保持し、
  // 同じEventでversionを1へ戻さない。
  const draftVersionCountersRef =
    useRef<Map<string, number>>(new Map());

  function nextDraftVersion(eventId: string): number {
    const next =
      (draftVersionCountersRef.current.get(eventId) ?? 0) + 1;

    draftVersionCountersRef.current.set(eventId, next);
    return next;
  }

  const events = useMemo<KompariEvent[] | null>(() => {
    if (!eventDocs || !predsMap) return null;
    return eventDocs.map((d) => normalizeEventDocToEvent(d, predsMap.get(d.id) ?? []));
  }, [eventDocs, predsMap]);

  // P6-4a: parsedPredsMap(event別のparsePredictionBatch結果)を診断分類する
  // (追加Firestore readなし)。孤児prediction(event docが存在しないeventId)も
  // 拾えるよう、events配列ではなくparsedPredsMapの全key起点で集約する。
  const diagnostics = useMemo(() => {
    if (!parsedPredsMap || !eventDocs) return null;

    const eventDocsById = new Map(eventDocs.map((d) => [d.id, d]));

    let anomalyCount = 0;
    let unknownSourceCount = 0;
    let mockCount = 0;
    // P6-4b: shapeDiagnostics全体のfield別件数(全event横断)。
    const fieldCounts = { main: 0, ai: 0, isMock: 0, predictionSource: 0 };

    const perEvent: {
      eventId: string;
      title: string | null;
      anomaly: number;
      unknownSource: number;
      mock: number;
      needsReview: number;
      hasEventDoc: boolean;
      // P6-4b: そのeventのshapeDiagnosticsだけから集計したreason別件数。
      reasonCounts: Record<string, number>;
    }[] = [];

    for (const [eventId, batchResult] of parsedPredsMap.entries()) {
      const evAnomaly = batchResult.shapeDiagnostics.length;
      let evUnknownSource = 0;
      let evMock = 0;
      const evReasonCounts: Record<string, number> = {};

      for (const diagnostic of batchResult.shapeDiagnostics) {
        fieldCounts[diagnostic.field] += 1;
        evReasonCounts[diagnostic.reason] = (evReasonCounts[diagnostic.reason] || 0) + 1;
      }

      for (const prediction of batchResult.validPredictions) {
        const sourceDiagnostic = classifyPredictionSourceForDiagnostics(prediction);

        if (sourceDiagnostic.kind === "unknown-source") {
          evUnknownSource += 1;
        } else if (sourceDiagnostic.kind === "mock") {
          evMock += 1;
        }
      }

      anomalyCount += evAnomaly;
      unknownSourceCount += evUnknownSource;
      mockCount += evMock;

      const needsReview = evAnomaly + evUnknownSource;
      if (needsReview === 0) continue;

      const eventDoc = eventDocsById.get(eventId);

      perEvent.push({
        eventId,
        title: eventDoc?.title ?? null,
        anomaly: evAnomaly,
        unknownSource: evUnknownSource,
        mock: evMock,
        needsReview,
        hasEventDoc: !!eventDoc,
        reasonCounts: evReasonCounts,
      });
    }

    return {
      needsReviewCount: anomalyCount + unknownSourceCount,
      anomalyCount,
      unknownSourceCount,
      mockCount,
      fieldCounts,
      perEvent,
    };
  }, [parsedPredsMap, eventDocs]);

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
        // P6-4a: 診断用のevent別raw入力。rawはこのコールバック内のローカル変数
        // としてのみ存在し、Reactのstateへは一切保存しない。
        const rawInputsByEvent = new Map<string, RawPredictionDocInput[]>();

        for (const d of snap.docs) {
          const raw = d.data();
          const pred = raw as KompariPredictionDoc;
          const eventId = pred.eventId || d.ref.parent.parent?.id;
          if (!eventId) continue;

          if (!map.has(eventId)) map.set(eventId, []);
          map.get(eventId)!.push(pred);

          if (!rawInputsByEvent.has(eventId)) rawInputsByEvent.set(eventId, []);
          rawInputsByEvent.get(eventId)!.push({
            raw,
            context: { eventId, predictionId: d.id },
          });
        }

        setPredsMap(map);

        const parsedMap = new Map<string, ParsePredictionBatchResult>();
        for (const [eventId, inputs] of rawInputsByEvent.entries()) {
          parsedMap.set(eventId, parsePredictionBatch(inputs));
        }
        setParsedPredsMap(parsedMap);
      }
    );
    return () => { eventsUnsub(); predsUnsub(); };
  }, []);

  // PR-2e-0b: snapshot acknowledgment専用effect。pendingがあるEventだけを対象に、
  // 最新snapshotがその保存結果を反映済みかを確認し、ack成立分だけpending/draftを
  // 選択的に削除する。全draftをsnapshot値で上書きする全面同期は行わない。
  useEffect(() => {
    if (!events) return;
    if (pendingMap.size === 0) return;

    const eventsById = new Map(events.map((e) => [e.id, e]));
    const acknowledgedEntries: Array<[string, PendingResultSave]> = [];

    for (const [eventId, pending] of pendingMap.entries()) {
      const event = eventsById.get(eventId);
      if (!event) continue;

      const persistedWinner = getResultWinner(event);

      let persistedRevision: number | null = null;
      try {
        persistedRevision = resolveCurrentRevision(event.result?.revision);
      } catch (error) {
        console.error(error);
        continue;
      }

      let acknowledged: boolean;

      if (pending.kind === "single-winner-correction") {
        acknowledged =
          persistedRevision > pending.nextRevision ||
          (persistedRevision === pending.nextRevision &&
            persistedWinner === pending.winner);
      } else {
        acknowledged =
          persistedWinner === pending.winner || persistedRevision >= 1;
      }

      if (acknowledged) {
        acknowledgedEntries.push([eventId, pending]);
      }
    }

    if (acknowledgedEntries.length === 0) return;

    setPendingMap((current) => {
      let changed = false;
      const next = new Map(current);

      for (const [eventId, acknowledgedPending] of acknowledgedEntries) {
        const currentPending = next.get(eventId);

        if (currentPending?.version === acknowledgedPending.version) {
          next.delete(eventId);
          changed = true;
        }
      }

      return changed ? next : current;
    });

    setDraftMap((current) => {
      let changed = false;
      const next = new Map(current);

      for (const [eventId, acknowledgedPending] of acknowledgedEntries) {
        const draft = next.get(eventId);

        if (draft?.version === acknowledgedPending.version) {
          next.delete(eventId);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [events, pendingMap]);

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

  const saveResult = async (
    event: KompariEvent,
    winner: string,
    expectedResult: ExpectedResultState
  ): Promise<SaveResultOutcome> => {
    const trimmedWinner = winner.trim();
    const candidates = event.candidates ?? [];
    const originalWinner = getResultWinner(event);
    const resultIsSettled = isResultTerminal(event);
    const winnerChanged = trimmedWinner !== originalWinner;

    if (resultIsSettled && winnerChanged && trimmedWinner === "") {
      alert(
        "確定済みの結果は削除できません。訂正が必要な場合は、正しい候補を選択してください。"
      );
      return { ok: false, reason: "blocked" };
    }

    if (winnerChanged && trimmedWinner !== "") {
      const outsideWinners = findWinnersOutsideCandidates(
        [trimmedWinner],
        candidates
      );

      if (outsideWinners.length > 0) {
        alert(
          "選択された結果は候補一覧に含まれていないため保存できません。候補一覧を確認してください。"
        );
        return { ok: false, reason: "blocked" };
      }
    }

    // 初回settlement条件: event.resultが文字通りnull/undefinedの場合のみ、新規winnerを
    // 「初めての確定」として扱う(app/admin/edit/[id]/page.tsxのsaveEventと同一契約)。
    const eventResult = event.result;
    const initialSettlementConditionMet =
      !resultIsSettled &&
      originalWinner === "" &&
      eventResult?.winners === undefined &&
      eventResult?.status === undefined &&
      !eventResult?.settledAt &&
      (eventResult === null || eventResult === undefined);

    // 訂正可能shape判定は lib/result-revision.ts の共有SoTへ委譲する
    // (saveResult固有のinline判定は持たない、PR-2d-2b)。
    const singleWinnerCorrectionAllowed = canCorrectSingleWinner(event);

    let intentKind: "metadata" | "initial-settlement" | "single-winner-correction";

    if (!winnerChanged) {
      intentKind = "metadata";
    } else if (trimmedWinner !== "" && initialSettlementConditionMet) {
      intentKind = "initial-settlement";
    } else if (trimmedWinner !== "" && singleWinnerCorrectionAllowed) {
      const confirmed = window.confirm(
        `確定済みの結果を訂正します。\n\n` +
          `変更前: ${originalWinner || "未設定"}\n` +
          `変更後: ${trimmedWinner}\n\n` +
          `訂正内容は監査履歴として保存されます。\n` +
          `この変更を保存しますか？`
      );

      if (!confirmed) {
        return { ok: false, reason: "cancelled" };
      }

      intentKind = "single-winner-correction";
    } else {
      // trimmedWinner!=="" で initial-settlement/single-winner-correctionいずれの条件も
      // 満たさない非標準shape(canonical winners-only・複数winner・winner↔winners不一致・
      // winners=[]・voided・postponed・invalid・settledAt-only等)、または settled-clear guard
      // で捕捉されなかった非標準shapeでのクリア試行(trimmedWinner==="")を、
      // fall-throughさせず必ずblockする。新しいResult消去・訂正能力をここから開かない。
      alert(
        "この結果は現在の管理画面では変更できない形式です。開発者に確認してください。"
      );
      return { ok: false, reason: "blocked" };
    }

    const eventRef = doc(db, "events", event.id);

    try {
      setSavingId(event.id);

      if (intentKind === "single-winner-correction") {
        // correctedByはtransaction開始前に1回だけ取得する(callback内でAuth再取得しない。
        // callbackは競合時にretryされうるため)。
        const user = auth.currentUser;
        const correctedBy = user ? { uid: user.uid, email: user.email } : undefined;

        const nextRevision = await runTransaction(db, async (transaction) => {
          // 全readをwriteより先に行う(Firestore transactionの公式要件)。
          const snapshot = await transaction.get(eventRef);

          if (!snapshot.exists()) {
            throw new ResultRevisionValidationError("Event not found");
          }

          // fresh docのidはdocument pathのIDをauthoritativeにするため後置でspreadする。
          const freshEventDoc = {
            ...snapshot.data(),
            id: event.id,
          } as KompariEventDoc;
          // predictionsは訂正判定・訂正計画のいずれからも参照されないため空配列で足りる。
          const freshEvent = normalizeEventDocToEvent(freshEventDoc, []);

          const plan = planSingleWinnerCorrection({
            freshEvent,
            expectedOriginalWinner: expectedResult.winner,
            expectedRevision: expectedResult.revision,
            nextWinner: trimmedWinner,
          });

          const revisionRef = doc(
            db,
            "events",
            event.id,
            "resultRevisions",
            resultRevisionDocId(plan.nextRevision)
          );
          const revisionSnap = await transaction.get(revisionRef);

          if (revisionSnap.exists()) {
            throw new ResultRevisionValidationError("Revision already exists");
          }

          // 親updateはresult.*のdot-pathのみ(+revision)。result whole-mapとは非混在、
          // result.settledAtは書かない(既存値をFirestore側で自動的に保持させる)。
          transaction.update(eventRef, {
            "result.winner": plan.after.winner,
            "result.winners": plan.after.winners,
            "result.status": "settled",
            "result.revision": plan.nextRevision,
            updatedAt: serverTimestamp(),
          });

          transaction.set(
            revisionRef,
            buildResultRevisionEntry({
              revision: plan.nextRevision,
              eventId: event.id,
              before: plan.before,
              after: plan.after,
              correctedAtSentinel: serverTimestamp(),
              correctedBy,
            })
          );

          return plan.nextRevision;
        });

        return {
          ok: true,
          kind: "single-winner-correction",
          winner: trimmedWinner,
          nextRevision,
        };
      } else {
        // intentKindはmetadataまたはinitial-settlementのみ。single-winner-correction用の
        // buildResultWriteUpdates呼出しはここでは行わない(transaction経路と排他)。
        const resultUpdates =
          intentKind === "metadata"
            ? buildResultWriteUpdates({ kind: "metadata" })
            : buildResultWriteUpdates({
                kind: "initial-settlement",
                winner: trimmedWinner,
                settledAt: serverTimestamp(),
              });

        const batch = writeBatch(db);
        batch.update(eventRef, {
          ...resultUpdates,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();

        return intentKind === "metadata"
          ? { ok: true, kind: "metadata", winner: trimmedWinner }
          : { ok: true, kind: "initial-settlement", winner: trimmedWinner };
      }
    } catch (error) {
      if (error instanceof ResultRevisionConflictError) {
        alert(
          "他の変更と競合しました。最新の状態を確認して再度お試しください。"
        );
        return { ok: false, reason: "conflict" };
      } else if (error instanceof ResultRevisionValidationError) {
        alert("結果の状態が想定外のため訂正できません。");
        return { ok: false, reason: "validation-error" };
      } else {
        console.error(error);
        alert(
          "結果の保存に失敗しました。Googleログイン中のメールアドレスとFirestoreルールを確認してください。"
        );
        return { ok: false, reason: "failed" };
      }
    } finally {
      setSavingId("");
    }
  };

  // PR-2e-0b: select変更はローカルdraft更新のみ(Firestore writeなし・confirmなし)。
  // pending分岐をdraft不在分岐より先に判定する(pending中の再編集は新draft世代とする)。
  function handleResultSelectChange(event: KompariEvent, nextSelected: string) {
    const pending = pendingMap.get(event.id);
    const persistedWinner = getResultWinner(event);

    let nextDraft: DraftResult;

    if (pending) {
      const version = nextDraftVersion(event.id);

      nextDraft =
        pending.kind === "single-winner-correction"
          ? {
              selected: nextSelected,
              baseWinner: pending.winner,
              baseRevision: pending.nextRevision,
              version,
            }
          : {
              selected: nextSelected,
              baseWinner: pending.winner,
              baseRevision: 0,
              version,
            };
    } else {
      const existingDraft = draftMap.get(event.id);

      if (!existingDraft) {
        let baseRevision: number;

        try {
          baseRevision = resolveCurrentRevision(event.result?.revision);
        } catch (error) {
          console.error(error);
          alert(
            "この結果は状態が想定外のため編集できません。開発者に確認してください。"
          );
          return;
        }

        nextDraft = {
          selected: nextSelected,
          baseWinner: persistedWinner,
          baseRevision,
          version: nextDraftVersion(event.id),
        };
      } else {
        nextDraft = {
          ...existingDraft,
          selected: nextSelected,
        };
      }
    }

    if (
      nextDraft.selected === persistedWinner &&
      nextDraft.baseWinner === persistedWinner
    ) {
      setDraftMap((current) => {
        if (!current.has(event.id)) return current;
        const next = new Map(current);
        next.delete(event.id);
        return next;
      });
      return;
    }

    setDraftMap((current) => {
      const next = new Map(current);
      next.set(event.id, nextDraft);
      return next;
    });
  }

  // PR-2e-0b: 「結果を保存」ボタンからだけsaveResultへ到達する経路。
  const handleSaveClick = async (event: KompariEvent) => {
    const draft = draftMap.get(event.id);
    if (!draft) return;

    const persistedWinner = getResultWinner(event);

    let persistedRevision: number;
    try {
      persistedRevision = resolveCurrentRevision(event.result?.revision);
    } catch (error) {
      console.error(error);
      alert(
        "この結果は状態が想定外のため編集できません。開発者に確認してください。"
      );
      return;
    }

    // 非atomicな早期警告。既存transactionのexpectedOriginalWinner比較を代替しない。
    if (
      draft.baseWinner !== persistedWinner ||
      draft.baseRevision !== persistedRevision
    ) {
      alert(
        "他の端末で結果が変更されました。画面を再読み込みしてから操作してください。"
      );
      return;
    }

    const outcome = await saveResult(event, draft.selected, {
      winner: draft.baseWinner,
      revision: draft.baseRevision,
    });

    if (!outcome.ok) {
      return;
    }

    if (outcome.kind === "metadata") {
      setDraftMap((current) => {
        if (!current.has(event.id)) return current;
        const next = new Map(current);
        next.delete(event.id);
        return next;
      });
      return;
    }

    const pendingSave: PendingResultSave =
      outcome.kind === "initial-settlement"
        ? {
            kind: "initial-settlement",
            winner: outcome.winner,
            version: draft.version,
          }
        : {
            kind: "single-winner-correction",
            winner: outcome.winner,
            nextRevision: outcome.nextRevision,
            version: draft.version,
          };

    setPendingMap((current) => {
      const next = new Map(current);
      next.set(event.id, pendingSave);
      return next;
    });
  };

  // PR-2e-0b: クリアはローカルstateの削除のみ(Firestore writeなし・confirmなし)。
  // saveResult(event, "")呼出しは廃止する。
  const handleClearClick = (event: KompariEvent) => {
    setDraftMap((current) => {
      if (!current.has(event.id)) return current;
      const next = new Map(current);
      next.delete(event.id);
      return next;
    });

    setPendingMap((current) => {
      if (!current.has(event.id)) return current;
      const next = new Map(current);
      next.delete(event.id);
      return next;
    });
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

        {diagnostics && (
          <section className="mb-5 rounded-[26px] bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-extrabold text-gray-700">
              要確認prediction（診断）
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-red-50 p-3">
                <div className="text-[11px] font-bold text-red-600">
                  要確認prediction
                </div>
                <div className="mt-1 text-2xl font-extrabold text-red-700">
                  {diagnostics.needsReviewCount}件
                </div>
              </div>

              <div className="rounded-2xl bg-gray-50 p-3">
                <div className="text-[11px] font-bold text-gray-400">
                  参考: mock（集計対象外）
                </div>
                <div className="mt-1 text-2xl font-extrabold text-gray-700">
                  {diagnostics.mockCount}件
                </div>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-gray-50 p-3">
                <div className="text-[11px] font-bold text-gray-400">
                  データ形式異常
                </div>
                <div className="mt-1 text-lg font-extrabold text-gray-900">
                  {diagnostics.anomalyCount}件
                </div>
                {diagnostics.anomalyCount > 0 && (
                  <div className="mt-1 text-[11px] font-bold text-gray-400">
                    予測対象 {diagnostics.fieldCounts.main}件 / AI名{" "}
                    {diagnostics.fieldCounts.ai}件 / mock判定{" "}
                    {diagnostics.fieldCounts.isMock}件 / predictionSource{" "}
                    {diagnostics.fieldCounts.predictionSource}件
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-gray-50 p-3">
                <div className="text-[11px] font-bold text-gray-400">
                  source分類不能
                </div>
                <div className="mt-1 text-lg font-extrabold text-gray-900">
                  {diagnostics.unknownSourceCount}件
                </div>
              </div>
            </div>

            {diagnostics.perEvent.length === 0 ? (
              <p className="text-xs font-bold leading-5 text-gray-400">
                要確認predictionはありません。
              </p>
            ) : (
              <div className="space-y-3">
                {diagnostics.perEvent.map((row) => (
                  <div
                    key={row.eventId}
                    className="rounded-2xl bg-gray-50 p-3"
                  >
                    <div className="mb-1 text-sm font-extrabold">
                      {row.hasEventDoc ? row.title : "イベント情報なし"}
                    </div>

                    {!row.hasEventDoc && (
                      <div className="mb-1 text-[11px] font-bold text-gray-400">
                        eventId: {row.eventId}
                      </div>
                    )}

                    <div className="text-xs font-bold text-gray-500">
                      要確認 {row.needsReview}件 / データ形式異常 {row.anomaly}
                      件 / source分類不能 {row.unknownSource}件 / mock{" "}
                      {row.mock}件
                    </div>

                    {row.anomaly > 0 && (
                      <div className="mt-1 text-[11px] font-bold text-gray-400">
                        {REASON_DISPLAY_ORDER.filter(
                          (reason) => (row.reasonCounts[reason] ?? 0) > 0
                        )
                          .map((reason) => `${reason} ×${row.reasonCounts[reason]}`)
                          .join(" / ")}
                      </div>
                    )}

                    {row.hasEventDoc && (
                      <button
                        type="button"
                        onClick={() => goTo(`/admin/edit/${row.eventId}`)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white py-3 text-center text-xs font-extrabold text-gray-700"
                      >
                        確認する →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

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
            const officialPredictions =
              event.predictions.filter(isOfficialPrediction);
            const consensus = getConsensus(event);
            const saving = savingId === event.id;
            const draft = draftMap.get(event.id);
            const pending = pendingMap.get(event.id);
            const selectedResult = draft?.selected ?? resultWinner;
            const hasUnsavedChange =
              draft !== undefined && draft.selected !== resultWinner;

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
                      {officialPredictions.length}
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
                    value={selectedResult}
                    onChange={(e) =>
                      handleResultSelectChange(event, e.target.value)
                    }
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

                {hasUnsavedChange && (
                  <div className="mt-2 rounded-2xl bg-amber-50 p-3 text-center text-xs font-extrabold text-amber-700">
                    未保存の変更があります
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSaveClick(event)}
                    disabled={saving || pending !== undefined || !hasUnsavedChange}
                    className="rounded-2xl bg-blue-700 py-4 text-sm font-extrabold text-white disabled:bg-gray-300"
                  >
                    {saving ? "保存中..." : "結果を保存"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleClearClick(event)}
                    disabled={
                      saving || (draft === undefined && pending === undefined)
                    }
                    className="rounded-2xl bg-gray-100 py-4 text-sm font-extrabold text-gray-700 disabled:bg-gray-200"
                  >
                    クリア
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => goTo(`/events/${event.id}`)}
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
