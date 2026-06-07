"use client";

import { useEffect, useMemo, useState } from "react";
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type VoteType = "up" | "down" | null;

type VoteButtonsProps = {
  eventId: string;
  ai: string;
};

type VoteCounts = {
  up: number;
  down: number;
};

function getVoteDocId(eventId: string, ai: string) {
  return `${eventId}__${encodeURIComponent(ai)}`;
}

function getLocalVoteKey(eventId: string, ai: string) {
  return `kompari-vote-${eventId}-${ai}`;
}

export function VoteButtons({ eventId, ai }: VoteButtonsProps) {
  const [counts, setCounts] = useState<VoteCounts>({
    up: 0,
    down: 0,
  });

  const [myVote, setMyVote] = useState<VoteType>(null);
  const [loading, setLoading] = useState(false);

  const voteDocId = useMemo(() => getVoteDocId(eventId, ai), [eventId, ai]);
  const localVoteKey = useMemo(
    () => getLocalVoteKey(eventId, ai),
    [eventId, ai]
  );

  useEffect(() => {
    const savedVote = localStorage.getItem(localVoteKey);

    if (savedVote === "up" || savedVote === "down") {
      setMyVote(savedVote);
    } else {
      setMyVote(null);
    }
  }, [localVoteKey]);

  useEffect(() => {
    const ref = doc(db, "votes", voteDocId);

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      if (!snapshot.exists()) {
        setCounts({
          up: 0,
          down: 0,
        });
        return;
      }

      const data = snapshot.data();

      setCounts({
        up: Number(data.up || 0),
        down: Number(data.down || 0),
      });
    });

    return () => unsubscribe();
  }, [voteDocId]);

  const vote = async (nextVote: Exclude<VoteType, null>) => {
    if (loading) return;

    try {
      setLoading(true);

      const ref = doc(db, "votes", voteDocId);

      const previousVote = myVote;
      const finalVote: VoteType = previousVote === nextVote ? null : nextVote;

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);

        const currentUp = snapshot.exists() ? Number(snapshot.data().up || 0) : 0;
        const currentDown = snapshot.exists()
          ? Number(snapshot.data().down || 0)
          : 0;

        let nextUp = currentUp;
        let nextDown = currentDown;

        if (previousVote === "up") {
          nextUp -= 1;
        }

        if (previousVote === "down") {
          nextDown -= 1;
        }

        if (finalVote === "up") {
          nextUp += 1;
        }

        if (finalVote === "down") {
          nextDown += 1;
        }

        transaction.set(
          ref,
          {
            eventId,
            ai,
            up: Math.max(0, nextUp),
            down: Math.max(0, nextDown),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      if (finalVote) {
        localStorage.setItem(localVoteKey, finalVote);
      } else {
        localStorage.removeItem(localVoteKey);
      }

      setMyVote(finalVote);
    } catch (error) {
      console.error(error);
      alert("投票の保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => vote("up")}
        disabled={loading}
        className={`rounded-full px-3 py-2 text-xs font-extrabold transition disabled:opacity-50 ${
          myVote === "up"
            ? "bg-blue-700 text-white"
            : "bg-blue-50 text-blue-700"
        }`}
      >
        👍 いいね {counts.up}
      </button>

      <button
        type="button"
        onClick={() => vote("down")}
        disabled={loading}
        className={`rounded-full px-3 py-2 text-xs font-extrabold transition disabled:opacity-50 ${
          myVote === "down"
            ? "bg-red-600 text-white"
            : "bg-red-50 text-red-700"
        }`}
      >
        👎 うーん {counts.down}
      </button>
    </div>
  );
}