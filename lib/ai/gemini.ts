import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";

let cachedClient: GoogleGenerativeAI | null = null;

function getApiKey() {
  const key = process.env.GEMINI_API_KEY?.trim();

  if (!key) {
    throw new Error("GEMINI_API_KEY is missing. Add it to .env.local.");
  }

  return key;
}

function getClient() {
  if (!cachedClient) {
    cachedClient = new GoogleGenerativeAI(getApiKey());
  }

  return cachedClient;
}

export function resolveGeminiModel(override?: string) {
  const candidate =
    override?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL;

  return candidate;
}

export async function generateStoryText(options: {
  prompt: string;
  model?: string;
}) {
  const prompt = options.prompt.trim();

  if (!prompt) {
    throw new Error("Prompt cannot be empty.");
  }

  const requestedModel = resolveGeminiModel(options.model);
  const fallbackModel = DEFAULT_GEMINI_MODEL;
  const client = getClient();

  async function generateWithModel(modelName: string) {
    const model = client.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    return { text, model: modelName };
  }

  let generated: { text: string; model: string };

  try {
    generated = await generateWithModel(requestedModel);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const modelNotFound = message.includes("not found");

    if (modelNotFound && requestedModel !== fallbackModel) {
      generated = await generateWithModel(fallbackModel);
    } else {
      throw error;
    }
  }

  if (!generated.text) {
    throw new Error("Gemini returned an empty response.");
  }

  return generated;
}
