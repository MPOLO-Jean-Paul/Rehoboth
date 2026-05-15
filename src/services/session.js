import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Adaptateur pour supporter le Web (localStorage) et le Mobile (SecureStore)
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

const ACCOUNTS_KEY = 'mdcd_accounts';
const ACTIVE_EMAIL_KEY = 'mdcd_active_email';

export async function saveAuthSession({ token, role, rememberMe, biometricsEnabled, lastUserEmail, lastUserName }) {
  if (token) await storage.setItem('userToken', token);
  if (role) await storage.setItem('userRole', role);
  if (rememberMe !== undefined) await storage.setItem('rememberMe', rememberMe ? 'true' : 'false');
  if (biometricsEnabled !== undefined) await storage.setItem('biometricsEnabled', biometricsEnabled ? 'true' : 'false');
  
  if (lastUserEmail) {
    await storage.setItem(ACTIVE_EMAIL_KEY, lastUserEmail);
    const accountsRaw = await storage.getItem(ACCOUNTS_KEY);
    let accounts = accountsRaw ? JSON.parse(accountsRaw) : [];
    
    // Remove existing entry for this email if it exists
    accounts = accounts.filter(a => a.email !== lastUserEmail);
    
    // Add new/updated account to the top
    accounts.unshift({
      email: lastUserEmail,
      name: lastUserName,
      role: role,
      token: token
    });

    // Limit to 2 accounts
    await storage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, 2)));
  }
}

export async function clearAuthSession({ preserveAccounts = true } = {}) {
  await storage.deleteItem('userToken');
  await storage.deleteItem('userRole');

  if (!preserveAccounts) {
    await storage.deleteItem('rememberMe');
    await storage.deleteItem('biometricsEnabled');
    await storage.deleteItem(ACCOUNTS_KEY);
    await storage.deleteItem(ACTIVE_EMAIL_KEY);
  }
}

export async function getAccounts() {
  const accountsRaw = await storage.getItem(ACCOUNTS_KEY);
  return accountsRaw ? JSON.parse(accountsRaw) : [];
}

export async function loadAuthSession() {
  const [token, role, rememberMe, biometricsEnabled, lastEmail] = await Promise.all([
    storage.getItem('userToken'),
    storage.getItem('userRole'),
    storage.getItem('rememberMe'),
    storage.getItem('biometricsEnabled'),
    storage.getItem(ACTIVE_EMAIL_KEY),
  ]);

  const accounts = await getAccounts();
  const activeAccount = accounts.find(a => a.email === lastEmail) || accounts[0];

  return { 
    token: token || activeAccount?.token, 
    role: role || activeAccount?.role, 
    rememberMe, 
    biometricsEnabled, 
    lastUserEmail: lastEmail || activeAccount?.email, 
    lastUserName: activeAccount?.name,
    accounts
  };
}

export async function setActiveAccount(email) {
  const accounts = await getAccounts();
  const account = accounts.find(a => a.email === email);
  if (account) {
    await storage.setItem(ACTIVE_EMAIL_KEY, email);
    await storage.setItem('userToken', account.token);
    await storage.setItem('userRole', account.role);
    return account;
  }
  return null;
}

export async function removeAccount(email) {
  const accountsRaw = await storage.getItem(ACCOUNTS_KEY);
  let accounts = accountsRaw ? JSON.parse(accountsRaw) : [];
  
  accounts = accounts.filter(a => a.email !== email);
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  
  const activeEmail = await storage.getItem(ACTIVE_EMAIL_KEY);
  if (activeEmail === email) {
    await storage.deleteItem(ACTIVE_EMAIL_KEY);
    await storage.deleteItem('userToken');
    await storage.deleteItem('userRole');
  }
}

