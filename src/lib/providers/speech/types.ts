/** Speech provider abstractions. Swappable for ElevenLabs/OpenAI/Google later. */

export interface SttResult {
  transcript: string;
  isFinal: boolean;
}

export interface SpeechToTextProvider {
  readonly kind: string;
  readonly available: boolean;
  start(opts: {
    lang: string;
    onResult: (r: SttResult) => void;
    onError: (e: string) => void;
    onEnd: () => void;
  }): void;
  stop(): void;
}

export interface TtsOptions {
  lang: string;
  rate: number;
  volume: number;
  voiceName?: string | null;
  onStart?: () => void;
  /** Fires at browser-reported word/sentence boundaries when supported. */
  onBoundary?: () => void;
  onEnd?: () => void;
}

export interface TextToSpeechProvider {
  readonly kind: string;
  readonly available: boolean;
  speak(text: string, opts: TtsOptions): void;
  cancel(): void;
  listVoices(): { name: string; lang: string }[];
}
