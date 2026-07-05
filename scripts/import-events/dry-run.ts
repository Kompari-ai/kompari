// Event Importer dry-run.
// fixture を読んで正規化するだけ。Firestore SDK は import しない・書き込まない。
// 実行: npx tsx scripts/import-events/dry-run.ts

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

function loadFixture(): RawEventSource {
  const raw = readFileSync(FIXTURE_PATH, "utf-8");
  return JSON.parse(raw) as RawEventSource;
}

function logResult(label: string, result: ConvertResult) {
  console.log(`\n--- ${label} ---`);

  if (result.ok) {
    console.log("変換成功:");
    console.log(JSON.stringify(result.event, null, 2));
  } else {
    console.log(`変換失敗: ${result.reason} (sourceId: ${result.sourceId})`);
  }
}

function main() {
  console.log("=== Event Importer dry-run ===");
  console.log("dry-run: Firestoreに書き込んでいません。");

  const raw = loadFixture();

  const result1 = convertRawEventSource(raw);
  logResult("1回目の変換", result1);

  const result2 = convertRawEventSource(raw);
  logResult("2回目の変換(同じ sourceId で id が一致するか確認)", result2);

  if (result1.ok && result2.ok) {
    const sameId = result1.event.id === result2.event.id;
    console.log(`\n同一 sourceId から生成された id が一致するか: ${sameId}`);
    console.log(`  1回目 id: ${result1.event.id}`);
    console.log(`  2回目 id: ${result2.event.id}`);
  }

  const emptyEntriesRaw: RawEventSource = { ...raw, entries: [] };
  const result3 = convertRawEventSource(emptyEntriesRaw);
  logResult("entries空のケース(変換失敗の確認)", result3);

  console.log("\ndry-run: Firestoreに書き込んでいません。(再掲)");
}

main();
