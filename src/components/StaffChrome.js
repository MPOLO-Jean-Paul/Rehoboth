import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, SafeAreaView, TouchableOpacity, Switch, Alert } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { PressableScale } from './AnimatedComponents';
import { clearAuthSession } from '../services/session';

export default function StaffChrome({
  navigation,
  roleTitle,
  roleSubtitle,
  taskButtons = [],
  taskLabel = 'Tâches',
}) {
  const { C, S, isDark, toggleTheme, lang, toggleLang, isOnline, brandColor } = useTheme();

  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const leftAnim = useRef(new Animated.Value(-S.width)).current;
  const rightAnim = useRef(new Animated.Value(S.width)).current;

  const openLeft = () => {
    setIsLeftOpen(true);
    Animated.spring(leftAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }).start();
  };

  const closeLeft = () => {
    Animated.timing(leftAnim, { toValue: -S.width, duration: 220, useNativeDriver: true }).start(() => setIsLeftOpen(false));
  };

  const openRight = () => {
    setIsRightOpen(true);
    Animated.spring(rightAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }).start();
  };

  const closeRight = () => {
    Animated.timing(rightAnim, { toValue: S.width, duration: 220, useNativeDriver: true }).start(() => setIsRightOpen(false));
  };

  const handleLogout = async () => {
    await clearAuthSession();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const quickTasks = useMemo(() => {
    if (taskButtons.length > 0) return taskButtons;
    return [
      { key: 'refresh', label: 'Rafraîchir', icon: 'refresh', onPress: () => navigation?.goBack?.() },
      { key: 'home', label: 'Accueil', icon: 'home-outline', onPress: () => navigation?.navigate?.('Home') },
    ];
  }, [navigation, taskButtons]);

  const roleBadge = roleSubtitle || (lang === 'fr' ? 'Espace personnel' : 'Staff area');
  const styles = createStyles(C, S, isDark, brandColor);

  return (
    <>
      {isLeftOpen && <TouchableOpacity style={styles.dimming} activeOpacity={1} onPress={closeLeft} />}
      <Animated.View style={[styles.leftPanel, { transform: [{ translateX: leftAnim }], backgroundColor: C.bg, borderRightColor: C.border }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.panelHeader}>
            <Text style={[styles.panelTitle, { color: C.text }]}>{taskLabel}</Text>
            <TouchableOpacity onPress={closeLeft}>
              <MaterialIcons name="close" size={S.ms(28)} color={C.text} />
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: S.s(16), paddingTop: S.vs(14), flex: 1 }}>
            <View style={[styles.roleCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={[styles.roleIconWrap, { backgroundColor: brandColor + '15' }]}>
                <MaterialCommunityIcons name="view-grid-outline" size={S.ms(28)} color={brandColor} />
              </View>
              <Text style={[styles.roleTitle, { color: C.text }]}>{roleTitle}</Text>
              <Text style={{ color: C.textSecondary, fontSize: S.fs(12), textAlign: 'center', lineHeight: S.fs(18) }}>{roleBadge}</Text>
            </View>

            <View style={styles.taskList}>
              {quickTasks.map((task) => (
                <PressableScale
                  key={task.key}
                  style={[styles.taskItem, { backgroundColor: C.card, borderColor: C.border }]}
                  onPress={() => {
                     closeLeft();
                     task.onPress?.();
                  }}
                >
                  <MaterialCommunityIcons name={task.icon} size={S.ms(20)} color={brandColor} />
                <Text style={[styles.taskLabel, { color: C.text }]} numberOfLines={2}>{task.label}</Text>
                </PressableScale>
              ))}
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      {isRightOpen && <TouchableOpacity style={styles.dimming} activeOpacity={1} onPress={closeRight} />}
      <Animated.View style={[styles.rightPanel, { transform: [{ translateX: rightAnim }], backgroundColor: C.bg, borderLeftColor: C.border }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.panelHeader}>
            <Text style={[styles.panelTitle, { color: C.text }]}>{lang === 'fr' ? 'Réglages' : 'Settings'}</Text>
            <TouchableOpacity onPress={closeRight}>
              <MaterialIcons name="close" size={S.ms(28)} color={C.text} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: S.ms(20), flex: 1 }}>
            <View style={[styles.profileBox, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={[styles.avatar, { backgroundColor: brandColor }]}>
                <MaterialCommunityIcons name="account-cog" size={S.ms(42)} color="#FFF" />
              </View>
              <Text style={[styles.profileTitle, { color: C.text }]}>{roleTitle}</Text>
              <Text style={{ color: C.textSecondary, fontSize: S.fs(12) }}>{lang === 'fr' ? 'Panneau personnel' : 'Personal panel'}</Text>
            </View>

            <View style={styles.settingRow}>
              <Text style={{ color: C.text, fontSize: S.fs(14), fontWeight: '600' }}>{lang === 'fr' ? 'Langue' : 'Language'}</Text>
              <Switch 
                value={lang === 'en'} 
                onValueChange={toggleLang} 
                trackColor={{ false: '#CBD5E1', true: brandColor + '80' }}
                thumbColor={lang === 'en' ? brandColor : '#F8FAFC'}
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={{ color: C.text, fontSize: S.fs(14), fontWeight: '600' }}>{lang === 'fr' ? 'Mode sombre' : 'Dark mode'}</Text>
              <Switch 
                value={isDark} 
                onValueChange={toggleTheme} 
                trackColor={{ false: '#CBD5E1', true: brandColor + '80' }}
                thumbColor={isDark ? brandColor : '#F8FAFC'}
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={{ color: C.text, fontSize: S.fs(14), fontWeight: '600' }}>{lang === 'fr' ? 'Connexion' : 'Connection'}</Text>
              <View style={[styles.statusPill, { backgroundColor: isOnline ? '#22C55E18' : '#EF444418' }]}>
                <Text style={{ color: isOnline ? '#22C55E' : '#EF4444', fontWeight: '800', fontSize: S.fs(11) }}>
                  {isOnline ? (lang === 'fr' ? 'En ligne' : 'Online') : (lang === 'fr' ? 'Hors ligne' : 'Offline')}
                </Text>
              </View>
            </View>

            <PressableScale style={[styles.logoutBtn, { backgroundColor: '#EF444410' }]} onPress={() => {
              Alert.alert(
                lang === 'fr' ? 'Déconnexion' : 'Logout',
                lang === 'fr' ? 'Voulez-vous vraiment quitter votre session ?' : 'Do you really want to sign out?',
                [
                  { text: lang === 'fr' ? 'Annuler' : 'Cancel', style: 'cancel' },
                  { text: lang === 'fr' ? 'Déconnecter' : 'Logout', style: 'destructive', onPress: handleLogout },
                ]
              );
            }}>
              <MaterialIcons name="logout" size={S.ms(20)} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontWeight: '900', marginLeft: S.s(10), fontSize: S.fs(13) }}>
                {lang === 'fr' ? 'DÉCONNEXION' : 'LOGOUT'}
              </Text>
            </PressableScale>
          </View>
        </SafeAreaView>
      </Animated.View>

      <View pointerEvents="box-none" style={styles.fabRow}>
        <PressableScale style={[styles.fab, { backgroundColor: C.surface, borderColor: C.border }]} onPress={openLeft}>
          <MaterialIcons name="menu-open" size={S.ms(26)} color={C.text} />
        </PressableScale>
        <PressableScale style={[styles.fab, { backgroundColor: C.surface, borderColor: C.border }]} onPress={openRight}>
          <MaterialIcons name="settings" size={S.ms(24)} color={brandColor} />
        </PressableScale>
      </View>
    </>
  );
}

const createStyles = (C, S, isDark, brandColor) => StyleSheet.create({
  dimming: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 130 },
  leftPanel: { position: 'absolute', top: 0, bottom: 0, left: 0, width: S.width * 0.84, zIndex: 140, borderRightWidth: 1 },
  rightPanel: { position: 'absolute', top: 0, bottom: 0, right: 0, width: S.width * 0.84, zIndex: 140, borderLeftWidth: 1 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: S.ms(20), borderBottomWidth: 1, borderBottomColor: C.divider },
  panelTitle: { fontSize: S.fs(20), fontWeight: '900', letterSpacing: 0 },
  roleCard: { borderWidth: 1, borderRadius: S.ms(18), padding: S.ms(18), alignItems: 'center', marginBottom: S.vs(18) },
  roleIconWrap: { width: S.ms(64), height: S.ms(64), borderRadius: S.ms(16), alignItems: 'center', justifyContent: 'center', marginBottom: S.vs(12) },
  roleTitle: { fontSize: S.fs(18), fontWeight: '900', marginBottom: S.vs(4), textAlign: 'center' },
  taskList: { gap: S.vs(12) },
  taskItem: { borderWidth: 1, borderRadius: S.ms(14), minHeight: S.vs(54), paddingHorizontal: S.s(14), flexDirection: 'row', alignItems: 'center' },
  taskLabel: { marginLeft: S.s(12), fontWeight: '800', fontSize: S.fs(14), flex: 1, lineHeight: S.fs(19) },
  profileBox: { borderWidth: 1, borderRadius: S.ms(18), paddingVertical: S.vs(18), alignItems: 'center', marginBottom: S.vs(18) },
  avatar: { width: S.ms(84), height: S.ms(84), borderRadius: S.ms(18), alignItems: 'center', justifyContent: 'center', marginBottom: S.vs(14) },
  profileTitle: { fontSize: S.fs(18), fontWeight: '900', marginBottom: S.vs(4) },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: S.vs(14) },
  statusPill: { paddingHorizontal: S.s(10), paddingVertical: S.vs(6), borderRadius: 999 },
  logoutBtn: { height: S.vs(56), borderRadius: S.ms(14), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: S.vs(18) },
  fabRow: { position: 'absolute', top: S.vs(10), left: S.s(16), right: S.s(16), zIndex: 150, flexDirection: 'row', justifyContent: 'space-between' },
  fab: { width: S.ms(44), height: S.ms(44), borderRadius: S.ms(12), borderWidth: 1, alignItems: 'center', justifyContent: 'center', elevation: 6 },
});
