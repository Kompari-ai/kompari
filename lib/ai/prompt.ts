import type { PredictionInput } from "./types";

export function buildPredictionPrompt(input: PredictionInput): {
  system: string;
  user: string;
} {
  const { title, category, candidates, aiDisplayName } = input;
  const candidateList = candidates.join("、");

  const system = `あなたは${aiDisplayName}として予測します。ユーザーの質問に対してJSON形式のみで回答してください。前置き・後置き・Markdownのコードフェンスは一切不要です。`;

  const user = `以下のイベントについて、候補の中から予測を行ってください。

イベント名: ${title}
カテゴリ: ${category}
候補: ${candidateList}

必ず以下のJSON形式のみで回答してください（前置き・後置き・コードフェンス禁止）:
{"main":"本命候補名","second":"対抗候補名","third":"3番手候補名","confidence":"high|medium|low","reason":"なぜその候補を本命にしたか。ですます調で200〜300字程度。最初の1〜2文に結論を置く。候補同士の比較を踏まえた説明。","evidence":"参照した観点（直近成績・相性・コンディション等）をですます調で簡潔に。"}

重要:
- main / second / third は必ず上記の候補リストの中から選ぶこと（候補外の文字列は禁止）
- あくまで予測エンタメであり、確実性を断言しないトーンにする
- reason は 200〜300 字程度のですます調`;

  return { system, user };
}
