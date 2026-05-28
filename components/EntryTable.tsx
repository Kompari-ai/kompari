type Entry = {
  number: number;
  name: string;
  odds: string;
};

export function EntryTable({ entries }: { entries: Entry[] }) {
  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">出走表</h2>
        <span className="text-xs text-gray-500">単勝オッズ</span>
      </div>

      <div className="divide-y divide-gray-100">
        {entries.map((entry) => (
          <div key={entry.number} className="flex items-center py-3">
            <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-sm font-bold mr-3">
              {entry.number}
            </div>

            <div className="flex-1 font-semibold">{entry.name}</div>

            <div className="text-sm text-gray-500">{entry.odds}</div>
          </div>
        ))}
      </div>
    </section>
  );
}