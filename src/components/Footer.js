import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function Footer({ darkMode }) {
  return (
    <View style={[styles.footer, { backgroundColor: darkMode ? '#1A1C1E' : '#F1F5F9' }]}>
      <Text style={[styles.title, { color: darkMode ? '#FFF' : '#1A1A1A' }]}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["REHOBOTH"] || "REHOBOTH"}</Text>
      <View style={styles.info}>
        <View style={styles.item}><MaterialCommunityIcons name="map-marker" size={12} color="#64748B" /><Text style={styles.text}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["Lubumbashi, RDC"] || "Lubumbashi, RDC"}</Text></View>
        <View style={styles.item}><MaterialCommunityIcons name="phone" size={12} color="#64748B" /><Text style={styles.text}>+243 81 000 00 00</Text></View>
      </View>
      <View style={styles.divider} />
      <Text style={styles.copy}>© {new Date().getFullYear()} JP SERVICES</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 20 },
  title: { fontWeight: 'bold', marginBottom: 10 },
  info: { gap: 5 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  text: { fontSize: 11, color: '#64748B' },
  divider: { width: '100%', height: 1, backgroundColor: 'rgba(0,0,0,0.1)', marginVertical: 15 },
  copy: { fontSize: 10, color: '#94A3B8', fontWeight: 'bold' }
});