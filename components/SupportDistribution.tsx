type Support = {
  name: string;
  count: number;
};

export function SupportDistribution({ support }: { support: Support[] }) {
  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">3着以内支持数</h2>
        <span className="text-xs text-gray-500">4 AI中</span>
      </div>

      <div className="space-y-3">
        {support.map((item) => (
          <div key={item.name}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-semibold">{item.name}</span>
              <span className="text-blue-700 font-bold">{item.count}/4</span>
            </div>

            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-700 rounded-full"
                style={{ width: `${(item.count / 4) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}