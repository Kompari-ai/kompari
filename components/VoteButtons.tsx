"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

export function VoteButtons({ ai }: { ai: string }) {
  const [loading, setLoading] = useState(false);
  const [goodCount, setGoodCount] = useState(0);
  const [badCount, setBadCount] = useState(0);
  const [myVote, setMyVote] = useState<"good" | "bad" | null>(null);

  const storageKey = `kompari-vote-${ai}`;

  useEffect(() => {
    const savedVote = localStorage.getItem(storageKey);

    if (savedVote === "good" || savedVote === "bad") {
      setMyVote(savedVote);
    }

    const q = query(collection(db, "votes"), where("ai", "==", ai));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let good = 0;
      let bad = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();

        if (data.type === "good") good += 1;
        if (data.type === "bad") bad += 1;
      });

      setGoodCount(good);
      setBadCount(bad);
    });

    return () => unsubscribe();
  }, [ai, storageKey]);

  const vote = async (type: "good" | "bad") => {
    if (myVote) {
      alert("このAIにはすでに投票済みです");
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, "votes"), {
        ai,
        type,
        createdAt: serverTimestamp(),
      });

      localStorage.setItem(storageKey, type);
      setMyVote(type);
    } catch (error) {
      console.error(error);
      alert("保存に失敗しました");
    }

    setLoading(false);
  };

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <button
          onClick={() => vote("good")}
          disabled={loading || !!myVote}
          className={`flex-1 rounded-2xl py-3 font-bold disabled:opacity-60 ${
            myVote === "good"
              ? "bg-blue-700 text-white"
              : "bg-blue-50 text-blue-700"
          }`}
        >
          👍 Good {goodCount}
        </button>

        <button
          onClick={() => vote("bad")}
          disabled={loading || !!myVote}
          className={`flex-1 rounded-2xl py-3 font-bold disabled:opacity-60 ${
            myVote === "bad"
              ? "bg-gray-800 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          👎 Bad {badCount}
        </button>
      </div>

      {myVote && (
        <p className="mt-2 text-center text-xs text-gray-500">
          投票済み：{myVote === "good" ? "Good" : "Bad"}
        </p>
      )}
    </div>
  );
}