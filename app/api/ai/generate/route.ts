import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { withRoleAuth } from '@/lib/auth/api-helpers';
import type { AuthContext } from '@/lib/auth/api-helpers';

const ALLOWED_PROVIDERS = ['openrouter', 'gemini'] as const;
const ALLOWED_MODELS = [
  'google/gemini-2.0-flash-001',
  'google/gemini-2.5-flash',
  'gemini-2.0-flash-exp',
  'gemini-2.5-flash',
] as const;

// Increase body size limit for vision requests that include large base64 images
export const maxDuration = 120;


interface GenerateRequestBody {
  prompt: string;
  schema?: Record<string, unknown>;
  provider?: 'openrouter' | 'gemini';
  model?: string;
  temperature?: number;
  imageBase64?: string;
}

interface GenerateResult {
  text: string;
  usage?: { promptTokens: number; completionTokens: number; estimatedCostUSD: number };
}

/** Calls OpenRouter with retry logic. */
async function generateWithOpenRouter(
  prompt: string,
  model: string,
  schema: Record<string, unknown> | undefined,
  temperature: number,
  maxRetries: number,
  imageBase64?: string,
): Promise<GenerateResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured on the server.');

  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
  });

  const systemPrompt = schema
    ? `You are a precise data extraction assistant. Return ONLY valid JSON matching this schema: ${JSON.stringify(schema)}`
    : 'You are a helpful assistant.';

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: imageBase64
              ? [
                  { type: 'text' as const, text: prompt },
                  { type: 'image_url' as const, image_url: { url: imageBase64 } },
                ]
              : prompt,
          },
        ],
        response_format: schema && !imageBase64 ? { type: 'json_object' } : undefined,
      });
      const u = response.usage;
      const inputCost  = ((u?.prompt_tokens     ?? 0) / 1_000_000) * 0.15;
      const outputCost = ((u?.completion_tokens ?? 0) / 1_000_000) * 0.60;
      const estimatedCostUSD = inputCost + outputCost;
      if (u) {
        console.log(
          `[AI cost] model: ${model} | in: ${u.prompt_tokens} tok | out: ${u.completion_tokens} tok` +
          ` | ~$${estimatedCostUSD.toFixed(5)} | hasImage: ${!!imageBase64}`,
        );
      }
      return {
        text: response.choices[0]?.message?.content ?? '',
        usage: u ? { promptTokens: u.prompt_tokens, completionTokens: u.completion_tokens, estimatedCostUSD } : undefined,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[OpenRouter] attempt ${attempt + 1} failed — model: ${model}, hasImage: ${!!imageBase64}, error:`, lastError.message);
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  throw lastError ?? new Error('AI generation failed after retries.');
}

/** Calls Google Gemini directly with retry logic. */
async function generateWithGemini(
  prompt: string,
  model: string,
  schema: Record<string, unknown> | undefined,
  temperature: number,
  maxRetries: number,
  imageBase64?: string,
): Promise<GenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on the server.');

  const genai = new GoogleGenAI({ apiKey });

  const fullPrompt = schema
    ? `${prompt}\n\nReturn ONLY valid JSON matching this schema: ${JSON.stringify(schema)}`
    : prompt;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const contents = imageBase64
        ? {
            parts: [
              { text: fullPrompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg' as const,
                  data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
                },
              },
            ],
          }
        : fullPrompt;
      const result = await genai.models.generateContent({
        model,
        contents,
        config: { temperature },
      });
      return { text: result.text ?? '' };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  throw lastError ?? new Error('AI generation failed after retries.');
}

export const POST = withRoleAuth(
  ['Administrator', 'Team Lead', 'Estimator'],
  async (request: NextRequest, _ctx: AuthContext) => {
    try {
      const body = (await request.json()) as GenerateRequestBody;
      const {
        prompt,
        schema,
        provider = 'openrouter',
        temperature = 0.1,
        imageBase64,
      } = body;

      const model: string = body.model || 'google/gemini-2.0-flash-001';

      if (!prompt || typeof prompt !== 'string') {
        return NextResponse.json({ error: 'prompt is required and must be a string' }, { status: 400 });
      }

      // D-08: Allowlist provider
      if (!ALLOWED_PROVIDERS.includes(provider as typeof ALLOWED_PROVIDERS[number])) {
        return NextResponse.json({ error: 'Unsupported provider.' }, { status: 400 });
      }

      // D-08: Allowlist model
      if (!ALLOWED_MODELS.includes(model as typeof ALLOWED_MODELS[number])) {
        return NextResponse.json({ error: 'Unsupported model.' }, { status: 400 });
      }

      // D-08: Clamp temperature to [0, 1]
      if (temperature < 0 || temperature > 1) {
        return NextResponse.json({ error: 'temperature must be between 0 and 1.' }, { status: 400 });
      }

      const { text, usage } =
        provider === 'gemini'
          ? await generateWithGemini(prompt, model, schema, temperature, 5, imageBase64)
          : await generateWithOpenRouter(prompt, model, schema, temperature, 5, imageBase64);

      return NextResponse.json({ text, usage }, { status: 200 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      console.error('[/api/ai/generate] 500 error:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
);
