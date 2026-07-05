import type { DrawnCard, SpreadOption } from "@/data/tarot";

export type ArchetypeProfile = {
  profileName: string;
  summary: string;
  dominantArchetypes: string[];
  lightTraits: string[];
  shadowTraits: string[];
  currentPattern: string;
  growthEdge: string;
  ritualPrompt: string;
};

type InterpretationMode = "standard" | "shadow";

function pickTopEntries(values: Array<[string, number]>, count: number) {
  return values
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([value]) => value);
}

function getSpreadLens(spread: SpreadOption) {
  switch (spread.id) {
    case "single":
      return "把视线集中在最核心的一束心理光线";
    case "free-flow":
      return "不预设位置，只顺着牵引去看此刻最真实的回声";
    case "love":
      return "把情感流动、边界与回应方式慢慢照亮";
    case "career":
      return "把行动方式、阻力来源与投入方向重新摆到台前";
    case "decision":
      return "把取舍背后的真正动机、代价与偏好拉到眼前";
    default:
      return "让这一次抽牌先照见你当下的内在节奏";
  }
}

export function buildArchetypeProfile({
  cards,
  spread,
  interpretationMode,
}: {
  cards: DrawnCard[];
  spread: SpreadOption;
  interpretationMode: InterpretationMode;
}): ArchetypeProfile {
  const archetypeWeights = new Map<string, number>();
  const lightWeights = new Map<string, number>();
  const shadowWeights = new Map<string, number>();

  for (const card of cards) {
    const isUpright = card.orientation === "Upright";
    archetypeWeights.set(card.archetypeZh, (archetypeWeights.get(card.archetypeZh) ?? 0) + 1);

    for (const trait of card.lightZh.slice(0, 3)) {
      lightWeights.set(trait, (lightWeights.get(trait) ?? 0) + (isUpright ? 2 : 1));
    }

    for (const trait of card.shadowZh.slice(0, 3)) {
      shadowWeights.set(trait, (shadowWeights.get(trait) ?? 0) + (isUpright ? 1 : 2));
    }
  }

  const dominantArchetypes = pickTopEntries([...archetypeWeights.entries()], 2);
  const lightTraits = pickTopEntries([...lightWeights.entries()], 3);
  const shadowTraits = pickTopEntries([...shadowWeights.entries()], 3);
  const profileName =
    dominantArchetypes.length > 1
      ? `${dominantArchetypes[0]} · ${dominantArchetypes[1]}`
      : dominantArchetypes[0] ?? "当下原型";

  const spreadLens = getSpreadLens(spread);
  const profileTone =
    interpretationMode === "shadow"
      ? "这次画像更像一盏照进阴影里的灯，不急着安慰，而是先把那些不愿承认的牵引慢慢显出来。"
      : "这次画像更像一面温柔的镜子，它先替你勾出此刻最明显的心理纹理，再把下一步的方向轻轻放到手边。";

  const currentPattern =
    interpretationMode === "shadow"
      ? `你现在很可能正在一边依赖 ${lightTraits[0] ?? "熟悉感"}，一边又被 ${shadowTraits[0] ?? "回避"} 和 ${shadowTraits[1] ?? "迟疑"} 反复牵扯。${spreadLens}，会让这种“想靠近、又想退回去”的张力变得更明显。`
      : `你此刻最明显的节奏，落在 ${lightTraits[0] ?? "感受"}、${lightTraits[1] ?? "判断"} 与 ${lightTraits[2] ?? "行动"} 的协商里。${spreadLens}，所以真正重要的不是快，而是先让内在不同声音坐到同一张桌前。`;

  const growthEdge =
    interpretationMode === "shadow"
      ? `这一轮更值得留意的成长边缘，是别再急着把 ${shadowTraits[0] ?? "防御"} 合理化。你可以问问自己：当 ${dominantArchetypes[0] ?? "这股力量"} 被触碰时，我到底想守住什么，又在怕失去什么。`
      : `这一轮更值得培养的，不是更强的控制感，而是把 ${dominantArchetypes[0] ?? "当下的主导原型"} 用得更稳。也许你已经有方向了，只是还需要给它更清楚的边界与节奏。`;

  const ritualPrompt =
    interpretationMode === "shadow"
      ? "今晚留一小段安静时间，写下你最想立刻否认的一种感受，再问自己：如果不再躲它，它会告诉我什么？"
      : "给自己留十分钟，把今天最反复出现的一种感受记下来，再补一句：它真正想提醒我的，可能是什么？";

  const summary = `${profileTone} 这一次最突出的原型纹理，落在 ${profileName} 之间；它既带着 ${lightTraits.join("、")}，也伴随着 ${shadowTraits.join("、")} 的提醒。`;

  return {
    profileName,
    summary,
    dominantArchetypes,
    lightTraits,
    shadowTraits,
    currentPattern,
    growthEdge,
    ritualPrompt,
  };
}
