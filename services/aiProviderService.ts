import type { AppSettings } from '@/types';

/**
 * Reads the current app settings from localStorage.
 * Used to determine the preferred provider and model.
 */
export const getAppSettings = (injectedSettings?: AppSettings): AppSettings | null => {
  if (injectedSettings) return injectedSettings;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem('tve_app_settings');
      if (!raw) return null;
      return JSON.parse(raw) as AppSettings;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Sends a prompt to the server-side AI generation endpoint.
 * API keys never leave the server — this is a secure client-side wrapper.
 */
export const generateAIContent = async (
  prompt: string,
  schema?: Record<string, unknown>,
  options?: {
    temperature?: number;
    maxRetries?: number;
    settings?: AppSettings;
  },
): Promise<{ text: string }> => {
  const settings = getAppSettings(options?.settings);
  const provider = settings?.provider || 'openrouter';
  const model = settings?.model || 'google/gemini-2.0-flash-001';
  const temperature = options?.temperature ?? 0.1;

  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, schema, provider, model, temperature }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI generation failed: ${error}`);
  }

  return response.json() as Promise<{ text: string }>;
};
