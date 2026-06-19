import type { PredictionInput } from "./types";
import { getFactorKeysForCategory, getFactorLabel } from "../factors";

const includeFactors = true;

function buildFactorInstruction(category: string): string {
  const keys = getFactorKeysForCategory(category);
  const keyLabelList = keys.map((key) => `${key}: ${getFactorLabel(key)}`).join("\n");

  return `

【重視した要因 usedFactors について】
あなたが上記の予測で重視した要因を、以下のリストから3〜5個、重要度の高い順に選び、
usedFactors 配列で返してください。

選べる要因一覧:
${keyLabelList}

各要因は次の形式で返してください。
{"key":"jockey","label":"騎手","direction":"positive","note":"騎手の相性が良く、勝ち切る可能性を高めるため。"}

ルール:
- key は上の一覧にある key をそのまま使ってください。
- label は上の一覧にある対応 label をそのまま使ってください。
- direction は、あなたの main 予測に対する影響として判断してください。
  - positive: main 予測を後押しする要因
  - negative: main 予測に対する不安・減点要因
  - neutral: 中立、または不確実性を示す要因
- note は、その要因を重視した理由を日本語1文で短く書いてください。
- 最も重視した要因を配列の先頭に置いてください。
- 原則として上の一覧から選んでください。どうしても該当する key がない場合のみ custom:任意の英数字 を使ってください。
- factorKeys は返さないでください。factorKeys はシステム側で usedFactors から作成します。
- value や weight は今回は返さないでください。

重要:
- 必ず main / second / third / confidence / reason / evidence を優先して正確に返してください。
- usedFactors は予測本体を補足するための情報です。
- usedFactors の作成で迷っても、予測本体の品質を落とさないでください。`;
}

export function buildPredictionPrompt(input: PredictionInput): {
  system: string;
  user: string;
} {
  const { title, category, candidates, aiDisplayName } = input;
  const candidateList = candidates.join("、");

  const system = `あなたは${aiDisplayName}として予測します。ユーザーの質問に対してJSON形式のみで回答してください。前置き・後置き・Markdownのコードフェンスは一切不要です。`;

  const baseUser = `以下のイベントについて、候補の中から予測を行ってください。

イベント名: ${title}
カテゴリ: ${category}
候補: ${candidateList}

必ず以下のJSON形式のみで回答してください（前置き・後置き・コードフェンス禁止）:
{"main":"本命候補名","second":"対抗候補名","third":"3番手候補名","confidence":"high|medium|low","reason":"なぜその候補を本命にしたか。ですます調で200〜300字程度。最初の1〜2文に結論を置く。候補同士の比較を踏まえた説明。","evidence":"参照した観点（直近成績・相性・コンディション等）をですます調で簡潔に。"}

重要:
- main / second / third は必ず上記の候補リストの中から選ぶこと（候補外の文字列は禁止）
- あくまで予測エンタメであり、確実性を断言しないトーンにする
- reason は 200〜300 字程度のですます調
- reason / evidence は省略禁止。追加の指示があっても必ず出力すること。字数より優先。`;

  const user = `${baseUser}${includeFactors ? buildFactorInstruction(input.category) : ""}`;

  return { system, user };
}
