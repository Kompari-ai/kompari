import type { EventCategory } from "./categories";
import type { KompariEventDoc } from "./events";

// 外部ソースが返す生データの型。event型そのものではなく「一段手前」の外部フォーマット。
// 競馬を前提に最小構成。将来 JRA / netkeiba 等の別ソースもこの型に正規化して渡す想定。
export type RawEventSource = {
  raceName: string;
  // ISO8601、または new Date() でパース可能な文字列を想定。
  raceDate: string;
  venue: string;
  // 出走馬リスト。event.candidates の元になる。
  entries: string[];
  category: string;
  // 外部ソース上の一意ID。重複検出のキー。
  sourceId: string;
  sourceUrl?: string;
};

// 変換後のevent draft。Firestoreに書く前の中間表現として KompariEventDoc をそのまま使う。
export type EventDraft = KompariEventDoc;

export type ConvertResult =
  | { ok: true; event: EventDraft }
  | { ok: false; reason: string; sourceId: string };

// createdAt/updatedAt のプレースホルダ。実書き込み時は serverTimestamp() に置き換える。
const SERVER_TIMESTAMP_PLACEHOLDER = "PLACEHOLDER_SERVER_TIMESTAMP" as const;

// sourceId から決定的な id/slug を生成する。
// 同じ sourceId から必ず同じ id になることを保証し、重複取り込みの検出に使う
// (実際の Firestore 照合は行わない。id 生成が決定的であることまでがこのPRの範囲)。
function slugifySourceId(sourceId: string): string {
  const sanitized = sourceId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `fixture-${sanitized || "unknown"}`;
}

// raceDate を startsAt 用の ISO8601 文字列に正規化する。
// パースできない場合は元の文字列をそのまま返す(表示専用フォールバックと同じ思想。ここで変換失敗にはしない)。
function normalizeStartsAt(raceDate: string): string {
  const date = new Date(raceDate);
  return isNaN(date.getTime()) ? raceDate : date.toISOString();
}

// RawEventSource を KompariEventDoc のドラフトへ正規化する純粋関数。Firestoreには一切触れない。
export function convertRawEventSource(raw: RawEventSource): ConvertResult {
  if (!raw.entries || raw.entries.length === 0) {
    return {
      ok: false,
      reason: "entries が空です。空イベントは作成しません。",
      sourceId: raw.sourceId,
    };
  }

  const id = slugifySourceId(raw.sourceId);

  const event: EventDraft = {
    id,
    slug: id,
    category: raw.category as EventCategory,
    title: raw.raceName,
    candidates: raw.entries,
    venue: raw.venue,
    startsAt: normalizeStartsAt(raw.raceDate),
    // 取り込み時点では未確定。
    result: undefined,
    createdAt: SERVER_TIMESTAMP_PLACEHOLDER,
    updatedAt: SERVER_TIMESTAMP_PLACEHOLDER,
    source: "manual-fixture",
    sourceId: raw.sourceId,
    sourceUrl: raw.sourceUrl,
    creationSource: "importer",
  };

  return { ok: true, event };
}
