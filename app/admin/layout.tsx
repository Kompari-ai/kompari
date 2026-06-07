"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      setLoggingIn(true);
      setErrorMessage("");
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
      setErrorMessage("Googleログインに失敗しました。");
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem("kompari-admin-unlocked");
  };

  const adminEmail = ADMIN_EMAIL.toLowerCase();
  const userEmail = user?.email?.toLowerCase() || "";
  const isAdmin = !!adminEmail && !!userEmail && adminEmail === userEmail;

  if (!loaded) {
    return (
      <main className="min-h-screen bg-[#f5f5f7] text-[#111827]">
        <div className="mx-auto flex min-h-screen max-w-[430px] items-center justify-center px-4">
          <div className="text-sm font-bold text-gray-400">読み込み中...</div>
        </div>
      </main>
    );
  }

  if (!ADMIN_EMAIL) {
    return (
      <main className="min-h-screen bg-[#f5f5f7] text-[#111827]">
        <div className="mx-auto flex min-h-screen max-w-[430px] items-center justify-center px-4">
          <section className="w-full rounded-[30px] bg-white p-5 shadow-sm">
            <h1 className="text-xl font-extrabold">管理者メール未設定</h1>

            <p className="mt-3 text-sm font-bold leading-6 text-gray-500">
              .env.local に NEXT_PUBLIC_ADMIN_EMAIL を追加してください。
            </p>

            <Link
              href="/"
              className="mt-5 block rounded-2xl bg-blue-700 py-4 text-center text-sm font-extrabold text-white"
            >
              トップへ戻る
            </Link>
          </section>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f5f5f7] text-[#111827]">
        <div className="mx-auto flex min-h-screen max-w-[430px] items-center justify-center px-4">
          <section className="w-full rounded-[30px] bg-white p-5 shadow-sm">
            <div
              className="rounded-[26px] p-5 text-white"
              style={{
                background:
                  "linear-gradient(135deg, #2563eb 0%, #1d4ed8 45%, #172554 100%)",
              }}
            >
              <div className="text-[11px] font-extrabold tracking-[0.18em] text-blue-100">
                ADMIN LOGIN
              </div>

              <h1 className="mt-3 text-3xl font-black">管理画面</h1>

              <p className="mt-3 text-sm font-semibold leading-6 text-blue-50">
                イベント作成・結果入力・編集にはGoogleログインが必要です。
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <button
                type="button"
                onClick={login}
                disabled={loggingIn}
                className="w-full rounded-2xl bg-blue-700 py-4 text-sm font-extrabold text-white disabled:bg-gray-300"
              >
                {loggingIn ? "ログイン中..." : "Googleでログイン"}
              </button>

              {errorMessage && (
                <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
                  {errorMessage}
                </div>
              )}

              <Link
                href="/"
                className="block rounded-2xl bg-gray-100 py-4 text-center text-sm font-bold text-gray-700"
              >
                トップへ戻る
              </Link>
            </div>

            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
              <div className="text-xs font-bold text-gray-400">
                許可されている管理者メール
              </div>

              <div className="mt-1 text-sm font-extrabold text-gray-700">
                {ADMIN_EMAIL}
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#f5f5f7] text-[#111827]">
        <div className="mx-auto flex min-h-screen max-w-[430px] items-center justify-center px-4">
          <section className="w-full rounded-[30px] bg-white p-5 text-center shadow-sm">
            <div className="text-4xl">🔒</div>

            <h1 className="mt-4 text-xl font-extrabold">
              管理者ではありません
            </h1>

            <p className="mt-3 text-sm font-bold leading-6 text-gray-500">
              現在ログイン中のメールアドレスでは、管理画面を利用できません。
            </p>

            <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-left">
              <div className="text-xs font-bold text-gray-400">
                ログイン中
              </div>

              <div className="mt-1 text-sm font-extrabold text-gray-700">
                {user.email}
              </div>

              <div className="mt-3 text-xs font-bold text-gray-400">
                管理者
              </div>

              <div className="mt-1 text-sm font-extrabold text-gray-700">
                {ADMIN_EMAIL}
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="mt-5 w-full rounded-2xl bg-gray-900 py-4 text-sm font-extrabold text-white"
            >
              ログアウト
            </button>

            <Link
              href="/"
              className="mt-3 block rounded-2xl bg-gray-100 py-4 text-sm font-bold text-gray-700"
            >
              トップへ戻る
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}