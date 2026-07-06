import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";

export default function DisclaimerPage() {
  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#111827]">
      <TopBar />

      <div className="mx-auto max-w-[430px] px-4 pb-28 pt-4">
        <section className="mb-5 overflow-hidden rounded-[32px] bg-white shadow-sm">
          <div
            className="p-5 text-white"
            style={{
              background:
                "linear-gradient(135deg, #2563eb 0%, #1d4ed8 45%, #172554 100%)",
            }}
          >
            <div className="mb-4 inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold tracking-[0.18em] text-white">
              DISCLAIMER
            </div>

            <h1 className="text-3xl font-black leading-tight">
              免責事項
            </h1>

            <p className="mt-3 text-sm font-semibold leading-6 text-blue-50">
              Kompariをご利用いただく前に、予測情報の扱いについてご確認ください。
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              1. Kompariの予測について
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              Kompariは、複数のAIによる予測を比較し、結果や人気を可視化するサービスです。
              表示されるAI予測は、情報提供・比較・娯楽を目的としたものであり、
              結果の正確性、完全性、将来の的中を保証するものではありません。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              2. 投資・金融情報について
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              株価、為替、暗号資産などに関する予測は、投資助言、金融商品取引法上の助言、
              売買推奨、利益保証を目的としたものではありません。
              投資判断は、利用者ご自身の責任で行ってください。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              3. 競馬・スポーツ予測について
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              競馬、スポーツ、eスポーツなどの予測は、勝敗や結果を保証するものではありません。
              馬券購入、賭け、その他金銭を伴う判断は、各利用者の責任において行ってください。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              4. AI予測の限界について
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              AIは、入力された情報や過去の傾向などをもとに予測を生成しますが、
              最新情報、突発的な出来事、非公開情報、人的判断などを完全に反映できるとは限りません。
              AIの回答には誤りや偏りが含まれる可能性があります。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              5. 損害について
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              Kompari上の情報を利用したこと、または利用できなかったことにより発生した損害について、
              運営者は責任を負いません。利用者は、自己の判断と責任において本サービスを利用するものとします。
            </p>
          </div>

          <div className="rounded-[26px] bg-blue-50 p-5">
            <h2 className="text-lg font-extrabold text-blue-700">
              要するに
            </h2>

            <p className="mt-3 text-sm font-extrabold leading-7 text-gray-700">
              Kompariは「AI予測を比較して楽しむ・検証する」ためのサービスです。
              実際のお金を使う判断は、必ずご自身の責任で行ってください。
            </p>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3">
          <Link
            href="/"
            className="rounded-2xl bg-white py-4 text-center text-sm font-bold text-gray-700 shadow-sm"
          >
            トップへ戻る
          </Link>

          <Link
            href="/events"
            className="rounded-2xl bg-blue-700 py-4 text-center text-sm font-bold text-white"
          >
            予測を見る
          </Link>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}