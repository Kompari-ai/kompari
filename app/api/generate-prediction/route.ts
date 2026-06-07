import { NextResponse } from "next/server";

export const runtime = "nodejs";

const aiStyles: Record<string, string> = {
  ChatGPT: "総合的にバランスよく判断",
  Claude: "慎重に展開や文脈を重視",
  Gemini: "データや比較材料を広く確認",
  DeepSeek: "人気に寄りすぎず逆張り要素も考慮",
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

  return ["1番人気馬", "先行馬", "差し馬"];
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

function rotate<T>(items: T[], aiName: string) {
  if (items.length === 0) return items;

  const offset =
    aiName === "ChatGPT"
      ? 0
      : aiName === "Claude"
      ? 1
      : aiName === "Gemini"
      ? 2
      : 3;

  const safeOffset = offset % items.length;

  return [...items.slice(safeOffset), ...items.slice(0, safeOffset)];
}

function pickTopThree(candidates: string[], aiName: string) {
  const rotated = rotate(candidates, aiName);

  const main = rotated[0] || candidates[0] || "未定";
  const second = rotated[1] || rotated[0] || candidates[0] || "未定";
  const third = rotated[2] || rotated[1] || rotated[0] || candidates[0] || "未定";

  return {
    main,
    second,
    third,
  };
}

function categoryReason(
  category: string,
  aiName: string,
  title: string,
  main: string,
  candidates: string[]
) {
  const style = aiStyles[aiName] || aiStyles.ChatGPT;
  const candidateText = candidates.slice(0, 6).join("、");

  if (category === "nba") {
    return `${aiName}は、候補（${candidateText}）の中から、直近成績、主力選手の状態、試合展開を踏まえ、${style}して「${main}」を本命にしました。${title}では終盤の得点力と守備の安定感が重要になると見ています。`;
  }

  if (category === "soccer") {
    return `${aiName}は、候補（${candidateText}）の中から、戦術相性、直近の得点力、守備の安定感を踏まえ、${style}して「${main}」を本命にしました。${title}では先制点の有無が大きな分岐点になると見ています。`;
  }

  if (category === "mlb") {
    return `${aiName}は、候補（${candidateText}）の中から、先発投手、打線の状態、ブルペンの安定感を踏まえ、${style}して「${main}」を本命にしました。${title}では序盤の失点を抑えられるかが重要です。`;
  }

  if (category === "crypto") {
    return `${aiName}は、候補（${candidateText}）の中から、需給、金利環境、ETF資金流入、投資家心理を踏まえ、${style}して「${main}」を本命にしました。${title}では短期材料よりも中期的な資金の流れを重視しています。`;
  }

  if (category === "stocks") {
    return `${aiName}は、候補（${candidateText}）の中から、業績、金利、バリュエーション、テーマ性を踏まえ、${style}して「${main}」を本命にしました。${title}では成長期待と利益率の持続性が焦点になります。`;
  }

  if (category === "election") {
    return `${aiName}は、候補（${candidateText}）の中から、支持率、地域差、争点、投票率を踏まえ、${style}して「${main}」を本命にしました。${title}では無党派層の動きが結果を左右すると見ています。`;
  }

  if (category === "esports") {
    return `${aiName}は、候補（${candidateText}）の中から、チーム相性、直近成績、マップ適性、個人技を踏まえ、${style}して「${main}」を本命にしました。${title}では序盤の主導権が重要です。`;
  }

  return `${aiName}は、候補（${candidateText}）の中から、近走成績、展開、馬場、騎手、人気を踏まえ、${style}して「${main}」を本命にしました。${title}ではペースと位置取りが結果を左右すると見ています。`;
}

function categoryEvidence(category: string) {
  if (category === "nba") {
    return "主力選手の出場状況、直近5試合の得点効率、リバウンド差を重視しています。";
  }

  if (category === "soccer") {
    return "直近の得点期待値、失点傾向、ホーム・アウェイ成績を重視しています。";
  }

  if (category === "mlb") {
    return "先発投手の安定感、打線の長打力、救援陣の消耗度を重視しています。";
  }

  if (category === "crypto") {
    return "資金流入、マクロ環境、ボラティリティ、ニュース材料を重視しています。";
  }

  if (category === "stocks") {
    return "決算内容、金利環境、需給、セクター全体の流れを重視しています。";
  }

  if (category === "election") {
    return "世論調査、地域別支持、投票率、直近の報道材料を重視しています。";
  }

  if (category === "esports") {
    return "直近成績、マップ勝率、選手コンディション、対戦相性を重視しています。";
  }

  return "過去成績、脚質、馬場適性、展開予想を重視しています。";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const title = body.title || "";
    const category = body.category || "horse_racing";
    const aiName = body.aiName || "ChatGPT";
    const candidates = normalizeCandidates(body.candidates, category);

    if (!title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    const topThree = pickTopThree(candidates, aiName);

    const confidence =
      aiName === "ChatGPT"
        ? "72"
        : aiName === "Claude"
        ? "68"
        : aiName === "Gemini"
        ? "70"
        : "64";

    return NextResponse.json({
      ai: aiName,
      main: topThree.main,
      second: topThree.second,
      third: topThree.third,
      confidence,
      reason: categoryReason(
        category,
        aiName,
        title,
        topThree.main,
        candidates
      ),
      evidence: categoryEvidence(category),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to generate prediction" },
      { status: 500 }
    );
  }
}