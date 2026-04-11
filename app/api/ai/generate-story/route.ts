import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth";
import { generateStoryText } from "@/lib/ai/gemini";

export const runtime = "nodejs";

type GenerateStoryRequestBody = {
  prompt?: unknown;
  model?: unknown;
};

const MAX_PROMPT_LENGTH = 12000;

export async function POST(request: Request) {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: GenerateStoryRequestBody;

  try {
    body = (await request.json()) as GenerateStoryRequestBody;
  } catch {
    return NextResponse.json(
      { error: "We could not read that story generation request." },
      { status: 400 },
    );
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";

  if (!prompt) {
    return NextResponse.json(
      { error: "Prompt is required." },
      { status: 400 },
    );
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Prompt must be ${MAX_PROMPT_LENGTH} characters or less.` },
      { status: 400 },
    );
  }

  try {
    const generated = await generateStoryText({
      prompt,
      model: model || undefined,
    });

    return NextResponse.json(
      {
        text: generated.text,
        model: generated.model,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("GEMINI_API_KEY is missing")) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(
        { error: error.message },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: "Failed to generate story text." },
      { status: 502 },
    );
  }
}
