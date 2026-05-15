import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ─── Storage Adapter (Web + Mobile) ────────────────────────────────────────────
const storage = {
  getItem: async (key) => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key, value) => {
    if (Platform.OS === 'web') return localStorage.setItem(key, value);
    return SecureStore.setItemAsync(key, value);
  },
  deleteItem: async (key) => {
    if (Platform.OS === 'web') return localStorage.removeItem(key);
    return SecureStore.deleteItemAsync(key);
  }
};

const ACCOUNTS_KEY    = 'mdcd_accounts';
const ACTIVE_KEY      = 'mdcd_active_email';
const SESSION_EXPIRY  = 24 * 60 * 60 * 1000; // 24 heures en ms

// ─── Helpers ────────────────────────────────────────────────────────────────────
function isExpired(savedAt) {
  if (!savedAt) return true;
  return (Date.now() - savedAt) > SESSION_EXPIRY;
}

// ─── Save Auth Session ──────────────────────────────────────────────────────────
export async function saveAuthSession({ token, role, rememberMe, biometricsEnabled, lastUserEmail, lastUserName }) {
  if (token)  await storage.setItem('userToken', token);
  if (role)   await storage.setItem('userRole', role);
  if (rememberMe     !== undefined) await storage.setItem('rememberMe', rememberMe ? 'true' : 'false');
  if (biometricsEnabled !== undefined) await storage.setItem('biometricsEnabled', biometricsEnabled ? 'true' : 'false');

  if (lastUserEmail && token && role) {
    await storage.setItem(ACTIVE_KEY, lastUserEmail);

    const accountsRaw = await storage.getItem(ACCOUNTS_KEY);
    let accounts = accountsRaw ? JSON.parse(accountsRaw) : [];

    // Supprimer l'entrée existante pour cet email
    accounts = accounts.filter(a => a.email !== lastUserEmail);

    // Ajouter le compte mis à jour en premier
    accounts.unshift({
      email:   lastUserEmail,
      name:    lastUserName || lastUserEmail.split('@')[0],
      role:    role,
      token:   token,
      savedAt: Date.now(),  // ⏱️ Horodatage pour l'expiration
    });

    // Limiter à 3 comptes max
    await storage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, 3)));
  }
}

// ─── Clear Auth Session ─────────────────────────────────────────────────────────
export async function clearAuthSession({ preserveAccounts = true } = {}) {
  await storage.deleteItem('userToken');
  await storage.deleteItem('userRole');

  if (!preserveAccounts) {
    await storage.deleteItem('rememberMe');
    await storage.deleteItem('biometricsEnabled');
    await storage.deleteItem(ACCOUNTS_KEY);
    await storage.deleteItem(ACTIVE_KEY);
  }
}

// ─── Get All Accounts (non expirés) ────────────────────────────────────────────
export async function getAccounts() {
  const accountsRaw = await storage.getItem(ACCOUNTS_KEY);
  if (!accountsRaw) return [];

  const accounts = JSON.parse(accountsRaw);

  // Filtrer les comptes expirés (> 24h)
  const valid = accounts.filter(a => !isExpired(a.savedAt));

  // Si des comptes ont expiré, mettre à jour le stockage
  if (valid.length !== accounts.length) {
    await storage.setItem(ACCOUNTS_KEY, JSON.stringify(valid));
  }

  return valid;
}

// ─── Load Auth Session ──────────────────────────────────────────────────────────
export async function loadAuthSession() {
  const accounts = await getAccounts();

  const [token, role, rememberMe, biometricsEnabled, activeEmail] = await Promise.all([
    storage.getItem('userToken'),
    storage.getItem('userRole'),
    storage.getItem('rememberMe'),
    storage.getItem('biometricsEnabled'),
    storage.getItem(ACTIVE_KEY),
  ]);

  // Trouver le compte actif parmi les comptes valides
  const activeAccount = accounts.find(a => a.email === activeEmail) || accounts[0] || null;

  // Vérifier si le token global est expiré (si le compte actif est expiré)
  const tokenExpired = activeAccount ? isExpired(activeAccount.savedAt) : true;

  return {
    token:          tokenExpired ? null : (token || activeAccount?.token),
    role:           tokenExpired ? null : (role  || activeAccount?.role),
    rememberMe,
    biometricsEnabled,
    lastUserEmail:  activeAccount?.email || null,
    lastUserName:   activeAccount?.name  || null,
    accounts,
    isExpired:      tokenExpired,
  };
}

// ─── Switch Account ─────────────────────────────────────────────────────────────
// Charge et active un compte sauvegardé — retourne le compte complet (email, role, token)
export async function setActiveAccount(email) {
  const accounts = await getAccounts();
  const account  = accounts.find(a => a.email === email);

  if (!account) return null;

  // Vérifier l'expiration avant d'activer
  if (isExpired(account.savedAt)) {
    // Supprimer le compte expiré
    await removeAccount(email);
    return null;
  }

  await storage.setItem(ACTIVE_KEY, email);
  await storage.setItem('userToken', account.token);
  await storage.setItem('userRole',  account.role);

  return account; // Retourne { email, name, role, token, savedAt }
}

// ─── Remove Account ─────────────────────────────────────────────────────────────
export async function removeAccount(email) {
  const accountsRaw = await storage.getItem(ACCOUNTS_KEY);
  let accounts = accountsRaw ? JSON.parse(accountsRaw) : [];

  accounts = accounts.filter(a => a.email !== email);
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

  const activeEmail = await storage.getItem(ACTIVE_KEY);
  if (activeEmail === email) {
    await storage.deleteItem(ACTIVE_KEY);
    await storage.deleteItem('userToken');
    await storage.deleteItem('userRole');
  }
}
