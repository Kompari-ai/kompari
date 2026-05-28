import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";

const aiData: Record<string, any> = {
  deepseek: {
    name: "DeepSeek",
    description:
      "競馬・競艇など数値予測系に強いAI。",
    overall: 74,
    horse: 78,
    boat: 81,
    soccer: 69,
    nba: 70,
    style: "データ重視",
    weakness: "穴狙いは控えめ",
    color: "from-blue-700 to-cyan-700",
  },

  chatgpt: {
    name: "ChatGPT",
    description:
      "総合分析能力が高く、多分野対応型AI。",
    overall: 71,
    horse: 73,
    boat: 68,
    soccer: 76,
    nba: 74,
    style: "バランス型",
    weakness: "超高配当狙いは苦手",
    color: "from-green-600 to-emerald-700",
  },

  claude: {
    name: "Claude",
    description:
      "展開予測・文章分析が得意なAI。",
    overall: 69,
    horse: 71,
    boat: 66,
    soccer: 72,
    nba: 68,
    style: "展開読み型",
    weakness: "数値系はやや弱い",
    color: "from-orange-500 to-red-500",
  },

  gemini: {
    name: "Gemini",
    description:
      "Google系データ分析に強いAI。",
    overall: 66,
    horse: 67,
    boat: 62,
    soccer: 70,
    nba: 73,
    style: "データ解析型",
    weakness: "波乱展開への対応",
    color: "from-purple-600 to-pink-600",
  },
};

export default async function AiProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const ai =
    aiData[slug] || aiData["chatgpt"];

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <TopBar />

      <div className="max-w-[430px] mx-auto px-4 py-4 pb-24">
        <section
          className={`rounded-3xl bg-gradient-to-br ${ai.color} p-5 text-white shadow-lg mb-5`}
        >
          <div className="text-xs opacity-80 mb-2">
            AI PROFILE
          </div>

          <h1 className="text-3xl font-extrabold mb-2">
            {ai.name}
          </h1>

          <p className="text-sm opacity-80 leading-6">
            {ai.description}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/10 p-3 text-center">
              <div className="text-2xl font-extrabold text-yellow-300">
                {ai.overall}%
              </div>

              <div className="text-[10px] opacity-70">
                総合的中率
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 text-center">
              <div className="text-2xl font-extrabold">
                {ai.horse}%
              </div>

              <div className="text-[10px] opacity-70">
                競馬
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 text-center">
              <div className="text-2xl font-extrabold">
                {ai.soccer}%
              </div>

              <div className="text-[10px] opacity-70">
                サッカー
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow-sm p-4 mb-5">
          <h2 className="font-bold mb-4">
            得意分野
          </h2>

          <div className="space-y-4 text-sm">
            {[
              ["競馬", ai.horse],
              ["競艇", ai.boat],
              ["サッカー", ai.soccer],
              ["NBA", ai.nba],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="flex justify-between mb-1">
                  <span>{label}</span>

                  <span className="font-bold text-blue-700">
                    {value}%
                  </span>
                </div>

                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-blue-700 rounded-full"
                    style={{
                      width: `${value}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow-sm p-4 mb-5">
          <h2 className="font-bold mb-4">
            予測スタイル
          </h2>

          <div className="space-y-3">
            <div className="rounded-2xl bg-blue-50 p-4">
              <div className="font-bold text-blue-700 mb-1">
                {ai.style}
              </div>

              <p className="text-sm leading-6 text-gray-700">
                AIごとの分析傾向を表示。
                将来的には実際の予測履歴から自動生成予定。
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4">
              <div className="font-bold mb-1">
                苦手傾向
              </div>

              <p className="text-sm leading-6 text-gray-700">
                {ai.weakness}
              </p>
            </div>
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}