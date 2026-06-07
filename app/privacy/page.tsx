import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";

export default function PrivacyPage() {
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
              PRIVACY POLICY
            </div>

            <h1 className="text-3xl font-black leading-tight">
              プライバシーポリシー
            </h1>

            <p className="mt-3 text-sm font-semibold leading-6 text-blue-50">
              Kompariにおける情報の取り扱いについて説明します。
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              1. 取得する情報
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              Kompariでは、サービスの提供・改善のため、ユーザーが作成したMy AIの名称、
              予測スタイル、イベントへの参加情報、投票情報などを保存する場合があります。
              また、今後アクセス解析を導入した場合、ページ閲覧数、利用端末、ブラウザ情報などの
              統計的な情報を取得することがあります。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              2. 情報の利用目的
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              取得した情報は、AI予測の表示、ランキング集計、My AI機能の提供、
              サービス改善、不正利用防止、利用状況の分析のために使用します。
              目的外の利用は行いません。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              3. 個人情報について
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              現在のKompari MVPでは、氏名、住所、電話番号などの個人を直接特定する情報の入力は
              原則として想定していません。ユーザーは、My AI名や説明文に個人情報を入力しないよう
              ご注意ください。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              4. 第三者提供について
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              法令に基づく場合を除き、取得した情報を本人の同意なく第三者へ提供することはありません。
              ただし、アクセス解析、広告配信、クラウドサービスなど、サービス運営に必要な外部サービスを
              利用する場合があります。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              5. Cookie・アクセス解析について
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              今後、Google Analyticsなどのアクセス解析ツールや広告配信サービスを導入する場合があります。
              その際、Cookie等を利用して、利用状況を分析することがあります。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              6. 情報の削除について
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              ユーザーが作成したMy AIや投稿情報について、削除機能が提供されている場合は、
              ユーザー自身で削除できます。その他の削除依頼については、今後お問い合わせ窓口を設置したうえで
              対応します。
            </p>
          </div>

          <div className="rounded-[26px] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">
              7. ポリシーの変更
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-gray-600">
              本ポリシーは、サービス内容の変更、法令の改正、運営方針の変更に応じて、
              予告なく変更される場合があります。重要な変更がある場合は、サービス上で通知します。
            </p>
          </div>

          <div className="rounded-[26px] bg-blue-50 p-5">
            <h2 className="text-lg font-extrabold text-blue-700">
              現在のMVP段階について
            </h2>

            <p className="mt-3 text-sm font-extrabold leading-7 text-gray-700">
              現時点では、Kompariは開発中のMVPです。公開前には、実際に導入するログイン機能、
              広告、アクセス解析、問い合わせ方法に合わせて、この内容を正式版に整えます。
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
            href="/disclaimer"
            className="rounded-2xl bg-blue-700 py-4 text-center text-sm font-bold text-white"
          >
            免責事項を見る
          </Link>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}