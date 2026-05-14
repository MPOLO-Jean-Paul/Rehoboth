import React, { useState, useContext, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Platform, KeyboardAvoidingView, Image, Animated, Easing, Alert, ScrollView, Dimensions, StatusBar, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import tw from 'twrnc';
import api from '../services/api';
import { AppContext } from '../../App';
import { ToastContext } from '../components/ToastManager';
import { PressableScale, FadeInView } from '../components/AnimatedComponents';
import { translations } from '../i18n/translations';
import { saveAuthSession, loadAuthSession, setActiveAccount } from '../services/session';
import { registerForPushNotificationsAsync, savePushToken } from '../services/notifications';
import * as LocalAuthentication from 'expo-local-authentication';

import { useTheme } from '../hooks/useTheme';

const { width } = Dimensions.get('window');

const getLoginFeedback = (error, lang) => {
  const status = error.response?.status;
  const serverMessage = error.response?.data?.message;
  const lowerMessage = String(serverMessage || '').toLowerCase();
  const hasTechnicalServerMessage =
    lowerMessage.includes('erreur interne') ||
    lowerMessage.includes('internal') ||
    lowerMessage.includes('server error') ||
    lowerMessage.includes('exception');

  if (status === 401) {
    return {
      message: lang === 'en' ? 'Invalid email or password.' : 'Identifiant ou mot de passe incorrect.',
      type: 'warning',
    };
  }

  if (status === 404) {
    return {
      message: lang === 'en' ? 'Account not found.' : 'Compte introuvable.',
      type: 'warning',
    };
  }

  if (status === 422) {
    return {
      message: lang === 'en' ? 'Please check the information entered.' : 'Vérifiez les informations saisies.',
      type: 'warning',
    };
  }

  if (status === 429) {
    return {
      message: lang === 'en' ? 'Too many attempts. Try again later.' : 'Trop de tentatives. Réessayez plus tard.',
      type: 'warning',
    };
  }

  if (serverMessage && !hasTechnicalServerMessage) {
    return { message: serverMessage, type: 'warning' };
  }

  return {
    message: lang === 'en'
      ? 'Connection unavailable for the moment. Please try again shortly.'
      : 'Connexion indisponible pour le moment. Réessayez dans un instant.',
    type: 'warning',
  };
};

export default function LoginScreen({ navigation }) {
  const { setUser } = useContext(AppContext);
  const { themeMode, lang, brandColor, C } = useTheme();
  const { showToast } = useContext(ToastContext);
  const insets = useSafeAreaInsets();
  const t = translations[lang] || translations.fr;
  
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';
  const isSmallScreen = width < 380;
  const formWidth = Math.min(width - 40, 430);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [biometricsChecked, setBiometricsChecked] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState(null); 
  const [hasStoredSession, setHasStoredSession] = useState(false);
  const [storedUser, setStoredUser] = useState(null);

  // Logo entrance: fade + slide up + scale
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  // Shimmer pulse on logo icon
  const shimmer = useRef(new Animated.Value(0)).current;
  // Back button fade
  const backFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkBiometrics();
    checkStoredSession();
    
    // Stagger: back button first, then logo
    Animated.sequence([
      Animated.timing(backFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(logoTranslateY, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      ])
    ]).start();

    // Continuous gentle shimmer pulse on logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const checkBiometrics = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        setIsBiometricSupported(true);
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        setBiometricType(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? 'face' : 'fingerprint');
      }
    } finally {
      setBiometricsChecked(true);
    }
  };

  const checkStoredSession = async () => {
    const session = await loadAuthSession();
    if (session.token && session.lastUserEmail && session.biometricsEnabled === 'true') {
      setHasStoredSession(true);
      setStoredUser(session);
      if (!email && session.lastUserEmail) {
        setEmail(session.lastUserEmail);
      }
    } else {
      setHasStoredSession(false);
      setStoredUser(null);
    }
  };

  const handleBiometricLogin = async () => {
    const session = await loadAuthSession();
    if (!session.token || !session.role) {
      showToast("Veuillez vous connecter normalement une première fois.", "info");
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t.biometricPrompt || 'Authentification requise',
      fallbackLabel: 'Utiliser le mot de passe',
      disableDeviceFallback: false,
    });

    if (result.success) {
      await setActiveAccount(session.lastUserEmail);
      setUser({
        name: session.lastUserName,
        email: session.lastUserEmail,
        role: session.role,
      });
      showToast(t.success || "Connecté", "success");
      navigateToDashboard(session.role);
    }
  };

  const navigateToDashboard = (role) => {
    const routeMap = {
      admin: 'AdminDashboard',
      reception: 'Reception',
      caisse: 'Cashier',
      medecin: 'DoctorDashboard',
      labo: 'LaboDashboard',
      pharmacie: 'PharmacyDashboard',
      soins: 'SoinsDashboard',
      maternite: 'MaternityDashboard',
    };

    const targetRoute = routeMap[role] || 'Home';
    navigation.reset({
      index: 0,
      routes: [{ name: targetRoute }],
    });
  };

  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.22] });

  const handleLogin = async () => {
    setLoading(true);
    
    // Nettoyage des credentials (espaces invisibles fréquents sur mobile)
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password; // On ne trim pas le mot de passe (les espaces peuvent être intentionnels)

    try {
      console.log(`[Login] Tentative pour: ${cleanEmail} sur ${api.defaults.baseURL}`);

      // 🛑 Reset complet des headers pour éviter tout conflit de session précédente
      delete api.defaults.headers.common['Authorization'];
      // Si vous utilisez des cookies (InfinityFree), on s'assure qu'ils ne sont pas corrompus
      
      const response = await api.post('/login', { 
        email: cleanEmail, 
        password: cleanPassword 
      });

      const token = response.data.token;
      const role = response.data.user.role;

      // ✅ Inject token immédiatement
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      await saveAuthSession({
        token,
        role,
        rememberMe: rememberMe,
        biometricsEnabled: true,
        lastUserEmail: cleanEmail,
        lastUserName: response.data.user.name,
      });
      setStoredUser({
        token,
        role,
        biometricsEnabled: 'true',
        lastUserEmail: cleanEmail,
        lastUserName: response.data.user.name,
        accounts: [{ email: cleanEmail, name: response.data.user.name, role, token }],
      });
      setHasStoredSession(true);

      setUser(response.data.user);
      showToast(t.success || "Connecté", "success");

      registerForPushNotificationsAsync()
        .then(pushToken => { if (pushToken) savePushToken(pushToken); })
        .catch(() => {});

      navigateToDashboard(role);
      
    } catch (e) {
      if (e.response) {
        if (__DEV__ && ![401, 404, 422, 429].includes(e.response.status)) {
          console.warn('[Login] Avertissement API:', e.response?.data || e.message);
        }
        const feedback = getLoginFeedback(e, lang);
        showToast(feedback.message, feedback.type);
      } else if (e.request) {
        if (__DEV__) {
          console.warn('[Login] Serveur injoignable:', e.message);
        }
        showToast(
          lang === 'en'
            ? 'Server unreachable. Check the connection and try again.'
            : 'Serveur injoignable. Vérifiez la connexion puis réessayez.',
          'warning'
        );
      } else {
        if (__DEV__) {
          console.warn('[Login] Connexion interrompue:', e.message);
        }
        showToast(t.loginError || "Connexion impossible pour le moment.", "warning");
      }
    } finally {
      setLoading(false);
    }
  };

  const showLoginHelp = () => {
    Alert.alert(
      t.loginHelpTitle || "Aide",
      t.loginHelpBody || "Contactez l'administrateur.",
      [{ text: t.confirm || "OK" }]
    );
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      
      <LinearGradient
        colors={isDark ? ['#07111F', '#0B1220', '#111827'] : ['#F8FBFF', '#F0F7FB', '#FFFFFF']}
        style={tw`absolute inset-0`}
      />

      <View style={[tw`flex-1`, { paddingTop: insets.top }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={tw`flex-1`}>
          
          {/* Header Back Button */}
          <Animated.View style={[tw`px-5 pt-3 pb-1 z-10`, { opacity: backFade }]}>
            <TouchableOpacity
              style={[
                tw`w-11 h-11 items-center justify-center border`, 
                { borderRadius: 14, backgroundColor: isDark ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255,255,255,0.92)', borderColor: isDark ? 'rgba(148,163,184,0.18)' : '#E2E8F0' }
              ]}
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
            >
              <MaterialIcons name="arrow-back-ios-new" size={18} color={isDark ? "#FFF" : '#0A0A0A'} />
            </TouchableOpacity>
          </Animated.View>

          <ScrollView
            contentContainerStyle={[tw`flex-grow items-center justify-center px-5`, { paddingBottom: 24 + insets.bottom, paddingTop: isSmallScreen ? 4 : 12 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo and Welcome Area - animated entrance */}
            <Animated.View style={[
              tw`items-center`,
              { width: formWidth, marginBottom: isSmallScreen ? 20 : 28 },
              { opacity: logoOpacity, transform: [{ translateY: logoTranslateY }, { scale: logoScale }] }
            ]}>
              {/* Logo container with shimmer glow */}
              <View style={{ position: 'relative', marginBottom: isSmallScreen ? 14 : 18 }}>
                <View style={[
                  tw`items-center justify-center border`,
                  { 
                    width: isSmallScreen ? 76 : 88,
                    height: isSmallScreen ? 76 : 88,
                    borderRadius: 18, 
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.86)' : '#FFFFFF', 
                    borderColor: isDark ? 'rgba(148, 163, 184, 0.18)' : C.borderSoft,
                    elevation: 10, shadowColor: brandColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16 
                  }
                ]}>
                  <Image source={require('../../assets/logo.png')} style={{ width: isSmallScreen ? 46 : 54, height: isSmallScreen ? 46 : 54 }} resizeMode="contain" />
                </View>
                {/* Shimmer glow ring */}
                <Animated.View style={[
                  { position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderRadius: 30, backgroundColor: brandColor, opacity: shimmerOpacity }
                ]} />
              </View>

              <Text style={[tw`${isSmallScreen ? 'text-2xl' : 'text-3xl'} font-black mb-2`, { color: isDark ? '#F8FAFC' : '#0F172A', letterSpacing: 0 }]}>
                {t.loginTitle || 'REHOBOTH'}
              </Text>
              <View style={[tw`px-5 py-1.5 mb-3 border`, { borderRadius: 999, backgroundColor: C.brandLight, borderColor: C.brandMedium }]}>
                <Text style={[tw`text-[10px] font-black`, { color: brandColor, letterSpacing: 0 }]}>ESPACE HOSPITALIER SÉCURISÉ</Text>
              </View>
              <Text style={[tw`text-sm text-center leading-5 px-3`, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                {t.loginSubtitle || 'Accédez à votre espace sécurisé Rehoboth'}
              </Text>
            </Animated.View>

            {/* Form Area */}
            <View style={{ width: formWidth }}>
              
              <FadeInView delay={100}>
                <View style={tw`flex-row items-center mb-2 ml-1`}>
                  <Text style={[tw`text-[10px] font-black`, { color: C.textSecondary, letterSpacing: 0 }]}>
                    {lang === 'en' ? 'EMAIL ADDRESS' : 'ADRESSE PROFESSIONNELLE'}
                  </Text>
                </View>
                <View style={[
                  tw`flex-row items-center px-4 border`, 
                  { height: isSmallScreen ? 52 : 56, borderRadius: 14, marginBottom: isSmallScreen ? 14 : 18 },
                  emailFocused 
                    ? { borderColor: brandColor, backgroundColor: isDark ? 'rgba(15, 23, 42, 0.92)' : '#FFF' } 
                    : { borderColor: isDark ? 'rgba(148, 163, 184, 0.16)' : C.border, backgroundColor: isDark ? 'rgba(15, 23, 42, 0.72)' : '#FFFFFF' }
                ]}>
                  <Feather name="help-circle" size={20} color={emailFocused ? brandColor : (isDark ? "#555555" : '#94A3B8')} style={tw`mr-4`} />
                  <TextInput
                    style={[tw`flex-1 text-base font-semibold`, { color: isDark ? '#F8FAFC' : '#0A0A0A' }]}
                    placeholder="agent@mdcd.com" placeholderTextColor={isDark ? "#555555" : '#94A3B8'}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize=""
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="next"
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>
              </FadeInView>

              <FadeInView delay={200}>
                <View style={tw`flex-row items-center mb-2 ml-1`}>
                  <Text style={[tw`text-[10px] font-black`, { color: C.textSecondary, letterSpacing: 0 }]}>
                    {lang === 'en' ? 'SECURE PASSWORD' : 'MOT DE PASSE SÉCURISÉ'}
                  </Text>
                </View>
                <View style={[
                  tw`flex-row items-center px-4 border`, 
                  { height: isSmallScreen ? 52 : 56, borderRadius: 14, marginBottom: isSmallScreen ? 10 : 14 },
                  passFocused 
                    ? { borderColor: brandColor, backgroundColor: isDark ? 'rgba(15, 23, 42, 0.92)' : '#FFF' } 
                    : { borderColor: isDark ? 'rgba(148, 163, 184, 0.16)' : C.border, backgroundColor: isDark ? 'rgba(15, 23, 42, 0.72)' : '#FFFFFF' }
                ]}>
                  <Feather name="shield" size={20} color={passFocused ? brandColor : (isDark ? "#555555" : '#94A3B8')} style={tw`mr-4`} />
                  <TextInput
                    style={[tw`flex-1 text-base font-semibold`, { color: isDark ? '#F8FAFC' : '#0A0A0A' }]}
                    placeholder="••••••••" placeholderTextColor={isDark ? "#555555" : '#94A3B8'}
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize=""
                    autoCorrect={false}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onFocus={() => setPassFocused(true)}
                    onBlur={() => setPassFocused(false)}
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    style={tw`p-2`}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={passFocused ? brandColor : (isDark ? '#555555' : '#94A3B8')}
                    />
                  </TouchableOpacity>
                </View>
              </FadeInView>

              <FadeInView delay={300}>
                <View style={[tw`flex-row justify-between items-center mt-1 px-1`, { marginBottom: isSmallScreen ? 22 : 28 }]}>
                  <TouchableOpacity
                    style={tw`flex-row items-center flex-1 pr-3`}
                    onPress={() => setRememberMe(!rememberMe)}
                  >
                    <View style={[
                      tw`w-5 h-5 rounded-md items-center justify-center border-2`, 
                      { borderColor: rememberMe ? brandColor : C.border, backgroundColor: rememberMe ? brandColor : 'transparent' }
                    ]}>
                      {rememberMe && <MaterialIcons name="check" size={14} color="#FFF" />}
                    </View>
                    <Text style={tw`ml-3 text-sm font-bold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {t.rememberMe || 'Rester connecté'}
                    </Text>
                  </TouchableOpacity>
                  
                  {biometricsChecked && isBiometricSupported && hasStoredSession ? (
                    <TouchableOpacity onPress={handleBiometricLogin} style={tw`flex-row items-center`}>
                      <MaterialCommunityIcons name={biometricType === 'face' ? 'face-recognition' : 'fingerprint'} size={18} color={brandColor} style={tw`mr-1`} />
                      <Text style={tw`text-sm font-black text-[${brandColor}]`}>Biométrie</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={showLoginHelp}>
                      <Text style={tw`text-sm font-black text-[${brandColor}]`}>
                        {t.loginForgot || ""}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </FadeInView>

              <FadeInView delay={400}>
                <PressableScale
                  style={[
                    tw`items-center justify-center flex-row`, 
                    { 
                      height: isSmallScreen ? 54 : 58,
                      borderRadius: 14, 
                      marginBottom: isSmallScreen ? 16 : 20,
                      backgroundColor: brandColor, 
                      elevation: 8, 
                      shadowColor: brandColor, 
                      shadowOffset: { width: 0, height: 8 }, 
                      shadowOpacity: 0.4, 
                      shadowRadius: 16 
                    }
                  ]}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <View style={tw`flex-row items-center`}>
                      <ActivityIndicator color="#FFF" style={tw`mr-3`} />
                      <Text style={[tw`text-white ${isSmallScreen ? 'text-base' : 'text-lg'} font-black`, { letterSpacing: 0 }]}>AUTHENTIFICATION...</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={[tw`text-white ${isSmallScreen ? 'text-base' : 'text-lg'} font-black mr-2`, { letterSpacing: 0 }]}>
                        {t.login || 'Se Connecter'}
                      </Text>
                      <Feather name="help-circle" size={20} color="#FFF" />
                    </>
                  )}
                </PressableScale>

              </FadeInView>
              
              <FadeInView delay={500}>
                <View style={tw`items-center mt-1`}>
                  <Text style={tw`text-xs font-bold ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-3`}>"© 2026 REHOBOTH SYSTEM"</Text>
                </View>
              </FadeInView>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}
