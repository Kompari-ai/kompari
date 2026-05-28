import { event } from "@/data/events";
import { Hero } from "@/components/Hero";
import { PredictionCard } from "@/components/PredictionCard";
import { TopBar } from "@/components/TopBar";
import { SupportDistribution } from "@/components/SupportDistribution";
import { EntryTable } from "@/components/EntryTable";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <TopBar />

      <div className="max-w-[430px] mx-auto px-4 py-4">
        <Hero
          title={event.title}
          venue={event.venue}
          startsIn={event.startsIn}
          raceMeta={event.raceMeta}
          consensus={event.consensus}
        />

        <SupportDistribution support={event.support} />

        <EntryTable entries={event.entries} />

        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">各AIの予測</h2>
          <span className="text-xs text-gray-500">
            Good / Badで評価
          </span>
        </div>

        {event.predictions.map((prediction) => (
          <PredictionCard key={prediction.ai} prediction={prediction} />
        ))}
      </div>
    </main>
  );
}