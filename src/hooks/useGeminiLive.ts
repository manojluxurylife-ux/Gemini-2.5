import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { float32ToInt16PCM, int16PCMToFloat32, SAMPLE_RATE, OUTPUT_SAMPLE_RATE, createAudioContext } from '../lib/audio-utils';
import { MalayalamEngine } from '../lib/malayalam-engine';

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

  // Mute audio state and reference to prevent local playout
  const [muteAudio, setMuteAudio] = useState(false);
  const muteAudioRef = useRef(false);

  // Whisper STT states and references
  const [useWhisperSTT, setUseWhisperSTT] = useState(true); // Enabled by default as per request
  const [whisperProgress, setWhisperProgress] = useState(0);
  const [isWhisperLoading, setIsWhisperLoading] = useState(false);
  const [isWhisperReady, setIsWhisperReady] = useState(false);
  const [isWhisperTranscribing, setIsWhisperTranscribing] = useState(false);

  const useWhisperSTTRef = useRef(true);
  const isModelSpeakingRef = useRef(false);
  const userSpeechBufferRef = useRef<Float32Array[]>([]);
  const silenceStartRef = useRef<number | null>(null);
  const isUserSpeakingRef = useRef<boolean>(false);
  const isTranscribingRef = useRef<boolean>(false);

  // Sync state variables to refs to ensure closure safety in audio thread callbacks
  useEffect(() => {
    useWhisperSTTRef.current = useWhisperSTT;
  }, [useWhisperSTT]);

  useEffect(() => {
    isModelSpeakingRef.current = isModelSpeaking;
  }, [isModelSpeaking]);

  useEffect(() => {
    muteAudioRef.current = muteAudio;
  }, [muteAudio]);

  // Periodic status checking of Malayalam/Whisper Engine readiness
  useEffect(() => {
    const checkStatus = () => {
      const engine = MalayalamEngine.getInstance();
      const status = engine.getStatus();
      setIsWhisperReady(status.sttReady);
    };
    checkStatus();
    const interval = setInterval(checkStatus, 1500);
    return () => clearInterval(interval);
  }, []);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextStartTimeRef = useRef(0);

  const loadWhisperSTT = useCallback(async (force = false) => {
    const engine = MalayalamEngine.getInstance();
    if (engine.getStatus().sttReady && !force) {
      setIsWhisperReady(true);
      return;
    }

    setIsWhisperLoading(true);
    try {
      await engine.loadSTT((progress) => {
        setWhisperProgress(progress);
      });
      setIsWhisperReady(true);
    } catch (err) {
      console.error("Failed to load local Whisper STT model:", err);
    } finally {
      setIsWhisperLoading(false);
    }
  }, []);

  const transcribeCollectedAudio = useCallback(async () => {
    if (isTranscribingRef.current || userSpeechBufferRef.current.length === 0) return;

    isTranscribingRef.current = true;
    setIsWhisperTranscribing(true);

    try {
      const chunks = userSpeechBufferRef.current;
      userSpeechBufferRef.current = []; // Clear immediately to avoid multiple transcriptions

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      if (totalLength < 4000) { // Under 0.25 sec of audio, discard
        return;
      }

      const audioToTranscribe = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        audioToTranscribe.set(chunk, offset);
        offset += chunk.length;
      }

      const engine = MalayalamEngine.getInstance();
      if (!engine.getStatus().sttReady) {
        await engine.loadSTT();
      }

      console.log(`[Whisper STT] Transcribing user audio segment of ${audioToTranscribe.length} samples locally...`);
      const text = await engine.transcribe(audioToTranscribe, 'auto');

      if (text && text.trim()) {
        const cleanedText = text.trim();
        console.log("[Whisper STT] Result text:", cleanedText);
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          // Prevent duplicates if native STT also returns identical text
          if (lastMsg && lastMsg.role === 'user' && (lastMsg.text === cleanedText || lastMsg.text.includes(cleanedText))) {
            return prev;
          }
          return [...prev, { role: 'user', text: cleanedText, timestamp: Date.now() }];
        });
      }
    } catch (e) {
      console.error("[Whisper STT] Local Whisper transcription failed:", e);
    } finally {
      isTranscribingRef.current = false;
      setIsWhisperTranscribing(false);
    }
  }, []);

  const playQueuedAudio = useCallback(async () => {
    if (muteAudioRef.current) {
      audioQueueRef.current = [];
      return;
    }
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

    // Reset Whisper buffers and state flags
    userSpeechBufferRef.current = [];
    isUserSpeakingRef.current = false;
    silenceStartRef.current = null;
    isTranscribingRef.current = false;
    setIsWhisperTranscribing(false);
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
    setMessages([]); // Start fresh with empty messages on connection

    // Pre-emptively load local Whisper model if enabled and not ready
    if (useWhisperSTTRef.current) {
      const engine = MalayalamEngine.getInstance();
      if (!engine.getStatus().sttReady) {
        try {
          await loadWhisperSTT();
        } catch (e) {
          console.warn("[Whisper STT] Lazy-load postponed or failed:", e);
        }
      }
    }

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
            // 1. Capture User Turn Transcription
            if ((message.serverContent as any)?.userTurn) {
              const parts = (message.serverContent as any).userTurn.parts;
              for (const part of parts) {
                if (part.text) {
                  setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.role === 'user') {
                      const updated = [...prev];
                      const existingText = lastMsg.text;
                      const newSegment = part.text!;
                      
                      let mergedText = existingText;
                      if (!existingText.includes(newSegment)) {
                        mergedText = existingText + " " + newSegment;
                      }
                      
                      updated[updated.length - 1] = {
                        ...lastMsg,
                        text: mergedText.trim().replace(/\s+/g, ' ')
                      };
                      return updated;
                    } else {
                      return [...prev, { role: 'user', text: part.text!, timestamp: Date.now() }];
                    }
                  });
                }
              }
            }

            // 2. Capture Model Turn Audio & Text Transcription
            if (message.serverContent?.modelTurn) {
              const parts = message.serverContent.modelTurn.parts;
              for (const part of parts) {
                if (part.inlineData?.data && !muteAudioRef.current) {
                  const audioData = int16PCMToFloat32(part.inlineData.data);
                  audioQueueRef.current.push(audioData);
                  
                  // Reset nextStartTime if it's too far in the past
                  if (audioContextRef.current && nextStartTimeRef.current < audioContextRef.current.currentTime) {
                    nextStartTimeRef.current = audioContextRef.current.currentTime;
                  }
                  
                  playQueuedAudio();
                }
                if (part.text) {
                  setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.role === 'model') {
                      const updated = [...prev];
                      const existingText = lastMsg.text;
                      const newSegment = part.text!;
                      
                      let mergedText = existingText;
                      if (!existingText.endsWith(newSegment)) {
                        mergedText = existingText + newSegment;
                      }
                      
                      updated[updated.length - 1] = {
                        ...lastMsg,
                        text: mergedText
                      };
                      return updated;
                    } else {
                      return [...prev, { role: 'model', text: part.text!, timestamp: Date.now() }];
                    }
                  });
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
        const currentVol = Math.sqrt(sum / inputData.length);
        setVolume(currentVol);

        // Prevent feedback loop / two ladies talking if the local speechSynthesis is actively speaking
        const isSystemSpeechSpeaking = typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking;

        // Send audio to Gemini
        if (isConnectedRef.current && sessionRef.current && !isSystemSpeechSpeaking) {
          const pcmData = float32ToInt16PCM(inputData);
          sessionRef.current.sendRealtimeInput({
            audio: { 
              data: pcmData, 
              mimeType: `audio/pcm;rate=${audioContextRef.current?.sampleRate || 16000}` 
            }
          });
        }

        // Whisper STT processing
        if (useWhisperSTTRef.current) {
          // If model is speaking or system speech is talking, don't capture audio (prevent feedback loop)
          if (isModelSpeakingRef.current || isSystemSpeechSpeaking) {
            userSpeechBufferRef.current = [];
            isUserSpeakingRef.current = false;
            silenceStartRef.current = null;
            return;
          }

          // Volume threshold for speech detection
          const voiceThreshold = 0.012; 
          
          if (currentVol > voiceThreshold) {
            // User is actively speaking
            isUserSpeakingRef.current = true;
            silenceStartRef.current = null;
            
            // Limit buffer size to prevent memory issues (max ~30 seconds)
            const currentTotalSamples = userSpeechBufferRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
            if (currentTotalSamples < 480000) {
              userSpeechBufferRef.current.push(new Float32Array(inputData));
            }
          } else {
            // User is silent or paused
            if (isUserSpeakingRef.current) {
              if (silenceStartRef.current === null) {
                silenceStartRef.current = Date.now();
              } else if (Date.now() - silenceStartRef.current > 1500) {
                // Silence has lasted more than 1.5 seconds. User probably finished speaking!
                transcribeCollectedAudio();
                isUserSpeakingRef.current = false;
                silenceStartRef.current = null;
              } else {
                // Still accumulating some background samples before confirming silence
                userSpeechBufferRef.current.push(new Float32Array(inputData));
              }
            }
          }
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
  }, [isConnected, isConnecting, playQueuedAudio, loadWhisperSTT, transcribeCollectedAudio]);

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
    resetError: () => setError(null),
    
    // Mute control
    muteAudio,
    setMuteAudio,
    
    // Whisper-specific exports
    useWhisperSTT,
    setUseWhisperSTT,
    whisperProgress,
    isWhisperLoading,
    isWhisperReady,
    isWhisperTranscribing,
    loadWhisperSTT
  };
}
