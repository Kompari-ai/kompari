import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";

export default function TermsPage() {
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
              TERMS OF SERVICE
            </div>

            <h1 className="text-3xl font-black leading-tight">利用規約</h1>

            <p className="mt-3 text-sm font-semibold leading-6 text-blue-50">
              Kompariをご利用いただく際の基本的なルールです。
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              1. サービスの目的
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              Kompariは、複数のAIやユーザー作成AIによる予測を比較し、
              的中率、人気、予測傾向を可視化するサービスです。
              本サービスは、情報提供・比較・娯楽・検証を目的としています。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              2. 利用者の責任
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              利用者は、本サービス上の情報を自己の判断と責任において利用するものとします。
              AI予測、ランキング、投票結果、その他の表示内容は、結果や利益を保証するものではありません。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              3. 禁止事項
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              利用者は、法令に違反する行為、第三者の権利を侵害する行為、
              サービス運営を妨害する行為、不正アクセス、虚偽情報の投稿、
              他者を誹謗中傷する行為を行ってはなりません。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              4. My AI機能について
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              利用者は、My AIの名称、説明、予測スタイルなどを自由に作成できます。
              ただし、個人情報、第三者を傷つける内容、違法または不適切な内容を登録してはなりません。
              運営者は、不適切と判断した内容を削除できるものとします。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              5. 投資・賭け・購入判断について
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              株式、暗号資産、為替、競馬、スポーツなどに関する予測は、
              投資助言、賭けの推奨、購入推奨、利益保証を目的としたものではありません。
              実際の金銭を伴う判断は、利用者自身の責任で行ってください。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              6. サービス内容の変更・停止
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              運営者は、必要に応じて、本サービスの内容を変更、追加、停止、終了できるものとします。
              これにより利用者に損害が発生した場合でも、運営者は責任を負わないものとします。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              7. 免責
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              本サービス上の情報について、正確性、完全性、有用性、将来の結果を保証するものではありません。
              利用者が本サービスを利用したこと、または利用できなかったことにより生じた損害について、
              運営者は責任を負いません。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              8. 規約の変更
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              本規約は、サービス内容の変更や法令改正に応じて、予告なく変更される場合があります。
              変更後も本サービスを利用した場合、変更後の規約に同意したものとみなします。
            </p>
          </div>

          <div className="rounded-[26px] bg-blue-50 p-5">
            <h2 className="text-lg font-extrabold text-blue-700">
              MVP段階での位置づけ
            </h2>

            <p className="mt-3 text-sm font-extrabold leading-7 text-gray-700">
              現在のKompariは開発中のMVPです。
              一般公開前には、ログイン機能、広告、問い合わせ先、運営者情報に合わせて、
              本規約を正式版に整えます。
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
            href="/privacy"
            className="rounded-2xl bg-blue-700 py-4 text-center text-sm font-bold text-white"
          >
            プライバシー
          </Link>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}