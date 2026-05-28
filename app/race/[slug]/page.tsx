import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";

const entries = [
  {
    number: 1,
    horse: "スターアニス",
    odds: "2.8",
    ai: "ChatGPT",
    support: 82,
  },
  {
    number: 2,
    horse: "ラフターラインズ",
    odds: "5.1",
    ai: "Claude",
    support: 68,
  },
  {
    number: 3,
    horse: "ドリームコア",
    odds: "7.4",
    ai: "DeepSeek",
    support: 59,
  },
  {
    number: 4,
    horse: "ブルーメテオ",
    odds: "12.2",
    ai: "Gemini",
    support: 41,
  },
];

export default function RacePage() {
  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <TopBar />

      <div className="max-w-[430px] mx-auto px-4 py-4 pb-24">
        <section className="rounded-3xl bg-gradient-to-br from-[#0f172a] to-[#1e3a8a] p-5 text-white shadow-xl mb-5">
          <div className="text-xs opacity-70 mb-2">
            AI RACE ANALYSIS
          </div>

          <h1 className="text-3xl font-extrabold mb-2">
            日本ダービー 2026
          </h1>

          <div className="flex gap-2 text-xs opacity-80 mb-4">
            <span>東京競馬場</span>
            <span>芝2400m</span>
            <span>GⅠ</span>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
            <div className="text-xs opacity-70 mb-1">
              AI総合本命
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-extrabold">
                  スターアニス
                </div>

                <div className="text-sm opacity-80">
                  ChatGPT / Claude支持
                </div>
              </div>

              <div className="text-right">
                <div className="text-3xl font-extrabold text-yellow-300">
                  82%
                </div>

                <div className="text-xs opacity-70">
                  支持率
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow-sm p-4 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">
              出走表
            </h2>

            <span className="text-xs text-gray-500">
              AI支持率順
            </span>
          </div>

          <div className="space-y-3">
            {entries.map((horse) => (
              <div
                key={horse.number}
                className="rounded-2xl border border-gray-100 p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold">
                      {horse.number}
                    </div>

                    <div>
                      <div className="font-bold">
                        {horse.horse}
                      </div>

                      <div className="text-xs text-gray-500">
                        推奨AI：{horse.ai}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-extrabold text-blue-700">
                      {horse.odds}
                    </div>

                    <div className="text-[10px] text-gray-500">
                      AIオッズ
                    </div>
                  </div>
                </div>

                <div className="mb-1 flex justify-between text-xs">
                  <span>支持率</span>
                  <span className="font-bold">
                    {horse.support}%
                  </span>
                </div>

                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-blue-700"
                    style={{
                      width: `${horse.support}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow-sm p-4">
          <h2 className="font-bold mb-4">
            AIレース展開予測
          </h2>

          <div className="space-y-4">
            <div className="rounded-2xl bg-blue-50 p-4">
              <div className="text-sm font-bold mb-2 text-blue-700">
                ChatGPT
              </div>

              <p className="text-sm leading-7 text-gray-700">
                スターアニスが先行集団の後ろから抜け出す展開を予測。
                スローペースからの瞬発力勝負になる可能性が高い。
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4">
              <div className="text-sm font-bold mb-2">
                Claude
              </div>

              <p className="text-sm leading-7 text-gray-700">
                中団待機組に展開利あり。
                ラフターラインズの末脚に注意。
              </p>
            </div>
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}