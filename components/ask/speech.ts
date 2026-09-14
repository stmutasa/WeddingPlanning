/**
 * Minimal typing for the browser speech API. It is not in lib.dom for every
 * TS version, it is prefixed on WebKit, and it is absent on most desktop
 * Firefox — so the mic button only renders when `speechRecognition()`
 * returns something (DESIGN.md §6: "mic, as DoneX").
 */
export interface SpeechResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

export interface SpeechEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResultLike };
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type SpeechConstructor = new () => SpeechRecognitionLike;

export function speechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechConstructor;
    webkitSpeechRecognition?: SpeechConstructor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = "en-GB";
  recognition.continuous = false;
  recognition.interimResults = true;
  return recognition;
}
