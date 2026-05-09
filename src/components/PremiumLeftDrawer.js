import React, { useContext } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, ScrollView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppContext, navigationRef } from '../../App';
import { Theme } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { withCacheBust } from '../utils/media';

const { width } = Dimensions.get('window');

export default function PremiumLeftDrawer({
  isOpen, anim, onClose,
  activeView, setActiveView,
  menuItems = [], roleName = '',
  isDark: _ignored,
  t,
}) {
  const { themeMode, user } = useContext(AppContext);
  const { isDark: dark, brandColor } = useTheme();
  const insets = useSafeAreaInsets();

  if (!isOpen) return null;

  const safeRoleName = String(roleName || 'Utilisateur').toUpperCase();
  const styles = createStyles(dark, brandColor, insets);

  const bg         = dark ? '#0B1220' : '#F5F9FC';
  const txt        = dark ? '#FFFFFF' : '#0F172A';
  const sub        = dark ? '#94A3B8' : '#64748B';
  const divider    = dark ? '#263244' : '#D8E3EC';

  const iconColors = [
    '#007AFF', '#34C759', '#FF9500', '#FF2D55',
    '#AF52DE', '#5AC8FA', '#FF3B30', '#30D158',
    '#BF5AF2', '#FF6961',
  ];
  const hasMessaging = menuItems.some(item => ['comm', 'staff_messages'].includes(item.id));
  const resolvedMenuItems = hasMessaging
    ? menuItems
    : [
        ...menuItems,
        {
          id: 'staff_messages',
          icon: 'email-multiple',
          label: t?.navMessaging || 'Messagerie',
          sub: t?.navMessagingSub || 'Messages du personnel',
          route: 'StaffMessages',
        },
      ];

  return (
    <>
      {/* Overlay */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={[styles.overlay, { backgroundColor: dark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.4)' }]}
      />

      {/* Drawer */}
      <Animated.View style={[
        styles.drawer,
        {
          transform: [{ translateX: anim }],
          backgroundColor: dark ? '#0A0A0A' : 'rgba(255,255,255,0.98)',
        },
      ]}>
        <View style={{ flex: 1 }}>

          {/* HEADER */}
          <LinearGradient 
            colors={dark ? ['#0A0A0A', 'transparent'] : ['#FFFFFF', 'transparent']} 
            style={{ paddingHorizontal: 20, paddingTop: insets.top + 20, paddingBottom: 25 }}
          >
            {/* Top bar with close */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.logoBox}>
                  {user?.profile_photo ? (
                     <Image
                       key={`${user.profile_photo}-${user.updated_at}`}
                       source={{ uri: withCacheBust(user.profile_photo, user.updated_at), cache: 'reload' }}
                       style={{ width: '100%', height: '100%', borderRadius: 14 }}
                       resizeMode="cover"
                     />
                  ) : (
                     <LinearGradient 
                        colors={Theme.colors.brandGradient} 
                        start={{x:0, y:0}} end={{x:1, y:1}}
                        style={{ width: '100%', height: '100%', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                     >
                        <MaterialCommunityIcons name="hospital-building" size={22} color="#FFF" />
                     </LinearGradient>
                  )}
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={{ color: txt, fontSize: 16, fontWeight: '900', letterSpacing: 0 }}>REHOBOTH</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#34C759', marginRight: 6 }} />
                    <Text style={{ color: brandColor, fontSize: 10, fontWeight: '900', letterSpacing: 0 }}>{safeRoleName}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: divider }]}>
                <MaterialIcons name="close" size={20} color={txt} />
              </TouchableOpacity>
            </View>

            {/* Section Title */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
               <View style={{ width: 3, height: 24, backgroundColor: brandColor, borderRadius: 2, marginRight: 10 }} />
               <Text style={{ fontSize: 22, fontWeight: '900', color: txt, letterSpacing: 0 }}>
                 Navigation
               </Text>
            </View>
          </LinearGradient>

            {/* NAV ITEMS — Modern Android 16 separate card style */}
            <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
              {resolvedMenuItems.map((item, index) => {
                const isAct = activeView === item.id;
                const iconColor = iconColors[index % iconColors.length];

                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      if (item.route && navigationRef.isReady()) {
                        navigationRef.navigate(item.route);
                      } else if (setActiveView) {
                        setActiveView(item.id);
                      }
                      if (onClose) onClose();
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.navItem,
                      {
                        backgroundColor: isAct ? (dark ? '#1A1A1A' : '#FFFFFF') : (dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)'),
                        borderColor: isAct ? brandColor : (dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                        shadowOpacity: isAct ? 0.12 : 0,
                      }
                    ]}
                  >
                    {/* Colored icon square */}
                    <View style={[
                      styles.iconWrap,
                      {
                        backgroundColor: isAct ? brandColor : (dark ? 'rgba(255,255,255,0.05)' : iconColor + '12'),
                      }
                    ]}>
                      <MaterialCommunityIcons
                        name={item.icon || 'circle-outline'}
                        size={22}
                        color={isAct ? '#FFF' : iconColor}
                      />
                    </View>

                    {/* Label + subtitle */}
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 16,
                        color: isAct ? (dark ? '#FFFFFF' : brandColor) : txt,
                        fontWeight: isAct ? '900' : '700',
                      }}>
                        {item.label}
                      </Text>
                      {item.sub ? (
                        <Text style={{ fontSize: 11, color: sub, marginTop: 1, fontWeight: '600', opacity: 0.8 }} numberOfLines={1}>
                          {item.sub}
                        </Text>
                      ) : null}
                    </View>

                    {/* Chevron or active indicator */}
                    {isAct ? (
                      <LinearGradient 
                        colors={Theme.colors.brandGradient}
                        style={{ width: 6, height: 6, borderRadius: 3, marginLeft: 8 }} 
                      />
                    ) : (
                      <MaterialIcons name="chevron-right" size={20} color={dark ? '#3A3A3C' : '#C7C7CC'} />
                    )}
                  </TouchableOpacity>
                );
              })}

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* FOOTER */}
          <View style={{
            paddingHorizontal: 20, paddingVertical: 16,
            paddingBottom: insets.bottom + 16,
            borderTopWidth: 0.5, borderTopColor: divider,
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: sub, letterSpacing: 0 }}>
              MDCD MD-ERP V3.0 PRO
            </Text>
          </View>

        </View>
      </Animated.View>
    </>
  );
}

const createStyles = (isDark, brandColor, insets) => StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
  },
  drawer: {
    position: 'absolute', top: insets.top + 8, bottom: insets.bottom + 8, left: 8,
    width: width * 0.82, zIndex: 201,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 10, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 35,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  },
  logoBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: brandColor, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 16,
  }
});
