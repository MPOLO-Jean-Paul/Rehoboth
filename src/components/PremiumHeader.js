import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import api from '../services/api';
import { Theme } from '../constants/theme';
import { withCacheBust } from '../utils/media';

export default function PremiumHeader({ 
  onLeftPress, 
  onRightPress, 
  title, 
  subtitle, 
  icon, 
  navigation 
}) {
  const { C, S, isDark, brandColor, notificationsEnabled, user } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    if (!user) return; // Ne pas fetch si non connecté
    try {
      const response = await api.get('/notifications/unread-count');
      setUnreadCount(response.data.count);
    } catch (error) {
      // silent - already handled by api interceptor
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const insets = useSafeAreaInsets();
  const styles = createStyles(C, S, isDark, brandColor, insets);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={C.statusBar} backgroundColor={C.bg} />
      <LinearGradient colors={isDark ? ['#0B1220', '#0F1A2C'] : ['#FFFFFF', '#F5F9FC']} style={{ paddingTop: insets.top, paddingBottom: S.vs(8) }}>
        <View style={styles.headerContent}>
            {/* Left – Menu */}
            <TouchableOpacity
              onPress={onLeftPress}
              style={[styles.roundButton, { backgroundColor: C.headerBtn, shadowColor: isDark ? '#000' : '#94A3B8' }]}
            >
              <MaterialIcons name="menu" size={S.ms(24)} color={brandColor} />
            </TouchableOpacity>

            {/* Center */}
            <View style={styles.centerSection}>
              <LinearGradient colors={Theme.colors.brandGradient} style={styles.logoIcon}>
                <MaterialCommunityIcons name={icon || 'hospital-building'} size={S.ms(18)} color="#FFF" />
              </LinearGradient>
              <View style={styles.textContainer}>
                <Text style={[styles.mainTitle, { color: C.text }]} numberOfLines={1}>{title?.toUpperCase()}</Text>
                {subtitle && (
                  <View style={[styles.subtitleBadge, { backgroundColor: brandColor + '15' }]}>
                    <Text style={[styles.subTitle, { color: brandColor }]} numberOfLines={1}>
                      {subtitle?.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Right – Bell + Profile */}
            <View style={styles.rightActions}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Notification')}
                style={[styles.roundButton, { backgroundColor: C.headerBtn, marginRight: S.s(10), shadowColor: isDark ? '#000' : '#94A3B8' }]}
              >
                <MaterialCommunityIcons name="bell-outline" size={S.ms(22)} color={brandColor} />
                {notificationsEnabled && unreadCount > 0 && (
                  <View style={[styles.badge, { borderColor: C.surface }]}>
                    <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onRightPress}
                style={[styles.roundButton, { backgroundColor: C.headerBtn, shadowColor: isDark ? '#000' : '#94A3B8', overflow: 'hidden' }]}
              >
                {user?.profile_photo ? (
                  <Image
                    key={`${user.profile_photo}-${user.updated_at}`}
                    source={{ uri: withCacheBust(user.profile_photo, user.updated_at), cache: 'reload' }}
                    style={{ width: '100%', height: '100%', borderRadius: 14 }}
                    resizeMode="cover"
                  />
                ) : (
                  <MaterialCommunityIcons name="account-circle-outline" size={S.ms(24)} color={brandColor} />
                )}
              </TouchableOpacity>
            </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const createStyles = (C, S, isDark, brandColor, insets) => StyleSheet.create({
  container: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    zIndex: 100,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSoft,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.22 : 0.08,
    shadowRadius: 12,
  },
  headerContent: {
    minHeight: S.vs(68), 
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'space-between', 
    paddingHorizontal: S.s(14),
  },
  roundButton: {
    width: S.ms(44), 
    height: S.ms(44), 
    borderRadius: S.ms(14),
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
    borderWidth: 1,
    borderColor: C.borderSoft,
    overflow: 'hidden',
  },
  centerSection: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', minWidth: 0, paddingHorizontal: S.s(8) },
  logoIcon: { 
    width: S.ms(34), 
    height: S.ms(34), 
    borderRadius: S.ms(12), 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: S.s(10),
    shadowColor: brandColor,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  textContainer: { alignItems: 'flex-start', minWidth: 0, flexShrink: 1, justifyContent: 'center' },
  mainTitle: { fontSize: S.fs(17), fontWeight: '900', letterSpacing: 0.5 },
  subtitleBadge: { 
    marginTop: S.vs(2), 
    paddingHorizontal: S.s(8), 
    paddingVertical: S.vs(2), 
    borderRadius: S.ms(8), 
    alignSelf: 'flex-start' 
  },
  subTitle: { fontSize: S.fs(8), fontWeight: '900', letterSpacing: 1 },
  rightActions: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    position: 'absolute', 
    top: S.ms(6), 
    right: S.ms(6),
    backgroundColor: '#EF4444',
    minWidth: S.ms(16), 
    height: S.ms(16), 
    borderRadius: S.ms(8),
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: isDark ? '#1A1A1A' : '#FFF',
  },
  badgeText: { color: '#FFF', fontSize: S.fs(8), fontWeight: '900' },
});
