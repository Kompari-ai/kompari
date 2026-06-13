import { NextResponse } from "next/server";
import { getAiConfigByDisplayName, resolveModelId } from "@/lib/ai/ai-config";
import type { PredictionInput } from "@/lib/ai/types";
import { callOpenAiCompatible } from "@/lib/ai/providers/openai-compatible";
import { callGemini } from "@/lib/ai/providers/gemini";
import { callAnthropic } from "@/lib/ai/providers/anthropic";

export const runtime = "nodejs";

type PredictionRequest = {
  title?: string;
  category?: string;
  aiName?: string;
  candidates?: unknown;
  aiStyle?: string;
  aiDescription?: string;
  strengthCategory?: string;
};

const officialAiStyles: Record<string, string> = {
  ChatGPT: "総合的にバランスよく判断する",
  Claude: "慎重に展開やリスクを読む",
  Gemini: "データや比較材料を広く確認する",
  DeepSeek: "人気に寄りすぎず、意外性も見る",
};

function getDefaultCandidates(category: string) {
  if (category === "nba") {
    return ["ホームチーム勝利", "アウェイチーム勝利", "接戦で延長戦"];
  }

  if (category === "soccer") {
    return ["ホームチーム勝利", "アウェイチーム勝利", "引き分け"];
  }

  if (category === "mlb") {
    return ["ホームチーム勝利", "アウェイチーム勝利", "ロースコア決着"];
  }

  if (category === "crypto") {
    return ["上昇シナリオ", "横ばいシナリオ", "下落シナリオ"];
  }

  if (category === "stocks") {
    return ["上昇", "横ばい", "下落"];
  }

  if (category === "election") {
    return ["候補A優勢", "候補B優勢", "接戦"];
  }

  if (category === "esports") {
    return ["チームA勝利", "チームB勝利", "フルセット決着"];
  }

  return ["1番人気候補", "先行候補", "差し候補"];
}

function normalizeCandidates(input: unknown, category: string) {
  if (Array.isArray(input)) {
    const list = input
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);

    if (list.length >= 2) {
      return list;
    }
  }

  return getDefaultCandidates(category);
}

function hashText(value: string) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

function getOfficialOffset(aiName: string) {
  if (aiName === "ChatGPT") return 0;
  if (aiName === "Claude") return 1;
  if (aiName === "Gemini") return 2;
  if (aiName === "DeepSeek") return 3;

  return null;
}

function getStyleOffset(style: string, candidatesLength: number) {
  if (candidatesLength === 0) return 0;

  if (
    style.includes("堅実") ||
    style.includes("本命") ||
    style.includes("安全")
  ) {
    return 0;
  }

  if (
    style.includes("穴") ||
    style.includes("逆張り") ||
    style.includes("意外")
  ) {
    return Math.min(1, candidatesLength - 1);
  }

  if (
    style.includes("データ") ||
    style.includes("分析") ||
    style.includes("理論")
  ) {
    return Math.min(2, candidatesLength - 1);
  }

  return 0;
}

function rotate<T>(items: T[], offset: number) {
  if (items.length === 0) return items;

  const safeOffset = offset % items.length;

  return [...items.slice(safeOffset), ...items.slice(0, safeOffset)];
}

function pickTopThree({
  candidates,
  aiName,
  title,
  category,
  aiStyle,
  aiDescription,
}: {
  candidates: string[];
  aiName: string;
  title: string;
  category: string;
  aiStyle: string;
  aiDescription: string;
}) {
  const officialOffset = getOfficialOffset(aiName);

  const offset =
    officialOffset !== null
      ? officialOffset
      : getStyleOffset(aiStyle, candidates.length) +
        (hashText(`${aiName}-${title}-${category}-${aiDescription}`) %
          candidates.length);

  const rotated = rotate(candidates, offset);

  return {
    main: rotated[0] || candidates[0] || "未定",
    second: rotated[1] || rotated[0] || candidates[0] || "未定",
    third: rotated[2] || rotated[1] || rotated[0] || candidates[0] || "未定",
  };
}

function getConfidence(aiName: string, aiStyle: string, aiDescription: string) {
  if (aiName === "ChatGPT") return "72";
  if (aiName === "Claude") return "68";
  if (aiName === "Gemini") return "70";
  if (aiName === "DeepSeek") return "64";

  const seed = hashText(`${aiName}-${aiStyle}-${aiDescription}`);
  return String(61 + (seed % 18));
}

function getCategoryFocus(category: string) {
  if (category === "nba") {
    return "直近成績、主力選手の状態、ホーム・アウェイの差を重視しました。";
  }

  if (category === "soccer") {
    return "直近の得点力、失点傾向、試合展開の安定感を重視しました。";
  }

  if (category === "mlb") {
    return "先発投手、打線の状態、ブルペンの安定感を重視しました。";
  }

  if (category === "crypto") {
    return "価格の流れ、材料の強さ、市場心理を重視しました。";
  }

  if (category === "stocks") {
    return "業績期待、金利環境、セクター全体の流れを重視しました。";
  }

  if (category === "election") {
    return "支持率、地域差、直近の報道材料を重視しました。";
  }

  if (category === "esports") {
    return "直近成績、チーム相性、選手コンディションを重視しました。";
  }

  return "過去傾向、展開、候補同士の比較を重視しました。";
}

function buildReason({
  category,
  aiName,
  title,
  main,
  candidates,
  aiStyle,
  aiDescription,
  strengthCategory,
}: {
  category: string;
  aiName: string;
  title: string;
  main: string;
  candidates: string[];
  aiStyle: string;
  aiDescription: string;
  strengthCategory: string;
}) {
  const candidateText = candidates.slice(0, 6).join("、");
  const focus = getCategoryFocus(category);
  const isStrongCategory = strengthCategory === category;

  return `${aiName}は「${candidateText}」の中から「${main}」を本命にしました。${focus}予測スタイルは「${aiStyle}」です。${
    aiDescription ? `このAIの特徴は「${aiDescription}」です。` : ""
  }${
    isStrongCategory
      ? "このカテゴリはこのAIの得意カテゴリでもあるため、判断材料をやや強めに評価しています。"
      : ""
  }対象イベント「${title}」では、最も勝ち筋が見えやすい候補として本命にしています。`;
}

function buildEvidence({
  category,
  candidates,
  aiStyle,
}: {
  category: string;
  candidates: string[];
  aiStyle: string;
}) {
  const candidateText = candidates.slice(0, 6).join("、");

  return `カテゴリ「${category}」の特性、候補「${candidateText}」の比較、AIの予測スタイル「${aiStyle}」をもとにした予測です。`;
}

// 実API呼び出し。キー未設定またはエラー時は null を返してモックに委ねる。
async function callRealApi(
  aiName: string,
  input: PredictionInput
): Promise<{
  main: string;
  second?: string;
  third?: string;
  confidence?: string;
  reason?: string;
  evidence?: string;
  aiProvider: string;
  aiModel: string;
  aiModelId: string;
} | null> {
  const config = getAiConfigByDisplayName(aiName);
  if (!config) return null;

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey || apiKey.trim() === "") return null;

  try {
    let result;

    if (config.providerKind === "openai-compatible") {
      result = await callOpenAiCompatible(config, input);
    } else if (config.providerKind === "gemini") {
      result = await callGemini(config, input);
    } else if (config.providerKind === "anthropic") {
      result = await callAnthropic(config, input);
    } else {
      return null;
    }

    return {
      ...result,
      aiProvider: config.provider,
      aiModel: config.model,
      aiModelId: resolveModelId(config),
    };
  } catch (err) {
    console.error(`[${aiName}] real API failed, falling back to mock:`, err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PredictionRequest;

    const title = String(body.title || "").trim();
    const category = String(body.category || "horse_racing").trim();
    const aiName = String(body.aiName || "ChatGPT").trim();
    const candidates = normalizeCandidates(body.candidates, category);

    const aiStyle =
      String(body.aiStyle || "").trim() ||
      officialAiStyles[aiName] ||
      "バランス型";

    const aiDescription = String(body.aiDescription || "").trim();
    const strengthCategory = String(body.strengthCategory || "").trim();

    if (!title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    // 実API呼び出しを試みる（公式AIのみ。キー未設定時はモックにフォールバック）
    const realResult = await callRealApi(aiName, {
      title,
      category,
      candidates,
      aiDisplayName: aiName,
    });

    if (realResult) {
      return NextResponse.json({ ai: aiName, ...realResult });
    }

    // モック（フォールバック）
    const topThree = pickTopThree({
      candidates,
      aiName,
      title,
      category,
      aiStyle,
      aiDescription,
    });

    const confidence = getConfidence(aiName, aiStyle, aiDescription);

    return NextResponse.json({
      ai: aiName,
      main: topThree.main,
      second: topThree.second,
      third: topThree.third,
      confidence,
      reason: buildReason({
        category,
        aiName,
        title,
        main: topThree.main,
        candidates,
        aiStyle,
        aiDescription,
        strengthCategory,
      }),
      evidence: buildEvidence({
        category,
        candidates,
        aiStyle,
      }),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to generate prediction" },
      { status: 500 }
    );
  }
}
