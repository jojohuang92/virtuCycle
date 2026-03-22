import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceCommand = {
  phrases: string[];
  action: () => void;
  announcement: string;
};

export type VoiceCommandsOptions = {
  /**
   * Automatically restart the mic after each utterance.
   * Only announces "Listening" after a successful command fires —
   * silent no-speech timeouts restart quietly so the user isn't spammed.
   */
  continuous?: boolean;
};

type VoiceCommandsState = {
  listening: boolean;
  lastTranscript: string;
  start: () => void;
  stop: () => void;
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function matchCommand(
  transcript: string,
  commands: VoiceCommand[],
): VoiceCommand | null {
  const normalized = normalize(transcript);
  for (const cmd of commands) {
    for (const phrase of cmd.phrases) {
      if (normalized.includes(normalize(phrase))) return cmd;
    }
  }
  return null;
}

export function useVoiceCommands(
  commands: VoiceCommand[],
  ttsEnabled: boolean,
  options?: VoiceCommandsOptions,
): VoiceCommandsState {
  const [listening, setListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");

  const commandsRef = useRef(commands);
  const ttsRef = useRef(ttsEnabled);
  const continuousRef = useRef(options?.continuous ?? false);
  /** True between start() and stop() */
  const activeRef = useRef(false);
  const mountedRef = useRef(true);
  /** Pending restart timer — cleared if stop() is called or a new one is queued */
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Only true right after a recognised command runs.
   * Controls whether the next restart announces "Listening" or restarts silently.
   */
  const announceNextRestart = useRef(false);

  useEffect(() => { commandsRef.current = commands; }, [commands]);
  useEffect(() => { ttsRef.current = ttsEnabled; }, [ttsEnabled]);
  useEffect(() => { continuousRef.current = options?.continuous ?? false; }, [options?.continuous]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRef.current = false;
      if (restartTimer.current) clearTimeout(restartTimer.current);
    };
  }, []);

  const startRecognition = useCallback(() => {
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: false,
      maxAlternatives: 5,
    });
  }, []);

  /**
   * Schedule a single restart. Cancels any already-pending restart so we
   * never queue two at once.
   */
  const scheduleRestart = useCallback((delayMs = 400) => {
    if (!continuousRef.current || !activeRef.current) return;

    if (restartTimer.current) clearTimeout(restartTimer.current);

    restartTimer.current = setTimeout(() => {
      restartTimer.current = null;
      if (!mountedRef.current || !activeRef.current) return;

      const shouldAnnounce = announceNextRestart.current && ttsRef.current;
      announceNextRestart.current = false;

      if (shouldAnnounce) {
        Speech.speak("Listening", {
          onDone: () => {
            if (mountedRef.current && activeRef.current) startRecognition();
          },
        });
      } else {
        startRecognition();
      }
    }, delayMs);
  }, [startRecognition]);

  // ── Recognition events ──────────────────────────────────────────────────────

  useSpeechRecognitionEvent("start", () => {
    if (mountedRef.current) setListening(true);
  });

  // `end` fires after every session (successful, no-speech, aborted).
  // This is the single place restarts are scheduled.
  useSpeechRecognitionEvent("end", () => {
    if (!mountedRef.current) return;
    setListening(false);
    scheduleRestart();
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (!mountedRef.current) return;
    const transcript = event.results[0]?.transcript ?? "";
    if (!transcript) return;

    setLastTranscript(transcript);

    const matched = matchCommand(transcript, commandsRef.current);
    if (!matched) {
      // Only tell the user in single-shot mode — continuous mode stays quiet
      if (ttsRef.current && !continuousRef.current) {
        Speech.speak("Sorry, I didn't recognise that. Say help for commands.");
      }
      return;
    }

    // A command matched — announce "Listening" on the next restart so the
    // user knows the mic re-opened after acting on their command.
    announceNextRestart.current = true;

    if (ttsRef.current) {
      Speech.speak(matched.announcement, {
        onDone: () => {
          if (mountedRef.current) matched.action();
        },
      });
    } else {
      matched.action();
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!mountedRef.current) return;
    setListening(false);
    // no-speech and aborted are normal in continuous mode — `end` handles restart.
    // Only surface unexpected errors.
    if (event.error !== "no-speech" && event.error !== "aborted" && ttsRef.current) {
      Speech.speak("Voice recognition error.");
    }
  });

  // ── Public API ──────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    const { granted } =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      if (ttsRef.current) Speech.speak("Microphone permission is required.");
      return;
    }

    activeRef.current = true;
    announceNextRestart.current = false; // silent restarts until a command fires

    if (ttsRef.current) {
      // One-time announcement at activation — after this, restarts are silent
      // unless a command was recognised.
      Speech.speak("Voice commands active. Listening.", {
        onDone: () => {
          if (mountedRef.current && activeRef.current) startRecognition();
        },
      });
    } else {
      startRecognition();
    }
  }, [startRecognition]);

  const stop = useCallback(() => {
    activeRef.current = false;
    announceNextRestart.current = false;
    if (restartTimer.current) {
      clearTimeout(restartTimer.current);
      restartTimer.current = null;
    }
    Speech.stop();
    ExpoSpeechRecognitionModule.stop();
    if (mountedRef.current) setListening(false);
  }, []);

  return { listening, lastTranscript, start, stop };
}
