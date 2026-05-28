type Prediction = {
  ai: string;
  logo: string;
  record: string;
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
          className="w-10 h-10 rounded-full bg-gray-50 p-2"
        />

        <div className="flex-1">
          <div className="font-bold">{prediction.ai}</div>
          <div className="text-xs text-gray-500">{prediction.record}</div>
        </div>

        <div className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
          本命 ◎
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-yellow-50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">◎ 本命</div>
          <div className="font-extrabold">{prediction.main}</div>
        </div>

        <div className="bg-gray-100 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">○ 対抗</div>
          <div className="font-bold">{prediction.second}</div>
        </div>

        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">▲ 穴</div>
          <div className="font-bold">{prediction.third}</div>
        </div>
      </div>

      <div className="text-sm leading-7 text-gray-700 mb-4">
        {prediction.reason}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600 mb-4">
        📊 根拠データ：{prediction.evidence}
      </div>

      <div className="flex gap-2">
        <button className="flex-1 bg-green-50 border border-green-200 text-green-700 rounded-xl py-2 font-semibold">
          👍 Good
        </button>

        <button className="flex-1 bg-red-50 border border-red-200 text-red-700 rounded-xl py-2 font-semibold">
          👎 Bad
        </button>
      </div>
    </section>
  );
}