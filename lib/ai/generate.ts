/**
 * Server-side AI generation utility.
 * Used by API routes and server services — never import from client components.
 */

import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

export type AIProvider = 'openrouter' | 'gemini';

export interface GenerateOptions {
  provider?: AIProvider;
  model?: string;
  temperature?: number;
  maxRetries?: number;
}

const DEFAULT_OPTIONS: Required<GenerateOptions> = {
  provider: 'openrouter',
  model: 'google/gemini-2.5-flash',
  temperature: 0.1,
  maxRetries: 5,
};

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  throw lastError ?? new Error('AI generation failed after retries.');
}

async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number,
  maxRetries: number,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
  });

  return withRetry(async () => {
    const res = await client.chat.completions.create({
      model,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    return res.choices[0]?.message?.content ?? '';
  }, maxRetries);
}

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number,
  maxRetries: number,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');

  const genai = new GoogleGenAI({ apiKey });

  return withRetry(async () => {
    const result = await genai.models.generateContent({
      model,
      contents: `${systemPrompt}\n\n${userPrompt}`,
      config: { temperature },
    });
    return result.text ?? '';
  }, maxRetries);
}

/**
 * Generate text from AI. Works server-side only.
 */
export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  options?: GenerateOptions,
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.provider === 'gemini') {
    return callGemini(systemPrompt, userPrompt, opts.model, opts.temperature, opts.maxRetries);
  }
  return callOpenRouter(systemPrompt, userPrompt, opts.model, opts.temperature, opts.maxRetries);
}
