import React, { useContext } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView, Dimensions , useColorScheme } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppContext } from '../../App';

import { Theme } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

const { width } = Theme.layout;

const DIAGNOSES = [
  'Paludisme simple', 'Paludisme grave', 'Fièvre typhoïde',
  'Infection Respiratoire Aiguë (IRA)', 'Gastro-entérite',
  'Hypertension Artérielle (HTA)', 'Diabète de type 2', 'Anémie ferriprive',
  'Malnutrition protéino-énergétique', 'Diarrhée infectieuse', 'Cystite / Infection urinaire',
  'Appendicite aiguë', 'Hernie inguinale', 'Gastrite chronique',
];

const QUICK_NOTES = [
  'Patient stable, revoir dans 3 jours si persistance des symptômes.',
  'Hospitalisation recommandée en urgence pour surveillance.',
  'Repos médical accordé pour 3 jours (Certificat délivré).',
  'Référé vers un médecin spécialiste pour avis complémentaire.',
  'Poursuivre le traitement en cours et observer le régime alimentaire.',
  'Mise en observation immédiate et constantes à suivre toutes les 2h.',
];

export default function DoctorActionPanel({ isOpen, anim, onClose, isDark: _ignored, onAppendDiagnosis, onAppendNotes }) {
  const { isDark, C, brandColor } = useTheme();
  const styles = createStyles(C, brandColor);

  return (
    <>
      {isOpen && (
        <TouchableOpacity
          style={[StyleSheet.absoluteFillObject, { zIndex: 998 }]}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: C.overlay }]} />
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.panel, { backgroundColor: C.bg, transform: [{ translateX: anim }] }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: C.divider }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <LinearGradient colors={Theme.colors.brandGradient} style={styles.iconBox}>
              <MaterialCommunityIcons name="clipboard-pulse" size={20} color="#FFF" />
            </LinearGradient>
            <View>
              <Text style={[styles.title, { color: C.text }]}>MODÈLES CLINIQUES</Text>
              <Text style={{ fontSize: 10, color: C.sub, fontWeight: '700' }}>Saisie rapide intelligente</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: C.closeBg }]}>
            <MaterialIcons name="close" size={20} color={C.closeIc} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Diagnostics */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
             <MaterialCommunityIcons name="tag-outline" size={16} color={brandColor} />
             <Text style={[styles.sectionTitle, { color: C.sub, marginBottom: 0, marginLeft: 8 }]}>DIAGNOSTICS FRÉQUENTS</Text>
          </View>
          <View style={styles.chipContainer}>
            {DIAGNOSES.map(diag => (
              <TouchableOpacity
                key={diag}
                style={[styles.chip, { backgroundColor: C.surface, borderColor: C.border }]}
                onPress={() => { onAppendDiagnosis(diag); onClose(); }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.sub }}>{diag}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Notes */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 32 }}>
             <MaterialCommunityIcons name="notebook-outline" size={16} color={brandColor} />
             <Text style={[styles.sectionTitle, { color: C.sub, marginBottom: 0, marginLeft: 8 }]}>NOTES & CONDUITES À TENIR</Text>
          </View>
          <View style={{ gap: 10 }}>
            {QUICK_NOTES.map((note, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.noteCard, { backgroundColor: C.surface, borderColor: C.border }]}
                onPress={() => { onAppendNotes(note); onClose(); }}
              >
                <View style={styles.noteIcon}>
                   <MaterialCommunityIcons name="text-box-plus-outline" size={16} color={brandColor} />
                </View>
                <Text style={{ flex: 1, fontSize: 13, color: C.sub, lineHeight: 20, fontWeight: '600' }}>{note}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 60 }} />
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: C.divider }]}>
           <Text style={{ fontSize: 10, color: C.sub, textAlign: 'center', fontWeight: '800' }}>APPUIE SUR UN MODÈLE POUR L'INSERER</Text>
        </View>
      </Animated.View>
    </>
  );
}

const createStyles = (C, brandColor) => StyleSheet.create({
  panel: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
    width: width * 0.85, maxWidth: 360, zIndex: 999,
    elevation: 25,
    shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.2, shadowRadius: 15,
  },
  header: {
    height: 100, paddingTop: 40, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1,
  },
  iconBox: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  title: { fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  chip: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  noteCard: { padding: 18, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'flex-start', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  noteIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.brandMedium, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  footer: { padding: 20, paddingBottom: 40, borderTopWidth: 1 },
});
