export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 border-t border-gray-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
      <div className="grid grid-cols-4 py-2">
        <a className="flex flex-col items-center gap-1 text-blue-700">
          <span className="text-xl">🏠</span>
          <span className="text-[10px] font-bold">ホーム</span>
        </a>

        <a className="flex flex-col items-center gap-1 text-gray-400">
          <span className="text-xl">🐎</span>
          <span className="text-[10px] font-bold">レース</span>
        </a>

        <a className="flex flex-col items-center gap-1 text-gray-400">
          <span className="text-xl">🏆</span>
          <span className="text-[10px] font-bold">ランキング</span>
        </a>

        <a className="flex flex-col items-center gap-1 text-gray-400">
          <span className="text-xl">🤖</span>
          <span className="text-[10px] font-bold">マイAI</span>
        </a>
      </div>
    </nav>
  );
}