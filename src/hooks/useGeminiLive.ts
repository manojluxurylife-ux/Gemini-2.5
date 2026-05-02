import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { float32ToInt16PCM, int16PCMToFloat32, SAMPLE_RATE, createAudioContext } from '../lib/audio-utils';

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export function useGeminiLive() {
  const isConnectedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
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

  const playQueuedAudio = useCallback(() => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0 || isPlayingRef.current) return;

    isPlayingRef.current = true;
    const chunk = audioQueueRef.current.shift()!;
    const buffer = audioContextRef.current.createBuffer(1, chunk.length, audioContextRef.current.sampleRate);
    buffer.getChannelData(0).set(chunk);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);

    const startTime = Math.max(audioContextRef.current.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;

    source.onended = () => {
      isPlayingRef.current = false;
      if (audioQueueRef.current.length > 0) {
        playQueuedAudio();
      } else {
        setIsModelSpeaking(false);
      }
    };
  }, []);

  const disconnect = useCallback(() => {
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

    try {
      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY!,
        apiVersion: "v1beta"
      });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      });
      
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: "You are Nexus, a highly advanced legal AI voice assistant. Your goal is to be helpful, concise, and professional. Use legal terminology correctly. You handle interruptions naturally. Keep your responses brief.",
        },
        callbacks: {
          onopen: () => {
            isConnectedRef.current = true;
            setIsConnected(true);
            setIsConnecting(false);
            console.log("Gemini Live connection established");
          },
          onmessage: async (message: LiveServerMessage) => {
            console.log("Gemini Live message received:", message);
            if (message.serverContent?.modelTurn) {
              const parts = message.serverContent.modelTurn.parts;
              for (const part of parts) {
                if (part.inlineData?.data) {
                  const audioData = int16PCMToFloat32(part.inlineData.data);
                  audioQueueRef.current.push(audioData);
                  setIsModelSpeaking(true);
                  playQueuedAudio();
                }
                if (part.text) {
                  setMessages(prev => [...prev, { role: 'model', text: part.text!, timestamp: Date.now() }]);
                }
              }
            }

            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              isPlayingRef.current = false;
              setIsModelSpeaking(false);
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            isConnectedRef.current = false;
            setIsConnected(false);
            setIsConnecting(false);
            console.log("Gemini Live closed");
          },
          onerror: (error) => {
            console.error("Gemini Live error:", error);
            if (error instanceof ErrorEvent) {
              console.error("ErrorEvent message:", error.message);
            }
            setIsConnecting(false);
          }
        }
      });

      sessionRef.current = session;

      // Start microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
            audio: { data: pcmData, mimeType: `audio/pcm;rate=${SAMPLE_RATE}` }
          });
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

    } catch (error) {
      console.error("Failed to connect:", error);
      setIsConnecting(false);
    }
  }, [isConnected, isConnecting, playQueuedAudio]);

  return {
    isConnected,
    isConnecting,
    messages,
    isModelSpeaking,
    volume,
    connect,
    disconnect
  };
}
