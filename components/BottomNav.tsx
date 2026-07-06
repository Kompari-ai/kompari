"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    label: "ホーム",
    href: "/",
    icon: "⌂",
  },
  {
    label: "イベント",
    href: "/events",
    icon: "◇",
  },
  {
    label: "結果",
    href: "/results",
    icon: "✓",
  },
  {
    label: "ランキング",
    href: "/ranking",
    icon: "♕",
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 z-50 border-t border-gray-200 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]"
      style={{
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: "430px",
      }}
    >
      <div className="grid h-[76px] w-full grid-cols-4 bg-white">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-full w-full flex-col items-center justify-center gap-1"
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-2xl text-base font-extrabold ${
                  active
                    ? "bg-brand text-white"
                    : "bg-transparent text-gray-400"
                }`}
              >
                {item.icon}
              </div>

              <div
                className={`text-[11px] font-bold leading-none ${
                  active ? "text-brand" : "text-gray-400"
                }`}
              >
                {item.label}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}