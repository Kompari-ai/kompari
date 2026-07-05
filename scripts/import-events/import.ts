// Guarded event importer.
//
// デフォルト(引数なし、または --dry-run): dry-run。
//   sample fixture を読み、event draft に変換し、ログ出力するだけ。
//   Firestore 関連の import は一切発生しない(下記 writeToFirestore 参照)。
//
// --write フラグ時のみ Firestore write 経路を通る:
//   1. events/{deterministic id} に Admin SDK の doc().create() を試みる
//   2. 既に存在する → create() が ALREADY_EXISTS で失敗するので catch して skip ログを出す(上書きしない)
//   3. 存在しない → create() が成功する
//   predictions サブコレクションには一切触れない。
//
// 実行:
//   npx tsx scripts/import-events/import.ts             (dry-run)
//   npx tsx scripts/import-events/import.ts --dry-run    (dry-run)
//   npx tsx scripts/import-events/import.ts --write      (実書き込み)
//
// 注意(SDK/認証について):
//   --write 経路は firebase-admin(Admin SDK)を使う。scripts/lib/admin.ts 参照。
//   client SDK(firebase/firestore)は使わない。理由: firestore.rules の events
//   create/update/delete は isAdmin()(管理者メールでの認証)を要求しており、
//   scripts から実行する未認証の client SDK ではこの条件を満たせず permission-denied
//   になることが PR-2 の read-only 確認で判明したため。
//   Admin SDK は GOOGLE_APPLICATION_CREDENTIALS(サービスアカウントJSONの絶対パス)を
//   前提とする。未設定の場合は scripts/lib/admin.ts が明示的なエラーを投げて停止する。
//   サービスアカウントJSONは本リポジトリに存在せず、このスクリプトも生成・commitしない。

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  convertRawEventSource,
  type ConvertResult,
  type RawEventSource,
} from "../../lib/event-import";

const FIXTURE_PATH = join(
  process.cwd(),
  "fixtures/events/horse-racing/sample-race.json"
);

type Mode = "dry-run" | "write";

function parseMode(): Mode {
  const args = process.argv.slice(2);
  return args.includes("--write") ? "write" : "dry-run";
}

function loadFixture(): RawEventSource {
  const raw = readFileSync(FIXTURE_PATH, "utf-8");
  return JSON.parse(raw) as RawEventSource;
}

function logDraft(result: ConvertResult) {
  if (result.ok) {
    console.log("変換成功:");
    console.log(JSON.stringify(result.event, null, 2));
  } else {
    console.log(`変換失敗: ${result.reason} (sourceId: ${result.sourceId})`);
  }
}

// Admin SDK の create() が ALREADY_EXISTS で失敗した場合の判定。
// SDK/gRPCのバージョンにより code の形が揺れる可能性があるため、
// 数値コード(6 = ALREADY_EXISTS)とメッセージ文字列の両方をフォールバックとして見る。
function isAlreadyExistsError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 6 || code === "already-exists") return true;

  const message = error instanceof Error ? error.message : String(error);
  return /ALREADY_EXISTS/i.test(message);
}

// --write モード専用。Admin SDK 関連の import はこの関数の中でのみ行う。
// dry-run モードではこの関数自体が呼ばれないため、firebase-admin は一切ロードされない。
async function writeToFirestore(result: ConvertResult): Promise<void> {
  if (!result.ok) {
    console.log("変換失敗のため書き込みをスキップします。");
    return;
  }

  const { getAdminFirestore } = await import("../lib/admin");
  const { FieldValue } = await import("firebase-admin/firestore");

  const event = result.event;
  const eventId = event.id;

  console.log(`\nこれから events/${eventId} に書き込みます`);
  console.log(`  sourceId: ${event.sourceId}`);
  console.log(`  title: ${event.title}`);
  console.log(`  candidates件数: ${event.candidates.length}`);
  console.log("  predictions は作成しません。");

  const firestore = getAdminFirestore();
  const eventRef = firestore.collection("events").doc(eventId);

  try {
    // create() は既存ドキュメントがあると ALREADY_EXISTS で失敗するため、
    // 無条件 set() より安全な「存在しない場合のみ作成」を1呼び出しで実現できる。
    await eventRef.create({
      slug: event.slug,
      category: event.category,
      title: event.title,
      candidates: event.candidates,
      venue: event.venue,
      startsAt: event.startsAt,
      // 取り込み時点では未確定。空文字列は入れない。既存admin UIと同じくnullで表現する。
      result: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      predictionCount: 0,
      source: event.source,
      sourceId: event.sourceId,
      sourceUrl: event.sourceUrl,
      creationSource: event.creationSource,
    });

    console.log(
      `\nevents/${eventId} を作成しました。predictions は作成していません。`
    );
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      console.log(
        `\nevents/${eventId} は既に存在します。skip します(上書きしません)。`
      );
      return;
    }

    throw error;
  }
}

async function main() {
  const mode = parseMode();

  console.log(`=== Event Importer (mode: ${mode}) ===`);

  const raw = loadFixture();
  const result = convertRawEventSource(raw);

  logDraft(result);

  if (mode === "dry-run") {
    console.log("\ndry-run: Firestoreには書き込んでいません。");
    if (result.ok) {
      console.log(`--write なら events/${result.event.id} に create します。`);
    }
    return;
  }

  await writeToFirestore(result);
}

main();
