import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";

const EMERGENCY_TYPES = ["emergency", "robbery", "assault", "hit-and-run", "burglary", "theft"];

interface AlarmContextType {
  alarmCount: number;
  refreshAlarm: () => void;
  playBackupAlert: () => void;
}

const AlarmContext = createContext<AlarmContextType | undefined>(undefined);

let audioCtx: AudioContext | null = null;
let emergencyBuffer: AudioBuffer | null = null;
let emergencyLoadPromise: Promise<void> | null = null;
let normalBuffer: AudioBuffer | null = null;
let normalLoadPromise: Promise<void> | null = null;
let backupBuffer: AudioBuffer | null = null;
let backupLoadPromise: Promise<void> | null = null;
let loopSource: AudioBufferSourceNode | null = null;
let loopGain: GainNode | null = null;
let isLooping = false;
const soundedBackupIds = new Set<string>();

// Create AudioContext immediately on module load
try {
  audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
} catch (e) {
  console.warn("[AlarmContext] Failed to create AudioContext:", e);
}

async function ensureEmergencyLoaded(): Promise<void> {
  if (emergencyBuffer) return;
  if (emergencyLoadPromise) return emergencyLoadPromise;
  emergencyLoadPromise = (async () => {
    try {
      const res = await fetch("/emergency_alert.wav");
      const buf = await res.arrayBuffer();
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      emergencyBuffer = await audioCtx.decodeAudioData(buf);
    } catch (e) {
      console.error("Failed to load emergency audio:", e);
    }
  })();
  return emergencyLoadPromise;
}

async function ensureNormalLoaded(): Promise<void> {
  if (normalBuffer) return;
  if (normalLoadPromise) return normalLoadPromise;
  normalLoadPromise = (async () => {
    try {
      const res = await fetch("/normalreport.mp3");
      const buf = await res.arrayBuffer();
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      normalBuffer = await audioCtx.decodeAudioData(buf);
    } catch (e) {
      console.error("Failed to load normal report audio:", e);
    }
  })();
  return normalLoadPromise;
}

async function ensureBackupLoaded(): Promise<void> {
  if (backupBuffer) return;
  if (backupLoadPromise) return backupLoadPromise;
  backupLoadPromise = (async () => {
    try {
      const res = await fetch("/backup_alert.wav");
      const buf = await res.arrayBuffer();
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      backupBuffer = await audioCtx.decodeAudioData(buf);
    } catch (e) {
      console.error("Failed to load backup audio:", e);
    }
  })();
  return backupLoadPromise;
}

async function playBackupBeep() {
  if (!backupBuffer) {
    try { await ensureBackupLoaded(); } catch {}
    if (!backupBuffer) return;
  }
  if (!audioCtx) return;
  try {
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    const source = audioCtx.createBufferSource();
    source.buffer = backupBuffer;
    source.loop = false;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.8;
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start();
  } catch (e) {
    console.warn("[AlarmContext] playBackupBeep failed:", e);
  }
}

function stopLoop() {
  if (!isLooping) return;
  isLooping = false;
  try { loopSource?.stop(); } catch {}
  try { loopSource?.disconnect(); } catch {}
  try { loopGain?.disconnect(); } catch {}
  loopSource = null;
  loopGain = null;
}

function startLoop(buffer: AudioBuffer) {
  if (!audioCtx) return;
  stopLoop();
  try {
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    isLooping = true;
    loopSource = audioCtx.createBufferSource();
    loopSource.buffer = buffer;
    loopSource.loop = true;
    loopGain = audioCtx.createGain();
    loopGain.gain.value = 0.5;
    loopSource.connect(loopGain);
    loopGain.connect(audioCtx.destination);
    loopSource.start();
  } catch (e) {
    console.warn("[AlarmContext] startLoop failed:", e);
    isLooping = false;
  }
}

export function AlarmProvider({ children }: { children: React.ReactNode }) {
  const [alarmCount, setAlarmCount] = useState(0);

  // Preload audio files immediately
  useEffect(() => {
    ensureEmergencyLoaded();
    ensureNormalLoaded();
    ensureBackupLoaded();
  }, []);

  const checkReports = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("crime_reports")
        .select("id, crime_type, status")
        .order("created_at", { ascending: false })
        .limit(50);

      const emergencyCount = (data ?? []).filter(
        (r: any) => EMERGENCY_TYPES.includes(r.crime_type?.toLowerCase()) && r.status === "pending"
      ).length;

      const normalCount = (data ?? []).filter(
        (r: any) => !EMERGENCY_TYPES.includes(r.crime_type?.toLowerCase()) && r.status === "pending"
      ).length;

      const backupReports = (data ?? []).filter(
        (r: any) => r.status === "needs-backup"
      );

      setAlarmCount(emergencyCount);

      if (emergencyCount > 0) {
        if (emergencyBuffer) {
          if (!isLooping || (isLooping && loopSource?.buffer !== emergencyBuffer)) {
            stopLoop();
            startLoop(emergencyBuffer);
          }
        }
      } else if (normalCount > 0) {
        if (normalBuffer) {
          if (!isLooping || (isLooping && loopSource?.buffer !== normalBuffer)) {
            stopLoop();
            startLoop(normalBuffer);
          }
        }
      } else {
        stopLoop();
      }

      const newlySounded = backupReports.some(
        (r: any) => !soundedBackupIds.has(r.id) && r.status === "needs-backup"
      );
      for (const r of backupReports) {
        soundedBackupIds.add(r.id);
      }
      if (newlySounded) {
        playBackupBeep();
      }
    } catch (e) {
      console.error("[AlarmContext] checkReports error:", e);
    }
  }, []);

  // Fallback: try to resume AudioContext on any user interaction
  useEffect(() => {
    const tryResume = () => {
      if (audioCtx?.state === "suspended") {
        audioCtx.resume();
      }
    };
    document.addEventListener("click", tryResume);
    document.addEventListener("touchstart", tryResume);
    return () => {
      document.removeEventListener("click", tryResume);
      document.removeEventListener("touchstart", tryResume);
      stopLoop();
    };
  }, []);

  useEffect(() => {
    checkReports();

    const channel = supabase
      .channel("global-alarm")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crime_reports" }, () => {
        checkReports();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "crime_reports" }, () => {
        checkReports();
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "action_updates" },
        (payload: any) => {
          if (payload.new?.action_type === "backup_requested") {
            playBackupBeep();
          }
          checkReports();
        }
      )
      .subscribe((status: string) => {
        console.log("[AlarmContext] realtime status:", status);
      });

    const poll = window.setInterval(checkReports, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      stopLoop();
    };
  }, [checkReports]);

  return (
    <AlarmContext.Provider value={{ alarmCount, refreshAlarm: checkReports, playBackupAlert: playBackupBeep }}>
      {children}
    </AlarmContext.Provider>
  );
}

export function useAlarm() {
  const context = useContext(AlarmContext);
  if (!context) throw new Error("useAlarm must be used within AlarmProvider");
  return context;
}
