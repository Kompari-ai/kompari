# Phase 2.5 バックフィル仕様書

## 目的
既存 races 全件を events/predictions にコピーし、Phase 3(読み取り切替)の前提を作る。
races は一切変更しない(読み取りのみ)。events 側のみ生成。

## 現在の状況(重要)
- backfill.mjs と package.json は作成済み(リポジトリ外: C:\Users\toriniku\Desktop\kompari-backfill\)
- 未実行・npm install未実施・serviceAccountKey.json なし・Firestore書き込みなし
- 次セッションで「スクリプトレビュー → 実装前チェック → dry-run → 本番実行 → 検証 → 鍵無効化」を完走する

## 実行形態
- ローカル Node.js + firebase-admin SDK
- 置き場所: C:\Users\toriniku\Desktop\kompari-backfill\(リポジトリ外)
  - backfill.mjs / package.json(firebase-admin) / serviceAccountKey.json(リポジトリに入れない)
- サービスアカウント鍵: Firebase Console → プロジェクト設定 → サービスアカウント → 秘密鍵生成
  - バックフィル完了後は鍵を無効化・削除
- API Route は使わない(10秒制限・クライアントSDK権限のため)

## 変換ルール

### events 本体(races 1件 → events/{同一ID})
- id/slug = races のドキュメントID(同一ID)
- category/title/candidates/venue/startsAt: そのままコピー
- result.winner: resultWinner(トップレベル)と result.winner を統合
  → result.winner 優先、無ければ resultWinner、両方無ければ result: null
- startsIn: 捨てる(KompariEventDoc に無い)
- createdAt: races の createdAt をコピー
- updatedAt: スクリプト実行時刻
- predictionCount: predictions 配列の件数

### predictions(races.predictions[] → events/{id}/predictions/{predId})
全予測共通で付与:
- eventId = 親イベントID
- predictionId = 採番(下記)
- outcome = result から算出: 確定済み(winner有)なら main===winner?"hit":"miss"、未確定なら"pending"
- predictedAt = races の createdAt
- updatedAt = スクリプト実行時刻

公式AI予測(source !== "user")の補正:
- isMock: undefined なら false、値があればコピー
- predictionSource: undefined なら "official-ai"、値があればコピー
- ai/main/second/third/confidence/reason/evidence/aiModel/aiModelId/aiProvider/
  usedFactors/factorKeys: そのままコピー(無いものは無いまま)

My AI予測(source === "user")の扱い:
- 素通しコピー。isMock/predictionSource/myAiId/aiModel/factorKeys を補正しない
- サブコレクション化に必須の eventId/predictionId/outcome/predictedAt/updatedAt のみ付与
- predictionSource の my-ai 上書きはしない(660d06b の判断を踏襲)
- 理由: My AI は現状すべて mock の仮実装。実機能(実APIパス)は候補Eで別途。
  バックフィルでは触らず素通し。

### predictionId 採番
- 基本: prediction.myAiId があればそれ、なければ prediction.ai
- サニタイズ: "/" を "_" に置換、空なら "unknown"
- 同一イベント内で衝突する場合: 最新1件を採用(上書き)。admin二重書き(Phase2b)と揃える。
  suffix での全件残しはしない。実データに重複が無ければ発火しない(実装前にConsole確認)

## 安全機構
- べき等性: events/{id} が既存ならスキップ(2回実行しても安全)
- dry-run: DRY_RUN モードで書き込まず「対象件数・変換サンプル3件・既存衝突件数」を出力
- バッチ: writeBatch 500操作上限を考慮し分割
- rollback: events を全削除(races無傷)。Console または firebase CLI で再帰削除

## 実装前チェックリスト(次セッション冒頭・Console目視 or 読み取り)
1. races の総件数(バッチ分割の要否)
2. 同一イベント内に同一公式AI名の重複予測がある race があるか(衝突分岐の発火有無)
3. startsIn を持つ旧ドキュメントの有無(廃止して問題ないか)
4. events の現在件数(0 or 数件。既存があればスキップ対象)

## 検証(本番実行後)
- races 件数と events 件数が一致(スキップ分を除く)
- events/{id}/predictions の総数が races.predictions の総数と一致
- サンプル数件で outcome が正しく算出(確定済みイベントで hit/miss)
- 既存画面が従来どおり(races主読みのまま、events は追加されただけ)

## 次セッションの手順
1. backfill.mjs をレビュー(中身が本仕様どおりか確認)
2. 実装前チェックリスト(Console目視)
3. serviceAccountKey.json を生成・配置(リポジトリに入れない)
4. npm install
5. dry-run 実行 → 出力確認(件数・衝突・outcome分布・サンプル3件)
6. 本番実行
7. 検証(上記)
8. 鍵を無効化・削除

## 移行ロードマップ上の位置
Phase0-2b✓ → Phase2.5(バックフィル・本仕様)← 次 → Phase3(読み取り切替) → Phase4(races廃止)
