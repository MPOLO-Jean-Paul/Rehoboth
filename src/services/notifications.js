import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import api from './api';

let Notifications = null;
const EAS_PROJECT_ID = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;

// expo-notifications works in Expo Go since SDK 53 on both iOS and Android
try {
  Notifications = require('expo-notifications');

  // This handler ensures notifications show as banners even when the app is FOREGROUND
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  console.log('Failed to load expo-notifications:', e);
}

export async function registerForPushNotificationsAsync() {
  if (!Notifications) return null;

  let token;

  try {
    if (Platform.OS === 'android') {
      // Default channel (standard alerts)
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Alertes Générales',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00529B',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });

      // High-priority medical alerts channel
      await Notifications.setNotificationChannelAsync('medical-alerts', {
        name: 'Alertes Médicales',
        description: 'Notifications urgentes pour les professionnels de santé',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#EF4444',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        bypassDnd: true, // Bypass Do Not Disturb for emergencies
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('[Rehoboth] Permission notifications refusée.');
        return null;
      }

      const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
      if (isExpoGo) {
        // In Expo Go we can get a local device push token (for local notifications)
        // but not a real Expo push token without a project. We return null gracefully.
        console.log('[Rehoboth] Expo Go détecté — token push limité.');
        return null;
      }

      try {
        token = (await Notifications.getExpoPushTokenAsync({
          projectId: EAS_PROJECT_ID,
        })).data;
        console.log('[Rehoboth] Push Token enregistré:', token);
      } catch (firebaseError) {
        console.log('[Rehoboth] Firebase non configuré pour le Dev Client. Push ignoré en dev.');
        return null;
      }
    } else {
      console.log('[Rehoboth] Appareil virtuel — notifications push non supportées.');
    }
  } catch (error) {
    console.log('[Rehoboth] Erreur enregistrement token push:', error.message || error);
  }

  return token;
}

export async function savePushToken(token) {
  if (!token) return;
  try {
    await api.post('/user/push-token', { token });
    console.log('[Rehoboth] Token push sauvegardé sur le serveur.');
  } catch (error) {
    if (__DEV__ && false) {
      console.log('[Rehoboth] Sauvegarde token push ignorée:', error?.message || error);
    }
  }
}

/**
 * Trigger a local notification immediately (no server needed).
 * Works in both Expo Go and production builds.
 */
export async function sendLocalNotification(title, body, data = {}, channelId = 'default') {
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger: null, // null = fire immediately
    });
  } catch (e) {
    console.log('[Rehoboth] Erreur notification locale:', e);
  }
}

export { Notifications };
