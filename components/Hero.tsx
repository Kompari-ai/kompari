type HeroProps = {
  title: string;
  venue: string;
  startsIn: string;
  consensus: string;
};

export function Hero({ title, venue, startsIn, consensus }: HeroProps) {
  return (
    <section className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-5 text-white mb-5 shadow-lg">
      <div className="inline-flex items-center gap-2 bg-amber-400 text-black text-xs font-bold px-3 py-1 rounded-full mb-4">
        ⏱ 発走まで {startsIn}
      </div>

      <div className="text-xs opacity-80 mb-2">{venue}</div>

      <h2 className="text-2xl font-extrabold mb-5">{title}</h2>

      <div className="bg-white/10 rounded-xl p-4">
        <div className="text-xs opacity-80 mb-2">AIコンセンサス</div>
        <div className="text-sm font-bold">{consensus}</div>
      </div>
    </section>
  );
}