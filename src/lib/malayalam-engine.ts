import { pipeline, env } from "@xenova/transformers";

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

export class MalayalamEngine {
  private static instance: MalayalamEngine;
  private ttsPipeline: any = null;
  private sttPipeline: any = null;
  private isTTSLoading = false;
  private isSTTLoading = false;
  private ttsProgress = 0;
  private sttProgress = 0;

  private constructor() {}

  public static getInstance(): MalayalamEngine {
    if (!MalayalamEngine.instance) {
      MalayalamEngine.instance = new MalayalamEngine();
    }
    return MalayalamEngine.instance;
  }

  public getStatus() {
    return {
      ttsReady: !!this.ttsPipeline,
      sttReady: !!this.sttPipeline,
      ttsProgress: this.ttsProgress,
      sttProgress: this.sttProgress,
      isTTSLoading: this.isTTSLoading,
      isSTTLoading: this.isSTTLoading
    };
  }

  /**
   * Loads the Malayalam TTS model (MMS-TTS-MAL)
   */
  public async loadTTS(onProgress?: (progress: number) => void) {
    if (this.ttsPipeline || this.isTTSLoading) return;

    this.isTTSLoading = true;
    try {
      // MMS-TTS-MAL is a high-quality Malayalam TTS model compatible with Transformers.js
      this.ttsPipeline = await pipeline('text-to-speech', 'Xenova/mms-tts-mal', {
        progress_callback: (data: any) => {
          if (data.status === 'progress') {
            this.ttsProgress = Math.round(data.progress);
            if (onProgress) onProgress(this.ttsProgress);
          }
        }
      });
      this.ttsProgress = 100;
      if (onProgress) onProgress(100);
      console.log("Malayalam TTS Model loaded successfully.");
    } catch (error) {
      console.error("Failed to load Malayalam TTS model:", error);
      this.ttsPipeline = null;
    } finally {
      this.isTTSLoading = false;
    }
  }

  /**
   * Loads the Malayalam STT model (Whisper Tiny)
   */
  public async loadSTT(onProgress?: (progress: number) => void) {
    if (this.sttPipeline || this.isSTTLoading) return;

    this.isSTTLoading = true;
    try {
      // Whisper Tiny is multilingual and performs well for Malayalam
      this.sttPipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
        progress_callback: (data: any) => {
          if (data.status === 'progress') {
            this.sttProgress = Math.round(data.progress);
            if (onProgress) onProgress(this.sttProgress);
          }
        }
      });
      this.sttProgress = 100;
      if (onProgress) onProgress(100);
      console.log("Malayalam STT Model loaded successfully.");
    } catch (error) {
      console.error("Failed to load Malayalam STT model:", error);
      this.sttPipeline = null;
    } finally {
      this.isSTTLoading = false;
    }
  }

  /**
   * Generates Malayalam speech from text
   */
  public async speak(text: string): Promise<AudioBuffer | null> {
    if (!this.ttsPipeline) return null;

    try {
      const output = await this.ttsPipeline(text);
      return output.audio;
    } catch (error) {
      console.error("Malayalam TTS Inference Error:", error);
      return null;
    }
  }

  /**
   * Transcribes Malayalam speech from audio
   */
  public async transcribe(audio: any): Promise<string | null> {
    if (!this.sttPipeline) return null;

    try {
      const output = await this.sttPipeline(audio, {
        language: 'malayalam',
        task: 'transcribe'
      });
      return output.text;
    } catch (error) {
      console.error("Malayalam STT Inference Error:", error);
      return null;
    }
  }

  /**
   * Helper to record audio from microphone for a fixed duration or until stopped
   */
  public async recordAudio(durationMs: number = 5000): Promise<Float32Array | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      const chunks: Float32Array[] = [];
      
      return new Promise((resolve) => {
        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          chunks.push(new Float32Array(inputData));
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        setTimeout(() => {
          stream.getTracks().forEach(t => t.stop());
          processor.disconnect();
          source.disconnect();
          audioContext.close();

          // Combine chunks
          const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
          const result = new Float32Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
          }
          resolve(result);
        }, durationMs);
      });
    } catch (error) {
      console.error("Audio Recording Error:", error);
      return null;
    }
  }
}
