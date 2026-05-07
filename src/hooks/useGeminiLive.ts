import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { float32ToInt16PCM, int16PCMToFloat32, SAMPLE_RATE, OUTPUT_SAMPLE_RATE, createAudioContext } from '../lib/audio-utils';

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export function useGeminiLive() {
  const isConnectedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextStartTimeRef = useRef(0);

  const playQueuedAudio = useCallback(async () => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) return;

    // Ensure context is running
    if (audioContextRef.current.state === 'suspended') {
      try { await audioContextRef.current.resume(); } catch (e) {}
    }

    while (audioQueueRef.current.length > 0) {
      const chunk = audioQueueRef.current.shift()!;
      const buffer = audioContextRef.current.createBuffer(1, chunk.length, OUTPUT_SAMPLE_RATE);
      buffer.getChannelData(0).set(chunk);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);

      const now = audioContextRef.current.currentTime;
      const startTime = Math.max(now, nextStartTimeRef.current);
      
      source.start(startTime);
      nextStartTimeRef.current = startTime + buffer.duration;
      
      setIsModelSpeaking(true);

      source.onended = () => {
        if (audioContextRef.current && audioContextRef.current.currentTime >= nextStartTimeRef.current - 0.1) {
          setIsModelSpeaking(false);
        }
      };
    }
  }, []);

  const disconnect = useCallback(() => {
    setError(null);
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch(e) {}
      sessionRef.current = null;
    }
    isConnectedRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsConnected(false);
    setVolume(0);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const connect = useCallback(async () => {
    if (isConnected || isConnecting) return;
    setIsConnecting(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      try {
        audioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      } catch (e) {
        console.warn("Could not force 16kHz sample rate, using default:", e);
        audioContextRef.current = new AudioContextClass();
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `You are Nexus, a highly advanced polyglot legal AI voice assistant expert in Indian Law. 
You are fluent in Malayalam, Hindi, Tamil, Telugu, Kannada, and English.
If the user speaks in any of these languages, respond fluently in that same language.
Your goal is to be helpful, concise, and professional. Use legal terminology correctly. 
You handle interruptions naturally. Keep your responses brief and helpful.`,
        },
        callbacks: {
          onopen: () => {
            isConnectedRef.current = true;
            setIsConnected(true);
            setIsConnecting(false);
            console.log("Gemini Live connection established");
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn) {
              const parts = message.serverContent.modelTurn.parts;
              for (const part of parts) {
                if (part.inlineData?.data) {
                  const audioData = int16PCMToFloat32(part.inlineData.data);
                  audioQueueRef.current.push(audioData);
                  
                  // Reset nextStartTime if it's too far in the past
                  if (audioContextRef.current && nextStartTimeRef.current < audioContextRef.current.currentTime) {
                    nextStartTimeRef.current = audioContextRef.current.currentTime;
                  }
                  
                  playQueuedAudio();
                }
                if (part.text) {
                  setMessages(prev => [...prev, { role: 'model', text: part.text!, timestamp: Date.now() }]);
                }
              }
            }

            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              nextStartTimeRef.current = 0;
              setIsModelSpeaking(false);
            }
          },
          onclose: () => {
            isConnectedRef.current = false;
            setIsConnected(false);
            setIsConnecting(false);
            console.log("Gemini Live closed");
          },
          onerror: (error: any) => {
            console.error("Gemini Live error:", error);
            let rawMsg = "";
            if (typeof error === 'string') rawMsg = error;
            else if (error?.message) rawMsg = error.message;
            else if (error?.error?.message) rawMsg = error.error.message;
            else if (error instanceof ErrorEvent) rawMsg = error.message;
            else rawMsg = JSON.stringify(error);

            let errorMessage = "An unexpected error occurred.";
            
            if (rawMsg.includes("Resource has been exhausted")) {
              errorMessage = "API Quota exceeded. Please try again later or check your Gemini API plan.";
            } else if (rawMsg.includes("Network error") || rawMsg.includes("Failed to fetch") || rawMsg.includes("WebSocket")) {
              errorMessage = "Network connection failed. Please check your internet connection and try again.";
            } else if (rawMsg.includes("UNAVAILABLE")) {
              errorMessage = "The AI service is currently unavailable. Please try again in a few moments.";
            } else {
              errorMessage = rawMsg;
            }
            
            setError(errorMessage);
            setIsConnecting(false);
            isConnectedRef.current = false;
            setIsConnected(false);
          }
        }
      });

      sessionRef.current = session;

      // Start microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      streamRef.current = stream;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate volume for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        setVolume(Math.sqrt(sum / inputData.length));

        // Send audio to Gemini
        if (isConnectedRef.current && sessionRef.current) {
          const pcmData = float32ToInt16PCM(inputData);
          sessionRef.current.sendRealtimeInput({
            audio: { 
              data: pcmData, 
              mimeType: `audio/pcm;rate=${audioContextRef.current?.sampleRate || 16000}` 
            }
          });
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

    } catch (e: any) {
      console.error("Failed to connect:", e);
      let rawMsg = "";
      if (typeof e === 'string') rawMsg = e;
      else if (e?.message) rawMsg = e.message;
      else if (e?.error?.message) rawMsg = e.error.message;
      else rawMsg = String(e);

      let msg = "Failed to establish connection.";
      if (rawMsg.includes("Resource has been exhausted")) {
        msg = "API Quota exceeded. Please try again later.";
      } else if (rawMsg.includes("Network error") || rawMsg.includes("Failed to fetch") || rawMsg.includes("WebSocket")) {
        msg = "Network connection failed. Please check your internet connection.";
      } else if (rawMsg.includes("UNAVAILABLE")) {
        msg = "The AI service is temporarily unavailable. Please try again later.";
      } else {
        msg = rawMsg;
      }
      setError(msg);
      setIsConnecting(false);
    }
  }, [isConnected, isConnecting, playQueuedAudio]);

  const sendVideoFrame = useCallback((base64Data: string) => {
    if (isConnectedRef.current && sessionRef.current) {
      sessionRef.current.sendRealtimeInput({
        video: {
          mimeType: 'image/jpeg',
          data: base64Data
        }
      });
    }
  }, []);

  return {
    isConnected,
    isConnecting,
    messages,
    isModelSpeaking,
    volume,
    connect,
    disconnect,
    sendVideoFrame,
    error,
    resetError: () => setError(null)
  };
}
