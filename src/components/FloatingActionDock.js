import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, LayoutAnimation, UIManager, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { PressableScale } from './AnimatedComponents';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function FloatingActionDock({
  title,
  actions = [],
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Rechercher...',
  bottomOffset = 96,
}) {
  const { C, S, isDark, brandColor } = useTheme();
  const insets = useSafeAreaInsets();
  const [searchOpen, setSearchOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const visibleActions = useMemo(() => actions.filter(Boolean), [actions]);
  const hasSearch = typeof onSearchChange === 'function';
  const styles = createStyles(C, S, isDark, brandColor, insets, bottomOffset);

  if (!hasSearch && visibleActions.length === 0 && !title) {
    return null;
  }

  const toggleExpand = () => {
    LayoutAnimation.configureNext({
      duration: 350,
      create: { type: 'spring', property: 'scaleXY', springDamping: 0.8 },
      update: { type: 'spring', springDamping: 0.8 },
      delete: { type: 'timing', duration: 200, property: 'opacity' }
    });
    if (expanded) setSearchOpen(false);
    setExpanded(!expanded);
  };

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      {hasSearch && searchOpen && expanded && (
        <View style={styles.searchPanel}>
          <MaterialIcons name="search" size={S.ms(20)} color={brandColor} />
          <TextInput
            value={searchValue}
            onChangeText={onSearchChange}
            placeholder={searchPlaceholder}
            placeholderTextColor={C.placeholder}
            autoFocus
            style={styles.searchInput}
            returnKeyType="search"
          />
          <TouchableOpacity
            onPress={() => {
              onSearchChange('');
              setSearchOpen(false);
            }}
            style={styles.clearBtn}
          >
            <MaterialIcons name="close" size={S.ms(18)} color={C.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {expanded ? (
        <View style={styles.dock}>
          <PressableScale onPress={toggleExpand} style={styles.collapseBtn}>
             <MaterialCommunityIcons name="chevron-right" size={S.ms(24)} color={C.sub} />
          </PressableScale>
          
          {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : <View style={{ flex: 1 }} />}

          <View style={styles.actions}>
            {hasSearch && (
              <PressableScale
                style={[styles.actionBtn, searchOpen && styles.activeBtn]}
                onPress={() => setSearchOpen((current) => !current)}
              >
                <MaterialIcons name="search" size={S.ms(22)} color={searchOpen ? '#FFF' : brandColor} />
              </PressableScale>
            )}

            {visibleActions.map((action) => {
              const Icon = action.iconFamily === 'community' ? MaterialCommunityIcons : MaterialIcons;
              const active = action.active;
              return (
                <PressableScale
                  key={action.key || action.label}
                  style={[
                    styles.actionBtn,
                    active && styles.activeBtn,
                    action.danger && { backgroundColor: '#EF4444' },
                  ]}
                  onPress={action.onPress}
                  disabled={action.disabled}
                >
                  <Icon
                    name={action.icon}
                    size={S.ms(action.size || 22)}
                    color={active || action.danger ? '#FFF' : (action.color || brandColor)}
                  />
                </PressableScale>
              );
            })}
          </View>
        </View>
      ) : (
        <PressableScale onPress={toggleExpand} style={styles.fabWrap}>
           <LinearGradient
             colors={Theme.colors.brandGradient}
             start={{ x: 0, y: 0 }}
             end={{ x: 1, y: 1 }}
             style={styles.fab}
           >
             <MaterialCommunityIcons name="lightning-bolt" size={S.ms(26)} color="#FFF" />
           </LinearGradient>
        </PressableScale>
      )}
    </View>
  );
}

const createStyles = (C, S, isDark, brandColor, insets, bottomOffset) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: S.s(14),
    right: S.s(14),
    bottom: Math.max(S.vs(16), insets.bottom + bottomOffset),
    zIndex: 120,
    elevation: 18,
    alignItems: 'flex-end',
  },
  searchPanel: {
    width: '100%',
    minHeight: S.vs(52),
    borderRadius: S.ms(16),
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.s(14),
    marginBottom: S.vs(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: isDark ? 0.36 : 0.12,
    shadowRadius: 18,
    elevation: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: S.s(10),
    color: C.text,
    fontSize: S.fs(14),
    fontWeight: '700',
    minHeight: S.vs(48),
  },
  clearBtn: {
    width: S.ms(34),
    height: S.ms(34),
    borderRadius: S.ms(10),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
  },
  dock: {
    width: '100%',
    minHeight: S.vs(58),
    borderRadius: S.ms(18),
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: S.s(10),
    paddingRight: S.s(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: isDark ? 0.34 : 0.14,
    shadowRadius: 22,
    elevation: 12,
  },
  collapseBtn: {
    width: S.ms(36),
    height: S.ms(36),
    borderRadius: S.ms(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
  },
  title: {
    flex: 1,
    color: C.text,
    fontSize: S.fs(12),
    fontWeight: '900',
    letterSpacing: 0,
    paddingHorizontal: S.s(10),
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s(8),
  },
  actionBtn: {
    width: S.ms(44),
    height: S.ms(44),
    borderRadius: S.ms(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brandColor + '12',
    borderWidth: 1,
    borderColor: brandColor + '22',
  },
  activeBtn: {
    backgroundColor: brandColor,
    borderColor: brandColor,
  },
  fabWrap: {
    shadowColor: brandColor,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 14,
  },
  fab: {
    width: S.ms(60),
    height: S.ms(60),
    borderRadius: S.ms(30),
    alignItems: 'center',
    justifyContent: 'center',
  },
});

