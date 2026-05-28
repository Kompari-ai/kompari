export function TopBar() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-[430px] mx-auto px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-blue-700 tracking-tight">
            Kompari
          </h1>
          <p className="text-[10px] text-gray-500 font-semibold tracking-wide">
            AI PREDICTION ARENA
          </p>
        </div>

        <button className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          🔔
        </button>
      </div>
    </header>
  );
}