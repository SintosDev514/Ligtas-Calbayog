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
  triggerHaptics: () => Promise<void>;
  soundsLoaded: boolean;
}

const AlarmContext = createContext<AlarmContextType | undefined>(undefined);

export function AlarmProvider({ children }: { children: React.ReactNode }) {
  const [alertBanner, setAlertBanner] = useState<string | null>(null);
  const emergencySoundRef = useRef<Audio.Sound | null>(null);
  const normalSoundRef = useRef<Audio.Sound | null>(null);
  const soundsLoaded = useRef(false);
  const activeAlertIds = useRef<Set<string>>(new Set());
  const alertTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let mounted = true;
    const instances: Audio.Sound[] = [];

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1,
        });

        const [emergencyResult, normalResult] = await Promise.all([
          Audio.Sound.createAsync(
            require("../assets/emergency_alert.wav"),
            { volume: 0.5, shouldPlay: false, rate: 1.0 }
          ),
          Audio.Sound.createAsync(
            require("../assets/normalreport.mp3"),
            { volume: 0.5, shouldPlay: false, rate: 1.0 }
          ),
        ]);

        instances.push(emergencyResult.sound, normalResult.sound);

        if (mounted) {
          emergencySoundRef.current = emergencyResult.sound;
          normalSoundRef.current = normalResult.sound;
          soundsLoaded.current = true;
        } else {
          instances.forEach((s) => s.unloadAsync().catch(() => {}));
        }
      } catch (e) {
        console.error("[AlarmContext] Audio setup failed:", e);
      }
    })();

    return () => {
      mounted = false;
      instances.forEach((s) => {
        s.stopAsync().catch(() => {});
        s.unloadAsync().catch(() => {});
      });
      emergencySoundRef.current = null;
      normalSoundRef.current = null;
      soundsLoaded.current = false;
    };
  }, []);

  const triggerHaptics = async () => {
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
    } catch (e) {
      try { Vibration.vibrate([0, 500, 300, 500, 300, 500]); } catch (_) {}
    }
  };

  const isEmergencyType = (crimeType: string | null | undefined) => {
    return EMERGENCY_TYPES.includes(crimeType?.toLowerCase() || "");
  };

  const playEmergencyAlert = useCallback(async (report: any) => {
    if (activeAlertIds.current.has(report.id)) return;
    activeAlertIds.current.add(report.id);

    triggerHaptics();

    const label = report.crime_type?.replace(/-/g, " ") || "New report";
    setAlertBanner(`🚨 Emergency: ${label}`);

    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => setAlertBanner(null), 8000);

    const isEmergency = isEmergencyType(report.crime_type);
    const sound = isEmergency ? emergencySoundRef.current : normalSoundRef.current;

    if (sound && soundsLoaded.current) {
      try {
        await sound.stopAsync().catch(() => {});
        await sound.setPositionAsync(0).catch(() => {});
        await sound.setIsLoopingAsync(true);
        await sound.playAsync();
      } catch (e) {
        console.warn("[AlarmContext] Audio playback failed:", e);
      }
    }
  }, []);

  const stopAlertForReport = useCallback(async (reportId: string) => {
    if (!activeAlertIds.current.has(reportId)) return;
    activeAlertIds.current.delete(reportId);

    if (activeAlertIds.current.size === 0) {
      try { Haptics.selectionAsync(); } catch (_) {}
      try { Vibration.cancel(); } catch (_) {}

      try {
        if (emergencySoundRef.current) {
          await emergencySoundRef.current.stopAsync().catch(() => {});
          await emergencySoundRef.current.setPositionAsync(0).catch(() => {});
          await emergencySoundRef.current.setIsLoopingAsync(false).catch(() => {});
        }
        if (normalSoundRef.current) {
          await normalSoundRef.current.stopAsync().catch(() => {});
          await normalSoundRef.current.setPositionAsync(0).catch(() => {});
          await normalSoundRef.current.setIsLoopingAsync(false).catch(() => {});
        }
      } catch (e) {
        console.warn("[AlarmContext] Stop audio failed:", e);
      }
    }

    setAlertBanner(null);
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
      alertTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
      emergencySoundRef.current?.stopAsync().catch(() => {});
      emergencySoundRef.current?.setIsLoopingAsync(false).catch(() => {});
      normalSoundRef.current?.stopAsync().catch(() => {});
      normalSoundRef.current?.setIsLoopingAsync(false).catch(() => {});
      activeAlertIds.current.clear();
    };
  }, []);

  return (
    <AlarmContext.Provider
      value={{
        alertBanner,
        setAlertBanner,
        playEmergencyAlert,
        stopAlertForReport,
        triggerHaptics,
        soundsLoaded: soundsLoaded.current,
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
