import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import SyncManager from './SyncManager';
import { clearAuthSession } from './session';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.32.147.63/polyclique-api/public/api';
if (__DEV__) {
  console.log('--- API URL UTILISÉE :', API_URL);
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  },
  timeout: 60000 
});


// Retry automatique sur erreur réseau ou 503 (serveur temporairement indisponible)
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const OFFLINE_QUEUE_ALLOWED_PATHS = [
  '/notifications/',
  '/messages/',
];

const createIdempotencyKey = () => {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${random}`;
};

const canQueueOffline = (url = '') => {
  return OFFLINE_QUEUE_ALLOWED_PATHS.some((path) => url.includes(path));
};

const logApiWarning = (label, details) => {
  if (__DEV__) {
    console.warn(label, details);
  }
};


// Intercepteur pour charger le Token d'authentification
api.interceptors.request.use(
  async (config) => {
    // ⚠️ CRITICAL: Never send an old token during a login attempt
    // Some backends reject login requests if an invalid Authorization header is present.
    if (config.url.endsWith('/login')) {
      return config;
    }

    const token = await SecureStore.getItemAsync('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const method = (config.method || 'get').toLowerCase();
    if (method !== 'get' && !config.headers['Idempotency-Key']) {
      config.headers['Idempotency-Key'] = createIdempotencyKey();
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Intercepteur pour gérer le mode Hors-Ligne
 * Si une requête POST/PUT/DELETE échoue à cause du réseau, on la met en attente.
 */
api.interceptors.response.use(
  (response) => response,

  async (error) => {

    const errResponse = error.response;
    const config = error.config;
    const message = error.message;
    const isLoginAttempt = config?.url === '/login';
    const isExpectedLoginFailure = isLoginAttempt && [401, 404, 422].includes(errResponse?.status);

    // --- RETRY AUTOMATIQUE (réseau instable ou serveur mutualisé lent) ---
    const isNetworkError = !errResponse || message === 'Network Error' || error.code === 'ECONNABORTED';
    const isServerUnavailable = errResponse?.status === 503 || errResponse?.status === 502;
    const shouldRetry = (isNetworkError || isServerUnavailable) && config && !config._retryCount;

    if (shouldRetry) {
      config._retryCount = (config._retryCount || 0) + 1;
      if (config._retryCount <= MAX_RETRIES) {
        logApiWarning(`--- RETRY ${config._retryCount}/${MAX_RETRIES} :`, config.url);
        await sleep(RETRY_DELAY_MS * config._retryCount);
        return api(config);
      }
    }
    // --- FIN RETRY ---

    if (errResponse?.status === 401 && config?.url !== '/login') {
      if (errResponse.data?.message !== 'Unauthenticated.') {
        logApiWarning('--- AVERTISSEMENT API :', errResponse.data || message);
      }
      await clearAuthSession();
    } else if (!isExpectedLoginFailure) {
      logApiWarning('--- AVERTISSEMENT API :', errResponse?.data || message);
    }

    // Si c'est une erreur de connexion et ce n'est pas un GET
    const isMutation = config && config.method !== 'get' && !config.url?.includes('/login');

    if (isNetworkError && isMutation && canQueueOffline(config.url)) {
      await SyncManager.enqueueAction({
        url: config.url,
        method: config.method,
        data: JSON.parse(config.data || '{}'),
        headers: config.headers
      });

      const queuedError = new Error('Action mise en attente hors-ligne. Elle sera synchronisee au retour du reseau.');
      queuedError.offlineQueued = true;
      return Promise.reject(queuedError);
    }

    return Promise.reject(error);
  }
);

export default api;
