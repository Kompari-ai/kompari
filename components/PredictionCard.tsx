import Link from "next/link";
import { VoteButtons } from "@/components/VoteButtons";

type Prediction = {
  ai: string;
  main: string;
  second?: string;
  third?: string;
  confidence?: string;
  reason?: string;
  evidence?: string;
  source?: "official" | "user";
  myAiId?: string;
};

type PredictionCardProps = {
  prediction: Prediction;
  eventId?: string;
  raceId?: string;
  resultWinner?: string;
};

function formatConfidence(confidence?: string) {
  if (!confidence) return "-";
  if (confidence.includes("%")) return confidence;
  return `${confidence}%`;
}

function getResultLabel(prediction: Prediction, resultWinner?: string) {
  if (!resultWinner) {
    return {
      label: "判定待ち",
      className: "bg-blue-50 text-blue-700",
    };
  }

  if (prediction.main === resultWinner) {
    return {
      label: "的中",
      className: "bg-green-50 text-green-700",
    };
  }

  return {
    label: "不的中",
    className: "bg-red-50 text-red-700",
  };
}

function getAiLink(prediction: Prediction) {
  if (prediction.myAiId) {
    return `/my-ai/${prediction.myAiId}`;
  }

  return `/ai/${prediction.ai.toLowerCase()}`;
}

function getAiInitial(ai: string) {
  if (ai === "ChatGPT") return "GPT";
  if (ai === "Claude") return "C";
  if (ai === "Gemini") return "G";
  if (ai === "DeepSeek") return "DS";

  return ai.slice(0, 2).toUpperCase();
}

function getAiIconClass(prediction: Prediction) {
  if (prediction.source === "user" || prediction.myAiId) {
    return "bg-indigo-600 text-white";
  }

  if (prediction.ai === "ChatGPT") {
    return "bg-emerald-500 text-white";
  }

  if (prediction.ai === "Claude") {
    return "bg-orange-500 text-white";
  }

  if (prediction.ai === "Gemini") {
    return "bg-blue-600 text-white";
  }

  if (prediction.ai === "DeepSeek") {
    return "bg-indigo-700 text-white";
  }

  return "bg-gray-900 text-white";
}

export function PredictionCard({
  prediction,
  eventId,
  raceId,
  resultWinner,
}: PredictionCardProps) {
  const safeEventId = eventId || raceId || "";
  const result = getResultLabel(prediction, resultWinner);
  const isMyAi = prediction.source === "user" || !!prediction.myAiId;

  return (
    <section className="rounded-[26px] border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <Link href={getAiLink(prediction)} className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold ${getAiIconClass(
              prediction
            )}`}
          >
            {getAiInitial(prediction.ai)}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold">{prediction.ai}</h3>

              <span
                className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                  isMyAi
                    ? "bg-blue-50 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {isMyAi ? "My AI" : "公式AI"}
              </span>
            </div>

            <p className="mt-1 text-xs font-bold text-gray-400">
              詳細プロフィールを見る
            </p>
          </div>
        </Link>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${result.className}`}
        >
          {result.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-blue-50 p-3">
          <div className="text-[11px] font-bold text-gray-500">本命</div>
          <div className="mt-1 truncate text-sm font-extrabold text-blue-700">
            {prediction.main || "-"}
          </div>
        </div>

        <div className="rounded-2xl bg-gray-50 p-3">
          <div className="text-[11px] font-bold text-gray-400">対抗</div>
          <div className="mt-1 truncate text-sm font-extrabold">
            {prediction.second || "-"}
          </div>
        </div>

        <div className="rounded-2xl bg-gray-50 p-3">
          <div className="text-[11px] font-bold text-gray-400">信頼度</div>
          <div className="mt-1 text-sm font-extrabold">
            {formatConfidence(prediction.confidence)}
          </div>
        </div>
      </div>

      {prediction.third && (
        <div className="mt-3 rounded-2xl bg-gray-50 p-3">
          <div className="text-xs font-bold text-gray-400">3番手</div>
          <div className="mt-1 font-extrabold">{prediction.third}</div>
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-gray-50 p-3">
        <div className="mb-1 text-xs font-bold text-gray-400">予測理由</div>
        <p className="text-sm font-semibold leading-6 text-gray-700">
          {prediction.reason ||
            "このAIは、候補全体のバランスを比較して本命を選んでいます。"}
        </p>
      </div>

      {prediction.evidence && (
        <div className="mt-3 rounded-2xl bg-gray-50 p-3">
          <div className="mb-1 text-xs font-bold text-gray-400">根拠</div>
          <p className="text-sm font-semibold leading-6 text-gray-700">
            {prediction.evidence}
          </p>
        </div>
      )}

      {safeEventId && (
        <div className="mt-4">
          <VoteButtons eventId={safeEventId} ai={prediction.ai} />
        </div>
      )}
    </section>
  );
}

export default PredictionCard;