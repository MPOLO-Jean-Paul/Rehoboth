import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Service de stockage persistant pour les données de l'application
 * Permet un chargement instantané (SWR - Stale While Revalidate)
 */
class Storage {
  /**
   * Sauvegarde des données avec un tag spécifique
   */
  async save(key, data) {
    try {
      const payload = {
        data,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(`@rehoboth_cache_${key}`, JSON.stringify(payload));
      return true;
    } catch (e) {
      console.log(`[Storage] Save Error (${key}):`, e);
      return false;
    }
  }

  /**
   * Récupère les données cachées
   */
  async get(key) {
    try {
      const raw = await AsyncStorage.getItem(`@rehoboth_cache_${key}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.data;
    } catch (e) {
      console.log(`[Storage] Get Error (${key}):`, e);
      return null;
    }
  }

  /**
   * Supprime une clé spécifique
   */
  async remove(key) {
    try {
      await AsyncStorage.removeItem(`@rehoboth_cache_${key}`);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Nettoie tout le cache
   */
  async clear() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith('@rehoboth_cache_'));
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
      return true;
    } catch (e) {
      return false;
    }
  }
}

export default new Storage();
