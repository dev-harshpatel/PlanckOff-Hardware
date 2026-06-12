/**
 * OpenRouter client factory and the shared structured-output call helper.
 */

import OpenAI from 'openai';
import { MODEL } from './config';
import { RESPONSE_SCHEMA } from './schemas';

export function makeOpenRouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'PlanckOff Hardware Estimating',
    },
  });
}

export async function callOpenRouterForSets(
  client: OpenAI,
  messages: Parameters<OpenAI['chat']['completions']['create']>[0]['messages'],
  signal?: AbortSignal,
  schema: Record<string, unknown> = RESPONSE_SCHEMA,
  schemaName = 'hardware_extraction',
  model: string = MODEL,
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 65536,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: schemaName,
        schema,
        strict: false,
      },
    } as Parameters<typeof client.chat.completions.create>[0]['response_format'],
    messages,
  }, { signal });
  return response.choices[0]?.message?.content ?? '';
}
