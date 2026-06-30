import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "ligtas_cache_";
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

export async function getCached(key) {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    return { data, fresh: Date.now() - timestamp < CACHE_DURATION };
  } catch {
    return null;
  }
}

export async function setCache(key, data) {
  try {
    await AsyncStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch {}
}

export async function clearCache(key) {
  try {
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
  } catch {}
}

export async function clearAllCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
  } catch {}
}
