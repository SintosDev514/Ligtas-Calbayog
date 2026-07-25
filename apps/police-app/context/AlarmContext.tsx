import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { Vibration, Platform } from "react-native";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

const EMERGENCY_TYPES = ["emergency", "robbery", "assault", "hit-and-run", "burglary", "theft"];

interface AlarmContextType {
  alertBanner: string | null;
  setAlertBanner: (msg: string | null) => void;
  playEmergencyAlert: (report: any) => void;
  stopAlertForReport: (reportId: string) => void;
  stopAllAlarms: () => void;
  triggerHaptics: () => Promise<void>;
  soundsLoaded: boolean;
}

const AlarmContext = createContext<AlarmContextType | undefined>(undefined);

export function AlarmProvider({ children }: { children: React.ReactNode }) {
  const [alertBanner, setAlertBanner] = useState<string | null>(null);
  const [soundsLoaded, setSoundsLoaded] = useState(false);
  const emergencySoundRef = useRef<Audio.Sound | null>(null);
  const normalSoundRef = useRef<Audio.Sound | null>(null);
  const activeAlertIds = useRef<Set<string>>(new Set());
  const alertTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const audioSetupRunning = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    const load = async () => {
      if (audioSetupRunning.current) return;
      audioSetupRunning.current = true;

      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1,
        });

        try {
          const { sound } = await Audio.Sound.createAsync(
            require("../assets/emergency_alert.wav"),
            { volume: 0.8, shouldPlay: false }
          );
          if (mountedRef.current) emergencySoundRef.current = sound;
        } catch (e) {
          console.error("[AlarmContext] Failed to load emergency sound:", e);
        }

        try {
          const { sound } = await Audio.Sound.createAsync(
            require("../assets/normalreport.mp3"),
            { volume: 0.8, shouldPlay: false }
          );
          if (mountedRef.current) normalSoundRef.current = sound;
        } catch (e) {
          console.error("[AlarmContext] Failed to load normal sound:", e);
        }

        if (mountedRef.current) {
          setSoundsLoaded(true);
          console.log("[AlarmContext] Audio loaded. Emergency:", !!emergencySoundRef.current, "Normal:", !!normalSoundRef.current);
        }
      } catch (e) {
        console.error("[AlarmContext] Audio setup failed:", e);
      } finally {
        audioSetupRunning.current = false;
      }
    };

    load();

    return () => {
      mountedRef.current = false;
      emergencySoundRef.current?.unloadAsync().catch(() => {});
      normalSoundRef.current?.unloadAsync().catch(() => {});
      emergencySoundRef.current = null;
      normalSoundRef.current = null;
    };
  }, []);

  const triggerHaptics = useCallback(async () => {
    try {
      if (Platform.OS === "ios") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await new Promise((r) => setTimeout(r, 400));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await new Promise((r) => setTimeout(r, 400));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        await new Promise((r) => setTimeout(r, 300));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await new Promise((r) => setTimeout(r, 300));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } catch {
      try { Vibration.vibrate([0, 500, 300, 500, 300, 500]); } catch {}
    }
  }, []);

  const isEmergencyType = (crimeType: string | null | undefined) => {
    return EMERGENCY_TYPES.includes(crimeType?.toLowerCase() || "");
  };

  const forcePlaySound = useCallback(async (sound: Audio.Sound) => {
    try {
      await sound.stopAsync();
    } catch {}
    try {
      await sound.setPositionAsync(0);
    } catch {}
    try {
      await sound.setIsLoopingAsync(true);
    } catch {}
    try {
      await sound.setVolumeAsync(0.8);
    } catch {}
    try {
      await sound.playAsync();
    } catch {}
  }, []);

  const stopAllAudio = useCallback(async () => {
    try { Vibration.cancel(); } catch {}

    for (const sound of [emergencySoundRef.current, normalSoundRef.current]) {
      if (!sound) continue;
      try { await sound.setIsLoopingAsync(false); } catch {}
      try { await sound.stopAsync(); } catch {}
      try { await sound.setPositionAsync(0); } catch {}
    }
  }, []);

  const playEmergencyAlert = useCallback((report: any) => {
    if (activeAlertIds.current.has(report.id)) return;
    activeAlertIds.current.add(report.id);
    console.log("[AlarmContext] playEmergencyAlert called for", report.id, "type:", report.crime_type);

    triggerHaptics();

    const label = report.crime_type?.replace(/-/g, " ") || "New report";
    setAlertBanner(`🚨 Emergency: ${label}`);

    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => setAlertBanner(null), 8000);

    const isEmergency = isEmergencyType(report.crime_type);
    const sound = isEmergency ? emergencySoundRef.current : normalSoundRef.current;

    if (sound) {
      forcePlaySound(sound);
    } else {
      console.warn("[AlarmContext] Sound ref not ready for:", label);
    }
  }, [triggerHaptics, forcePlaySound]);

  const stopAlertForReport = useCallback((reportId: string) => {
    activeAlertIds.current.delete(reportId);

    if (activeAlertIds.current.size === 0) {
      stopAllAudio();
      setAlertBanner(null);
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = null;
      }
    }
  }, [stopAllAudio]);

  const stopAllAlarms = useCallback(() => {
    activeAlertIds.current.clear();
    stopAllAudio();
    setAlertBanner(null);
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
      alertTimerRef.current = null;
    }
  }, [stopAllAudio]);

  useEffect(() => {
    return () => {
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
      activeAlertIds.current.clear();
      emergencySoundRef.current?.setIsLoopingAsync(false).catch(() => {});
      emergencySoundRef.current?.stopAsync().catch(() => {});
      normalSoundRef.current?.setIsLoopingAsync(false).catch(() => {});
      normalSoundRef.current?.stopAsync().catch(() => {});
    };
  }, []);

  return (
    <AlarmContext.Provider
      value={{
        alertBanner,
        setAlertBanner,
        playEmergencyAlert,
        stopAlertForReport,
        stopAllAlarms,
        triggerHaptics,
        soundsLoaded,
      }}
    >
      {children}
    </AlarmContext.Provider>
  );
}

export function useAlarm() {
  const context = useContext(AlarmContext);
  if (!context) throw new Error("useAlarm must be used within AlarmProvider");
  return context;
}
