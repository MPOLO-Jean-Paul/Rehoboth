import React, { useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppContext } from '../../App';
import { Theme } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

/**
 * PremiumRightPanel — Settings panel with Android-style radio selectors.
 */
export default function PremiumRightPanel({
  isOpen, anim, onClose,
  isDark: _ignored,
  isOnline,
  lang: _langProp, toggleLang: _toggleLangProp, toggleTheme: _toggleThemeProp,
  roleName, roleIcon = 'account-tie',
  onLogout, t = {},
  setActiveView,
}) {
  const { themeMode, setThemeMode, notificationsEnabled, toggleNotifications, lang, setLang, user } = useContext(AppContext);
  const { isDark: dark, brandColor } = useTheme();
  const insets = useSafeAreaInsets();

  if (!isOpen) return null;

  const bg      = dark ? '#0B1220' : '#F5F9FC';
  const cardBg  = dark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const border  = dark ? '#263244' : '#D8E3EC';
  const divider = dark ? '#263244' : '#EAF1F6';
  const txt     = dark ? '#FFFFFF' : '#0F172A';
  const sub     = dark ? '#94A3B8' : '#64748B';
  const groupTitle = dark ? '#8E8E93' : '#6D6D72';
  const accountName = user?.name || roleName;
  const accountRole = user?.role ? user.role.toUpperCase() : String(roleName || '').toUpperCase();

  // Android-style radio row
  const RadioRow = ({ label, subtitle, selected, onPress, isFirst, isLast }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: cardBg,
        borderTopLeftRadius: isFirst ? 10 : 0,
        borderTopRightRadius: isFirst ? 10 : 0,
        borderBottomLeftRadius: isLast ? 10 : 0,
        borderBottomRightRadius: isLast ? 10 : 0,
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: divider,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, color: txt, fontWeight: '400' }}>{label}</Text>
        {subtitle ? <Text style={{ fontSize: 12, color: sub, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {/* Android-style radio button */}
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2,
        borderColor: selected ? brandColor : (dark ? '#636366' : '#C7C7CC'),
        alignItems: 'center', justifyContent: 'center',
        marginLeft: 12,
      }}>
        {selected && (
          <View style={{
            width: 12, height: 12, borderRadius: 6,
            backgroundColor: brandColor,
          }} />
        )}
      </View>
    </TouchableOpacity>
  );

  // Android-style list row (with chevron or toggle)
  const ListRow = ({ icon, iconBg, label, subtitle, onPress, rightElement, isFirst, isLast, showChevron = true }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 13,
        backgroundColor: cardBg,
        borderTopLeftRadius: isFirst ? 10 : 0,
        borderTopRightRadius: isFirst ? 10 : 0,
        borderBottomLeftRadius: isLast ? 10 : 0,
        borderBottomRightRadius: isLast ? 10 : 0,
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: divider,
      }}
    >
      {icon && (
        <View style={{
          width: 32, height: 32, borderRadius: 8,
          backgroundColor: iconBg || brandColor,
          alignItems: 'center', justifyContent: 'center',
          marginRight: 14,
        }}>
          {icon}
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, color: txt, fontWeight: '400' }}>{label}</Text>
        {subtitle ? <Text style={{ fontSize: 12, color: sub, marginTop: 1 }}>{subtitle}</Text> : null}
      </View>
      {rightElement || (showChevron && onPress && (
        <MaterialIcons name="chevron-right" size={20} color={dark ? "#636366" : '#C7C7CC'} />
      ))}
    </TouchableOpacity>
  );

  return (
    <>
      {/* Dimmed overlay */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
          zIndex: 139,
          backgroundColor: dark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
        }}
      />

      <Animated.View style={{
        position: 'absolute', top: insets.top + 8, bottom: insets.bottom + 8, right: 8, width: '82%',
        zIndex: 140, backgroundColor: bg,
        borderRadius: 18,
        borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        transform: [{ translateX: anim }],
        shadowColor: '#000', shadowOffset: { width: -10, height: 0 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 35,
        overflow: 'hidden'
      }}>
        <View style={{ flex: 1 }}>

          {/* HEADER */}
          <LinearGradient 
            colors={dark ? ['rgba(255,255,255,0.03)', 'transparent'] : ['rgba(0,0,0,0.02)', 'transparent']}
            style={{ paddingHorizontal: 20, paddingTop: insets.top + 10, paddingBottom: 20 }}
          >
            <TouchableOpacity onPress={onClose} style={{ alignSelf: 'flex-end', marginBottom: 15 }}>
              <View style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              }}>
                <MaterialIcons name="close" size={20} color={txt} />
              </View>
            </TouchableOpacity>
            
            <Text style={{ fontSize: 24, fontWeight: '900', color: txt, marginBottom: 20, letterSpacing: 0 }}>Paramètres</Text>

            {/* Profile Card */}
            <TouchableOpacity 
              onPress={() => { onClose(); if (setActiveView) setActiveView('profile'); }}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: cardBg,
                borderRadius: 14,
                padding: 16,
                borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10
              }}
            >
              <LinearGradient 
                colors={Theme.colors.brandGradient} 
                start={{x:0, y:0}} end={{x:1, y:1}}
                style={{
                  width: 56, height: 56, borderRadius: 14,
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 16,
                  shadowColor: brandColor, shadowOpacity: 0.4, shadowRadius: 12
                }}
              >
                <MaterialCommunityIcons name={roleIcon} size={28} color={brandColor} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: txt }}>{accountName}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                   <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isOnline ? '#34C759' : '#FF3B30', marginRight: 6 }} />
                   <Text style={{ fontSize: 11, color: brandColor, fontWeight: '800', letterSpacing: 0 }}>
                     {accountRole} • {isOnline ? 'EN LIGNE' : 'HORS-LIGNE'}
                   </Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={brandColor} />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>

            {/* COMPTE */}
            <Text style={{ fontSize: 10, fontWeight: '900', color: brandColor, marginTop: 28, marginBottom: 12, marginLeft: 6, letterSpacing: 0 }}>COMPTE</Text>
            <View style={{ borderRadius: 12, overflow: 'hidden' }}>
              <ListRow
                icon={<MaterialCommunityIcons name="help-circle" size={18} color="#FFF" />}
                iconBg={brandColor}
                label="Mon Compte"
                subtitle="Gérer mes informations"
                isFirst isLast
                onPress={() => { onClose(); if (setActiveView) setActiveView('profile'); }}
              />
            </View>

            {/* APPARENCE */}
            <Text style={{ fontSize: 10, fontWeight: '900', color: brandColor, marginTop: 28, marginBottom: 12, marginLeft: 6, letterSpacing: 0 }}>APPARENCE</Text>

            {/* Thème */}
            <Text style={{ fontSize: 12, color: sub, marginBottom: 6, marginLeft: 4 }}>Thème de l'application</Text>
            <View style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              <RadioRow
                label="Clair"
                subtitle="Toujours en mode clair"
                selected={themeMode === 'light'}
                onPress={() => setThemeMode && setThemeMode('light')}
                isFirst
              />
              <RadioRow
                label="Sombre"
                subtitle="Toujours en mode sombre"
                selected={themeMode === 'dark'}
                onPress={() => setThemeMode && setThemeMode('dark')}
              />
              <RadioRow
                label="Système"
                subtitle="Suivre les préférences du téléphone"
                selected={themeMode === 'system'}
                onPress={() => setThemeMode && setThemeMode('system')}
                isLast
              />
            </View>

            {/* Langue */}
            <Text style={{ fontSize: 12, color: sub, marginBottom: 6, marginLeft: 4 }}>Langue de l'interface</Text>
            <View style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
              <RadioRow
                label=""
                selected={lang === 'fr'}
                onPress={() => setLang && setLang('fr')}
                isFirst
              />
              <RadioRow
                label="Anglais"
                selected={lang === 'en'}
                onPress={() => setLang && setLang('en')}
                isLast
              />
            </View>

            {/* NOTIFICATIONS */}
            <Text style={{ fontSize: 10, fontWeight: '900', color: brandColor, marginTop: 28, marginBottom: 12, marginLeft: 6, letterSpacing: 0 }}>NOTIFICATIONS</Text>
            <View style={{ borderRadius: 12, overflow: 'hidden' }}>
              <ListRow
                icon={<MaterialIcons name={notificationsEnabled ? 'notifications-active' : 'notifications-off'} size={18} color={brandColor} />}
                iconBg="#34C759"
                label="Notifications push"
                subtitle={notificationsEnabled ? 'Alertes activées' : 'Alertes désactivées'}
                isFirst isLast
                showChevron={false}
                rightElement={
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={toggleNotifications}
                    trackColor={{ false: dark ? '#39393D' : '#E5E5EA', true: '#34C759' }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor={dark ? '#39393D' : '#E5E5EA'}
                  />
                }
              />
            </View>

            <View style={{ height: 28 }} />
          </ScrollView>

          {/* FOOTER – LOGOUT */}
          <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 20, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: divider }}>
            <TouchableOpacity
              onPress={onLogout}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                padding: 16, borderRadius: 12,
                backgroundColor: dark ? '#2C1414' : '#FFF2F2',
                borderWidth: 0.5, borderColor: '#FF3B3050',
              }}
            >
              <MaterialIcons name="logout" size={20} color="#FF3B30" />
              <Text style={{ color: '#FF3B30', fontWeight: '700', marginLeft: 10, fontSize: 15 }}>
                {t.settingsLogout || 'Déconnexion'}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </Animated.View>
    </>
  );
}
