import { GoogleGenAI } from "@google/genai";

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64 = reader.result as string;
            resolve(base64.split(',')[1]);
        };
        reader.onerror = error => reject(error);
    });
};

export const analyzeImageWithAI = async (
    imageFile: File,
    promptText: string,
    apiKey?: string
): Promise<string> => {
    const key = apiKey || process.env.VITE_GEMINI_API_KEY;
    if (!key) {
        throw new Error("No Gemini API Key provided. Please update your settings.");
    }

    const ai = new GoogleGenAI({ apiKey: key });

    try {
        const base64Data = await fileToBase64(imageFile);

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: promptText },
                        {
                            inlineData: {
                                mimeType: imageFile.type,
                                data: base64Data
                            }
                        }
                    ]
                }
            ]
        });

        return response.text || "No analysis generated.";

    } catch (error: any) {
        console.error("Error analyzing image:", error);
        throw new Error(`Image Analysis Failed: ${error.message}`);
    }
};
