import React, { createContext, useState, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import NetInfo from '@react-native-community/netinfo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { View, Text, ActivityIndicator, Image, StyleSheet, Animated, Easing, StatusBar, Dimensions, Platform, useColorScheme } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider, useToast } from './src/components/ToastManager';
import SyncManager from './src/services/SyncManager';
import { translations } from './src/i18n/translations';
import api from './src/services/api';
import { loadAuthSession, clearAuthSession } from './src/services/session';
import { Theme } from './src/constants/theme';
import { registerForPushNotificationsAsync, savePushToken, sendLocalNotification, Notifications } from './src/services/notifications';
import { registerBackgroundSync } from './src/services/BackgroundSyncService';
import { resolveNotificationTarget } from './src/services/notificationNavigation';

export const navigationRef = createNavigationContainerRef();

// Import Screens
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import AdminDashboard from './src/screens/AdminScreen';
import ReceptionScreen from './src/screens/ReceptionScreen';
import CashierScreen from './src/screens/CashierScreen';
import DoctorScreen from './src/screens/DoctorScreen';
import LaboScreen from './src/screens/LaboScreen';
import PharmacyScreen from './src/screens/PharmacyScreen';
import SoinsScreen from './src/screens/SoinsScreen';
import MaternityScreen from './src/screens/MaternityScreen';
import NotificationScreen from './src/screens/NotificationScreen';
import StaffMessagesScreen from './src/screens/StaffMessagesScreen';
import RoleGuard from './src/components/RoleGuard';
import GlobalErrorBoundary from './src/components/GlobalErrorBoundary';


export const AppContext = createContext();

const Stack = createNativeStackNavigator();

export default function App() {
  const [themeMode, setThemeMode] = useState('system'); // default to system
  const [lang, setLang] = useState('fr');
  const [isOnline, setIsOnline] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [initialRoute, setInitialRoute] = useState(null);
  const [pendingNotification, setPendingNotification] = useState(null);
  const [user, setUser] = useState(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.75)).current;
  const titleSlide = useRef(new Animated.Value(30)).current;
  const titleFade = useRef(new Animated.Value(0)).current;
  const badgeFade = useRef(new Animated.Value(0)).current;
  const progressFade = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.5)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.3)).current;
  const seenNotificationIds = useRef(new Set());
  const notificationPollReady = useRef(false);

  useEffect(() => {
    if (!initialRoute) {
      // Step 1: Logo bursts in
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      ]).start(() => {
        // Step 2: Title slides up
        Animated.parallel([
          Animated.timing(titleFade, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(titleSlide, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start(() => {
          // Step 3: Badge + progress appear
          Animated.parallel([
            Animated.timing(badgeFade, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(progressFade, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(progressAnim, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          ]).start();
        });
      });

      // Pulsing rings (Heartbeat pattern)
      const ringLoop = (scaleRef, opacityRef, delay) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            // First pulse
            Animated.parallel([
              Animated.timing(scaleRef, { toValue: 1.6, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(opacityRef, { toValue: 0.4, duration: 200, useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(scaleRef, { toValue: 1.2, duration: 400, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
              Animated.timing(opacityRef, { toValue: 0.1, duration: 400, useNativeDriver: true }),
            ]),
            // Second pulse (the "lub-dub")
            Animated.parallel([
              Animated.timing(scaleRef, { toValue: 1.8, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(opacityRef, { toValue: 0.5, duration: 200, useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(scaleRef, { toValue: 2.2, duration: 1000, easing: Easing.out(Easing.sin), useNativeDriver: true }),
              Animated.timing(opacityRef, { toValue: 0, duration: 1000, useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(scaleRef, { toValue: 1, duration: 0, useNativeDriver: true }),
              Animated.timing(opacityRef, { toValue: 0, duration: 0, useNativeDriver: true }),
            ]),
            Animated.delay(1000),
          ])
        ).start();
      };
      ringLoop(ring1Scale, ring1Opacity, 0);
      ringLoop(ring2Scale, ring2Opacity, 1200);
    }
    return () => {
      fadeAnim.stopAnimation();
      scaleAnim.stopAnimation();
      titleFade.stopAnimation();
      titleSlide.stopAnimation();
      badgeFade.stopAnimation();
      progressFade.stopAnimation();
      progressAnim.stopAnimation();
      ring1Scale.stopAnimation();
      ring1Opacity.stopAnimation();
      ring2Scale.stopAnimation();
      ring2Opacity.stopAnimation();
    };
  }, [initialRoute]);

  // Global Context Colors
  const systemScheme = useColorScheme();
  const resolvedDark = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';
  const colors = resolvedDark ? Theme.colors.dark : Theme.colors.light;

  useEffect(() => {
    checkInitialAuth();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isNowOnline = Boolean(state.isConnected);

      setIsOnline(prev => {
        if (!prev && isNowOnline) {
          handleReconnection();
        }
        return isNowOnline;
      });
    });

    // Initialisation silencieuse: certains builds/appareils refusent le background fetch natif.
    registerBackgroundSync();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!Notifications) return;

    let notificationListener;
    let responseListener;

    const setupNotifications = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          await savePushToken(token);
        }
      } catch (e) {
        console.log('[REHOBOTH] Notification setup failed:', e);
      }
    };

    // Register push token as soon as user is logged in
    if (initialRoute && initialRoute !== 'Home' && initialRoute !== 'Login') {
      setupNotifications();
    }

    // Show notification banner when app is in FOREGROUND
    notificationListener = Notifications.addNotificationReceivedListener(notification => {
      const { title, body, data } = notification.request.content;
      if (data?.__localEcho) return;

      console.log('[REHOBOTH] Notification reçue:', title);
      // Re-schedule as local notification so it shows in the system tray even in foreground
      sendLocalNotification(title, body, { ...(data ?? {}), __localEcho: true });
    });

    // Handle tap on notification → navigate to relevant screen
    responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      handleNotificationNavigation(data);
    });

    return () => {
      if (notificationListener) notificationListener.remove();
      if (responseListener) responseListener.remove();
    };
  }, [initialRoute]);

  useEffect(() => {
    seenNotificationIds.current = new Set();
    notificationPollReady.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (!Notifications || !notificationsEnabled || !user || !initialRoute || initialRoute === 'Home' || initialRoute === 'Login') {
      return;
    }

    let isMounted = true;

    const pollServerNotifications = async () => {
      try {
        const response = await api.get('/notifications');
        const notifications = Array.isArray(response.data) ? response.data : [];

        const unreadNotifications = notifications.filter(item => !item.is_read);
        const incomingIds = new Set(unreadNotifications.map(item => item.id));

        if (!notificationPollReady.current) {
          seenNotificationIds.current = incomingIds;
          notificationPollReady.current = true;
          return;
        }

        for (const item of unreadNotifications.reverse()) {
          if (!isMounted || seenNotificationIds.current.has(item.id)) continue;

          seenNotificationIds.current.add(item.id);
          await sendLocalNotification(
            item.title || 'REHOBOTH',
            item.body || 'Nouvelle notification',
            { ...(item.data ?? {}), notification_id: item.id, type: item.type, __localEcho: true },
            item.type === 'emergency' ? 'medical-alerts' : 'default'
          );
        }
      } catch (e) {
        if (__DEV__) {
          console.log('[REHOBOTH] Poll notifications ignoré:', e?.message || e);
        }
      }
    };

    pollServerNotifications();
    const interval = setInterval(pollServerNotifications, 20000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [initialRoute, notificationsEnabled, user?.id]);

  // Process pending notification once we are logged in and navigation is ready
  useEffect(() => {
    if (initialRoute && initialRoute !== 'Home' && initialRoute !== 'Login' && pendingNotification) {
      const timer = setTimeout(() => {
        handleNotificationNavigation(pendingNotification);
        setPendingNotification(null);
      }, 1000); // Wait for screen to mount
      return () => clearTimeout(timer);
    }
  }, [initialRoute, pendingNotification]);

  const handleNotificationNavigation = (data) => {
    if (!data) return;

    if (!navigationRef.isReady() || !initialRoute || initialRoute === 'Home' || initialRoute === 'Login') {
      console.log('Navigation not ready or not logged in, queuing notification');
      setPendingNotification(data);
      return;
    }

    const target = resolveNotificationTarget(data, data.role || user?.role);
    navigationRef.navigate(target.route, target.params);
  };

  const checkInitialAuth = async () => {
    const startTime = Date.now();
    try {
      const { token, role, rememberMe, lastUserEmail, lastUserName, isExpired } = await loadAuthSession();
      let targetRoute = 'Home';

      const routeMap = {
        'admin':     'AdminDashboard',
        'reception': 'Reception',
        'caisse':    'Cashier',
        'medecin':   'DoctorDashboard',
        'labo':      'LaboDashboard',
        'pharmacie': 'PharmacyDashboard',
        'soins':     'SoinsDashboard',
        'maternite': 'MaternityDashboard',
      };

      if (token && rememberMe === 'true' && !isExpired) {
        try {
          const networkState = await NetInfo.fetch();
          if (networkState.isConnected) {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            const userRes = await api.get('/user');
            setUser(userRes.data);
            targetRoute = routeMap[userRes.data.role] || 'Home';
          } else {
            setUser({ name: lastUserName, email: lastUserEmail, role });
            targetRoute = routeMap[role] || 'Home';
          }
        } catch (authError) {
          if (authError?.response?.status === 401) {
            await clearAuthSession({ preserveAccounts: true });
          } else {
            setUser({ name: lastUserName, email: lastUserEmail, role });
            targetRoute = routeMap[role] || 'Home';
          }
        }
      } else {
        // Session expirée ou sans rememberMe : effacer token mais garder les comptes
        await clearAuthSession({ preserveAccounts: true });
      }

      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 1500 - elapsedTime);
      setTimeout(() => setInitialRoute(targetRoute), remainingTime);

    } catch (e) {
      setTimeout(() => setInitialRoute('Home'), 3000);
    }
  };

  const handleReconnection = async () => {
    const queueSize = await SyncManager.getQueueLength();
    if (queueSize > 0) {
      // Note: On ne peut pas appeler useToast ici car c'est hors du ToastProvider
      // Donc la sync se fait silencieusement ou via un log, 
      // ou on attend que l'utilisateur soit sur un écran.
      await SyncManager.processQueue();
    }
  };

  const toggleTheme = () => setThemeMode(prev => prev === 'light' ? 'dark' : 'light');
  const toggleLang = () => setLang(prev => prev === 'fr' ? 'en' : 'fr');
  const toggleNotifications = () => setNotificationsEnabled(prev => !prev);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return lang === 'fr' ? 'BONJOUR' : 'GOOD MORNING';
    if (hour < 18) return lang === 'fr' ? 'BON APRÈS-MIDI' : 'GOOD AFTERNOON';
    return lang === 'fr' ? 'BONSOIR' : 'GOOD EVENING';
  };

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617' }}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        
        <LinearGradient 
          colors={['#020617', '#0F172A', '#1E293B']} 
          style={styles.bootScreen}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Background Decorative Glows - Optimized for smooth feel */}
          <Animated.View style={{ position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: '#1E1B4B', opacity: 0.3, transform: [{ scale: ring1Scale }] }} />
          <Animated.View style={{ position: 'absolute', bottom: -80, left: -80, width: 250, height: 250, borderRadius: 125, backgroundColor: '#312E81', opacity: 0.2, transform: [{ scale: ring2Scale }] }} />

          {/* CENTER CONTENT */}
          <View style={{ alignItems: 'center', width: '100%', paddingBottom: 60 }}>

            {/* LOGO with pulsing rings */}
            <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center', marginBottom: 50 }}>
              <View style={{ alignItems: 'center', justifyContent: 'center', width: 220, height: 220 }}>
                <Animated.View style={[
                  styles.ring,
                  { transform: [{ scale: ring1Scale }], opacity: ring1Opacity, borderColor: Theme.colors.primary, borderWidth: 1 }
                ]} />
                <Animated.View style={[
                  styles.ring,
                  { transform: [{ scale: ring2Scale }], opacity: ring2Opacity, borderColor: 'rgba(255, 255, 255, 0.1)' }
                ]} />
                
                <View style={[styles.glassContainer, { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.15)' }]}>
                  <Image source={require('./assets/logo.png')} style={{ width: 88, height: 88 }} resizeMode="contain" />
                </View>
              </View>
            </Animated.View>

            {/* BRAND NAME & GREETING */}
            <Animated.View style={{ opacity: titleFade, transform: [{ translateY: titleSlide }], alignItems: 'center', width: '100%' }}>
              <Text style={{ color: Theme.colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 4, marginBottom: 8 }}>{getGreeting()}</Text>
              <Text style={[styles.bootTitle, { color: '#FFFFFF', letterSpacing: 8, fontWeight: '900' }]}>REHOBOTH</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, opacity: 0.4 }}>
                <View style={{ height: 1, width: 20, backgroundColor: '#FFF' }} />
                <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '700', letterSpacing: 3, marginHorizontal: 12 }}>MEDICAL CENTER</Text>
                <View style={{ height: 1, width: 20, backgroundColor: '#FFF' }} />
              </View>
            </Animated.View>

            {/* PROGRESS AREA */}
            <Animated.View style={[styles.progressContainer, { opacity: progressFade, marginTop: 70 }]}>
              <View style={[styles.progressBg, { height: 4, backgroundColor: 'rgba(255, 255, 255, 0.05)', overflow: 'hidden' }]}>
                <Animated.View style={[styles.progressBar, {
                  width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  backgroundColor: Theme.colors.primary
                }]} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
                <ActivityIndicator size="small" color={Theme.colors.primary} style={{ transform: [{ scale: 0.7 }], marginRight: 8 }} />
                <Text style={[styles.bootSubtitle, { color: 'rgba(255, 255, 255, 0.4)' }]}>
                   {lang === 'fr' ? 'PRÉPARATION DE VOTRE ESPACE...' : 'PREPARING YOUR WORKSPACE...'}
                </Text>
              </View>
            </Animated.View>
          </View>

          {/* FOOTER */}
          <View style={[styles.bootFooter, { bottom: 50 }]}>
            <Animated.View style={{ opacity: badgeFade, alignItems: 'center' }}>
               <Text style={[styles.footerText, { color: 'rgba(255, 255, 255, 0.3)', marginBottom: 4 }]}>V2.5 ELITE EDITION</Text>
               <View style={{ height: 1, width: 100, backgroundColor: 'rgba(255, 255, 255, 0.05)' }} />
            </Animated.View>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <GlobalErrorBoundary>
      <SafeAreaProvider>
      <AppContext.Provider value={{ 
        themeMode, setThemeMode, toggleTheme, 
        lang, setLang, toggleLang, 
        colors, isOnline, 
        notificationsEnabled, toggleNotifications,
        user, setUser
      }}>
        <ToastProvider>
          <NavigationContainer ref={navigationRef}>
            <Stack.Navigator 
              initialRouteName={initialRoute}
              screenOptions={{ 
                headerShown: false,
                animation: 'fade_from_bottom',
                animationDuration: 350,
              }}
            >
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              
              <Stack.Screen name="AdminDashboard">
                {props => <RoleGuard allowedRoles={['admin']}><AdminDashboard {...props} /></RoleGuard>}
              </Stack.Screen>

              <Stack.Screen name="Reception">
                {props => <RoleGuard allowedRoles={['admin', 'reception', 'soins']}><ReceptionScreen {...props} /></RoleGuard>}
              </Stack.Screen>

              <Stack.Screen name="Cashier">
                {props => <RoleGuard allowedRoles={['admin', 'caisse']}><CashierScreen {...props} /></RoleGuard>}
              </Stack.Screen>

              <Stack.Screen name="DoctorDashboard">
                {props => <RoleGuard allowedRoles={['admin', 'medecin']}><DoctorScreen {...props} /></RoleGuard>}
              </Stack.Screen>

              <Stack.Screen name="LaboDashboard">
                {props => <RoleGuard allowedRoles={['admin', 'labo']}><LaboScreen {...props} /></RoleGuard>}
              </Stack.Screen>

              <Stack.Screen name="PharmacyDashboard">
                {props => <RoleGuard allowedRoles={['admin', 'pharmacie']}><PharmacyScreen {...props} /></RoleGuard>}
              </Stack.Screen>

              <Stack.Screen name="SoinsDashboard">
                {props => <RoleGuard allowedRoles={['admin', 'soins']}><SoinsScreen {...props} /></RoleGuard>}
              </Stack.Screen>

              <Stack.Screen name="MaternityDashboard">
                {props => <RoleGuard allowedRoles={['admin', 'maternite', 'soins', 'medecin']}><MaternityScreen {...props} /></RoleGuard>}
              </Stack.Screen>

              <Stack.Screen name="Notification" component={NotificationScreen} options={{ headerShown: false }} />
              <Stack.Screen name="StaffMessages" component={StaffMessagesScreen} options={{ headerShown: false }} />
            </Stack.Navigator>
          </NavigationContainer>
        </ToastProvider>
      </AppContext.Provider>
    </SafeAreaProvider>
    </GlobalErrorBoundary>
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  ring: {
    position: 'absolute',
    width: Math.min(Dimensions.get('window').width * 0.35, 130),
    height: Math.min(Dimensions.get('window').width * 0.35, 130),
    borderRadius: Math.min(Dimensions.get('window').width * 0.35, 130) / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'transparent',
  },
  glassContainer: {
    width: Math.min(Dimensions.get('window').width * 0.3, 120),
    height: Math.min(Dimensions.get('window').width * 0.3, 120),
    borderRadius: Math.min(Dimensions.get('window').width * 0.3, 120) * 0.3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
  },
  bootTitle: {
    fontSize: Math.min(Dimensions.get('window').width * 0.09, 36),
    fontWeight: '900',
    letterSpacing: Math.min(Dimensions.get('window').width * 0.015, 6), // More conservative spacing
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
    textAlign: 'center',
    width: '100%', // Ensure it uses full width for centering
  },
  bootMedical: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
    textAlign: 'center',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
    marginRight: 8,
    shadowColor: '#4ADE80',
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  progressContainer: {
    marginTop: 56,
    width: '100%',
    alignItems: 'center',
  },
  progressBg: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'visible',
    marginBottom: 16,
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 2,
  },
  progressTip: {
    position: 'absolute',
    top: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF',
    shadowColor: '#FFF',
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 5,
  },
  bootSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  bootFooter: {
    position: 'absolute',
    bottom: 44,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 1.5,
  }
});
