import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/api';
import { ToastContext } from '../components/ToastManager';
import PremiumHeader from '../components/PremiumHeader';
import PremiumFooter from '../components/PremiumFooter';
import ProfileView from '../components/ProfileView';
import { useTheme } from '../hooks/useTheme';

export default function MaternityScreen({ navigation, route }) {
  const { isDark, C, brandColor, user, lang, toggleLang, themeMode, toggleTheme, isOnline } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useContext(ToastContext);
  const [activeView, setActiveView] = useState(route.params?.tab || 'cases');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [form, setForm] = useState({
    patient_id: '',
    visit_id: '',
    gestational_age_weeks: '',
    gravida: '',
    parity: '',
    risk_level: 'low',
    maternal_bp: '',
    fetal_heart_rate: '',
    notes: '',
  });
  const [followUp, setFollowUp] = useState({
    type: 'prenatal_check',
    maternal_bp: '',
    fetal_heart_rate: '',
    cervical_dilation: '',
    contractions: '',
    temperature: '',
    notes: '',
    next_action: '',
  });
  const [delivery, setDelivery] = useState({
    delivery_type: 'vaginal',
    baby_gender: 'unknown',
    baby_weight: '',
    baby_apgar: '',
    delivery_fee: '',
    notes: '',
  });

  const styles = createStyles(C, brandColor);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (route.params?.tab) setActiveView(route.params.tab);
  }, [route.params?.tab]);

  const parseError = (e) => e.response?.data?.message || 'Erreur maternité';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [casesResp, statsResp] = await Promise.all([
        api.get('/maternity/cases'),
        api.get('/maternity/stats'),
      ]);
      setCases(casesResp.data.data || casesResp.data || []);
      setStats(statsResp.data);
    } catch (e) {
      showToast(parseError(e), 'error');
    } finally {
      setLoading(false);
    }
  };

  const openCase = async (item) => {
    try {
      const resp = await api.get(`/maternity/cases/${item.id}`);
      setSelectedCase(resp.data);
      setActiveView('details');
    } catch (e) {
      showToast(parseError(e), 'error');
    }
  };

  const createCase = async () => {
    if (!form.patient_id) return showToast('ID patient requis', 'error');

    try {
      const payload = normalizePayload(form);
      const resp = await api.post('/maternity/cases', payload);
      showToast('Dossier maternité créé', 'success');
      setSelectedCase(resp.data.maternity_case);
      setActiveView('details');
      fetchData();
    } catch (e) {
      showToast(parseError(e), 'error');
    }
  };

  const saveFollowUp = async () => {
    if (!selectedCase?.id) return;

    try {
      const resp = await api.post(`/maternity/cases/${selectedCase.id}/follow-ups`, normalizePayload(followUp));
      showToast('Suivi enregistré', 'success');
      setSelectedCase(resp.data.maternity_case);
      setFollowUp({ type: 'prenatal_check', maternal_bp: '', fetal_heart_rate: '', cervical_dilation: '', contractions: '', temperature: '', notes: '', next_action: '' });
      openCase(selectedCase);
      fetchData();
    } catch (e) {
      showToast(parseError(e), 'error');
    }
  };

  const saveDelivery = async () => {
    if (!selectedCase?.id) return;

    try {
      const resp = await api.post(`/maternity/cases/${selectedCase.id}/deliver`, normalizePayload(delivery));
      showToast('Accouchement enregistré', 'success');
      setSelectedCase(resp.data.maternity_case);
      fetchData();
    } catch (e) {
      showToast(parseError(e), 'error');
    }
  };

  const discharge = async () => {
    if (!selectedCase?.id) return;

    try {
      const resp = await api.post(`/maternity/cases/${selectedCase.id}/discharge`, { notes: 'Sortie validée depuis le module maternité.' });
      showToast('Sortie enregistrée', 'success');
      setSelectedCase(resp.data.maternity_case);
      fetchData();
    } catch (e) {
      showToast(parseError(e), 'error');
    }
  };

  const normalizePayload = (source) => Object.fromEntries(
    Object.entries(source)
      .filter(([, value]) => value !== '' && value !== null && value !== undefined)
      .map(([key, value]) => {
        if (['patient_id', 'visit_id', 'gestational_age_weeks', 'gravida', 'parity', 'fetal_heart_rate'].includes(key)) {
          return [key, Number(value)];
        }
        if (['baby_weight', 'delivery_fee', 'temperature', 'cervical_dilation'].includes(key)) {
          return [key, Number(value)];
        }
        return [key, value];
      })
  );

  const renderStats = () => (
    <View style={styles.statsGrid}>
      {[
        ['Dossiers actifs', stats?.active_count || 0, 'mother-heart'],
        ['En travail', stats?.labor_count || 0, 'baby-carriage'],
        ['Risque élevé', stats?.high_risk_count || 0, 'alert-octagon'],
        ["Accouchements aujourd'hui", stats?.deliveries_today || 0, 'human-pregnant'],
      ].map(([label, value, icon]) => (
        <View key={label} style={styles.statCard}>
          <MaterialCommunityIcons name={icon} size={22} color={brandColor} />
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );

  const renderCaseCard = (item) => (
    <TouchableOpacity key={item.id} style={styles.card} onPress={() => openCase(item)}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{item.patient?.first_name} {item.patient?.last_name}</Text>
        <Text style={[styles.badge, item.risk_level === 'high' || item.risk_level === 'emergency' ? styles.badgeDanger : null]}>{String(item.risk_level || 'low').toUpperCase()}</Text>
      </View>
      <Text style={styles.cardSub}>{item.gestational_age_weeks ? `${item.gestational_age_weeks} SA` : 'Terme non renseigné'} · {item.pregnancy_status}</Text>
      <Text style={styles.cardMeta}>TA {item.maternal_bp || '-'} · BCF {item.fetal_heart_rate || '-'} · Suivis {item.follow_ups_count || 0}</Text>
    </TouchableOpacity>
  );

  const renderCases = () => (
    <View>
      {renderStats()}
      {cases.length === 0 ? <Text style={styles.empty}>Aucun dossier maternité actif.</Text> : cases.map(renderCaseCard)}
    </View>
  );

  const renderNewCase = () => (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Nouveau dossier maternité</Text>
      <Field label="ID patient" value={form.patient_id} onChangeText={(v) => setForm({ ...form, patient_id: v })} keyboardType="numeric" />
      <Field label="ID visite (optionnel)" value={form.visit_id} onChangeText={(v) => setForm({ ...form, visit_id: v })} keyboardType="numeric" />
      <View style={styles.row}>
        <Field label="SA" value={form.gestational_age_weeks} onChangeText={(v) => setForm({ ...form, gestational_age_weeks: v })} keyboardType="numeric" compact />
        <Field label="Geste" value={form.gravida} onChangeText={(v) => setForm({ ...form, gravida: v })} keyboardType="numeric" compact />
        <Field label="Parité" value={form.parity} onChangeText={(v) => setForm({ ...form, parity: v })} keyboardType="numeric" compact />
      </View>
      <Segmented value={form.risk_level} onChange={(risk_level) => setForm({ ...form, risk_level })} options={['low', 'moderate', 'high', 'emergency']} />
      <Field label="TA maternelle" value={form.maternal_bp} onChangeText={(v) => setForm({ ...form, maternal_bp: v })} />
      <Field label="BCF" value={form.fetal_heart_rate} onChangeText={(v) => setForm({ ...form, fetal_heart_rate: v })} keyboardType="numeric" />
      <Field label="Notes" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} multiline />
      <ActionButton label="Créer le dossier" icon="content-save" onPress={createCase} />
    </View>
  );

  const renderDetails = () => {
    if (!selectedCase) return <Text style={styles.empty}>Sélectionnez un dossier.</Text>;

    return (
      <View>
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle}>{selectedCase.patient?.first_name} {selectedCase.patient?.last_name}</Text>
            <Text style={styles.badge}>{selectedCase.status}</Text>
          </View>
          <Text style={styles.cardSub}>{selectedCase.gestational_age_weeks || '-'} SA · {selectedCase.pregnancy_status}</Text>
          <Text style={styles.cardMeta}>TA {selectedCase.maternal_bp || '-'} · BCF {selectedCase.fetal_heart_rate || '-'} · Temp {selectedCase.temperature || '-'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Nouveau suivi</Text>
          <Segmented value={followUp.type} onChange={(type) => setFollowUp({ ...followUp, type })} options={['prenatal_check', 'labor_monitoring', 'postnatal', 'neonatal', 'emergency']} />
          <View style={styles.row}>
            <Field label="TA" value={followUp.maternal_bp} onChangeText={(v) => setFollowUp({ ...followUp, maternal_bp: v })} compact />
            <Field label="BCF" value={followUp.fetal_heart_rate} onChangeText={(v) => setFollowUp({ ...followUp, fetal_heart_rate: v })} keyboardType="numeric" compact />
          </View>
          <View style={styles.row}>
            <Field label="Dilatation" value={followUp.cervical_dilation} onChangeText={(v) => setFollowUp({ ...followUp, cervical_dilation: v })} keyboardType="numeric" compact />
            <Field label="Temp." value={followUp.temperature} onChangeText={(v) => setFollowUp({ ...followUp, temperature: v })} keyboardType="numeric" compact />
          </View>
          <Field label="Contractions" value={followUp.contractions} onChangeText={(v) => setFollowUp({ ...followUp, contractions: v })} />
          <Field label="Notes" value={followUp.notes} onChangeText={(v) => setFollowUp({ ...followUp, notes: v })} multiline />
          <ActionButton label="Enregistrer le suivi" icon="clipboard-pulse" onPress={saveFollowUp} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Accouchement</Text>
          <Segmented value={delivery.delivery_type} onChange={(delivery_type) => setDelivery({ ...delivery, delivery_type })} options={['vaginal', 'cesarean', 'assisted']} />
          <View style={styles.row}>
            <Field label="Sexe bébé" value={delivery.baby_gender} onChangeText={(v) => setDelivery({ ...delivery, baby_gender: v })} compact />
            <Field label="Poids" value={delivery.baby_weight} onChangeText={(v) => setDelivery({ ...delivery, baby_weight: v })} keyboardType="numeric" compact />
          </View>
          <Field label="Apgar" value={delivery.baby_apgar} onChangeText={(v) => setDelivery({ ...delivery, baby_apgar: v })} />
          <Field label="Frais accouchement" value={delivery.delivery_fee} onChangeText={(v) => setDelivery({ ...delivery, delivery_fee: v })} keyboardType="numeric" />
          <Field label="Notes" value={delivery.notes} onChangeText={(v) => setDelivery({ ...delivery, notes: v })} multiline />
          <ActionButton label="Valider accouchement" icon="baby-face-outline" onPress={saveDelivery} />
          <TouchableOpacity style={styles.secondaryButton} onPress={discharge}>
            <Text style={styles.secondaryButtonText}>Sortie maternité</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Historique</Text>
          {(selectedCase.follow_ups || []).length === 0 ? <Text style={styles.emptySmall}>Aucun suivi enregistré.</Text> : selectedCase.follow_ups.map((f) => (
            <View key={f.id} style={styles.timelineItem}>
              <Text style={styles.timelineTitle}>{f.type} · {f.user?.name || 'Agent'}</Text>
              <Text style={styles.cardMeta}>{f.notes || 'Sans notes'}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const Field = ({ label, compact, ...props }) => (
    <View style={[styles.field, compact ? styles.compactField : null]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} placeholderTextColor={C.sub} style={[styles.input, props.multiline ? styles.textarea : null]} />
    </View>
  );

  const Segmented = ({ value, onChange, options }) => (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = value === option;
        return (
          <TouchableOpacity key={option} onPress={() => onChange(option)} style={[styles.segment, selected ? styles.segmentActive : null]}>
            <Text style={[styles.segmentText, selected ? styles.segmentTextActive : null]}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const ActionButton = ({ label, icon, onPress }) => (
    <TouchableOpacity style={styles.primaryButton} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={20} color="#FFF" />
      <Text style={styles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );

  const menu = [
    { id: 'cases', label: 'Dossiers', icon: 'mother-heart' },
    { id: 'new', label: 'Nouveau', icon: 'plus-circle' },
    { id: 'profile', label: 'Profil', icon: 'account-circle' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PremiumHeader
        title="Maternité"
        subtitle={activeView === 'new' ? 'Nouveau dossier' : activeView === 'details' ? 'Suivi patiente' : 'Dossiers actifs'}
        navigation={navigation}
        isOnline={isOnline}
        themeMode={themeMode}
        toggleTheme={toggleTheme}
        lang={lang}
        toggleLang={toggleLang}
        user={user}
        brandColor={brandColor}
        isDark={isDark}
      />

      <View style={styles.tabs}>
        {menu.map((item) => (
          <TouchableOpacity key={item.id} onPress={() => setActiveView(item.id)} style={[styles.tab, activeView === item.id ? styles.tabActive : null]}>
            <MaterialCommunityIcons name={item.icon} size={18} color={activeView === item.id ? '#FFF' : C.sub} />
            <Text style={[styles.tabText, activeView === item.id ? styles.tabTextActive : null]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={brandColor} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {activeView === 'cases' && renderCases()}
          {activeView === 'new' && renderNewCase()}
          {activeView === 'details' && renderDetails()}
          {activeView === 'profile' && <ProfileView />}
        </ScrollView>
      )}

      <PremiumFooter
        tabs={menu}
        activeTab={activeView === 'details' ? 'cases' : activeView}
        onTabPress={setActiveView}
      />
    </View>
  );
}

const createStyles = (C, brandColor) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 96 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', padding: 12, gap: 8 },
  tab: { flex: 1, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: C.card },
  tabActive: { backgroundColor: brandColor, borderColor: brandColor },
  tabText: { color: C.sub, fontWeight: '800', fontSize: 12 },
  tabTextActive: { color: '#FFF' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statCard: { width: '48%', borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, padding: 14 },
  statValue: { color: C.text, fontSize: 24, fontWeight: '900', marginTop: 8 },
  statLabel: { color: C.sub, fontSize: 12, fontWeight: '700', marginTop: 3 },
  card: { borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { color: C.text, fontSize: 17, fontWeight: '900', flex: 1 },
  cardSub: { color: C.text, fontSize: 13, fontWeight: '700', marginTop: 8 },
  cardMeta: { color: C.sub, fontSize: 12, marginTop: 6, lineHeight: 18 },
  badge: { color: brandColor, borderColor: brandColor + '55', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '900' },
  badgeDanger: { color: '#EF4444', borderColor: '#EF444455' },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: '900', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  field: { marginBottom: 10 },
  compactField: { flex: 1 },
  label: { color: C.sub, fontSize: 11, fontWeight: '900', marginBottom: 6, textTransform: 'uppercase' },
  input: { minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, color: C.text, backgroundColor: C.bg },
  textarea: { height: 96, paddingTop: 12, textAlignVertical: 'top' },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  segment: { borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: C.bg },
  segmentActive: { backgroundColor: brandColor, borderColor: brandColor },
  segmentText: { color: C.sub, fontWeight: '800', fontSize: 11 },
  segmentTextActive: { color: '#FFF' },
  primaryButton: { minHeight: 48, borderRadius: 8, backgroundColor: brandColor, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 6 },
  primaryButtonText: { color: '#FFF', fontWeight: '900' },
  secondaryButton: { minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryButtonText: { color: C.text, fontWeight: '900' },
  empty: { color: C.sub, textAlign: 'center', marginTop: 24, fontWeight: '700' },
  emptySmall: { color: C.sub, fontWeight: '700' },
  timelineItem: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, marginTop: 10 },
  timelineTitle: { color: C.text, fontWeight: '900', fontSize: 12 },
});
