// Local persistence wrapper.
//
// Mirrors the async { value } shape the app was originally written against
// (Claude's window.storage), so call sites read `result.value`. This keeps the
// component code unchanged and makes the later Expo port a drop-in swap:
// replace the localStorage calls below with AsyncStorage.
export const storage = {
  async get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? null : { value: raw };
    } catch (e) {
      console.error("storage.get failed", key, e);
      return null;
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error("storage.set failed", key, e);
    }
  },
};
