"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ENABLED_STORAGE_KEY = "inkbranch.ambient.enabled";
const VOLUME_STORAGE_KEY = "inkbranch.ambient.volume";
const DEFAULT_VOLUME = 0.08;
const MIN_VOLUME = 0.02;
const MAX_VOLUME = 0.24;

function clampVolume(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_VOLUME;
  }

  return Math.min(Math.max(value, MIN_VOLUME), MAX_VOLUME);
}

export function AmbientPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasTrackError, setHasTrackError] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  const source = useMemo(
    () => process.env.NEXT_PUBLIC_AMBIENT_AUDIO_SRC?.trim() || "/audio/ambient.mp3",
    [],
  );

  const clearFadeTimer = useCallback(() => {
    if (!fadeTimerRef.current) {
      return;
    }

    clearInterval(fadeTimerRef.current);
    fadeTimerRef.current = null;
  }, []);

  const fadeTo = useCallback((targetVolume: number, onComplete?: () => void) => {
    const audio = audioRef.current;

    if (!audio) {
      onComplete?.();
      return;
    }

    clearFadeTimer();

    const boundedTarget = clampVolume(targetVolume);
    const startVolume = Math.max(audio.volume, 0);

    if (Math.abs(startVolume - boundedTarget) < 0.005) {
      audio.volume = boundedTarget;
      onComplete?.();
      return;
    }

    const step = boundedTarget > startVolume ? 0.01 : -0.01;
    fadeTimerRef.current = setInterval(() => {
      const current = audio.volume;
      const next = current + step;
      const reachedTarget =
        (step > 0 && next >= boundedTarget) || (step < 0 && next <= boundedTarget);

      if (reachedTarget) {
        audio.volume = boundedTarget;
        clearFadeTimer();
        onComplete?.();
        return;
      }

      audio.volume = Math.max(0, Math.min(1, next));
    }, 45);
  }, [clearFadeTimer]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedEnabled = window.localStorage.getItem(ENABLED_STORAGE_KEY) === "1";
      const storedVolumeRaw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
      const storedVolume = storedVolumeRaw
        ? Number.parseFloat(storedVolumeRaw)
        : DEFAULT_VOLUME;

      setIsEnabled(storedEnabled);
      setVolume(clampVolume(storedVolume));
      setHasHydrated(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    window.localStorage.setItem(ENABLED_STORAGE_KEY, isEnabled ? "1" : "0");
  }, [hasHydrated, isEnabled]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    window.localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
  }, [hasHydrated, volume]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !hasHydrated || hasTrackError) {
      return;
    }

    audio.loop = true;

    if (!isEnabled) {
      if (audio.paused) {
        return;
      }

      fadeTo(0, () => {
        const currentAudio = audioRef.current;
        if (!currentAudio) {
          return;
        }

        currentAudio.pause();
        setIsPlaying(false);
      });
      return;
    }

    const startPlayback = async () => {
      try {
        if (!audio.paused) {
          fadeTo(volume);
          return;
        }

        audio.volume = 0;
        await audio.play();
        setIsPlaying(true);
        fadeTo(volume);
      } catch {
        setIsEnabled(false);
        setIsPlaying(false);
      }
    };

    void startPlayback();
  }, [fadeTo, hasHydrated, hasTrackError, isEnabled, volume]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    const handlePlaying = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      clearFadeTimer();
      setHasTrackError(true);
      setIsEnabled(false);
      setIsPlaying(false);
    };

    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
    };
  }, [clearFadeTimer]);

  useEffect(() => {
    return () => {
      clearFadeTimer();
    };
  }, [clearFadeTimer]);

  return (
    <div className="w-full max-w-[290px] rounded-2xl border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-3 shadow-sm">
      <audio ref={audioRef} src={source} preload="none" />

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs tracking-[0.12em] text-[var(--ink-muted)] uppercase">
          Ambient Audio
        </p>
        <button
          type="button"
          onClick={() => setIsEnabled((current) => !current)}
          className="rounded-full border border-[var(--parchment-border)] px-3 py-1 text-xs font-semibold text-[var(--ink)] transition hover:bg-white/70"
        >
          {isEnabled ? (isPlaying ? "Pause" : "Play") : "Off"}
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <label
          htmlFor="ambient-volume"
          className="text-[11px] font-semibold tracking-[0.08em] text-[var(--ink-muted)] uppercase"
        >
          Vol
        </label>
        <input
          id="ambient-volume"
          type="range"
          min={MIN_VOLUME}
          max={MAX_VOLUME}
          step={0.01}
          value={volume}
          onChange={(event) => setVolume(clampVolume(Number.parseFloat(event.target.value)))}
          disabled={hasTrackError}
          className="h-2 w-full accent-[var(--ink)] disabled:opacity-50"
        />
        <span className="w-9 text-right text-xs text-[var(--ink-muted)]">
          {Math.round(volume * 100)}%
        </span>
      </div>

      {hasTrackError ? (
        <p className="mt-2 text-xs text-amber-800">
          Add your music file at <code>/public/audio/ambient.mp3</code>.
        </p>
      ) : (
        <p className="mt-2 text-xs text-[var(--ink-muted)]">
          Subtle loop for reading and writing sessions.
        </p>
      )}
    </div>
  );
}
