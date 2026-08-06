/**
 * Centralised LLM client module.
 * Validates all required environment variables at import time and exports a
 * configured OpenAI-compatible client instance.  Any misconfiguration throws a
 * typed LLMConfigError so it surfaces immediately rather than silently at
 * call-time.
 */

import OpenAI from "openai";

export class LLMConfigError extends Error {
  constructor(
    message: string,
    public readonly missingVars: string[]
  ) {
    super(message);
    this.name = "LLMConfigError";
  }
}

function validateConfig(): {
  apiKey: string;
  model: string;
  baseURL: string | undefined;
} {
  const missing: string[] = [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) missing.push("OPENAI_API_KEY");

  const model = process.env.LLM_MODEL_NAME;
  if (!model) missing.push("LLM_MODEL_NAME");

  // OPENAI_BASE_URL is optional — only validate presence when explicitly set
  const baseURL = process.env.OPENAI_BASE_URL || undefined;

  if (missing.length > 0) {
    throw new LLMConfigError(
      `LLM client misconfigured — missing required environment variables: ${missing.join(", ")}.`,
      missing
    );
  }

  return { apiKey: apiKey!, model: model!, baseURL };
}

const config = validateConfig();

export const llmModel: string = config.model;

export const llmClient = new OpenAI({
  apiKey: config.apiKey,
  ...(config.baseURL ? { baseURL: config.baseURL } : {}),
});
