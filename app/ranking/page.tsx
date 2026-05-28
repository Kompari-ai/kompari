import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";

const rankings = [
  {
    rank: 1,
    name: "DeepSeek",
    rate: 74,
    record: "50戦37的中",
    strength: "競馬・競艇に強い",
    logo: "/deepseek.png",
  },
  {
    rank: 2,
    name: "ChatGPT",
    rate: 71,
    record: "52戦37的中",
    strength: "総合力が高い",
    logo:
      "https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg",
  },
  {
    rank: 3,
    name: "Claude",
    rate: 69,
    record: "48戦33的中",
    strength: "展開読みが得意",
    logo: "/claude.png",
  },
  {
    rank: 4,
    name: "Gemini",
    rate: 66,
    record: "47戦31的中",
    strength: "データ傾向に強い",
    logo:
      "https://upload.wikimedia.org/wikipedia/commons/8/8f/Google-gemini-icon.svg",
  },
];

export default function RankingPage() {
  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <TopBar />

      <div className="max-w-[430px] mx-auto px-4 py-4 pb-24">
        <section className="bg-gradient-to-br from-blue-700 to-blue-950 rounded-3xl p-5 text-white mb-5 shadow-lg">
          <div className="text-xs opacity-80 mb-2">
            AI PREDICTION ARENA
          </div>

          <h1 className="text-2xl font-extrabold mb-2">
            AI的中率ランキング
          </h1>

          <p className="text-sm opacity-80 leading-6">
            各AIの予測成績を比較し、
            どのAIがどの分野に強いかを可視化します。
          </p>
        </section>

        <section className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">総合ランキング</h2>

            <span className="text-xs text-gray-500">
              シーズン累計
            </span>
          </div>

          <div className="space-y-3">
            {rankings.map((ai) => (
              <Link
                key={ai.name}
                href={`/ai/${ai.name.toLowerCase()}`}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold ${
                    ai.rank === 1
                      ? "bg-yellow-100 text-yellow-700"
                      : ai.rank === 2
                      ? "bg-gray-100 text-gray-600"
                      : ai.rank === 3
                      ? "bg-orange-100 text-orange-700"
                      : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {ai.rank}
                </div>

                <img
                  src={ai.logo}
                  alt={ai.name}
                  className="w-10 h-10 rounded-full bg-gray-50 p-2 object-contain"
                />

                <div className="flex-1">
                  <div className="font-bold">
                    {ai.name}
                  </div>

                  <div className="text-xs text-gray-500">
                    {ai.record}
                  </div>

                  <div className="text-xs text-blue-700 font-semibold mt-1">
                    {ai.strength}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-extrabold text-blue-700">
                    {ai.rate}%
                  </div>

                  <div className="text-[10px] text-gray-500">
                    的中率
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold mb-3">
            分野別の得意分野
          </h2>

          <div className="space-y-3 text-sm">
            <div>
              <div className="flex justify-between mb-1">
                <span>競馬</span>

                <span className="font-bold text-blue-700">
                  DeepSeek 78%
                </span>
              </div>

              <div className="h-2 bg-gray-100 rounded-full">
                <div className="h-2 bg-blue-700 rounded-full w-[78%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span>サッカー</span>

                <span className="font-bold text-blue-700">
                  ChatGPT 73%
                </span>
              </div>

              <div className="h-2 bg-gray-100 rounded-full">
                <div className="h-2 bg-blue-700 rounded-full w-[73%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span>展開予測</span>

                <span className="font-bold text-blue-700">
                  Claude 71%
                </span>
              </div>

              <div className="h-2 bg-gray-100 rounded-full">
                <div className="h-2 bg-blue-700 rounded-full w-[71%]" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}