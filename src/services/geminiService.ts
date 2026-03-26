import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'dummy-key') {
    throw new Error("Neural Link Offline: GEMINI_API_KEY or VITE_GEMINI_API_KEY is missing. Please set it in your environment variables or .env file.");
  }
  return new GoogleGenAI({ apiKey });
};

export async function generateAIResponse(prompt: string, history: { role: string, content: string }[], fileData?: { data: string, mimeType: string }) {
  try {
    const ai = getAIClient();
    const filteredHistory = [];
    let lastRole = "";
    
    for (const msg of history) {
      const role = msg.role === 'user' ? 'user' : 'model';
      if (role !== lastRole) {
        filteredHistory.push({
          role,
          parts: [{ text: msg.content }]
        });
        lastRole = role;
      }
    }

    if (filteredHistory.length > 0 && filteredHistory[filteredHistory.length - 1].role === 'user') {
      filteredHistory.pop();
    }

    const contents = [
      ...filteredHistory,
      {
        role: "user",
        parts: [
          ...(fileData ? [{ 
            inlineData: {
              data: fileData.data,
              mimeType: fileData.mimeType
            } 
          }] : []),
          { text: `QUESTION: ${prompt || (fileData ? "Analyze this document." : "Hello")}\n\nINSTRUCTION: Answer using ONLY the provided document data. If not found, say 'Data not present in document'. No extra info.` }
        ]
      }
    ];

    // Switching to gemini-3-flash-preview as primary to avoid Quota errors
    // It is much faster and has higher limits for free tier.
    const modelName = "gemini-3-flash-preview";

    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: `STRICT DATA ANALYZER MODE:
        1. Respond ONLY using the provided document data.
        2. DO NOT use external knowledge.
        3. If information is missing, state: "Data not present in document."
        4. No greetings, no conversational filler, just the facts from the data.
        5. Use markdown for tables and lists if found in data.`,
      }
    });

    return response.text || "I apologize, but I couldn't generate a response at this time.";
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    
    if (error?.message?.includes('429') || error?.message?.includes('quota')) {
      throw new Error("Neural Link Busy: API Quota Exceeded. Please wait a few seconds and try again.");
    }
    
    throw new Error('Neural Link Interrupted: ' + (error.message || 'Unknown Error'));
  }
}
