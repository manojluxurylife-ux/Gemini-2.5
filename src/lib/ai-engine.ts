import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
}

export interface AIResponse {
  text: string;
  model: string;
}

export type AITaskType = 'voice' | 'drafting' | 'search' | 'general';

/**
 * HybridAIEngine implementation using Gemini 2.5 Flash exclusively.
 */
export class HybridAIEngine {
  private static instance: HybridAIEngine;
  private ai: any;

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    console.log("Nexus AI Engine Initializing...");
    if (apiKey) {
      console.log("GEMINI_API_KEY found.");
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      console.warn("GEMINI_API_KEY is not defined. AI features will be disabled. Please set GEMINI_API_KEY in environment variables.");
      this.ai = null;
    }
  }

  public static getInstance(): HybridAIEngine {
    if (!HybridAIEngine.instance) {
      HybridAIEngine.instance = new HybridAIEngine();
    }
    return HybridAIEngine.instance;
  }

  public getStatus() {
    return {
      builtIn: !!this.ai,
      voiceModel: 'Gemini 3.1 Flash (Direct)',
      draftModel: 'Gemini 3.1 Flash (Pro-Logic)',
      searchModel: 'Gemini 3.1 Flash (Grounding)',
      isLocalReady: true,
      loadProgress: 100
    };
  }

  public async *generateResponseStream(
    prompt: string, 
    history: AIMessage[], 
    task: AITaskType = 'voice'
  ): AsyncGenerator<string> {
    if (!this.ai) {
      yield "Error: AI engine not initialized.";
      return;
    }

    try {
      // Use Gemini 3.1 Flash Preview as requested
      const modelName = 'gemini-3.1-flash-preview';
      const contents: any[] = history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      const systemInstruction = `You are Nexus Justice, a professional polyglot legal assistant with deep expertise in Indian Laws and regional languages, especially Malayalam. 

LANGUAGE CAPABILITIES:
- You are fluent in Malayalam, Hindi, Tamil, Telugu, Kannada, Bengali, and English.
- You understand regional legal terminology (e.g., Kacheri, Vakalat, Aadhar, etc.).
- If the user speaks to you in Malayalam, you MUST respond in Malayalam with native-level fluency and cultural nuance.
- You can translate legal documents between any of these languages perfectly.

VOICE INTERACTION RULES:
1. Keep responses EXTREMELY concise and formal.
2. Maintain context from previous turns.
3. Identify the most complex legal part of your answer and ask if the user wants to know more about that.
4. End with a concise open-ended question to keep the conversation flowing.

In Malayalam: "ഞാൻ നെക്സസ് ജസ്റ്റിസ് ആണ്, നിങ്ങളുടെ നിയമപരമായ സഹായി. എങ്ങനെ സഹായിക്കണം?" (I am Nexus Justice, your legal assistant. How can I help?)`;

      const responseStream = await this.ai.models.generateContentStream({
        model: modelName,
        contents: contents,
        config: {
          systemInstruction
        }
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          yield chunk.text;
        }
      }
    } catch (error: any) {
      console.error("Streaming Error:", error);
      let rawMsg = typeof error === 'string' ? error : (error?.message || String(error));
      if (rawMsg.includes("Resource has been exhausted")) {
        yield "Error: AI Quota exceeded. Please try again later.";
      } else if (rawMsg.includes("Network error") || rawMsg.includes("Failed to fetch")) {
        yield "Error: Network connection failed. Please check your internet connection.";
      } else {
        yield "Error: Failed to connect to AI engine.";
      }
    }
  }

  public async generateResponse(
    prompt: string, 
    history: AIMessage[], 
    imageBase64?: string,
    task: AITaskType = 'general'
  ): Promise<AIResponse> {
    try {
      console.log("Generating response for task:", task);
      const effectiveTask = task === 'general' ? await this.orchestrate(prompt) : task;
      
      if (!this.ai) {
        return { text: "Error: AI engine not initialized.", model: "Error" };
      }

      if (effectiveTask === 'search') {
        const text = await this.callGeminiSearch(prompt, history);
        return { text, model: "Gemini 3.1 Flash (Search)" };
      }

      const modelName = 'gemini-3.1-flash-preview';
      const contents: any[] = history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const parts: any[] = [{ text: prompt }];
      if (imageBase64) {
        const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
        const mimeType = imageBase64.match(/data:([^;]+);base64/)?.[1] || 'image/jpeg';
        if (base64Data) {
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          });
        }
      }

      contents.push({ role: 'user', parts });

      const systemInstruction = `You are Nexus Justice, a professional polyglot legal assistant. 
Expert in Indian Law and regional languages: Malayalam, Hindi, Tamil, Telugu, Kannada, Bengali.
Be concise, formal, and helpful. Use legal terminology correctly. 
If responding in Malayalam, ensure native-level accuracy. Maintain conversation context.`;

      const response = await this.ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
          systemInstruction
        }
      });

      return { text: response.text || "I'm sorry, I couldn't generate a response.", model: "Gemini 3.1 Flash" };
    } catch (error: any) {
      console.error("AI Engine Error:", error);
      let rawMsg = typeof error === 'string' ? error : (error?.message || String(error));
      let errorMessage = "Error: Failed to connect to AI engine.";
      
      if (rawMsg.includes("Resource has been exhausted")) {
        errorMessage = "AI Quota exceeded. Please try again later or check your Gemini API plan.";
      } else if (rawMsg.includes("Network error") || rawMsg.includes("Failed to fetch")) {
        errorMessage = "Network connection failed. Please check your internet connection.";
      } else {
        errorMessage = `Error: ${rawMsg}`;
      }
      return { text: errorMessage, model: "Error" };
    }
  }

  private async orchestrate(prompt: string): Promise<AITaskType> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ 
          role: 'user', 
          parts: [{ 
            text: `Classify the user's intent into one of these: 'drafting', 'search', 'voice'.
            - 'drafting': document generation/editing.
            - 'search': live laws/citations/facts.
            - 'voice': general conversation/advice.
            Return ONLY the category name.
            User Request: "${prompt}"` 
          }] 
        }]
      });
      
      const decision = response.text?.toLowerCase().trim() || 'voice';
      if (decision.includes('draft')) return 'drafting';
      if (decision.includes('search')) return 'search';
      return 'voice';
    } catch (err) {
      return 'voice';
    }
  }

  private async callGeminiSearch(prompt: string, history: AIMessage[]): Promise<string> {
    try {
      const contents: any[] = history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: contents,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      let text = response.text || "";
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && chunks.length > 0) {
        text += "\n\n**Sources:**\n";
        chunks.forEach((c: any) => {
          if (c.web) {
            text += `- [${c.web.title}](${c.web.uri})\n`;
          }
        });
      }

      return text;
    } catch (err) {
      return "Error: Web search failed.";
    }
  }
}

