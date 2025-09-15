import { useRef, useState } from "react";

export function useTTS() {
  const audioRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);

  async function speakText(text) {
    try {
      // Stop any previous audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      // Fetch audio from your TTS endpoint
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      // Create a new audio element
      const newAudio = new Audio(url);
      newAudio.muted = isMuted;
      audioRef.current = newAudio;

      // Play (requires user interaction)
      await newAudio.play().catch((err) => {
        console.warn("Audio play blocked:", err);
      });
    } catch (err) {
      console.error("TTS error:", err);
    }
  }

  function toggleMute() {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.muted = next;
      }
      return next;
    });
  }

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }

  return { speakText, toggleMute, stopAudio, isMuted };
}
