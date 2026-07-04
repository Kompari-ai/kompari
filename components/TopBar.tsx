"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  {
    label: "ホーム",
    href: "/",
    description: "トップ",
  },
  {
    label: "予測",
    href: "/races",
    description: "イベント一覧",
  },
  {
    label: "ランキング",
    href: "/ranking",
    description: "AI成績",
  },
  {
    label: "通知",
    href: "/notifications",
    description: "未入力確認",
  },
  {
    label: "免責",
    href: "/disclaimer",
    description: "注意事項",
  },
  {
    label: "プライバシー",
    href: "/privacy",
    description: "情報の扱い",
  },
  {
    label: "利用規約",
    href: "/terms",
    description: "ルール",
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isAdminPage = pathname.startsWith("/admin");

  const adminLogout = () => {
    localStorage.removeItem("kompari-admin-unlocked");
    window.location.href = "/admin";
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white">
        <div
          className="mx-auto flex h-16 items-center justify-between px-4"
          style={{
            width: "100%",
            maxWidth: "430px",
          }}
        >
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-2xl font-bold text-gray-900"
            aria-label="メニュー"
          >
            {open ? "×" : "≡"}
          </button>

          <Link href="/" className="text-center">
            <div className="text-2xl font-extrabold italic tracking-tight text-brand">
              Kompari
            </div>
            <div className="text-[10px] font-extrabold tracking-[0.35em] text-gray-400">
              AI PREDICTION ARENA
            </div>
          </Link>

          <Link
            href="/notifications"
            className={`relative flex h-10 w-10 items-center justify-center rounded-full text-xl ${
              isActive(pathname, "/notifications") ? "bg-brand-tint" : ""
            }`}
            aria-label="通知"
          >
            🔔
          </Link>
        </div>
      </header>

      {isAdminPage && (
        <div className="fixed left-0 right-0 top-16 z-[9999] pointer-events-none">
          <div
            className="mx-auto flex justify-end px-4 pt-2"
            style={{
              width: "100%",
              maxWidth: "430px",
            }}
          >
            <button
              type="button"
              onClick={adminLogout}
              className="pointer-events-auto rounded-full bg-gray-900 px-4 py-2 text-xs font-extrabold text-white shadow-xl"
            >
              管理ログアウト
            </button>
          </div>
        </div>
      )}

      {open && (
        <>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/20"
            aria-label="メニューを閉じる"
          />

          <div className="fixed left-0 right-0 top-16 z-50">
            <div
              className="mx-auto px-4"
              style={{
                width: "100%",
                maxWidth: "430px",
              }}
            >
              <div className="overflow-hidden rounded-b-[28px] rounded-t-none bg-white shadow-2xl">
                <section
                  className="p-4 text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-soft) 100%)",
                  }}
                >
                  <div className="text-[11px] font-extrabold tracking-[0.18em] text-white/70">
                    MENU
                  </div>

                  <h2 className="mt-2 text-xl font-extrabold">
                    Kompariメニュー
                  </h2>

                  <p className="mt-1 text-xs font-semibold leading-5 text-white/70">
                    予測イベント、ランキング、通知、利用規約などを確認できます。
                  </p>
                </section>

                <div className="grid grid-cols-2 gap-2 p-3">
                  {menuItems.map((item) => {
                    const active = isActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`rounded-2xl p-3 ${
                          active ? "bg-brand-tint" : "bg-gray-50"
                        }`}
                      >
                        <div
                          className={`text-sm font-extrabold ${
                            active ? "text-brand" : "text-gray-900"
                          }`}
                        >
                          {item.label}
                        </div>

                        <div className="mt-1 text-[11px] font-bold text-gray-400">
                          {item.description}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
