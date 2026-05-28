"use client";

import { VoteButtons } from "./VoteButtons";

type Prediction = {
  ai: string;
  logo: string;
  record: string;
  confidence: number;
  main: string;
  second: string;
  third: string;
  reason: string;
  evidence: string;
};

export function PredictionCard({ prediction }: { prediction: Prediction }) {
  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <div className="flex items-center gap-3 mb-4">
        <img
          src={prediction.logo}
          alt={prediction.ai}
          className="w-10 h-10 rounded-full bg-gray-50 p-2 object-contain"
        />

        <div className="flex-1">
          <div className="font-bold">{prediction.ai}</div>
          <div className="text-xs text-gray-500">{prediction.record}</div>
        </div>

        <div className="text-right">
          <div className="text-lg font-extrabold text-blue-700">
            {prediction.confidence}%
          </div>
          <div className="text-[10px] text-gray-500">信頼度</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-yellow-50 rounded-xl p-3 text-center border border-yellow-100">
          <div className="text-xs text-gray-500 mb-1">◎ 本命</div>
          <div className="font-extrabold text-sm">{prediction.main}</div>
        </div>

        <div className="bg-gray-100 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">○ 対抗</div>
          <div className="font-bold text-sm">{prediction.second}</div>
        </div>

        <div className="bg-orange-50 rounded-xl p-3 text-center border border-orange-100">
          <div className="text-xs text-gray-500 mb-1">▲ 穴</div>
          <div className="font-bold text-sm">{prediction.third}</div>
        </div>
      </div>

      <div className="text-sm leading-7 text-gray-700 mb-4">
        {prediction.reason}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-900 mb-4">
        📊 根拠データ：{prediction.evidence}
      </div>

      <VoteButtons ai={prediction.ai} />
    </section>
  );
}