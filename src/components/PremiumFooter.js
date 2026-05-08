import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

/**
 * PremiumFooter
 * A sleek, floating "pill" style bottom navigation bar.
 */
export default function PremiumFooter({ tabs, activeTab, onTabPress }) {
  const { C, S, isDark, brandColor } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(C, S, isDark, brandColor, insets);

  return (
    <View style={styles.container}>
       {tabs.map(tab => {
         const isAct = activeTab === tab.id;
         return (
           <TouchableOpacity 
             key={tab.id} 
             style={[styles.tab, { flex: isAct ? 1.35 : 1, backgroundColor: isAct ? brandColor + '12' : 'transparent' }]} 
             onPress={() => onTabPress(tab.id)}
           >
              <View style={[styles.iconContainer, { backgroundColor: isAct ? brandColor : 'transparent', elevation: isAct ? 8 : 0, shadowColor: brandColor }]}>
                 <MaterialCommunityIcons 
                    name={isAct ? (tab.activeIcon || tab.icon) : tab.icon} 
                    size={S.ms(20)} 
                    color={isAct ? '#FFF' : C.textSecondary} 
                 />
              </View>
              {isAct && (
                <Text style={[styles.label, { color: isDark ? '#FFF' : brandColor }]} numberOfLines={1}>
                   {tab.label}
                </Text>
              )}
           </TouchableOpacity>
         );
       })}
    </View>
  );
}

const createStyles = (C, S, isDark, brandColor, insets) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: S.vs(84) + insets.bottom,
    flexDirection: 'row',
    paddingHorizontal: S.s(16),
    paddingTop: S.vs(8),
    paddingBottom: insets.bottom + S.vs(5),
    backgroundColor: isDark ? '#0B1220' : 'rgba(255,255,255,0.98)',
    elevation: 20,
    borderTopWidth: 1,
    borderTopColor: C.borderSoft,
    zIndex: 100,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: isDark ? 0.2 : 0.05,
    shadowRadius: 10,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: S.vs(6),
    paddingHorizontal: S.s(10),
    borderRadius: S.ms(14),
    marginHorizontal: S.s(4),
  },
  iconContainer: {
    width: S.ms(38),
    height: S.ms(38),
    borderRadius: S.ms(12),
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  label: {
    marginLeft: S.s(8),
    fontSize: S.fs(11),
    fontWeight: '900',
    letterSpacing: 0,
  }
});
