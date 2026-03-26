import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { Pinecone } from "@pinecone-database/pinecone";

// Initialize Pinecone lazily to avoid errors when keys are missing
let pineconeClient: Pinecone | null = null;

const getPineconeClient = () => {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) return null;
  
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: apiKey,
    });
  }
  return pineconeClient;
};

export const generateLangChainResponse = async (
  prompt: string,
  history: { role: string; content: string }[],
  fileData?: { data: string; mimeType: string }
) => {
  try {
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-3-flash-preview",
      apiKey: process.env.GEMINI_API_KEY,
      maxOutputTokens: 2048,
    });

    const messages = [
      { type: "system", content: "You are GaruanCDX, a professional AI Knowledge Assistant. Analyze the user's query and any provided documents with high precision." },
      ...history.map(h => ({ type: h.role === 'user' ? 'human' : 'ai', content: h.content })),
    ];

    const userContent: any[] = [{ type: "text", text: prompt }];
    
    if (fileData) {
      userContent.push({
        type: "image_url", // LangChain uses image_url for any inline data in some versions, or we can use the specific part format
        image_url: `data:${fileData.mimeType};base64,${fileData.data}`
      });
    }

    messages.push({ type: "human", content: userContent } as any);

    const chatPrompt = ChatPromptTemplate.fromMessages(messages as any);

    const outputParser = new StringOutputParser();

    const chain = RunnableSequence.from([
      chatPrompt,
      model,
      outputParser,
    ]);

    const response = await chain.invoke({
      input: prompt, // This is still needed for the template but the content is already in the messages
    });

    return response;
  } catch (error) {
    console.error("LangChain Error:", error);
    throw error;
  }
};

// Cleaned up: No more fake "Neural Memory Hits"
export const searchVectorDatabase = async (query: string) => {
  return ""; // Returning empty to ensure NO extra data is added
};
