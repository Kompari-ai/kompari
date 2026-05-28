type HeroProps = {
  title: string;
  venue: string;
  startsIn: string;
  raceMeta: string;
  consensus: string;
};

export function Hero({
  title,
  venue,
  startsIn,
  raceMeta,
  consensus,
}: HeroProps) {
  return (
    <section className="bg-gradient-to-br from-blue-700 to-blue-950 rounded-3xl p-5 text-white mb-5 shadow-lg">
      <div className="inline-flex items-center gap-2 bg-amber-400 text-black text-xs font-bold px-3 py-1 rounded-full mb-4">
        ⏱ 発走まで {startsIn}
      </div>

      <div className="text-xs opacity-80 mb-1">{venue}</div>
      <div className="text-xs opacity-70 mb-3">{raceMeta}</div>

      <h2 className="text-2xl font-extrabold mb-5">{title}</h2>

      <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
        <div className="text-xs opacity-80 mb-2">AIコンセンサス</div>
        <div className="text-base font-extrabold">{consensus}</div>
        <div className="text-xs opacity-70 mt-2">
          複数AIの予測を比較し、支持が集まる馬を可視化しています。
        </div>
      </div>
    </section>
  );
}