// scripts専用の Admin SDK 初期化 helper。
//
// このファイルは --write 分岐内でのみ dynamic import される前提(呼び出し側で保証する)。
// dry-run 経路では一切importされないため、firebase-admin がロードされることはない。
//
// 認証情報の扱い:
//   GOOGLE_APPLICATION_CREDENTIALS(サービスアカウントJSONの絶対パス)を第一候補とする。
//   このファイル自身はサービスアカウントJSONの中身を読まない・生成しない・commitしない。
//   実際の読み込みは firebase-admin の applicationDefault() が
//   環境変数経由でファイルパスを解決して行う。
//
// 未設定時:
//   GOOGLE_APPLICATION_CREDENTIALS が設定されていない場合は、
//   ここで明示的なエラーを投げて停止する(黙って未認証状態で進めない)。

import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// 本番Firestoreのproject id(docs/MIGRATION_STATUS.md に記録済みの kompari-48dba)。
// サービスアカウントJSON自体にも project_id が含まれるが、
// 意図しないprojectへの書き込みを防ぐため明示的に指定する。
const PROJECT_ID = "kompari-48dba";

// idempotentな初期化。二重初期化を防ぐため getApps().length を確認する。
export function getAdminFirestore(): Firestore {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS が設定されていません。" +
        "サービスアカウントJSONの絶対パスを環境変数に設定してから再実行してください。" +
        "(.env.local.example を参照。実際のJSONファイルはリポジトリにcommitしないこと)"
    );
  }

  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          credential: applicationDefault(),
          projectId: PROJECT_ID,
        });

  return getFirestore(app);
}
