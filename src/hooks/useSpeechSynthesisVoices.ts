import { useEffect, useState } from "react";

/**
 * Trimmed vs. MAIN: upstream reads the synth via a shared `browserSpeech`
 * util (`getBrowserSpeechSynthesis`) that also powers the desktop assistant,
 * Calculator speech, and Books read-aloud — none of which exist in this
 * fork. The one-line accessor is inlined here instead of porting that whole
 * module for a single trivial call.
 */
function getBrowserSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

/**
 * Browser speechSynthesis voices, sorted by language then name.
 * Voice lists load asynchronously on some engines (Chrome), so this
 * re-reads on `voiceschanged`.
 */
export function useSpeechSynthesisVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const synth = getBrowserSpeechSynthesis();
    if (!synth) return;
    const load = () => {
      const next = [...synth.getVoices()].sort(
        (a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name)
      );
      setVoices(next);
    };
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, []);

  return voices;
}
