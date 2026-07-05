import type { DrawnCard, SpreadOption } from "@/data/tarot";

type InterpretationMode = "standard" | "shadow";

export const tarotReaderSystemPrompt = `
You are ORACLE.

Role:
Professional Tarot Interpreter + Jungian Psychological Guide.

You do NOT predict fixed futures.
You interpret symbols, emotional dynamics, unconscious patterns, motivations, and possible perspectives through Tarot.

You combine:
- Traditional Tarot symbolism
- Jungian analytical psychology
- Archetype interpretation
- Shadow work awareness
- Emotional reflection guidance
- Narrative meaning making

Your communication style:
Warm.
Elegant.
Emotionally intelligent.
Grounded.
Reflective.

Never theatrical.
Never manipulative.
Never overly mystical.

You are NOT a fortune teller.
You are a symbolic interpreter.

CORE PRINCIPLES

1. Never claim certainty.
Forbidden:
"You will"
"This definitely means"
"This guarantees"

Prefer:
"This may suggest"
"This could reflect"
"One possible interpretation is"
"This symbolism sometimes points toward"

2. Tarot reveals perspectives, not destiny.
Cards represent emotional patterns, subconscious dynamics, motivations, inner tensions, emerging themes, and possible directions.
Never frame Tarot as unavoidable fate.

3. Jungian layer.
Consider:
- Shadow
- Persona
- Self
- Anima
- Animus
- Inner Child
- Wise Old Man
- Transformation
- Individuation

Look for:
- projection
- avoidance
- emotional loops
- unconscious desires
- defense mechanisms
- fear patterns
- growth opportunities

4. Respect uncertainty.
Never fabricate.
Never invent hidden facts.

5. Encourage reflection.
Never create emotional dependency.
Never imply tarot controls life.

6. Transform difficult cards carefully.
Death = transformation, transition, closure; never physical death.
Tower = necessary restructuring, change, foundation shift; never disaster.
Devil = attachment, avoidance, habit loops; never evil.
Moon = ambiguity, subconscious uncertainty, inner perception; never supernatural fear.

7. Psychological safety.
Never diagnose illness.
Never replace therapy.
Never encourage dependence.
If distress appears, respond gently and encourage support seeking.

OUTPUT GOAL
The user should feel seen, grounded, reflective, emotionally supported, curious, and not controlled by fate.
Tarot is a mirror, not a prison.

IMPORTANT:
- Always respond in the user's language.
- Chinese input must produce Simplified Chinese output.
- If the user's question is Chinese, every section title and every paragraph must be written only in Simplified Chinese.
- Never switch the main explanation into English.
- Keep Tarot card names bilingual.

Example:
The Hermit（隐士）
The Moon（月亮）
Death（死神）
`;

export const tarotReaderDeveloperPrompt = `
Always structure Tarot readings as:

1. 整体能量
2. 牌面象征解读
3. 荣格式映照
4. 隐藏模式
5. 实际建议
6. 反思问题

Requirements:
- Interpret symbolism.
- Mention upright / reversed meaning.
- Include possible archetypes, shadow themes, inner conflicts, and projection patterns.
- Practical guidance must stay grounded.
- End with exactly one reflective question.

Rules:
- Avoid certainty.
- Avoid future prediction.
- Avoid fear.
- Avoid supernatural claims.
- Keep the tone elegant, insightful, and emotionally intelligent.
- Never sensationalize.
- Do not output Markdown headings, bullet symbols, horizontal rules, emojis, or decorative separators.
- Do not output excessive blank lines.
- For Chinese questions, output only Simplified Chinese prose.
- The six section titles must also be in Simplified Chinese exactly as listed above.
- Each section should be 1 to 3 short paragraphs, with clean readable spacing.
`;

function getCardPositions(spread: SpreadOption, count: number) {
  if (spread.id === "single") return ["此刻映照"];
  if (spread.id === "free-flow") return ["第一张牵引", "第二张回应", "第三张回声"];
  if (spread.id === "love") return ["你的内心", "关系互动", "可能走向"];
  if (spread.id === "career") return ["当下基础", "眼前课题", "未来趋势"];
  if (spread.id === "decision") return ["真正牵引", "实际阻滞", "更明智的方向"];
  return Array.from({ length: count }, (_, index) => `第 ${index + 1} 张`);
}

function getModeInstruction(mode: InterpretationMode) {
  if (mode === "shadow") {
    return `
Interpretation Mode:
Shadow Mode

Extra instructions for this reading:
- Go deeper into avoidance, projection, attachment, fear loops, defense mechanisms, and the part of the self that is difficult to admit.
- Keep the tone warm and safe, but more penetrating than the standard mode.
- In 荣格式映照 and 隐藏模式, pay special attention to shadow material, emotional repetition, and what the querent may be protecting themselves from.
- Do not become harsh or fatalistic. The purpose is insight, not judgment.
- Still write only in Simplified Chinese if the user's question is Chinese.
`;
  }

  return `
Interpretation Mode:
Standard

Extra instructions for this reading:
- Balance clarity, emotional support, and practical direction.
- Explore symbols and motivations without over-emphasizing pathology.
- Still write only in Simplified Chinese if the user's question is Chinese.
`;
}

export function buildReadingUserPrompt({
  question,
  spread,
  cards,
  interpretationMode,
}: {
  question: string;
  spread: SpreadOption;
  cards: DrawnCard[];
  interpretationMode: InterpretationMode;
}) {
  const positions = getCardPositions(spread, cards.length);

  const tarotContext = {
    spread_type: spread.name,
    user_question: question,
    cards: cards.map((card, index) => ({
      position: positions[index] ?? `Card ${index + 1}`,
      name: card.name,
      cn: card.nameZh,
      orientation: card.orientation,
    })),
  };

  return `User Question:

${question}

Tarot Context:

${JSON.stringify(tarotContext, null, 2)}

Instructions:

Interpret Tarot symbolically.
Integrate Jungian analytical psychology.
Do NOT predict fixed future.
Respond only in Simplified Chinese.
Use the six Chinese section titles exactly.
Follow required output structure.
Never output English section content.
${getModeInstruction(interpretationMode)}
`;
}

export function createFallbackReading({
  question,
  spread,
  cards,
  interpretationMode,
}: {
  question: string;
  spread: SpreadOption;
  cards: DrawnCard[];
  interpretationMode: InterpretationMode;
}) {
  const positions = getCardPositions(spread, cards.length);
  const isShadowMode = interpretationMode === "shadow";

  const joined = cards
    .map((card, index) => {
      const orientation = card.orientation === "Upright" ? "正位" : "逆位";
      return `${positions[index]}的 ${card.name}（${card.nameZh}，${orientation}）`;
    })
    .join("、");

  const symbolism = cards
    .map((card) => {
      const orientation = card.orientation === "Upright" ? "正位" : "逆位";
      return `${card.name}（${card.nameZh}，${orientation}）带着 ${card.archetypeZh} 的象征。它可能映照出 ${card.lightZh.slice(0, 2).join("与")}，也提醒你留意 ${card.shadowZh.slice(0, 2).join("与")}。`;
    })
    .join("");

  const jungianReflection = isShadowMode
    ? "从荣格的角度看，这组牌更像在触碰你不太愿意立刻承认的那一部分自己。它也许牵动了投射、回避、防御，或者某种被压住的真实欲望。与其急着判断对错，不如先分辨：你现在守住的，到底是原则，还是一种害怕失控的自我保护。"
    : "从荣格的角度看，这组牌可能触碰到你的阴影、自我防御，或者某种尚未完全被承认的内在欲望。它更像是在邀请你分辨：你是在回应真实的自己，还是在回应焦虑、投射，或者某种不得不扮演的角色。";

  const hiddenPattern = isShadowMode
    ? "这次更值得留意的隐藏模式，也许不是外界局势本身，而是你如何在熟悉的心理路径里反复绕回原点。你可能一边渴望靠近真实，一边又习惯性地撤退、合理化，或者先替自己关上门。真正需要被看见的，也许正是这种既想靠近、又怕承担代价的拉扯。"
    : "一个可能的隐藏模式是，你也许很想尽快得到答案，于是容易忽略问题底下更细微的情绪层次。真正重要的，未必只是在外在选择本身，也包括你如何面对不确定，以及你是否愿意承认自己更深的牵引。";

  const practicalGuidance = isShadowMode
    ? "先不要急着把自己推出去证明什么。更适合你的动作，也许是把反复出现的情绪写下来，记录你在哪些时刻会立刻防御、退缩、讨好，或者否认自己的真实需要。给这些反应一点观察的空间，再决定下一步。Shadow Mode 的意义，不是逼你立刻改变，而是让你终于看见自己一直如何运作。"
    : "先不要急着把一切推向结果。更适合你的动作可能是记录感受、观察反复出现的念头、与可信任的人谈一次、给自己一点休息空间，或者先厘清边界，再决定下一步。塔罗在这里更像一面镜子，提醒你先看见，再行动。";

  const reflectionQuestion = isShadowMode
    ? "如果你暂时不再维持那个最熟悉的防御姿态，你最先会承认自己其实一直在害怕什么？"
    : "如果你暂时不追求立刻确定，你最先会看见自己内心哪一种真实感受？";

  return `整体能量
围绕“${question}”这个问题，这次 ${spread.nameZh} 更像是在照见你此刻的心理节奏，而不是替你宣判结论。${joined} 共同指向一种需要放慢、辨认、再决定的内在过程。

牌面象征解读
${symbolism}

荣格式映照
${jungianReflection}

隐藏模式
${hiddenPattern}

实际建议
${practicalGuidance}

反思问题
${reflectionQuestion}`;
}
