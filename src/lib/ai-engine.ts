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
      voiceModel: 'Gemini 2.5 Flash (Direct)',
      draftModel: 'Gemini 2.5 Flash',
      searchModel: 'Gemini 2.5 Flash (Search)',
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
      // Direct use of Gemini 2.0 Flash
      const modelName = 'gemini-2.0-flash';
      const contents: any[] = history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      const systemInstruction = "You are Nexus Justice, a professional legal voice assistant. You are currently speaking to the user via voice. Keep your responses EXTREMELY concise, formal, and helpful. Answer directly without unnecessary preamble. Maintain context from previous turns in the conversation. If the user speaks to you in Malayalam (or any other language), you MUST respond in that same language. Your goal is to be a seamless extension of the advocate's workflow. \n\nCRITICAL CONVERSATIONAL RULES:\n1. Never just stop after answering a question. \n2. Always encourage the user to ask more or talk more. \n3. Identify the most complex or 'toughest' part of your current answer and proactively ask the user if they want to know more about that specific detail.\n4. End your response with a concise open-ended question.";

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
    } catch (error) {
      console.error("Streaming Error:", error);
      yield "Error: Failed to connect to AI engine.";
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
        return { text, model: "Gemini 2.5 Flash (Search)" };
      }

      const modelName = 'gemini-2.0-flash';
      const contents: any[] = history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const parts: any[] = [{ text: prompt }];
      if (imageBase64) {
        parts.push({
          inlineData: {
            data: imageBase64.split(',')[1],
            mimeType: 'image/jpeg'
          }
        });
      }

      contents.push({ role: 'user', parts });

      const systemInstruction = "You are Nexus Justice, a professional legal assistant. Be concise, formal, and helpful. Use legal terminology correctly. If responding in Malayalam, ensure accuracy. Maintain context.";

      const response = await this.ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
          systemInstruction
        }
      });

      return { text: response.text || "I'm sorry, I couldn't generate a response.", model: "Gemini 2.5 Flash" };
    } catch (error: any) {
      console.error("AI Engine Error:", error);
      return { text: "Error: Failed to connect to AI engine.", model: "Error" };
    }
  }

  private async orchestrate(prompt: string): Promise<AITaskType> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
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
        model: 'gemini-2.0-flash',
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

