import React, { useRef, useEffect } from 'react';
import { Animated, TouchableWithoutFeedback, Easing, View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * PressableScale: Un bouton qui rétrécit légèrement au toucher.
 */
export const PressableScale = ({ children, onPress, style, disabled }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.timing(scaleAnim, {
      toValue: 0.96,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableWithoutFeedback 
      onPress={onPress} 
      onPressIn={handlePressIn} 
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

/**
 * FadeInView: Entrée en douceur avec décalage optionnel.
 */
export const FadeInView = ({ children, delay = 0, duration = 500, style }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {children}
    </Animated.View>
  );
};

/**
 * SkeletonItem: Bloc grisé avec animation de pulsation.
 * Accepte isDark pour adapter la couleur au thème.
 */
export const SkeletonItem = ({ width = '100%', height = 20, borderRadius = 8, style, isDark = false }) => {
  const opacAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacAnim, { toValue: 0.8, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(opacAnim, { toValue: 0.3, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[style, { width, height, borderRadius, backgroundColor: isDark ? '#1A1A1A' : '#E2E8F0', opacity: opacAnim }]} />
  );
};
/**
 * GlassCard: Panneau semi-transparent style "verre" (Android 16 style).
 */
export const GlassCard = ({ children, style, isDark }) => {
  return (
    <View style={[
      {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: isDark ? 0.3 : 0.05,
        shadowRadius: 20,
        elevation: 5,
      },
      style
    ]}>
      {children}
    </View>
  );
};

export const SurfaceCard = ({ children, style, C, S, elevated = false }) => {
  return (
    <View style={[
      {
        backgroundColor: C?.card || '#FFFFFF',
        borderRadius: S?.ms ? S.ms(18) : 18,
        borderWidth: 1,
        borderColor: C?.borderSoft || C?.border || '#E2E8F0',
        padding: S?.ms ? S.ms(16) : 16,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: elevated ? 10 : 4 },
        shadowOpacity: elevated ? 0.08 : 0.04,
        shadowRadius: elevated ? 18 : 10,
        elevation: elevated ? 4 : 2,
      },
      style
    ]}>
      {children}
    </View>
  );
};

export const EmptyState = ({ C, S, icon = 'clipboard-text-outline', title, message, actionLabel, onAction }) => {
  return (
    <SurfaceCard C={C} S={S} style={{ alignItems: 'center', paddingVertical: S?.vs ? S.vs(28) : 28 }}>
      <View style={{
        width: S?.ms ? S.ms(58) : 58,
        height: S?.ms ? S.ms(58) : 58,
        borderRadius: S?.ms ? S.ms(18) : 18,
        backgroundColor: C?.brandLight || '#EAF4FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: S?.vs ? S.vs(14) : 14,
      }}>
        <MaterialCommunityIcons name={icon} size={S?.ms ? S.ms(28) : 28} color={C?.brand || '#0B5CAD'} />
      </View>
      <Text style={{
        color: C?.text || '#0F172A',
        fontSize: S?.fs ? S.fs(16) : 16,
        fontWeight: '900',
        textAlign: 'center',
      }}>
        {title}
      </Text>
      {!!message && (
        <Text style={{
          color: C?.textSecondary || '#64748B',
          fontSize: S?.fs ? S.fs(13) : 13,
          lineHeight: S?.fs ? S.fs(19) : 19,
          textAlign: 'center',
          marginTop: S?.vs ? S.vs(6) : 6,
          maxWidth: 280,
        }}>
          {message}
        </Text>
      )}
      {!!actionLabel && (
        <PressableScale
          onPress={onAction}
          style={{
            marginTop: S?.vs ? S.vs(16) : 16,
            minHeight: S?.vs ? S.vs(44) : 44,
            paddingHorizontal: S?.s ? S.s(16) : 16,
            borderRadius: S?.ms ? S.ms(14) : 14,
            backgroundColor: C?.brand || '#0B5CAD',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: S?.fs ? S.fs(13) : 13 }}>
            {actionLabel}
          </Text>
        </PressableScale>
      )}
    </SurfaceCard>
  );
};

export const StatusPill = ({ C, S, label, tone = 'info', icon }) => {
  const palette = {
    info: C?.brand || '#0B5CAD',
    success: C?.success || '#15803D',
    warning: C?.warning || '#D97706',
    danger: C?.danger || '#DC2626',
    muted: C?.textSecondary || '#64748B',
  };
  const color = palette[tone] || palette.info;

  return (
    <View style={{
      minHeight: S?.vs ? S.vs(28) : 28,
      paddingHorizontal: S?.s ? S.s(10) : 10,
      borderRadius: 999,
      backgroundColor: color + '14',
      borderWidth: 1,
      borderColor: color + '25',
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
    }}>
      {!!icon && <MaterialCommunityIcons name={icon} size={S?.ms ? S.ms(14) : 14} color={color} style={{ marginRight: 5 }} />}
      <Text style={{ color, fontWeight: '900', fontSize: S?.fs ? S.fs(11) : 11 }}>
        {label}
      </Text>
    </View>
  );
};
