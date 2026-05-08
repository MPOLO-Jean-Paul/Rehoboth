import React, { createContext, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const toastStyles = {
  success: { backgroundColor: '#1E8E3E', icon: 'check-circle' },
  error: { backgroundColor: '#B7791F', icon: 'alert-outline' },
  danger: { backgroundColor: '#D93025', icon: 'alert-circle' },
  warning: { backgroundColor: '#B7791F', icon: 'alert-outline' },
  info: { backgroundColor: '#2563EB', icon: 'information-outline' },
};

const normalizeToast = (message, type) => {
  const rawMessage = String(message || '');
  const lowerMessage = rawMessage.toLowerCase();
  const isTechnicalMessage =
    lowerMessage.includes('erreur interne') ||
    lowerMessage.includes('internal server') ||
    lowerMessage.includes('server error') ||
    lowerMessage.includes('network error') ||
    lowerMessage.includes('exception') ||
    lowerMessage.includes('timeout') ||
    rawMessage.trim().startsWith('{');

  if (isTechnicalMessage) {
    return {
      message: 'Une indisponibilité temporaire est survenue. Réessayez dans un instant.',
      type: 'warning',
    };
  }

  return {
    message: rawMessage || 'Action impossible pour le moment.',
    type: toastStyles[type] ? type : 'info',
  };
};

export const ToastContext = createContext({
  showToast: (message, type = 'success') => {},
});

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;

  const showToast = useCallback((message, type = 'success') => {
    const normalizedToast = normalizeToast(message, type);
    setToast({ visible: true, ...normalizedToast });
    
    // Animation In
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 50, duration: 400, useNativeDriver: true }),
    ]).start();

    // Auto Hide
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -100, duration: 400, useNativeDriver: true }),
      ]).start(() => setToast({ visible: false, message: '', type: 'success' }));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast.visible && (
        <Animated.View style={[
          styles.toastContainer, 
          { opacity: opacityAnim, transform: [{ translateY: slideAnim }] },
          { backgroundColor: (toastStyles[toast.type] || toastStyles.info).backgroundColor }
        ]}>
          <MaterialCommunityIcons 
            name={(toastStyles[toast.type] || toastStyles.info).icon} 
            size={24} color="#FFF" 
          />
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5
  },
  toastText: { color: '#FFF', fontWeight: 'bold', marginLeft: 12, flex: 1, fontSize: 14 }
});
