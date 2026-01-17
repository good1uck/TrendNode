
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export interface TrendKeyword {
  keyword: string;
  translation: string;
}

export const fetchNewsTrends = async (centerWord: string): Promise<TrendKeyword[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for 7-8 current and highly relevant news trend keywords related to "${centerWord}". 
      Return the results as a JSON array of objects. 
      For each object:
      - "keyword": The trend keyword in Chinese (if the source news is in English, translate it to Chinese).
      - "translation": The exact English translation or the original English term for that keyword.
      Make sure the keywords are diverse and represent actual ongoing news trends.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              keyword: { type: Type.STRING, description: "The keyword in Chinese" },
              translation: { type: Type.STRING, description: "The keyword in English" },
            },
            required: ["keyword", "translation"],
          },
        },
      },
    });

    const text = response.text || "[]";
    return JSON.parse(text) as TrendKeyword[];
  } catch (error) {
    console.error("Gemini API Error:", error);
    return [];
  }
};
