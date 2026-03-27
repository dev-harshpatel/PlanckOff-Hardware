import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { AppSettings } from '../types';

/**
 * Gets the current app settings from localStorage
 */
export const getAppSettings = (injectedSettings?: AppSettings): AppSettings | null => {
    if (injectedSettings) return injectedSettings;
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const settingsStr = localStorage.getItem('tve_app_settings');
            if (!settingsStr) return null;
            return JSON.parse(settingsStr) as AppSettings;
        }
        return null;
    } catch (error) {
        console.error('Failed to load app settings:', error);
        return null;
    }
};

/**
 * Generate content using the configured AI provider (Gemini or Open Router)
 */
export const generateAIContent = async (
    prompt: string,
    schema?: any,
    options?: {
        temperature?: number;
        maxRetries?: number;
        settings?: AppSettings; // Allow passing settings explicitly
    }
): Promise<{ text: string }> => {
    const settings = getAppSettings(options?.settings);
    console.log('DEBUG: Loaded Settings:', settings);
    
    // Default to OpenRouter — set provider/model in app settings or env vars
    const provider = settings?.provider || 'openrouter';
    // Default model: google/gemini-2.0-flash-001 via OpenRouter (fast, great at structured JSON extraction)
    const model = settings?.model || 'google/gemini-2.0-flash-001';
    console.log(`DEBUG: Selected Provider: ${provider}, Model: ${model}`);
    
    const temperature = options?.temperature ?? 0.1;
    const maxRetries = options?.maxRetries ?? 5;
    
    if (provider === 'openrouter') {
        console.log('DEBUG: Using Open Router implementation');
        // Fall back to env var if no key in settings
        const openRouterKey = settings?.openRouterKey ||
            process.env.VITE_OPENROUTER_API_KEY ||
            process.env.OPENROUTER_API_KEY ||
            process.env.VITE_GEMINI_API_KEY || // legacy env var name
            process.env.GEMINI_API_KEY;        // legacy env var name
        return generateWithOpenRouter(prompt, model, schema, openRouterKey, temperature, maxRetries);
    } else {
        console.log('DEBUG: Using Gemini implementation');
        return generateWithGemini(prompt, model, schema, settings?.geminiApiKey, temperature, maxRetries);
    }
};

/**
 * Generate content using Google Gemini
 */
const generateWithGemini = async (
    prompt: string,
    model: string,
    schema: any,
    apiKey?: string,
    temperature: number = 0.1,
    retries: number = 5
): Promise<{ text: string }> => {
    const key = apiKey || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!key) {
        throw new Error('No Gemini API Key provided. Please update your settings or add GEMINI_API_KEY to your .env file.');
    }
    
    const ai = new GoogleGenAI({ apiKey: key });
    const baseDelay = 5000;
    
    for (let i = 0; i < retries; i++) {
        try {
            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: schema ? {
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                    temperature,
                } : {
                    temperature,
                }
            });
            
            return { text: response.text || '' };
        } catch (error: any) {
            const isRetryable = 
                error.status === 429 || 
                error.code === 429 || 
                String(error.status).startsWith('5') ||
                (error.message && error.message.includes('429'));
            
            if (isRetryable && i < retries - 1) {
                const delayTime = baseDelay * Math.pow(2, i);
                console.warn(`Gemini API call failed (Attempt ${i+1}/${retries}). Retrying in ${delayTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayTime));
                continue;
            }
            throw error;
        }
    }
    
    throw new Error('Exhausted all retries for Gemini API call.');
};

/**
 * Generate content using Open Router (OpenAI-compatible API)
 */
const generateWithOpenRouter = async (
    prompt: string,
    model: string,
    schema: any,
    apiKey?: string,
    temperature: number = 0.1,
    retries: number = 5
): Promise<{ text: string }> => {
    if (!apiKey) {
        throw new Error('No Open Router API Key provided. Please update your settings.');
    }
    
    // `window` is not available inside a Web Worker — use a safe fallback for the Referer header
    const referer = typeof window !== 'undefined' ? window.location.origin : 'https://planckoff.app';

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        dangerouslyAllowBrowser: true, // Required for client-side / worker usage
        defaultHeaders: {
            'HTTP-Referer': referer,
            'X-Title': 'Planckoff Hardware Estimating'
        }
    });
    
    const baseDelay = 5000;
    
    for (let i = 0; i < retries; i++) {
        try {
            const messages: any[] = [
                { role: 'user', content: prompt }
            ];
            
            const requestOptions: any = {
                model: model,
                messages: messages,
                temperature: temperature,
            };
            
            // Add JSON mode if schema is provided
            if (schema) {
                requestOptions.response_format = { type: 'json_object' };
                // Prepend instruction to return JSON
                messages[0].content = `Return your response as valid JSON following this schema. ${prompt}`;
            }
            
            const response = await openai.chat.completions.create(requestOptions);
            
            const content = response.choices[0]?.message?.content || '';
            return { text: content };
            
        } catch (error: any) {
            const isRetryable = 
                error.status === 429 || 
                error.code === 'rate_limit_exceeded' ||
                String(error.status).startsWith('5');
            
            if (isRetryable && i < retries - 1) {
                const delayTime = baseDelay * Math.pow(2, i);
                console.warn(`Open Router API call failed (Attempt ${i+1}/${retries}). Retrying in ${delayTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayTime));
                continue;
            }
            throw error;
        }
    }
    
    throw new Error('Exhausted all retries for Open Router API call.');
};
