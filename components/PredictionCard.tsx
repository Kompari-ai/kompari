"use client";

import { VoteButtons } from "./VoteButtons";

export function PredictionCard({
  prediction,
}: {
  prediction: {
    ai: string;
    prediction: string;
    confidence: number;
  };
}) {
  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-lg font-bold">
            {prediction.ai}
          </div>

          <div className="text-xs text-gray-500">
            AI予測
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-extrabold text-blue-700">
            {prediction.confidence}%
          </div>

          <div className="text-[10px] text-gray-500">
            信頼度
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-gray-50 p-4 text-sm leading-7 text-gray-700">
        {prediction.prediction}
      </div>

      <VoteButtons ai={prediction.ai} />
    </div>
  );
}