export type SpreadOption = {
  id: string;
  name: string;
  nameZh: string;
  cards: number;
  subtitle: string;
  promptFocus: string;
};

export type TarotCard = {
  id: string;
  name: string;
  nameZh: string;
  arcana: "Major" | "Minor";
  suit?: "Wands" | "Cups" | "Swords" | "Pentacles";
  rank?: string;
  archetype: string;
  archetypeZh: string;
  light: string[];
  shadow: string[];
  lightZh: string[];
  shadowZh: string[];
};

const majorArcanaSeeds = [
  ["the-fool", "The Fool", "愚者", "Beginnings", "新的起点", ["innocence", "leap of faith"], ["天真", "信任跃迁"], ["naivety", "avoidance"], ["轻率", "逃避"]],
  ["the-magician", "The Magician", "魔术师", "Manifestation", "意志显化", ["agency", "skill"], ["主动性", "掌控力"], ["manipulation", "scattered will"], ["操控", "意志分散"]],
  ["the-high-priestess", "The High Priestess", "女祭司", "Inner knowing", "内在直觉", ["intuition", "stillness"], ["直觉", "静观"], ["secrecy", "withheld truth"], ["隐匿", "不肯面对真相"]],
  ["the-empress", "The Empress", "皇后", "Nourishment", "丰盛滋养", ["abundance", "creativity"], ["丰盛", "创造力"], ["overgiving", "complacency"], ["过度付出", "沉溺舒适"]],
  ["the-emperor", "The Emperor", "皇帝", "Structure", "秩序结构", ["stability", "authority"], ["稳定", "掌控"], ["rigidity", "control"], ["僵硬", "控制欲"]],
  ["the-hierophant", "The Hierophant", "教皇", "Tradition", "传统秩序", ["wisdom", "ritual"], ["传承", "仪式感"], ["dogma", "conformity"], ["教条", "盲从"]],
  ["the-lovers", "The Lovers", "恋人", "Union", "联结与抉择", ["alignment", "choice"], ["契合", "选择"], ["misalignment", "projection"], ["失衡", "投射"]],
  ["the-chariot", "The Chariot", "战车", "Direction", "意志前行", ["discipline", "drive"], ["自律", "推进"], ["force", "conflicted momentum"], ["强推", "内在拉扯"]],
  ["strength", "Strength", "力量", "Gentle courage", "温柔的勇气", ["compassion", "resilience"], ["柔韧", "耐心"], ["self-doubt", "suppressed feeling"], ["自我怀疑", "压抑情绪"]],
  ["the-hermit", "The Hermit", "隐士", "Withdrawal", "向内探索", ["reflection", "guidance"], ["反思", "内在指引"], ["isolation", "avoidance"], ["封闭", "逃避关系"]],
  ["wheel-of-fortune", "Wheel of Fortune", "命运之轮", "Cycles", "周期流转", ["timing", "turning point"], ["时机", "转折"], ["instability", "resistance"], ["起伏", "抗拒变化"]],
  ["justice", "Justice", "正义", "Truth", "平衡与真相", ["clarity", "fairness"], ["清晰", "公正"], ["imbalance", "evasiveness"], ["失衡", "闪躲责任"]],
  ["the-hanged-man", "The Hanged Man", "倒吊人", "Perspective", "换位看见", ["surrender", "insight"], ["放下执念", "新视角"], ["stagnation", "martyrdom"], ["停滞", "自我牺牲"]],
  ["death", "Death", "死神", "Transformation", "结束与蜕变", ["release", "renewal"], ["放下", "重生"], ["clinging", "fear of endings"], ["抓住不放", "害怕结束"]],
  ["temperance", "Temperance", "节制", "Harmony", "调和整合", ["integration", "patience"], ["整合", "耐心"], ["excess", "fragmentation"], ["失控", "分裂感"]],
  ["the-devil", "The Devil", "恶魔", "Attachment", "欲望束缚", ["desire", "raw honesty"], ["真实欲望", "直面阴影"], ["entrapment", "compulsion"], ["上瘾", "被困住"]],
  ["the-tower", "The Tower", "高塔", "Disruption", "骤变震荡", ["liberation", "truth shock"], ["破局", "真相来袭"], ["collapse", "defensiveness"], ["崩塌", "防御心"]],
  ["the-star", "The Star", "星星", "Hope", "疗愈与希望", ["healing", "faith"], ["疗愈", "信任"], ["disillusionment", "distance"], ["失望", "疏离"]],
  ["the-moon", "The Moon", "月亮", "Mystery", "潜意识与迷雾", ["dreams", "sensitivity"], ["梦感", "敏锐"], ["confusion", "anxiety"], ["迷茫", "焦虑"]],
  ["the-sun", "The Sun", "太阳", "Vitality", "明朗生命力", ["joy", "confidence"], ["喜悦", "自信"], ["burnout", "overexposure"], ["透支", "锋芒过盛"]],
  ["judgement", "Judgement", "审判", "Awakening", "觉醒召唤", ["reckoning", "forgiveness"], ["醒悟", "宽恕"], ["self-criticism", "avoidance"], ["自责", "不愿回应召唤"]],
  ["the-world", "The World", "世界", "Completion", "圆满完成", ["wholeness", "arrival"], ["完成", "整合"], ["unfinished cycle", "hesitation"], ["未完成循环", "迟疑不前"]],
] as const;

const majorArcana: TarotCard[] = majorArcanaSeeds.map(
  ([id, name, nameZh, archetype, archetypeZh, light, lightZh, shadow, shadowZh]) => ({
    id,
    name,
    nameZh,
    arcana: "Major" as const,
    archetype,
    archetypeZh,
    light: [...light],
    shadow: [...shadow],
    lightZh: [...lightZh],
    shadowZh: [...shadowZh],
  }),
);

const suitTemplates = {
  Wands: {
    archetype: "Drive",
    archetypeZh: "行动与热情",
    light: ["spark", "courage"],
    lightZh: ["火花", "勇气"],
    shadow: ["impatience", "volatility"],
    shadowZh: ["急躁", "失衡"],
    suitZh: "权杖",
  },
  Cups: {
    archetype: "Emotion",
    archetypeZh: "情感与连结",
    light: ["connection", "intuition"],
    lightZh: ["连结", "感受力"],
    shadow: ["idealism", "emotional overwhelm"],
    shadowZh: ["理想化", "情绪淹没"],
    suitZh: "圣杯",
  },
  Swords: {
    archetype: "Mind",
    archetypeZh: "思维与判断",
    light: ["clarity", "discernment"],
    lightZh: ["清明", "辨识力"],
    shadow: ["overthinking", "sharpness"],
    shadowZh: ["过度思考", "锋利伤人"],
    suitZh: "宝剑",
  },
  Pentacles: {
    archetype: "Material grounding",
    archetypeZh: "现实与落地",
    light: ["stability", "craft"],
    lightZh: ["稳定", "踏实经营"],
    shadow: ["stagnation", "scarcity focus"],
    shadowZh: ["停滞", "匮乏焦虑"],
    suitZh: "星币",
  },
} as const;

const ranks = [
  "Ace",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Page",
  "Knight",
  "Queen",
  "King",
] as const;

const rankZhMap: Record<(typeof ranks)[number], string> = {
  Ace: "王牌",
  Two: "二",
  Three: "三",
  Four: "四",
  Five: "五",
  Six: "六",
  Seven: "七",
  Eight: "八",
  Nine: "九",
  Ten: "十",
  Page: "侍者",
  Knight: "骑士",
  Queen: "王后",
  King: "国王",
};

const minorArcana = (Object.keys(suitTemplates) as Array<keyof typeof suitTemplates>).flatMap(
  (suit) =>
    ranks.map((rank) => {
      const template = suitTemplates[suit];
      return {
        id: `${rank.toLowerCase()}-${suit.toLowerCase()}`,
        name: `${rank} of ${suit}`,
        nameZh: `${template.suitZh}${rankZhMap[rank]}`,
        arcana: "Minor" as const,
        suit,
        rank,
        archetype: template.archetype,
        archetypeZh: template.archetypeZh,
        light: [...template.light, rank],
        shadow: [...template.shadow, `${rank.toLowerCase()} shadow`],
        lightZh: [...template.lightZh, rankZhMap[rank]],
        shadowZh: [...template.shadowZh, `${rankZhMap[rank]}的阴影`],
      };
    }),
);

export const tarotDeck: TarotCard[] = [...majorArcana, ...minorArcana];

export const spreads: SpreadOption[] = [
  {
    id: "single",
    name: "Single Card",
    nameZh: "单张指引",
    cards: 1,
    subtitle: "用一张牌映照当下最核心的能量。",
    promptFocus: "给出一个清晰观察视角与一个可执行的下一步。",
  },
  {
    id: "free-flow",
    name: "No Spread",
    nameZh: "无牌阵",
    cards: 3,
    subtitle: "不预设位置，只凭牵引挑选三张与你有缘的牌。",
    promptFocus: "不使用时间框架，聚焦当下最真实的内在回响。",
  },
  {
    id: "love",
    name: "Love Reading",
    nameZh: "感情关系",
    cards: 3,
    subtitle: "聚焦情感模式、关系互动与内心真实。",
    promptFocus: "围绕亲密感、边界、脆弱性与沟通来解读。",
  },
  {
    id: "career",
    name: "Career Reading",
    nameZh: "事业工作",
    cards: 3,
    subtitle: "理解你的推进力、阻碍点与职业选择。",
    promptFocus: "聚焦行动力、工作模式、时机与判断。",
  },
  {
    id: "decision",
    name: "Decision Guidance",
    nameZh: "决策指引",
    cards: 3,
    subtitle: "承接拉扯，照见选项差异与更贴近内心的路径。",
    promptFocus: "不要下定论，而是看清取舍与内在一致性。",
  },
];

export type DrawnCard = TarotCard & {
  orientation: "Upright" | "Reversed";
};

export function drawCards(count: number): DrawnCard[] {
  const pool = [...tarotDeck];
  const result: DrawnCard[] = [];

  for (let index = 0; index < count; index += 1) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    const [card] = pool.splice(randomIndex, 1);
    result.push({
      ...card,
      orientation: Math.random() > 0.5 ? "Upright" : "Reversed",
    });
  }

  return result;
}
