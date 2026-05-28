export const event = {
  title: "日本ダービー(G1)",
  venue: "東京競馬場・芝2400m",
  startsIn: "45分",
  raceMeta: "東京11R / 15:40発走 / 晴 / 良馬場",
  consensus: "イクイノックス支持 3 / 4 AI",

  entries: [
    { number: 1, name: "ジオグリフ", odds: "15.0" },
    { number: 3, name: "イクイノックス", odds: "2.1" },
    { number: 5, name: "サトノクラウン", odds: "6.8" },
    { number: 8, name: "ドウデュース", odds: "3.4" },
    { number: 12, name: "タイトルホルダー", odds: "9.2" },
  ],

  support: [
    { name: "イクイノックス", count: 3 },
    { name: "ドウデュース", count: 3 },
    { name: "サトノクラウン", count: 2 },
    { name: "タイトルホルダー", count: 1 },
    { name: "ジオグリフ", count: 1 },
  ],

  predictions: [
    {
      ai: "ChatGPT",
      logo: "/logos/chatgpt.svg",
      record: "G1予想 6戦4的中",
      confidence: 78,
      main: "イクイノックス",
      second: "ドウデュース",
      third: "サトノクラウン",
      reason:
        "東京2400mでは瞬発力と位置取りが重要。イクイノックスは前走内容・調教・血統すべてが高水準で、最も安定した評価です。",
      evidence: "上がり3F指数1位 / 調教評価S / 東京適性◎",
    },
    {
      ai: "Claude",
      logo: "/logos/claude.png",
      record: "G1予想 6戦3的中",
      confidence: 72,
      main: "ドウデュース",
      second: "イクイノックス",
      third: "タイトルホルダー",
      reason:
        "展開が速くなれば、末脚の持続力があるドウデュースに向く可能性があります。人気とのバランスも悪くありません。",
      evidence: "東京実績◎ / 末脚指数A / 人気との乖離あり",
    },
    {
      ai: "Gemini",
      logo: "/logos/gemini.png",
      record: "G1予想 5戦3的中",
      confidence: 69,
      main: "イクイノックス",
      second: "サトノクラウン",
      third: "ドウデュース",
      reason:
        "過去データでは東京2400mは総合力型が強く、イクイノックスの安定感を最上位に評価しました。",
      evidence: "距離適性◎ / 安定指数1位 / 直近成績A",
    },
    {
      ai: "DeepSeek",
      logo: "/logos/deepseek.png",
      record: "G1予想 5連続的中中",
      confidence: 81,
      main: "イクイノックス",
      second: "ドウデュース",
      third: "ジオグリフ",
      reason:
        "人気馬ながら能力の抜け方が大きく、逆らう理由が少ないと判断。相手には東京実績のある馬を重視します。",
      evidence: "総合指数1位 / 調教評価S / 不安材料少",
    },
  ],
};