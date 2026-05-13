import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView, Dimensions , useColorScheme } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppContext } from '../../App';

import { Theme } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

const { width } = Theme.layout;

const ACTES_INFIRMIERS = [
  { id: 'inj_im', label: 'Injection IM', icon: 'needle' },
  { id: 'inj_iv', label: 'Injection IV', icon: 'needle' },
  { id: 'perfusion', label: 'Pose de perfusion', icon: 'iv-bag' },
  { id: 'pansement', label: 'Pansement simple', icon: 'bandage' },
  { id: 'prelevement', label: 'Prélèvement sanguin', icon: 'test-tube' },
  { id: 'sondage', label: 'Sondage urinaire', icon: 'test-tube' },
];

const OBSERVATIONS = [
  { id: 'conscient', label: 'Patient conscient et orienté', icon: 'brain' },
  { id: 'agite', label: 'Patient agité', icon: 'alert' },
  { id: 'douloureux', label: 'Patient algique', icon: 'emoticon-cry-outline' },
  { id: 'apaise', label: 'Patient calmé après soins', icon: 'emoticon-happy-outline' },
];

export default function SoinsActionPanel({ isOpen, anim, onClose, isDark: _ignored, onAppendNotes }) {
  const { isDark, C, brandColor } = useTheme();
  const styles = createStyles(C, brandColor);

  const [selectedActes, setSelectedActes] = useState([]);
  const [selectedObs, setSelectedObs] = useState([]);

  const toggleItem = (list, setList, id) => {
    setList(list.includes(id) ? list.filter(item => item !== id) : [...list, id]);
  };

  const handleValidate = () => {
    let newNotes = [];
    if (selectedActes.length > 0) {
      const actesText = selectedActes.map(id => ACTES_INFIRMIERS.find(a => a.id === id)?.label).join(', ');
      newNotes.push(`Actes réalisés : ${actesText}`);
    }
    if (selectedObs.length > 0) {
      const obsText = selectedObs.map(id => OBSERVATIONS.find(a => a.id === id)?.label).join(', ');
      newNotes.push(`Observations : ${obsText}`);
    }
    if (newNotes.length > 0) onAppendNotes(newNotes.join('\n'));
    setSelectedActes([]);
    setSelectedObs([]);
    onClose();
  };

  const hasSelection = selectedActes.length > 0 || selectedObs.length > 0;

  return (
    <>
      {isOpen && (
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: C.overlay, zIndex: 998 }]} />
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.panel, { backgroundColor: C.bg, transform: [{ translateX: anim }] }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: C.divider }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <LinearGradient colors={Theme.colors.brandGradient} style={styles.iconBox}>
              <MaterialCommunityIcons name="toolbox" size={20} color="#FFF" />
            </LinearGradient>
            <Text style={[styles.title, { color: C.text }]}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["ACTES & SOINS"] || "ACTES & SOINS"}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: C.closeBg }]}>
            <MaterialIcons name="close" size={20} color={C.closeIc} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Actes infirmiers */}
          <Text style={[styles.sectionTitle, { color: C.sub }]}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["ACTES INFIRMIERS RAPIDES"] || "ACTES INFIRMIERS RAPIDES"}</Text>
          <View style={styles.grid}>
            {ACTES_INFIRMIERS.map(acte => {
              const isSelected = selectedActes.includes(acte.id);
              return (
                <TouchableOpacity
                  key={acte.id}
                  style={[styles.card, {
                    backgroundColor: isSelected ? brandColor : C.surface,
                    borderColor: isSelected ? brandColor : C.border,
                  }]}
                  onPress={() => toggleItem(selectedActes, setSelectedActes, acte.id)}
                >
                  <MaterialCommunityIcons
                    name={acte.icon}
                    size={24}
                    color={isSelected ? '#FFF' : brandColor}
                    style={{ marginBottom: 8 }}
                  />
                  <Text style={[styles.cardLabel, { color: isSelected ? '#FFF' : C.sub }]}>
                    {acte.label}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <MaterialCommunityIcons name="check" size={10} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Observations */}
          <Text style={[styles.sectionTitle, { color: C.sub, marginTop: 24 }]}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["OBSERVATIONS CLINIQUES"] || "OBSERVATIONS CLINIQUES"}</Text>
          <View style={styles.grid}>
            {OBSERVATIONS.map(obs => {
              const isSelected = selectedObs.includes(obs.id);
              return (
                <TouchableOpacity
                  key={obs.id}
                  style={[styles.card, {
                    backgroundColor: isSelected ? brandColor : C.surface,
                    borderColor: isSelected ? brandColor : C.border,
                  }]}
                  onPress={() => toggleItem(selectedObs, setSelectedObs, obs.id)}
                >
                  <MaterialCommunityIcons
                    name={obs.icon}
                    size={24}
                    color={isSelected ? '#FFF' : brandColor}
                    style={{ marginBottom: 8 }}
                  />
                  <Text style={[styles.cardLabel, { color: isSelected ? '#FFF' : C.sub }]}>
                    {obs.label}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <MaterialCommunityIcons name="check" size={10} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {hasSelection && (
            <View style={{
              marginTop: 16, padding: 14, borderRadius: 16,
              backgroundColor: brandColor + '12', borderWidth: 1, borderColor: brandColor + '30',
            }}>
              <Text style={{ color: brandColor, fontWeight: '800', fontSize: 12 }}>
                {selectedActes.length + selectedObs.length} élément(s) sélectionné(s)
              </Text>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: C.bg, borderTopColor: C.divider }]}>
          <TouchableOpacity
            style={styles.validateBtn}
            onPress={handleValidate}
            disabled={!hasSelection}
          >
            <LinearGradient
              colors={hasSelection ? Theme.colors.brandGradient : ['#94A3B8', '#64748B']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.validateGrad}
            >
              <MaterialCommunityIcons name="clipboard-check-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.validateText}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["GÉNÉRER LES NOTES"] || "GÉNÉRER LES NOTES"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
}

const createStyles = (C, brandColor) => StyleSheet.create({
  panel: {
    position: 'absolute', top: 12, bottom: 12, left: 12,
    width: width * 0.86, maxWidth: 380, zIndex: 999,
    borderRadius: 36,
    elevation: 40,
    shadowColor: '#000', shadowOffset: { width: 12, height: 0 }, shadowOpacity: 0.25, shadowRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  header: {
    height: 96, paddingTop: 24, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1,
  },
  iconBox: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14, elevation: 4 },
  title: { fontSize: 15, fontWeight: '900', letterSpacing: 1.2 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  scroll: { flex: 1, padding: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 20, opacity: 0.6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48%', borderRadius: 20, borderWidth: 1,
    padding: 18, marginBottom: 14, alignItems: 'flex-start', position: 'relative',
    elevation: 2,
  },
  cardLabel: { fontSize: 12, fontWeight: '800', lineHeight: 18 },
  checkBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#FFF',
  },
  footer: { padding: 24, paddingBottom: 32, borderTopWidth: 1 },
  validateBtn: { height: 60, borderRadius: 30, overflow: 'hidden', elevation: 8 },
  validateGrad: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  validateText: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
});
