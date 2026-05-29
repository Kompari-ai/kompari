import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function fallbackPrediction(aiName: string, raceTitle: string) {
  const patterns: Record<string, any> = {
    ChatGPT: {
      main: "イクイノックス",
      second: "ドウデュース",
      third: "サトノクラウン",
      confidence: "76",
      reason: `${raceTitle}では総合力と安定感を重視。近走内容とコース適性から本命評価。`,
      evidence: "総合指数上位 / 安定感 / 距離適性",
    },
    Claude: {
      main: "ドウデュース",
      second: "イクイノックス",
      third: "タイトルホルダー",
      confidence: "72",
      reason: `${raceTitle}は展開次第で差し脚が生きる可能性があり、末脚の持続力を評価。`,
      evidence: "末脚評価 / 展開利 / 差し脚",
    },
    Gemini: {
      main: "イクイノックス",
      second: "サトノクラウン",
      third: "ドウデュース",
      confidence: "69",
      reason: `${raceTitle}の傾向では安定した先行力と総合指数が重要。データ上は本命候補。`,
      evidence: "過去傾向 / 総合指数 / 先行力",
    },
    DeepSeek: {
      main: "イクイノックス",
      second: "ドウデュース",
      third: "ジオグリフ",
      confidence: "81",
      reason: `${raceTitle}では指数・調教・展開の総合評価で能力上位と判断。`,
      evidence: "能力指数 / 調教評価 / 不安材料少",
    },
  };

  return {
    ai: aiName,
    ...(patterns[aiName] || patterns.ChatGPT),
  };
}

export async function POST(request: Request) {
  const body = await request.json();

  const raceTitle = body.title || "レース";
  const venue = body.venue || "";
  const aiName = body.aiName || "ChatGPT";

  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(fallbackPrediction(aiName, raceTitle));
    }

    const prompt = `
あなたは競馬予測AIです。
以下のレースについて、${aiName}として予測してください。

レース名: ${raceTitle}
開催場所: ${venue}

JSONだけで返してください。
{
  "ai": "${aiName}",
  "main": "本命馬名",
  "second": "対抗馬名",
  "third": "穴馬名",
  "confidence": "72",
  "reason": "予測理由",
  "evidence": "データ根拠"
}
`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content || "{}";
    return Response.json(JSON.parse(text));
  } catch (error) {
    console.error("OpenAI API Error:", error);

    return Response.json(fallbackPrediction(aiName, raceTitle));
  }
}