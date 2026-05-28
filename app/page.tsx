import { event } from "@/data/events";
import { Hero } from "@/components/Hero";
import { PredictionCard } from "@/components/PredictionCard";
import { TopBar } from "@/components/TopBar";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <TopBar />

      <div className="max-w-[430px] mx-auto px-4 py-4">
        <Hero
          title={event.title}
          venue={event.venue}
          startsIn={event.startsIn}
          consensus={event.consensus}
        />

        {event.predictions.map((prediction) => (
          <PredictionCard key={prediction.ai} prediction={prediction} />
        ))}
      </div>
    </main>
  );
}