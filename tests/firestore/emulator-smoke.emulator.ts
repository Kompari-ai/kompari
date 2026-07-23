import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    "FIRESTORE_EMULATOR_HOST is required; refusing to run against a non-emulator target",
  );
}

const PROJECT_ID = "demo-kompari-pr2f2";
const FIXTURE_ID = "test-4a-emulator-smoke-event";

const fixture = {
  id: FIXTURE_ID,
  title: "TEST-4a Emulator Smoke",
  category: "horse-racing",
  candidates: ["A", "B"],
  result: null,
};

let testEnv: RulesTestEnvironment;

describe("Firestore Emulator smoke test", () => {
  beforeAll(async () => {
    const rules = await readFile(resolve("firestore.rules"), "utf8");

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "events", FIXTURE_ID), fixture);
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("allows an unauthenticated user to read an Event", async () => {
    const context = testEnv.unauthenticatedContext();
    const snapshot = await assertSucceeds(
      getDoc(doc(context.firestore(), "events", FIXTURE_ID)),
    );

    expect(snapshot.exists()).toBe(true);
    expect(snapshot.data()).toMatchObject(fixture);
  });

  it("allows the admin email context to update an Event", async () => {
    const context = testEnv.authenticatedContext("test-admin", {
      email: "g0930035@gmail.com",
    });

    await assertSucceeds(
      updateDoc(doc(context.firestore(), "events", FIXTURE_ID), {
        title: "TEST-4a Emulator Smoke Updated",
      }),
    );
  });

  it("rejects an Event update from a non-admin context", async () => {
    const context = testEnv.authenticatedContext("test-user", {
      email: "test-user@example.com",
    });

    await assertFails(
      updateDoc(doc(context.firestore(), "events", FIXTURE_ID), {
        title: "Rejected Update",
      }),
    );
  });
});
