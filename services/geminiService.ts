
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export interface TrendKeyword {
  keyword: string;
  translation: string;
  weight: number; // Score from 1-10 representing how recent/breaking the news is
}

export const fetchNewsTrends = async (centerWord: string): Promise<TrendKeyword[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for 7-8 of the MOST RECENT and BREAKING news trend keywords related to "${centerWord}" using Google Search. 
      Prioritize news that happened in the last 24-48 hours.
      Return the results as a JSON array of objects. 
      For each object:
      - "keyword": The specific news trend keyword in Chinese (e.g., instead of just "AI", use "OpenAI Sora Release").
      - "translation": The original English term or exact translation.
      - "weight": An integer from 1 to 10, where 10 is "breaking news in the last hour" and 1 is "a general ongoing topic".
      Make the keywords highly specific to current events.`,
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
              weight: { type: Type.INTEGER, description: "Recency score 1-10" },
            },
            required: ["keyword", "translation", "weight"],
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
