import { NextResponse } from "next/server";
import { tarotDeck, spreads } from "@/data/tarot";
import {
  tarotReaderDeveloperPrompt,
  buildReadingUserPrompt,
  createFallbackReading,
  tarotReaderSystemPrompt,
} from "@/lib/deepseek";

type ReadingRequest = {
  question?: string;
  spreadId?: string;
  interpretationMode?: "standard" | "shadow";
  cards?: Array<{
    id: string;
    orientation: "Upright" | "Reversed";
  }>;
};

function normalizeModelReading(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/^\s+|\s+$/gmu, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s*/gmu, "")
    .replace(/^[-*_]{2,}\s*$/gmu, "")
    .replace(/[ ]{3,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/Overall Energy/giu, "整体能量")
    .replace(/Card Symbolism/giu, "牌面象征解读")
    .replace(/Jungian Reflection/giu, "荣格式映照")
    .replace(/Hidden Pattern/giu, "隐藏模式")
    .replace(/Practical Guidance/giu, "实际建议")
    .replace(/Reflection Question/giu, "反思问题")
    .trim();
}

function hasEnoughChinese(text: string) {
  const cjk = text.match(/[\u3400-\u9fff]/g) ?? [];
  return cjk.length >= 24;
}

function encodeStream(text: string) {
  const encoder = new TextEncoder();
  const chunks = text.match(/.{1,90}(\s|$)/g) ?? [text];

  return new ReadableStream({
    start(controller) {
      let index = 0;
      const push = () => {
        if (index >= chunks.length) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
        setTimeout(push, 36);
      };
      push();
    },
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as ReadingRequest;
  const question = body.question?.trim();
  const spread = spreads.find((item) => item.id === body.spreadId);
  const interpretationMode = body.interpretationMode === "shadow" ? "shadow" : "standard";

  if (!question || !spread || !body.cards?.length) {
    return NextResponse.json({ error: "Invalid reading payload." }, { status: 400 });
  }

  const cards = body.cards
    .map((item) => {
      const base = tarotDeck.find((card) => card.id === item.id);
      return base ? { ...base, orientation: item.orientation } : null;
    })
    .filter(
      (
        item,
      ): item is (typeof tarotDeck)[number] & {
        orientation: "Upright" | "Reversed";
      } => Boolean(item),
    );

  if (!cards.length) {
    return NextResponse.json({ error: "No valid cards found." }, { status: 400 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const userPrompt = buildReadingUserPrompt({
    question,
    spread,
    cards,
    interpretationMode,
  });

  if (!apiKey) {
    const fallback = createFallbackReading({ question, spread, cards, interpretationMode });
    return new Response(encodeStream(fallback), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  try {
    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
        stream: true,
        temperature: 0.7,
        top_p: 0.9,
        presence_penalty: 0.2,
        frequency_penalty: 0.15,
        max_tokens: 1800,
        messages: [
          {
            role: "system",
            content: tarotReaderSystemPrompt,
          },
          {
            role: "system",
            content: tarotReaderDeveloperPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      throw new Error((await upstream.text()) || "DeepSeek request failed.");
    }

    const decoder = new TextDecoder();
    const reader = upstream.body.getReader();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";

          for (const line of parts) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;

            const payload = trimmed.replace(/^data:\s*/, "");
            if (payload === "[DONE]") {
              break;
            }

            try {
              const json = JSON.parse(payload) as {
                choices?: Array<{
                  delta?: {
                    content?: string;
                  };
                }>;
              };

              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
              }
            } catch {
              // Ignore malformed frames from upstream.
            }
          }
        }

        const normalized = normalizeModelReading(fullText);
        const finalText = hasEnoughChinese(normalized)
          ? normalized
          : createFallbackReading({ question, spread, cards, interpretationMode });

        const progressive = encodeStream(finalText);
        const progressiveReader = progressive.getReader();

        while (true) {
          const { done, value } = await progressiveReader.read();
          if (done) {
            controller.close();
            return;
          }
          controller.enqueue(value);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    const fallback = createFallbackReading({ question, spread, cards, interpretationMode });
    return new Response(encodeStream(fallback), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  }
}
