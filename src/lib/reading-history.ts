import { createLocalCollection } from "@/lib/oracle-storage";

export type 保存的牌面 = {
  id: string;
  name: string;
  nameZh: string;
  orientation: "Upright" | "Reversed";
  archetypeZh: string;
};

export type 阅读记录 = {
  id: string;
  createdAt: string;
  question: string;
  spreadId: string;
  spreadName: string;
  interpretationMode: "standard" | "shadow";
  cards: 保存的牌面[];
  readingText: string;
  profileName: string;
  energyHeadline: string;
  reflectionQuestion: string;
};

const 阅读记录键 = "oracle-reading-history-v1";
const 阅读记录集合 = createLocalCollection<阅读记录>(阅读记录键);

export function 读取阅读记录(): 阅读记录[] {
  return 阅读记录集合.load();
}

export function 保存阅读记录(entries: 阅读记录[]) {
  阅读记录集合.save(entries);
}

function 摘取首段(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !["整体能量", "牌面象征解读", "荣格式映照", "隐藏模式", "实际建议", "反思问题"].includes(line));

  return lines[0] ?? "这次阅读还没有留下第一句回声。";
}

function 摘取反思问题(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sectionIndex = lines.findIndex((line) => line === "反思问题");
  if (sectionIndex === -1) return "如果把这次牌面留在心里一晚，明天最想继续回答的会是什么？";
  return lines.slice(sectionIndex + 1).find(Boolean) ?? "如果把这次牌面留在心里一晚，明天最想继续回答的会是什么？";
}

export function 创建阅读记录(input: Omit<阅读记录, "id" | "createdAt" | "energyHeadline" | "reflectionQuestion">): 阅读记录 {
  return {
    ...input,
    id: `reading-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    energyHeadline: 摘取首段(input.readingText),
    reflectionQuestion: 摘取反思问题(input.readingText),
  };
}
