import React from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

const { width } = Theme.layout;

export default function SoinsNavPanel({ isOpen, anim, onClose, isDark: _ignored, activeView, setActiveView }) {
  const { isDark, C, brandColor } = useTheme();
  const styles = createStyles(C, brandColor);

  const menuItems = [
    { id: 'care', title: 'Prise en charge', icon: 'needle', desc: 'Patients renvoyés par le médecin' },
    { id: 'queue', title: 'Triage & Accueil', icon: 'heart-pulse', desc: "File d'attente standard" },
    { id: 'urgencies', title: 'Urgences', icon: 'ambulance', desc: 'Prise en charge rapide' },
    { id: 'control', title: 'Contrôle & Suivi', icon: 'radar', desc: 'État des malades transférés' },
    { id: 'history', title: 'Historique Transferts', icon: 'history', desc: 'Registre de vos transferts' },
  ];

  return (
    <>
      {isOpen && (
        <TouchableOpacity
          style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: C.overlay }]} />
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.panel, { backgroundColor: C.bg, transform: [{ translateX: anim }] }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: C.border }]}>
          <LinearGradient colors={Theme.colors.brandGradient} style={styles.iconBox}>
            <MaterialCommunityIcons name="medical-bag" size={24} color="#FFF" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: C.text }]}>NAVIGATION SOINS</Text>
            <Text style={{ color: brandColor, fontSize: 10, fontWeight: '800', marginTop: 2 }}>MODULE INFIRMIER</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: C.closeBg }]}>
            <MaterialIcons name="close" size={20} color={C.closeIc} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 20 }}>
            {menuItems.map(item => {
              const isSelected = activeView === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.menuCard,
                    {
                      backgroundColor: isSelected ? brandColor : C.surface,
                      borderColor: isSelected ? brandColor : C.border,
                    },
                  ]}
                  onPress={() => { setActiveView(item.id); onClose(); }}
                >
                  <View style={[
                    styles.menuIconBox,
                    { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : (brandColor + '15') },
                  ]}>
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={22}
                      color={isSelected ? '#FFF' : brandColor}
                    />
                  </View>
                  <View style={{ marginLeft: 14, flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: isSelected ? '#FFF' : C.text }}>
                      {item.title}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: isSelected ? '#E0F2FE' : C.sub, marginTop: 2 }}>
                      {item.desc}
                    </Text>
                  </View>
                  {isSelected && <MaterialIcons name="check-circle" size={20} color="#FFF" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </Animated.View>
    </>
  );
}

const createStyles = (C, brandColor) => StyleSheet.create({
  panel: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
    width: width * 0.85, maxWidth: 360, zIndex: 1001,
    elevation: 30,
    shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.15, shadowRadius: 12,
  },
  header: {
    height: 100, paddingTop: 30, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
  },
  iconBox: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  menuIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, padding: 16 },
  menuCard: { padding: 20, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
});
