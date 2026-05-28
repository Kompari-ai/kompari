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

  useEffect(() => {
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
  }, [ai]);

  const vote = async (type: "good" | "bad") => {
    setLoading(true);

    try {
      await addDoc(collection(db, "votes"), {
        ai,
        type,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      alert("保存に失敗しました");
    }

    setLoading(false);
  };

  return (
    <div className="flex gap-2 mt-4">
      <button
        onClick={() => vote("good")}
        disabled={loading}
        className="flex-1 rounded-2xl bg-blue-700 text-white py-3 font-bold disabled:opacity-50"
      >
        👍 Good {goodCount}
      </button>

      <button
        onClick={() => vote("bad")}
        disabled={loading}
        className="flex-1 rounded-2xl bg-gray-200 py-3 font-bold disabled:opacity-50"
      >
        👎 Bad {badCount}
      </button>
    </div>
  );
}