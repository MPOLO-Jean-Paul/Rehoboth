import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
// NOTE: api is imported lazily inside processQueue to avoid circular dependency
// (SyncManager → api → SyncManager)

const SYNC_QUEUE_KEY = '@rehoboth_sync_queue';

class SyncManager {
  /**
   * Ajoute une action à la file d'attente locale
   * @param {Object} action { url, method, data, headers }
   */
  async enqueueAction(action) {
    try {
      const queueStr = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      const queue = queueStr ? JSON.parse(queueStr) : [];
      const headers = action.headers || {};
      
      const newAction = {
        ...action,
        headers: {
          'Content-Type': headers['Content-Type'] || headers['content-type'] || 'application/json',
          Accept: headers.Accept || headers.accept || 'application/json',
          ...(headers['Idempotency-Key'] ? { 'Idempotency-Key': headers['Idempotency-Key'] } : {}),
        },
        id: Date.now().toString(),
        timestamp: new Date().toISOString()
      };
      
      queue.push(newAction);
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Traite la file d'attente dès que la connexion revient
   */
  async processQueue(onProgress) {
    try {
      const state = await NetInfo.fetch();
      if (!state.isConnected) return;

      const queueStr = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (!queueStr) return;

      let queue = JSON.parse(queueStr);
      if (queue.length === 0) return;

      const remainingQueue = [];
      for (const action of queue) {
        try {
          // Lazy-load api to avoid circular dependency at module initialization
          const api = require('./api').default;
          await api({
            url: action.url,
            method: action.method,
            data: action.data,
            headers: action.headers
          });
          if (onProgress) onProgress(action);
        } catch (e) {
          remainingQueue.push(action);
        }
      }

      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remainingQueue));
      return remainingQueue.length === 0;
    } catch (e) {
      return false;
    }
  }

  async getQueueLength() {
    const queueStr = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    if (!queueStr) return 0;
    return JSON.parse(queueStr).length;
  }
}

export default new SyncManager();
