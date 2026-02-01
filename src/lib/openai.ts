import OpenAI from "openai";
import { getEnv } from "./env";

let _openai: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_openai) {
    try {
      const env = getEnv();
      _openai = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
      });
    } catch (error) {
      throw new Error(
        `OpenAI client initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  return _openai;
}

