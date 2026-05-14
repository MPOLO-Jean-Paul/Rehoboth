import React, { useEffect, useState, useRef, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, TextInput, Animated, Switch, StatusBar, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';
import { AppContext } from '../../App';
import { ToastContext } from '../components/ToastManager';
import { PressableScale, FadeInView, SkeletonItem } from '../components/AnimatedComponents';
import { translations } from '../i18n/translations';
import { clearAuthSession } from '../services/session';
import PremiumLeftDrawer from '../components/PremiumLeftDrawer';
import PremiumRightPanel from '../components/PremiumRightPanel';
import PremiumHeader from '../components/PremiumHeader';
import FloatingActionDock from '../components/FloatingActionDock';
import ProfileView from '../components/ProfileView';
import PremiumFooter from '../components/PremiumFooter';
import SoinsActionPanel from '../components/SoinsActionPanel';
import { Theme } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

import Storage from '../services/Storage';

const { width, height } = Theme.layout;
const normalizeSearch = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function SoinsScreen({ navigation, route }) {
  const { isDark, C, S, brandColor, themeMode, toggleTheme, lang, toggleLang, isOnline } = useTheme();
  const styles = createStyles(C, S, brandColor);
  const insets = useSafeAreaInsets();
  const { showToast } = useContext(ToastContext);
  const t = translations[lang] || translations.fr;
  const bt = t.bottomTabs || {};

  const [visits, setVisits] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bottomLoading, setBottomLoading] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [activeTab, setActiveTab] = useState('queue'); // queue, history
  const [activeBottomTab, setActiveBottomTab] = useState(null); // null | 'stats'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  const [transferDestination, setTransferDestination] = useState('medecin'); // 'medecin' | 'completed'

  // Hospitalisation State
  const [hospitalizations, setHospitalizations] = useState([]);
  const [hospLoading, setHospLoading] = useState(false);
  const [showAdmitForm, setShowAdmitForm] = useState(false);
  const [isBillingDaily, setIsBillingDaily] = useState(false);
  const [admitForm, setAdmitForm] = useState({
    patient_id: '',
    patient_name: '',
    room_number: '',
    bed_number: '',
    ward: '',
    daily_rate: '',
    diagnosis: '',
    notes: '',
    attending_doctor_id: null,
  });
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [selectedHosp, setSelectedHosp] = useState(null); // for detail view

  // Rapport de Garde State
  const [nursingReports, setNursingReports] = useState([]);
  const [alerts, setAlerts] = useState({ alerts: [], total: 0, critical: 0 });
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportForm, setReportForm] = useState({
    shift_type: 'matin',
    report_date: new Date().toISOString().split('T')[0],
    patients_seen: '',
    transfers_done: '',
    emergencies_handled: '',
    summary: '',
    patients_to_watch: '',
    handover_notes: '',
    status: 'draft',
  });
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [todayStats, setTodayStats] = useState(null);
  const [reportsView, setReportsView] = useState('alerts'); // 'alerts' | 'form' | 'history'

  // Form States
  const [notes, setNotes] = useState('');
  const [vitals, setVitals] = useState({
    temperature: '',
    blood_pressure: '',
    weight: '',
    height: '',
    pulse: '',
    respiratory_rate: '',
    oxygen_saturation: '',
  });

  const [isRightOpen, setIsRightOpen] = useState(false);
  const rightAnim = useRef(new Animated.Value(width)).current;
  const bottomPanelAnim = useRef(new Animated.Value(0)).current;

  // Soins Action Panel State
  const [isActionPanelOpen, setIsActionPanelOpen] = useState(false);
  const actionPanelAnim = useRef(new Animated.Value(-width)).current;

  // Nav Panel State
  const [isNavPanelOpen, setIsNavPanelOpen] = useState(false);
  const navPanelAnim = useRef(new Animated.Value(-width)).current;
  const [activeView, setActiveView] = useState('care'); // care, queue, urgencies, control, history

  // Urgency Form
  const [emergencyForm, setEmergencyForm] = useState({
    first_name: '', last_name: '', complaints: '',
    gender: 'M', age: '',
    is_insured: false, insurance_id: '', insurance_code: ''
  });
  const [isSubmittingEmergency, setIsSubmittingEmergency] = useState(false);
  const [insurances, setInsurances] = useState([]);
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [medSearch, setMedSearch] = useState('');
  const [medResults, setMedResults] = useState([]);

  useEffect(() => {
    loadCachedData();
    fetchVisits();
    fetchDoctors();
  }, []);

  useEffect(() => {
    const requestedTab = route.params?.tab;
    if (requestedTab && ['care', 'queue', 'urgencies', 'control', 'hospitalisation', 'alertes', 'rapport', 'history'].includes(requestedTab)) {
      setActiveView(requestedTab);
      setActiveTab(requestedTab === 'history' ? 'history' : 'queue');
      setActiveBottomTab(null);
      navigation.setParams({ tab: null });
    }

    if (route.params?.visitId && visits.length > 0) {
      const visit = visits.find(v => String(v.id) === String(route.params.visitId));
      if (visit) {
        setSelectedVisit(visit);
        setActiveView(requestedTab && requestedTab !== 'history' ? requestedTab : 'queue');
        // Clear params to avoid re-triggering
        navigation.setParams({ visitId: null });
      }
    }
  }, [route.params?.visitId, route.params?.tab, visits]);

  useEffect(() => {
    fetchInsurances();
    fetchHistory();
    fetchHospitalizations();
    fetchAlerts();
    fetchNursingReports();

    const startInterval = () => {
      return setInterval(() => {
        fetchVisits(true);
        fetchHistory(true);
        fetchAlerts();
      }, 15000);
    };

    let interval = startInterval();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        fetchVisits(true);
        fetchHistory(true);
        fetchAlerts();
        interval = startInterval();
      } else {
        clearInterval(interval);
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  const loadCachedData = async () => {
    const cached = await Storage.get('soins_data');
    if (cached) {
      setVisits(cached.visits || []);
      setHistory(cached.history || []);
      setHospitalizations(cached.hospitalizations || []);
      setAlerts(cached.alerts || { alerts: [], total: 0, critical: 0 });
      setLoading(false);
    }
  };

  const syncCache = async (key, val) => {
    const current = await Storage.get('soins_data') || {};
    Storage.save('soins_data', { ...current, [key]: val });
  };

  const fetchInsurances = async () => {
    try {
      const resp = await api.get('/insurances');
      const data = resp.data;
      setInsurances(Array.isArray(data) ? data : (data.data || []));
    } catch (e) { console.log(e); }
  };

  const fetchDoctors = async () => {
    try {
      const resp = await api.get('/doctors');
      setDoctors(resp.data);
    } catch (e) { /* silently fail - doctors list is optional */ }
  };

  const fetchHospitalizations = async () => {
    setHospLoading(true);
    try {
      const resp = await api.get('/hospitalizations');
      const dataRaw = resp.data;
      const data = Array.isArray(dataRaw) ? dataRaw : (dataRaw.data || []);
      setHospitalizations(data);
      syncCache('hospitalizations', data);
    } catch (e) { showToast('Erreur chargement hospitalisation', 'error'); }
    finally { setHospLoading(false); }
  };

  const searchPatients = async (q) => {
    setPatientSearch(q);
    if (q.length < 2) { setPatientResults([]); return; }
    setSearchingPatient(true);
    try {
      const resp = await api.get('/patients', { params: { q } });
      const data = resp.data;
      const results = Array.isArray(data) ? data : (data.data || []);
      setPatientResults(results.slice(0, 5));
    } catch (e) { }
    finally { setSearchingPatient(false); }
  };

  const handleAdmit = async () => {
    if (!admitForm.patient_id) return showToast('Sélectionnez un patient', 'error');
    if (!admitForm.daily_rate) return showToast('Entrez le tarif journalier', 'error');
    setIsSubmitting(true);
    try {
      await api.post('/hospitalizations', {
        patient_id: admitForm.patient_id,
        room_number: admitForm.room_number,
        bed_number: admitForm.bed_number,
        ward: admitForm.ward,
        daily_rate: parseFloat(admitForm.daily_rate),
        diagnosis: admitForm.diagnosis,
        notes: admitForm.notes,
        attending_doctor_id: admitForm.attending_doctor_id,
      });
      showToast('Patient admis en hospitalisation', 'success');
      setShowAdmitForm(false);
      setAdmitForm({ patient_id: '', patient_name: '', room_number: '', bed_number: '', ward: '', daily_rate: '', diagnosis: '', notes: '', attending_doctor_id: null });
      setPatientSearch('');
      setPatientResults([]);
      fetchHospitalizations();
    } catch (e) {
      showToast(e.response?.data?.message || 'Erreur admission', 'error');
    } finally { setIsSubmitting(false); }
  };

  const handleDischarge = async (hospId) => {
    try {
      await api.post(`/hospitalizations/${hospId}/discharge`);
      showToast('Patient sorti. Facture finale envoyée à la caisse.', 'success');
      setSelectedHosp(null);
      fetchHospitalizations();
    } catch (e) {
      showToast(e.response?.data?.message || 'Erreur sortie', 'error');
    }
  };

  const handleBillDaily = async () => {
    setIsBillingDaily(true);
    try {
      const resp = await api.post('/hospitalizations/bill-daily');
      showToast(`${resp.data.billed_count} patient(s) facturé(s) — Total: ${resp.data.total_amount.toLocaleString()} FC`, 'success');
    } catch (e) {
      showToast('Erreur facturation journalière', 'error');
    } finally { setIsBillingDaily(false); }
  };

  // ---- Rapport de Garde & Alertes ----
  const fetchAlerts = async () => {
    setAlertsLoading(true);
    try {
      const resp = await api.get('/nursing/alerts');
      const data = resp.data && resp.data.alerts ? resp.data : { alerts: [], total: 0, critical: 0 };
      setAlerts(data);
      syncCache('alerts', data);
    } catch (e) { /* silently handle alert fetch error */ }
    finally { setAlertsLoading(false); }
  };

  const fetchNursingReports = async () => {
    try {
      const resp = await api.get('/nursing/reports');
      setNursingReports(Array.isArray(resp.data) ? resp.data : []);
    } catch (e) { /* error fetching reports */ }
  };

  const fetchTodayStats = async () => {
    try {
      const resp = await api.get('/nursing/today-stats');
      const s = resp.data;
      setReportForm(f => ({
        ...f,
        patients_seen: String(s.patients_seen || 0),
        transfers_done: String(s.transfers_done || 0),
        emergencies_handled: String(s.emergencies_handled || 0),
      }));
      setTodayStats(s);
    } catch (e) { }
  };

  const handleMarkChecked = async (hospId) => {
    try {
      await api.post(`/nursing/alerts/mark-checked/${hospId}`);
      showToast('Visite enregistrée', 'success');
      fetchAlerts();
    } catch (e) { showToast(parseError(e), 'error'); }
  };

  const handleTriggerAlert = async (hospId, active, reason = '') => {
    try {
      await api.post(`/nursing/alerts/trigger/${hospId}`, { active, reason });
      showToast(active ? 'Alerte déclenchée' : 'Alerte désactivée', active ? 'warning' : 'success');
      fetchAlerts();
      fetchHospitalizations();
    } catch (e) { showToast(parseError(e), 'error'); }
  };

  const handleSubmitReport = async (submitStatus = 'draft') => {
    if (!reportForm.summary || reportForm.summary.length < 10) return showToast('Le résumé doit faire au moins 10 caractères', 'error');
    setIsSubmittingReport(true);
    try {
      await api.post('/nursing/reports', {
        ...reportForm,
        patients_seen: parseInt(reportForm.patients_seen) || 0,
        transfers_done: parseInt(reportForm.transfers_done) || 0,
        emergencies_handled: parseInt(reportForm.emergencies_handled) || 0,
        patients_to_watch: reportForm.patients_to_watch ? reportForm.patients_to_watch.split('\n').filter(Boolean) : [],
        status: submitStatus,
      });
      showToast(submitStatus === 'submitted' ? 'Rapport soumis ! Notif envoyée à l\'admin.' : 'Brouillon sauvegardé', 'success');
      setShowReportForm(false);
      setReportForm({ shift_type: 'matin', report_date: new Date().toISOString().split('T')[0], patients_seen: '', transfers_done: '', emergencies_handled: '', summary: '', patients_to_watch: '', handover_notes: '', status: 'draft' });
      fetchNursingReports();
    } catch (e) {
      showToast(e.response?.data?.message || 'Erreur envoi rapport', 'error');
    } finally { setIsSubmittingReport(false); }
  };

  const parseError = (e) => {
    if (e.response?.data?.errors) {
      const errors = e.response.data.errors;
      const firstKey = Object.keys(errors)[0];
      return errors[firstKey][0];
    }
    return e.response?.data?.message || t.error;
  };

  const fetchVisits = async (isBg = false) => {
    if (!isBg && !visits.length) setLoading(true);
    try {
      // Fetch patients first
      const prescResp = await api.get('/soins/patients');
      const dataRaw = prescResp.data;
      const data = Array.isArray(dataRaw) ? dataRaw : (dataRaw.data || []);
      setVisits(data);
      syncCache('visits', data);
      
      // Separately fetch medicines to avoid blocking the whole screen if pharmacy API fails
      api.get('/pharmacy/medicines')
        .then(resp => {
           const medData = resp.data;
           setMedicines(Array.isArray(medData) ? medData : (medData.data || []));
        })
        .catch(e => console.log('[Soins] Pharmacy access denied or error:', e.message));

    } catch (e) { 
      console.log('[Soins] Fetch Visits Error:', e);
      if (!isBg) showToast(parseError(e), 'error'); 
    }
    finally { if (!isBg) setLoading(false); }
  };

  const fetchHistory = async (isBg = false) => {
    if (!isBg && !history.length) setLoading(true);
    try {
      // For now, reuse my-today or similar if available
      const resp = await api.get('/visits/my-today');
      const dataRaw = resp.data;
      const data = Array.isArray(dataRaw) ? dataRaw : (dataRaw.data || []);
      setHistory(data);
      syncCache('history', data);
    } catch (e) {
      console.log('[Soins] Fetch History Error:', e);
      if (!isBg) showToast(t.error, 'error');
    }
    finally { if (!isBg) setLoading(false); }
  };

  const handleForward = async () => {
    if (!selectedVisit) return;
    if (!vitals.blood_pressure && !vitals.weight && !vitals.temperature && !notes) {
      return showToast("Renseignez au moins une constante ou des notes de soins", "error");
    }

    setIsSubmitting(true);
    try {
      await api.post('/soins/transfer', {
        visit_id: selectedVisit.id,
        next_service: transferDestination,
        doctor_id: transferDestination === 'medecin' ? selectedDoctorId : null,
        notes,
        vitals,
        prescription_items: prescriptionItems
      });
      showToast("Dossier transféré avec succès", "success");
      setSelectedVisit(null);
      setNotes('');
      setSelectedDoctorId(null);
      setTransferDestination('medecin');
      setVitals({ temperature: '', blood_pressure: '', weight: '', height: '', pulse: '', respiratory_rate: '', oxygen_saturation: '' });
      setPrescriptionItems([]);
      fetchVisits();
      fetchHistory();
    } catch (e) { showToast(parseError(e), 'error'); }
    finally { setIsSubmitting(false); }
  };

  const fetchStats = async () => {
    try {
      const resp = await api.get('/soins/stats');
      setStats(resp.data);
    } catch (e) {
      // Fallback to local calculation if API fails or doesn't exist
      setStats({
        inCare: careList.length,
        urgencies: urgenciesList.length,
        completedToday: historyList.length,
      });
    }
  };

  const toggleBottomTab = (tab) => {
    if (activeBottomTab === tab) {
      setActiveBottomTab(null);
      Animated.spring(bottomPanelAnim, { toValue: 0, friction: 8, useNativeDriver: true }).start();
      return;
    }
    setActiveBottomTab(tab);
    Animated.spring(bottomPanelAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
    if (tab === 'stats') fetchStats();
  };

  const handleLogout = async () => {
    await clearAuthSession();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const toggleRight = (open) => {
    setIsRightOpen(open);
    Animated.spring(rightAnim, { toValue: open ? 0 : width, friction: 8, tension: 40, useNativeDriver: true }).start();
  };

  const toggleNavPanel = (open) => {
    setIsNavPanelOpen(open);
    Animated.spring(navPanelAnim, { toValue: open ? 0 : -width, friction: 8, tension: 40, useNativeDriver: true }).start();
  };

  const toggleActionPanel = (open) => {
    setIsActionPanelOpen(open);
    Animated.spring(actionPanelAnim, { toValue: open ? 0 : -width, friction: 8, tension: 40, useNativeDriver: true }).start();
  };

  const soinsMenu = [
    { id: 'queue', label: bt.queue || 'File d\'Attente', icon: 'account-clock', sub: 'Triage des patients' },
    { id: 'care', label: bt.care || 'Soins', icon: 'needle', sub: 'En cours de soins' },
    { id: 'urgencies', label: 'Urgences', icon: 'ambulance', sub: 'Cas urgents' },
    { id: 'control', label: 'Contrôle & Suivi', icon: 'radar', sub: 'Patients en transit' },
    { id: 'hospitalisation', label: 'Hospitalisation', icon: 'bed', sub: 'Patients internés' },
    { id: 'alertes', label: 'Alertes', icon: 'bell-alert', sub: 'Surveillance', badge: alerts.critical },
    { id: 'rapport', label: 'Rapport de Garde', icon: 'clipboard-text', sub: 'Fin de service' },
    { id: 'history', label: bt.history || 'Historique', icon: 'history', sub: 'Soins terminés' },
  ];

  const submitEmergency = async () => {
    if (!emergencyForm.first_name || !emergencyForm.last_name) return showToast("Nom et prénom requis", "error");
    if (emergencyForm.is_insured && !emergencyForm.insurance_id) return showToast("Veuillez sélectionner l'assurance", "error");
    if (emergencyForm.is_insured && !emergencyForm.insurance_code) return showToast("Veuillez entrer le code de l'assuré", "error");

    setIsSubmittingEmergency(true);
    try {
      const payload = {
        ...emergencyForm,
        is_emergency: true,
        birth_year: emergencyForm.age ? new Date().getFullYear() - parseInt(emergencyForm.age, 10) : null
      };

      await api.post('/patients', payload);
      showToast("Urgence enregistrée", "success");
      setEmergencyForm({ first_name: '', last_name: '', complaints: '', gender: 'M', age: '', is_insured: false, insurance_id: '', insurance_code: '' });
      fetchVisits();
      setActiveView('queue');
    } catch (e) {
      if (e.response?.data?.message) showToast(e.response.data.message, 'error');
      else showToast(t.error, 'error');
    } finally { setIsSubmittingEmergency(false); }
  };

  const handleAppendNotes = (newNotes) => {
    setNotes(prev => prev ? prev + '\n' + newNotes : newNotes);
  };

  // Derive Lists
  const queueList = (visits || []).filter(v => !v?.complaints_notes?.includes('[MEDECIN]'));
  const careList = (visits || []).filter(v => v?.complaints_notes?.includes('[MEDECIN]'));
  const controlList = (history || []).filter(v => v?.current_service !== 'soins' && v?.status !== 'completed');
  const historyList = history || [];
  const urgenciesList = (visits || []).filter(v => v?.complaints_notes?.includes('[URGENCE]'));

  const renderEmptyState = (icon, title, message) => (
    <FadeInView style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 }}>
      <View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: isDark ? '#1A1A1A' : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20 }}>
        <LinearGradient colors={[brandColor + '20', brandColor + '05']} style={{ width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name={icon} size={48} color={brandColor} />
        </LinearGradient>
      </View>
      <Text style={{ fontSize: 22, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A', marginBottom: 12, textAlign: 'center', letterSpacing: 0.5 }}>{title}</Text>
      <Text style={{ fontSize: 14, color: isDark ? '#888888' : '#64748B', textAlign: 'center', lineHeight: 24, fontWeight: '600', paddingHorizontal: 20 }}>{message}</Text>
      <TouchableOpacity onPress={() => { fetchVisits(); fetchHistory(); }} style={{ marginTop: 32, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 20, backgroundColor: brandColor, elevation: 4, shadowColor: brandColor, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}>
        <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 1 }}>ACTUALISER</Text>
      </TouchableOpacity>
    </FadeInView>
  );

  return (
    <View style={[styles.mainContainer, { backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDark ? "" : "dark-content"} />

      <PremiumHeader
        onLeftPress={() => toggleNavPanel(true)}
        onRightPress={() => toggleRight(true)}
        title="REHOBOTH"
        subtitle={soinsMenu.find(m => m.id === activeView)?.label || 'SOINS / INFIRMERIE'}
        icon=""
        isDark={isDark}
        navigation={navigation}
      />

      <FloatingActionDock
        title={selectedVisit ? 'Prise en charge' : activeView === 'hospitalisation' ? 'Hospitalisation' : 'Actions soins'}
        searchValue={activeView === 'hospitalisation' ? patientSearch : undefined}
        onSearchChange={activeView === 'hospitalisation' ? setPatientSearch : undefined}
        searchPlaceholder="Rechercher un patient..."
        actions={[
          selectedVisit && { key: 'back-list', icon: 'arrow-back', onPress: () => setSelectedVisit(null), active: true },
          activeView !== 'care' && !selectedVisit && { key: 'back-care', icon: 'arrow-back', onPress: () => { setActiveView('care'); setActiveTab('queue'); if (activeBottomTab) toggleBottomTab('stats'); } },
          activeView === 'hospitalisation' && { key: 'admit', icon: 'hotel', onPress: () => setShowAdmitForm(true), active: true },
          activeView === 'rapport' && { key: 'report', icon: 'assignment-add', onPress: () => setShowReportForm(true), active: true },
          { key: 'refresh', icon: 'refresh', onPress: () => { if (activeView === 'hospitalisation') fetchHospitalizations(); else { fetchVisits(); fetchHistory(); } } },
        ]}
      />

      {/* VUE: PROFIL — rendu hors du ScrollView principal pour éviter les bugs d'entête */}
      {activeView === 'profile' && (
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 100,
            paddingBottom: insets.bottom + 40,
            paddingHorizontal: 20,
          }}
          showsVerticalScrollIndicator={false}
        >
          <ProfileView onBack={() => setActiveView('care')} />
        </ScrollView>
      )}

      {activeView !== 'profile' && (
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 100,
          paddingBottom: insets.bottom + 110,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          {!selectedVisit ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1 }}>
                  {activeView === 'care' ? 'PRISE EN CHARGE (SOINS)' :
                    activeView === 'queue' ? 'FILE D\'ATTENTE (TRIAGE)' :
                      activeView === 'urgencies' ? 'URGENCES EN COURS' :
                        activeView === 'control' ? 'CONTRÔLE & SUIVI' :
                          activeView === 'hospitalisation' ? 'HOSPITALISATION' : 'HISTORIQUE'}
                </Text>
                <TouchableOpacity onPress={() => {
                  if (activeView === 'hospitalisation') fetchHospitalizations();
                  else { fetchVisits(); fetchHistory(); }
                }}>
                  <MaterialIcons name="refresh" size={24} color={brandColor} />
                </TouchableOpacity>
              </View>

              {activeView === 'urgencies' && (
                <View style={{ padding: 20, borderRadius: 24, backgroundColor: isDark ? '#121212' : brandColor + '10', borderWidth: 1, borderColor: isDark ? '#1E1E1E' : brandColor + '30', marginBottom: 24 }}>
                  <Text style={{ color: brandColor, fontWeight: '900', fontSize: 12, letterSpacing: 1, marginBottom: 16 }}>DÉCLARER UNE URGENCE</Text>

                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                    <TextInput style={{ flex: 1, backgroundColor: isDark ? '#1A1A1A' : '#FFF', color: isDark ? '#FFF' : '#0A0A0A', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }} placeholder="Prénom *" placeholderTextColor={isDark ? "#888888" : '#94A3B8'} value={emergencyForm.first_name} onChangeText={v => setEmergencyForm(prev => ({ ...prev, first_name: v }))} />
                    <TextInput style={{ flex: 1, backgroundColor: isDark ? '#1A1A1A' : '#FFF', color: isDark ? '#FFF' : '#0A0A0A', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }} placeholder="Nom *" placeholderTextColor={isDark ? "#888888" : '#94A3B8'} value={emergencyForm.last_name} onChangeText={v => setEmergencyForm(prev => ({ ...prev, last_name: v }))} />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                    <TouchableOpacity onPress={() => setEmergencyForm(prev => ({ ...prev, gender: prev.gender === 'M' ? 'F' : 'M' }))} style={{ width: 80, padding: 12, borderRadius: 12, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', alignItems: 'center' }}>
                      <Text style={{ color: isDark ? '#FFF' : '#0A0A0A', fontWeight: '800' }}>Sexe: {emergencyForm.gender}</Text>
                    </TouchableOpacity>
                    <TextInput style={{ flex: 1, backgroundColor: isDark ? '#1A1A1A' : '#FFF', color: isDark ? '#FFF' : '#0A0A0A', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }} placeholder="Âge (optionnel)" keyboardType="numeric" placeholderTextColor={isDark ? "#888888" : '#94A3B8'} value={emergencyForm.age} onChangeText={v => setEmergencyForm(prev => ({ ...prev, age: v }))} />
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
                    <Switch
                      trackColor={{ false: isDark ? '#2E2E2E' : '#E2E8F0', true: '#22C55E' }}
                      thumbColor="#FFF"
                      value={emergencyForm.is_insured}
                      onValueChange={v => setEmergencyForm(prev => ({ ...prev, is_insured: v }))}
                    />
                    <Text style={{ marginLeft: 10, color: isDark ? '#F1F5F9' : '#1A1A1A', fontWeight: '700' }}>Patient Assuré ?</Text>
                  </View>

                  {emergencyForm.is_insured && (
                    <View style={{ marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                      <Text style={{ color: isDark ? '#888888' : '#94A3B8', fontSize: 11, fontWeight: '800', marginBottom: 8 }}>SÉLECTIONNER L'ASSURANCE</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        {(insurances || []).map(ins => (
                          <TouchableOpacity key={ins.id} onPress={() => setEmergencyForm(prev => ({ ...prev, insurance_id: ins.id }))} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, backgroundColor: emergencyForm.insurance_id === ins.id ? '#22C55E' : 'transparent', borderColor: emergencyForm.insurance_id === ins.id ? '#22C55E' : (isDark ? '#2E2E2E' : '#E2E8F0') }}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: emergencyForm.insurance_id === ins.id ? '#FFF' : (isDark ? '#E2E8F0' : '#475569') }}>{ins.name.toUpperCase()}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput style={{ backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', color: isDark ? '#FFF' : '#0A0A0A', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }} placeholder="Code Membre (Numéro de carte) *" placeholderTextColor={isDark ? "#888888" : '#94A3B8'} value={emergencyForm.insurance_code} onChangeText={v => setEmergencyForm(prev => ({ ...prev, insurance_code: v }))} />
                    </View>
                  )}

                  <TextInput style={{ backgroundColor: isDark ? '#1A1A1A' : '#FFF', color: isDark ? '#FFF' : '#0A0A0A', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', marginBottom: 12 }} placeholder="Motif de l'urgence (Ex: Saignements, Inconscient...)" placeholderTextColor={isDark ? "#888888" : '#94A3B8'} value={emergencyForm.complaints} onChangeText={v => setEmergencyForm(prev => ({ ...prev, complaints: v }))} />

                  <TouchableOpacity onPress={submitEmergency} disabled={isSubmittingEmergency} style={{ padding: 14, borderRadius: 12, backgroundColor: brandColor, alignItems: 'center' }}>
                    {isSubmittingEmergency ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: "#FFF", fontWeight: '900' }}>ADMETTRE EN URGENCE</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {/* ============ VUE HOSPITALISATION ============ */}
              {activeView === 'hospitalisation' ? (
                <FadeInView>
                  {/* Header Actions */}
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 18, backgroundColor: brandColor, elevation: 4 }}
                      onPress={() => setShowAdmitForm(true)}
                    >
                      <MaterialCommunityIcons name="help-circle" size={20} color="#FFF" />
                      <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 12, marginLeft: 8 }}>ADMETTRE UN PATIENT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: '#22C55E15', borderWidth: 1, borderColor: '#22C55E30' }}
                      onPress={handleBillDaily}
                      disabled={isBillingDaily}
                    >
                      {isBillingDaily ? <ActivityIndicator size="small" color="#22C55E" /> : <MaterialCommunityIcons name="cash-multiple" size={22} color="#22C55E" />}
                      <Text style={{ color: '#22C55E', fontWeight: '900', fontSize: 11, marginLeft: 8 }}>FACT. JOURNALIÈRE</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Formulaire Admission */}
                  {showAdmitForm && (
                    <FadeInView style={{ padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 28, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', marginBottom: 20, elevation: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <Text style={{ fontSize: 15, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>NOUVELLE ADMISSION</Text>
                        <TouchableOpacity onPress={() => setShowAdmitForm(false)}>
                          <MaterialIcons name="close" size={22} color={brandColor} />
                        </TouchableOpacity>
                      </View>

                      {/* Recherche Patient */}
                      <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1, marginBottom: 8 }}>PATIENT *</Text>
                      {admitForm.patient_id ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: isDark ? '#121212' : brandColor + '15', borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: isDark ? '#1E1E1E' : brandColor + '30' }}>
                          <MaterialCommunityIcons name="search" size={22} color={brandColor} />
                          <Text style={{ flex: 1, marginLeft: 10, fontWeight: '800', color: isDark ? '#FFF' : '#0A0A0A' }}>{admitForm.patient_name}</Text>
                          <TouchableOpacity onPress={() => setAdmitForm(p => ({ ...p, patient_id: '', patient_name: '' }))}>
                            <MaterialIcons name="close" size={18} color={brandColor} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={{ marginBottom: 16 }}>
                          <TextInput
                            style={{ backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', color: isDark ? '#FFF' : '#0A0A0A', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', marginBottom: 8 }}
                            placeholder="Rechercher un patient..." placeholderTextColor={isDark ? "#555555" : '#94A3B8'}
                            value={patientSearch}
                            onChangeText={searchPatients}
                          />
                          {searchingPatient && <ActivityIndicator size="small" color={brandColor} style={{ marginBottom: 8 }} />}
                          {patientResults.map(p => (
                            <TouchableOpacity key={p.id} style={{ padding: 12, borderRadius: 10, backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', marginBottom: 6 }} onPress={() => { setAdmitForm(f => ({ ...f, patient_id: p.id, patient_name: `${p.first_name} ${p.last_name}` })); setPatientResults([]); setPatientSearch(''); }}>
                              <Text style={{ fontWeight: '800', color: isDark ? '#FFF' : '#0A0A0A' }}>{p.first_name} {p.last_name}</Text>
                              {p.contact_info && <Text style={{ color: isDark ? '#888888' : '#94A3B8', fontSize: 12 }}>{p.contact_info}</Text>}
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1, marginBottom: 6 }}>CHAMBRE</Text>
                          <TextInput style={{ backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', color: isDark ? '#FFF' : '#0A0A0A', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }} placeholder="Ex: 12A" placeholderTextColor={isDark ? "#555555" : '#94A3B8'} value={admitForm.room_number} onChangeText={v => setAdmitForm(f => ({ ...f, room_number: v }))} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1, marginBottom: 6 }}>LIT</Text>
                          <TextInput style={{ backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', color: isDark ? '#FFF' : '#0A0A0A', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }} placeholder="Ex: B2" placeholderTextColor={isDark ? "#555555" : '#94A3B8'} value={admitForm.bed_number} onChangeText={v => setAdmitForm(f => ({ ...f, bed_number: v }))} />
                        </View>
                      </View>

                      <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1, marginBottom: 6 }}>SERVICE / SALLE</Text>
                      <TextInput style={{ backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', color: isDark ? '#FFF' : '#0A0A0A', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', marginBottom: 12 }} placeholder="Ex: Chirurgie, Maternité, Pédiatrie..." placeholderTextColor={isDark ? "#555555" : '#94A3B8'} value={admitForm.ward} onChangeText={v => setAdmitForm(f => ({ ...f, ward: v }))} />

                      <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1, marginBottom: 6 }}>TARIF JOURNALIER (FC) *</Text>
                      <TextInput style={{ backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', color: isDark ? '#FFF' : '#0A0A0A', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', marginBottom: 12 }} placeholder="Ex: 25000" placeholderTextColor={isDark ? "#555555" : '#94A3B8'} keyboardType="numeric" value={admitForm.daily_rate} onChangeText={v => setAdmitForm(f => ({ ...f, daily_rate: v }))} />

                      <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1, marginBottom: 6 }}>DIAGNOSTIC INITIAL</Text>
                      <TextInput style={{ backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', color: isDark ? '#FFF' : '#0A0A0A', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', marginBottom: 12, height: 80, textAlignVertical: 'top' }} placeholder="Motif d'hospitalisation..." placeholderTextColor={isDark ? "#555555" : '#94A3B8'} multiline value={admitForm.diagnosis} onChangeText={v => setAdmitForm(f => ({ ...f, diagnosis: v }))} />

                      {doctors.length > 0 && (
                        <>
                          <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1, marginBottom: 8 }}>MÉDECIN TRAITANT</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                            <TouchableOpacity onPress={() => setAdmitForm(f => ({ ...f, attending_doctor_id: null }))} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginRight: 8, backgroundColor: !admitForm.attending_doctor_id ? brandColor : (isDark ? '#1A1A1A' : '#FFF'), borderWidth: 1, borderColor: !admitForm.attending_doctor_id ? brandColor : (isDark ? '#2E2E2E' : '#E2E8F0') }}>
                              <Text style={{ color: !admitForm.attending_doctor_id ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B'), fontWeight: '800', fontSize: 11 }}>AUCUN</Text>
                            </TouchableOpacity>
                            {doctors.map(d => (
                              <TouchableOpacity key={d.id} onPress={() => setAdmitForm(f => ({ ...f, attending_doctor_id: d.id }))} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginRight: 8, backgroundColor: admitForm.attending_doctor_id === d.id ? brandColor : (isDark ? '#1A1A1A' : '#FFF'), borderWidth: 1, borderColor: admitForm.attending_doctor_id === d.id ? brandColor : (isDark ? '#2E2E2E' : '#E2E8F0') }}>
                                <Text style={{ color: admitForm.attending_doctor_id === d.id ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B'), fontWeight: '800', fontSize: 11 }}>DR. {d.name.toUpperCase()}</Text>
                                {d.specialty ? <Text style={{ color: admitForm.attending_doctor_id === d.id ? 'rgba(255,255,255,0.75)' : (isDark ? '#666' : '#94A3B8'), fontWeight: '700', fontSize: 9, marginTop: 2 }}>{d.specialty.toUpperCase()}</Text> : null}
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </>
                      )}

                      <TouchableOpacity style={{ height: 58, borderRadius: 29, overflow: 'hidden' }} onPress={handleAdmit} disabled={isSubmitting}>
                        <LinearGradient colors={Theme.colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                          {isSubmitting ? <ActivityIndicator color="#FFF" /> : (
                            <><MaterialCommunityIcons name="bed-outline" size={22} color="#FFF" /><Text style={{ color: "#FFF", fontWeight: '900', fontSize: 14, marginLeft: 10 }}>CONFIRMER L'ADMISSION</Text></>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </FadeInView>
                  )}

                  {/* Liste des hospitalisés */}
                  {hospLoading ? (
                    <View>{[1, 2, 3].map(i => <SkeletonItem key={i} height={110} style={{ marginBottom: 14, borderRadius: 24 }} />)}</View>
                  ) : hospitalizations.length === 0 ? (
                    renderEmptyState('bed', 'Aucun patient hospitalisé', 'Admettez un patient en utilisant le bouton ci-dessus.')
                  ) : hospitalizations.map((h, idx) => (
                    <FadeInView key={h.id} delay={idx * 60}>
                      <PressableScale
                        style={{ backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 24, marginBottom: 14, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9', elevation: 4, overflow: 'hidden' }}
                        onPress={() => setSelectedHosp(selectedHosp?.id === h.id ? null : h)}
                      >
                        {/* Card Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}>
                          <LinearGradient colors={['#3B82F615', '#3B82F605']} style={{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                            <MaterialCommunityIcons name="help-circle" size={28} color="#3B82F6" />
                          </LinearGradient>
                          <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text style={{ fontSize: 17, fontWeight: '900', color: isDark ? '#F1F5F9' : '#0A0A0A' }}>{h.patient?.first_name} {h.patient?.last_name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 6 }}>
                              {h.room_number && <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#3B82F620', borderRadius: 8 }}><Text style={{ fontSize: 11, fontWeight: '800', color: '#3B82F6' }}>Ch. {h.room_number}</Text></View>}
                              {h.ward && <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: isDark ? '#2E2E2E' : '#F1F5F9', borderRadius: 8 }}><Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#AAAAAA' : '#64748B' }}>{h.ward}</Text></View>}
                              <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#22C55E20', borderRadius: 8 }}><Text style={{ fontSize: 11, fontWeight: '800', color: '#22C55E' }}>{h.days_count}j</Text></View>
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 16, fontWeight: '900', color: brandColor }}>{Number(h.total_amount).toLocaleString()}</Text>
                            <Text style={{ fontSize: 10, color: isDark ? '#888888' : '#94A3B8', fontWeight: '700' }}>FC TOTAL</Text>
                          </View>
                        </View>

                        {/* Detail Expand */}
                        {selectedHosp?.id === h.id && (
                          <FadeInView style={{ paddingHorizontal: 18, paddingBottom: 18 + insets.bottom }}>
                            <View style={{ height: 1, backgroundColor: isDark ? '#2E2E2E' : '#F1F5F9', marginBottom: 16 }} />
                            {h.diagnosis && (
                              <View style={{ marginBottom: 12 }}>
                                <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1, marginBottom: 4 }}>DIAGNOSTIC</Text>
                                <Text style={{ color: isDark ? '#CBD5E1' : '#475569', lineHeight: 20 }}>{h.diagnosis}</Text>
                              </View>
                            )}
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                              <View style={{ flex: 1, padding: 14, backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', borderRadius: 14 }}>
                                <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', marginBottom: 4 }}>ADMISSION</Text>
                                <Text style={{ fontWeight: '800', color: isDark ? '#FFF' : '#0A0A0A' }}>{new Date(h.admission_date).toLocaleDateString('fr-FR')}</Text>
                              </View>
                              <View style={{ flex: 1, padding: 14, backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', borderRadius: 14 }}>
                                <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', marginBottom: 4 }}>TARIF/JOUR</Text>
                                <Text style={{ fontWeight: '800', color: isDark ? '#FFF' : '#0A0A0A' }}>{Number(h.daily_rate).toLocaleString()} FC</Text>
                              </View>
                            </View>
                            {h.doctor && <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#AAAAAA' : '#64748B', marginBottom: 16 }}>Médecin traitant : Dr. {h.doctor.name}</Text>}
                            <TouchableOpacity
                              style={{ padding: 14, borderRadius: 16, backgroundColor: '#EF444415', borderWidth: 1, borderColor: '#EF444430', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                              onPress={() => handleDischarge(h.id)}
                            >
                              <MaterialCommunityIcons name="exit-run" size={20} color="#EF4444" />
                              <Text style={{ color: '#EF4444', fontWeight: '900', marginLeft: 10, fontSize: 13 }}>SORTIR CE PATIENT</Text>
                            </TouchableOpacity>
                          </FadeInView>
                        )}
                      </PressableScale>
                    </FadeInView>
                  ))}
                </FadeInView>
              ) : activeView === 'alertes' ? (
                <FadeInView>
                  {/* Header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <View>
                      {alerts.critical > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF444415', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#EF444430' }}>
                          <MaterialCommunityIcons name="help-circle" size={16} color="#EF4444" />
                          <Text style={{ color: '#EF4444', fontWeight: '900', fontSize: 12, marginLeft: 6 }}>{alerts.critical} ALERTE(S) CRITIQUE(S)</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity onPress={fetchAlerts} style={{ padding: 8 }}>
                      <MaterialIcons name="refresh" size={24} color={brandColor} />
                    </TouchableOpacity>
                  </View>

                  {alertsLoading ? (
                    <View>{[1, 2].map(i => <SkeletonItem key={i} height={120} style={{ marginBottom: 14, borderRadius: 24 }} />)}</View>
                  ) : alerts.alerts.length === 0 ? (
                    <FadeInView style={{ alignItems: 'center', paddingVertical: 80 }}>
                      <LinearGradient colors={['#22C55E20', '#22C55E05']} style={{ width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                        <MaterialCommunityIcons name="check-circle" size={56} color="#22C55E" />
                      </LinearGradient>
                      <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A', textAlign: 'center' }}>Tout va bien !</Text>
                      <Text style={{ color: isDark ? '#888888' : '#94A3B8', marginTop: 8, textAlign: 'center', lineHeight: 22 }}>Aucune alerte active. Tous les patients hospitalisés sont suivis.</Text>
                    </FadeInView>
                  ) : alerts.alerts.map((alertItem, idx) => {
                    const hasCritical = alertItem.alerts.some(a => a.severity === 'critical');
                    const borderC = hasCritical ? '#EF4444' : '#F59E0B';
                    const bgC = hasCritical ? '#EF444410' : '#F59E0B10';
                    return (
                      <FadeInView key={alertItem.hospitalization_id} delay={idx * 60}>
                        <View style={{ backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 24, marginBottom: 14, borderWidth: 1.5, borderColor: borderC, overflow: 'hidden', elevation: 4 }}>
                          {/* Patient Header */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: isDark ? '#2E2E2E' : '#F1F5F9' }}>
                            <LinearGradient colors={[borderC + '30', borderC + '10']} style={{ width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                              <MaterialCommunityIcons name="bell-alert" size={24} color={borderC} />
                            </LinearGradient>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={{ fontSize: 16, fontWeight: '900', color: isDark ? '#F1F5F9' : '#0A0A0A' }}>{alertItem.patient?.first_name} {alertItem.patient?.last_name}</Text>
                              <Text style={{ fontSize: 12, color: isDark ? '#888888' : '#94A3B8', fontWeight: '700' }}>
                                {alertItem.room_number ? `Ch. ${alertItem.room_number}` : ''}{alertItem.ward ? ` — ${alertItem.ward}` : ''} · {alertItem.days_count}j
                              </Text>
                            </View>
                            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: hasCritical ? '#EF4444' : '#F59E0B' }}>
                              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 10 }}>{hasCritical ? 'CRITIQUE' : 'ATTENTION'}</Text>
                            </View>
                          </View>

                          {/* Alert Details */}
                          <View style={{ padding: 16 }}>
                            {alertItem.alerts.map((al, i) => (
                              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: i < alertItem.alerts.length - 1 ? 10 : 16 }}>
                                <MaterialCommunityIcons
                                  name={al.severity === 'critical' ? 'alert-circle' : al.severity === 'warning' ? 'alert' : 'information'}
                                  size={18}
                                  color={al.severity === 'critical' ? '#EF4444' : al.severity === 'warning' ? '#F59E0B' : '#3B82F6'}
                                />
                                <Text style={{ marginLeft: 8, flex: 1, color: isDark ? '#CBD5E1' : '#475569', fontWeight: '700', fontSize: 13 }}>{al.message}</Text>
                              </View>
                            ))}

                            {/* Action Buttons */}
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                              <TouchableOpacity
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 14, backgroundColor: '#22C55E15', borderWidth: 1, borderColor: '#22C55E30' }}
                                onPress={() => handleMarkChecked(alertItem.hospitalization_id)}
                              >
                                <MaterialCommunityIcons name="check-circle" size={18} color="#22C55E" />
                                <Text style={{ color: '#22C55E', fontWeight: '900', fontSize: 12, marginLeft: 6 }}>VISITE FAITE</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 14, backgroundColor: '#EF444415', borderWidth: 1, borderColor: '#EF444430' }}
                                onPress={() => handleTriggerAlert(alertItem.hospitalization_id, true, 'Surveillance renforcée requise')}
                              >
                                <MaterialCommunityIcons name="help-circle" size={18} color="#EF4444" />
                                <Text style={{ color: '#EF4444', fontWeight: '900', fontSize: 12, marginLeft: 6 }}>ESCALADER</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </FadeInView>
                    );
                  })}
                </FadeInView>
              ) : activeView === 'rapport' ? (
                <FadeInView>
                  {/* Tabs: Alertes / Form / Historique */}
                  <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1A1A1A' : '#F1F5F9', borderRadius: 16, padding: 4, marginBottom: 20 }}>
                    {[{ id: 'alerts', label: 'Alertes du Jour' }, { id: 'form', label: 'Nouveau Rapport' }, { id: 'history', label: 'Historique' }].map(tab => (
                      <TouchableOpacity
                        key={tab.id}
                        style={{ flex: 1, padding: 10, borderRadius: 12, backgroundColor: reportsView === tab.id ? (isDark ? '#0A0A0A' : '#FFF') : 'transparent', alignItems: 'center' }}
                        onPress={() => { setReportsView(tab.id); if (tab.id === 'form') fetchTodayStats(); }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: reportsView === tab.id ? brandColor : (isDark ? '#888888' : '#94A3B8') }}>{tab.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Résumé Stats du Jour */}
                  {reportsView === 'alerts' && (
                    <FadeInView>
                      <LinearGradient colors={[brandColor, '#805AD5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 24, marginBottom: 20 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 16 }}>RÉSUMÉ DU JOUR — {new Date().toLocaleDateString('fr-FR')}</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          {[
                            { label: 'Patients', value: todayStats?.patients_seen ?? '—', icon: 'account-heart' },
                            { label: 'Transferts', value: todayStats?.transfers_done ?? '—', icon: 'transfer' },
                            { label: 'Urgences', value: todayStats?.emergencies_handled ?? '—', icon: 'ambulance' },
                            { label: 'Internés', value: todayStats?.hospitalized_count ?? '—', icon: 'bed' },
                          ].map(s => (
                            <View key={s.label} style={{ alignItems: 'center' }}>
                              <MaterialCommunityIcons name={s.icon} size={24} color={brandColor} />
                              <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', marginTop: 4 }}>{s.value}</Text>
                              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700' }}>{s.label}</Text>
                            </View>
                          ))}
                        </View>
                      </LinearGradient>

                      {alerts.critical > 0 && (
                        <View style={{ padding: 16, borderRadius: 20, backgroundColor: '#EF444415', borderWidth: 1, borderColor: '#EF444430', flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                          <MaterialCommunityIcons name="alert-circle" size={28} color="#EF4444" />
                          <View style={{ marginLeft: 12, flex: 1 }}>
                            <Text style={{ color: '#EF4444', fontWeight: '900', fontSize: 14 }}>{alerts.critical} Alerte(s) critique(s)</Text>
                            <Text style={{ color: isDark ? '#CBD5E1' : '#475569', fontSize: 12, marginTop: 2 }}>Consultez la section Alertes pour y répondre.</Text>
                          </View>
                          <TouchableOpacity onPress={() => setActiveView('alertes')}>
                            <MaterialCommunityIcons name="help-circle" size={28} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      )}

                      <TouchableOpacity
                        style={{ height: 58, borderRadius: 29, overflow: 'hidden', marginTop: 8 }}
                        onPress={() => { setReportsView('form'); fetchTodayStats(); }}
                      >
                        <LinearGradient colors={Theme.colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                          <MaterialCommunityIcons name="clipboard-text" size={22} color="#FFF" />
                          <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14, marginLeft: 10 }}>RÉDIGER LE RAPPORT DE GARDE</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </FadeInView>
                  )}

                  {/* Formulaire Rapport */}
                  {reportsView === 'form' && (
                    <FadeInView style={{ backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 28, padding: 20, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                      {/* Sélection période */}
                      <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1, marginBottom: 10 }}>PÉRIODE DE GARDE</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                        {[{ id: 'matin', label: '☀️ Matin' }, { id: 'apres-midi', label: '🌤️ Après-Midi' }, { id: 'nuit', label: '🌙 Nuit' }].map(s => (
                          <TouchableOpacity key={s.id} style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: reportForm.shift_type === s.id ? brandColor : (isDark ? '#0A0A0A' : '#F8FAFC'), borderWidth: 1, borderColor: reportForm.shift_type === s.id ? brandColor : (isDark ? '#2E2E2E' : '#E2E8F0'), alignItems: 'center' }} onPress={() => setReportForm(f => ({ ...f, shift_type: s.id }))}>
                            <Text style={{ color: reportForm.shift_type === s.id ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B'), fontWeight: '800', fontSize: 12 }}>{s.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Compteurs auto-remplis */}
                      <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1, marginBottom: 10 }}>DONNÉES CHIFFRÉES</Text>
                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                        {[{ key: 'patients_seen', label: 'Patients vus' }, { key: 'transfers_done', label: 'Transferts' }, { key: 'emergencies_handled', label: 'Urgences' }].map(f => (
                          <View key={f.key} style={{ flex: 1 }}>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 0.5, marginBottom: 4 }}>{f.label.toUpperCase()}</Text>
                            <TextInput style={{ backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', color: isDark ? '#FFF' : '#0A0A0A', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', textAlign: 'center', fontWeight: '900', fontSize: 18 }} keyboardType="numeric" value={reportForm[f.key]} onChangeText={v => setReportForm(rf => ({ ...rf, [f.key]: v }))} />
                          </View>
                        ))}
                      </View>

                      <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1, marginBottom: 6 }}>RÉSUMÉ DE LA GARDE *</Text>
                      <TextInput style={{ backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', color: isDark ? '#FFF' : '#0A0A0A', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', marginBottom: 16, height: 120, textAlignVertical: 'top', lineHeight: 22 }} placeholder="Décrivez le déroulement de votre garde: état général des patients, incidents notables, soins effectués..." placeholderTextColor={isDark ? "#555555" : '#94A3B8'} multiline value={reportForm.summary} onChangeText={v => setReportForm(f => ({ ...f, summary: v }))} />

                      <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1, marginBottom: 6 }}>PATIENTS À SURVEILLER (un par ligne)</Text>
                      <TextInput style={{ backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', color: isDark ? '#FFF' : '#0A0A0A', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', marginBottom: 16, height: 80, textAlignVertical: 'top' }} placeholder="Ex: Jean Dupont — Ch.3 — Fièvre persistante" placeholderTextColor={isDark ? "#555555" : '#94A3B8'} multiline value={reportForm.patients_to_watch} onChangeText={v => setReportForm(f => ({ ...f, patients_to_watch: v }))} />

                      <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1, marginBottom: 6 }}>NOTES DE RELÈVE (pour l'équipe suivante)</Text>
                      <TextInput style={{ backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', color: isDark ? '#FFF' : '#0A0A0A', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', marginBottom: 20, height: 80, textAlignVertical: 'top' }} placeholder="Informations importantes pour le prochain infirmier..." placeholderTextColor={isDark ? "#555555" : '#94A3B8'} multiline value={reportForm.handover_notes} onChangeText={v => setReportForm(f => ({ ...f, handover_notes: v }))} />

                      {/* Boutons */}
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity style={{ flex: 1, padding: 16, borderRadius: 18, backgroundColor: isDark ? '#2E2E2E' : '#F1F5F9', alignItems: 'center' }} onPress={() => handleSubmitReport('draft')} disabled={isSubmittingReport}>
                          <Text style={{ fontWeight: '900', color: isDark ? '#AAAAAA' : '#64748B', fontSize: 13 }}>💾 BROUILLON</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ flex: 2, height: 56, borderRadius: 28, overflow: 'hidden' }} onPress={() => handleSubmitReport('submitted')} disabled={isSubmittingReport}>
                          <LinearGradient colors={Theme.colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                            {isSubmittingReport ? <ActivityIndicator color={brandColor} /> : (
                              <><MaterialCommunityIcons name="send" size={20} color="#FFF" /><Text style={{ color: "#FFF", fontWeight: '900', fontSize: 13, marginLeft: 8 }}>SOUMETTRE</Text></>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </FadeInView>
                  )}

                  {/* Historique des rapports */}
                  {reportsView === 'history' && (
                    <FadeInView>
                      {nursingReports.length === 0 ? renderEmptyState('clipboard-text', 'Aucun rapport', 'Aucun rapport de garde n\'a encore été rédigé.') : nursingReports.map((rep, idx) => (
                        <FadeInView key={rep.id} delay={idx * 50}>
                          <View style={{ backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 20, marginBottom: 12, padding: 18, borderWidth: 1, borderColor: rep.status === 'submitted' ? '#22C55E30' : (isDark ? '#2E2E2E' : '#E2E8F0') }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                              <View>
                                <Text style={{ fontWeight: '900', fontSize: 15, color: isDark ? '#FFF' : '#0A0A0A' }}>
                                  {rep.shift_type === 'matin' ? '☀️ Matin' : rep.shift_type === 'apres-midi' ? '🌤️ Après-Midi' : '🌙 Nuit'}
                                  {' — '}{new Date(rep.report_date).toLocaleDateString('fr-FR')}
                                </Text>
                                <Text style={{ fontSize: 12, color: isDark ? '#888888' : '#94A3B8', marginTop: 2 }}>Par {rep.nurse?.name}</Text>
                              </View>
                              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: rep.status === 'submitted' ? '#22C55E20' : '#F59E0B20' }}>
                                <Text style={{ fontWeight: '900', fontSize: 10, color: rep.status === 'submitted' ? '#22C55E' : '#F59E0B' }}>{rep.status === 'submitted' ? 'SOUMIS' : 'BROUILLON'}</Text>
                              </View>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                              <Text style={{ fontSize: 12, color: isDark ? '#AAAAAA' : '#64748B' }}>👥 {rep.patients_seen} patients</Text>
                              <Text style={{ fontSize: 12, color: isDark ? '#AAAAAA' : '#64748B' }}>↗️ {rep.transfers_done} transferts</Text>
                              <Text style={{ fontSize: 12, color: isDark ? '#AAAAAA' : '#64748B' }}>🚨 {rep.emergencies_handled} urgences</Text>
                            </View>
                            <Text style={{ color: isDark ? '#CBD5E1' : '#475569', fontSize: 13, lineHeight: 20 }} numberOfLines={3}>{rep.summary}</Text>
                          </View>
                        </FadeInView>
                      ))}
                    </FadeInView>
                  )}
                </FadeInView>
              ) : loading ? (
                <View>{[1, 2, 3].map(i => <SkeletonItem key={i} height={120} style={{ marginBottom: 16, borderRadius: 28 }} />)}</View>
              ) : (
                <>
                  {(activeView === 'care' || activeView === 'queue' || activeView === 'urgencies') && (
                    <LinearGradient colors={[brandColor, '#805AD5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 28, padding: 20, marginBottom: 20, elevation: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>FILE D'ATTENTE SOINS</Text>
                          <Text style={{ color: '#FFF', fontSize: 36, fontWeight: '900' }}>
                            {(activeView === 'care' ? careList : activeView === 'queue' ? queueList : urgenciesList).length}
                          </Text>
                        </View>
                        <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                          <MaterialCommunityIcons name="heart-pulse" size={30} color="#FFF" />
                        </View>
                      </View>
                      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 14 }} />
                      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700' }}>Appuyez sur un dossier pour saisir les constantes</Text>
                    </LinearGradient>
                  )}

                  {(activeView === 'care' ? careList : activeView === 'queue' ? queueList : activeView === 'urgencies' ? urgenciesList : activeView === 'control' ? controlList : historyList).length > 0 ? (activeView === 'care' ? careList : activeView === 'queue' ? queueList : activeView === 'urgencies' ? urgenciesList : activeView === 'control' ? controlList : historyList).map((v, idx) => (
                    <FadeInView key={v.id} delay={idx * 60}>
                      <PressableScale
                        style={{ padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 28, marginBottom: 14, borderWidth: (v.complaints_notes?.toLowerCase().includes('urgent') || activeView === 'urgencies') ? 2 : 1, borderColor: (v.complaints_notes?.toLowerCase().includes('urgent') || activeView === 'urgencies') ? '#EF4444' : (isDark ? '#2E2E2E' : '#F1F5F9'), elevation: 4 }}
                        onPress={() => {
                          if (activeView === 'control' || activeView === 'history') return;
                          setSelectedVisit(v);
                          setNotes(v.nursing_notes || '');
                          setVitals({
                            temperature: v.vitals?.temperature || '',
                            blood_pressure: v.vitals?.blood_pressure || '',
                            weight: v.vitals?.weight || '',
                            height: v.vitals?.height || '',
                            pulse: v.vitals?.pulse || '',
                            respiratory_rate: v.vitals?.respiratory_rate || '',
                            oxygen_saturation: v.vitals?.oxygen_saturation || '',
                          });
                        }}
                      >
                        {(v.complaints_notes?.toLowerCase().includes('urgent') || activeView === 'urgencies') && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF444415', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 12 }}>
                            <MaterialCommunityIcons name="help-circle" size={12} color="#EF4444" />
                            <Text style={{ color: '#EF4444', fontSize: 9, fontWeight: '900', marginLeft: 5 }}>URGENT</Text>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <LinearGradient colors={(v.complaints_notes?.toLowerCase().includes('urgent') || activeView === 'urgencies') ? ['#EF444420', '#EF444405'] : (isDark ? ['#1A1A1A', '#121212'] : [brandColor + '20', brandColor + '05'])} style={{ width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                            <MaterialCommunityIcons name={activeView === 'control' ? "" : activeView === "care" ? "needle" : "heart-pulse"} size={28} color={(v.complaints_notes?.toLowerCase().includes("urgent") || activeView === 'urgencies') ? '#EF4444' : brandColor} />
                          </LinearGradient>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 17, fontWeight: '900', color: isDark ? '#F1F5F9' : '#0A0A0A' }}>{v.patient?.first_name} {v.patient?.last_name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: activeView === 'control' ? '#3B82F6' : activeView === 'care' ? '#F59E0B' : (activeView === 'queue' || activeView === 'urgencies' ? brandColor : '#22C55E'), marginRight: 8 }} />
                              <Text style={{ color: isDark ? '#888888' : '#94A3B8', fontSize: 11, fontWeight: '800' }}>
                                {activeView === 'control' ? `ACTUELLEMENT: ${v.current_service?.toUpperCase()}` : activeView === 'care' ? 'EN ATTENTE DE SOINS' : (activeView === 'queue' || activeView === 'urgencies' ? 'TRIAGE' : 'TRAITÉ')}
                              </Text>
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            {v.doctor && <Text style={{ color: isDark ? '#555555' : '#94A3B8', fontSize: 10, fontWeight: '700', marginBottom: 4 }}>Dr. {v.doctor.name}</Text>}
                            {v.created_at ? <Text style={{ color: isDark ? '#555555' : '#94A3B8', fontSize: 10, fontWeight: '700' }}>{new Date(v.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text> : null}
                          </View>
                        </View>
                      </PressableScale>
                    </FadeInView>
                  )) : (
                    renderEmptyState(
                      "medical-bag",
                      "Aucun patient",
                      "La liste est actuellement vide. Les nouveaux patients apparaîtront ici dès leur admission."
                    )
                  )}
                </>
              )}
            </>
          ) : (
            <FadeInView style={{ paddingTop: 10 }}>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }} onPress={() => setSelectedVisit(null)}>
                <MaterialIcons name="arrow-back" size={20} color={brandColor} />
                <Text style={{ color: brandColor, fontWeight: '900', marginLeft: 8, fontSize: 13 }}>RETOUR À LA LISTE</Text>
              </TouchableOpacity>

              {/* Patient Summary Card */}
              <LinearGradient colors={[brandColor, '#805AD5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 24, borderRadius: 32, marginBottom: 24, elevation: 8 }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', letterSpacing: 2 }}>PATIENT EN SOINS</Text>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFF', marginTop: 6 }}>{selectedVisit.patient?.first_name} {selectedVisit.patient?.last_name}</Text>
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 14 }} />
                <View style={{ flexDirection: 'row', gap: 20 }}>
                  <View>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '900' }}>GENRE / ÂGE</Text>
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{selectedVisit.patient?.gender === 'M' ? 'Masculin' : 'Féminin'} · {selectedVisit.patient?.age || '—'} ans</Text>
                  </View>
                  <View>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '900' }}>ASSURANCE</Text>
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{selectedVisit.patient?.is_insured ? selectedVisit.patient?.insurance?.name || 'ASSURÉE' : 'PRIVÉ'}</Text>
                  </View>
                </View>
              </LinearGradient>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={styles.fieldHeading}>SIGNES VITAUX (CONSTANTES)</Text>
                <TouchableOpacity onPress={() => toggleActionPanel(true)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: brandColor + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                  <MaterialCommunityIcons name="help-circle" size={14} color={brandColor} />
                  <Text style={{ marginLeft: 6, fontSize: 10, fontWeight: '900', color: brandColor }}>ACTES & SOINS</Text>
                </TouchableOpacity>
              </View>

              <View style={{ gap: 12, marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: brandColor, marginBottom: 8 }}>TEMPÉRATURE (°C)</Text>
                    <TextInput
                      style={{ color: isDark ? '#FFF' : '#0A0A0A', fontWeight: '800', fontSize: 18 }}
                      keyboardType="numeric"
                      placeholder="37.0" placeholderTextColor={isDark ? "#555555" : '#CBD5E1'}
                      value={vitals.temperature}
                      onChangeText={v => setVitals(prev => ({ ...prev, temperature: v }))}
                    />
                  </View>
                  <View style={{ flex: 1, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: brandColor, marginBottom: 8 }}>TENSION (mmHg)</Text>
                    <TextInput
                      style={{ color: isDark ? '#FFF' : '#0A0A0A', fontWeight: '800', fontSize: 18 }}
                      placeholder="120/80" placeholderTextColor={isDark ? "#555555" : '#CBD5E1'}
                      value={vitals.blood_pressure}
                      onChangeText={v => setVitals(prev => ({ ...prev, blood_pressure: v }))}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: brandColor, marginBottom: 8 }}>POIDS (Kg)</Text>
                    <TextInput
                      style={{ color: isDark ? '#FFF' : '#0A0A0A', fontWeight: '800', fontSize: 18 }}
                      keyboardType="numeric"
                      placeholder="70" placeholderTextColor={isDark ? "#555555" : '#CBD5E1'}
                      value={vitals.weight}
                      onChangeText={v => setVitals(prev => ({ ...prev, weight: v }))}
                    />
                  </View>
                  <View style={{ flex: 1, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: brandColor, marginBottom: 8 }}>SPO2 (%)</Text>
                    <TextInput
                      style={{ color: isDark ? '#FFF' : '#0A0A0A', fontWeight: '800', fontSize: 18 }}
                      keyboardType="numeric"
                      placeholder="98" placeholderTextColor={isDark ? "#555555" : '#CBD5E1'}
                      value={vitals.oxygen_saturation}
                      onChangeText={v => setVitals(prev => ({ ...prev, oxygen_saturation: v }))}
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.fieldHeading}>NOTES INFIRMIÈRES / OBSERVATIONS</Text>
              <View style={{ borderRadius: 28, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', backgroundColor: isDark ? '#1A1A1A' : '#FFF', padding: 20, height: 160, marginBottom: 28 }}>
                <TextInput
                  style={{ flex: 1, color: isDark ? '#FFF' : '#0A0A0A', fontSize: 15, textAlignVertical: 'top', lineHeight: 22 }}
                  placeholder="Saisissez vos observations, soins administrés..." placeholderTextColor={isDark ? "#555555" : '#94A3B8'}
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>

              <Text style={styles.fieldHeading}>ORIENTATION</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                <TouchableOpacity
                  onPress={() => setTransferDestination('medecin')}
                  style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: transferDestination === 'medecin' ? brandColor : (isDark ? '#1A1A1A' : '#F1F5F9'), borderWidth: 1, borderColor: transferDestination === 'medecin' ? brandColor : (isDark ? '#2E2E2E' : '#E2E8F0'), alignItems: 'center' }}
                >
                  <MaterialCommunityIcons name="doctor" size={20} color={transferDestination === "medecin" ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B')} />
                  <Text style={{ color: transferDestination === 'medecin' ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B'), fontWeight: '900', fontSize: 11, marginTop: 4 }}>VERS MÉDECIN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setTransferDestination('pharmacie')}
                  style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: transferDestination === 'pharmacie' ? '#10B981' : (isDark ? '#1A1A1A' : '#F1F5F9'), borderWidth: 1, borderColor: transferDestination === 'pharmacie' ? '#10B981' : (isDark ? '#2E2E2E' : '#E2E8F0'), alignItems: 'center' }}
                >
                  <MaterialCommunityIcons name="help-circle" size={20} color={transferDestination === "pharmacie" ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B')} />
                  <Text style={{ color: transferDestination === 'pharmacie' ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B'), fontWeight: '900', fontSize: 11, marginTop: 4 }}>PHARMACIE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setTransferDestination('maternite')}
                  style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: transferDestination === 'maternite' ? '#EC4899' : (isDark ? '#1A1A1A' : '#F1F5F9'), borderWidth: 1, borderColor: transferDestination === 'maternite' ? '#EC4899' : (isDark ? '#2E2E2E' : '#E2E8F0'), alignItems: 'center' }}
                >
                  <MaterialCommunityIcons name="help-circle" size={20} color={transferDestination === "maternite" ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B')} />
                  <Text style={{ color: transferDestination === 'maternite' ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B'), fontWeight: '900', fontSize: 11, marginTop: 4 }}>MATERNITÉ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setTransferDestination('completed')}
                  style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: transferDestination === 'completed' ? '#22C55E' : (isDark ? '#1A1A1A' : '#F1F5F9'), borderWidth: 1, borderColor: transferDestination === 'completed' ? '#22C55E' : (isDark ? '#2E2E2E' : '#E2E8F0'), alignItems: 'center' }}
                >
                  <MaterialCommunityIcons name="help-circle" size={20} color={transferDestination === "completed" ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B')} />
                  <Text style={{ color: transferDestination === 'completed' ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B'), fontWeight: '900', fontSize: 11, marginTop: 4 }}>TERMINER ICI</Text>
                </TouchableOpacity>
              </View>

              {transferDestination === 'medecin' && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1, marginBottom: 12 }}>CHOISIR LE MÉDECIN (OPTIONNEL)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <TouchableOpacity
                      onPress={() => setSelectedDoctorId(null)}
                      style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, marginRight: 10, backgroundColor: !selectedDoctorId ? brandColor : (isDark ? '#1A1A1A' : '#FFF'), borderWidth: 1, borderColor: !selectedDoctorId ? brandColor : (isDark ? '#2E2E2E' : '#E2E8F0') }}
                    >
                      <Text style={{ color: !selectedDoctorId ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B'), fontWeight: '900', fontSize: 11 }}>AUTO</Text>
                    </TouchableOpacity>
                    {doctors.map(doc => (
                      <TouchableOpacity
                        key={doc.id}
                        onPress={() => setSelectedDoctorId(doc.id)}
                        style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, marginRight: 10, backgroundColor: selectedDoctorId === doc.id ? brandColor : (isDark ? '#1A1A1A' : '#FFF'), borderWidth: 1, borderColor: selectedDoctorId === doc.id ? brandColor : (isDark ? '#2E2E2E' : '#E2E8F0') }}
                      >
                        <Text style={{ color: selectedDoctorId === doc.id ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B'), fontWeight: '900', fontSize: 11 }}>DR. {doc.name.toUpperCase()}</Text>
                        {doc.specialty ? <Text style={{ color: selectedDoctorId === doc.id ? 'rgba(255,255,255,0.75)' : (isDark ? '#555' : '#94A3B8'), fontWeight: '700', fontSize: 9, marginTop: 2 }}>{doc.specialty.toUpperCase()}</Text> : null}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {transferDestination === 'pharmacie' && (
                <FadeInView style={{ marginBottom: 24, padding: 20, backgroundColor: '#10B98110', borderRadius: 28, borderWidth: 1, borderColor: '#10B98130' }}>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: '#10B981', letterSpacing: 1, marginBottom: 16 }}>PRESCRIPTION D'URGENCE (PHARMACIE)</Text>
                  
                  {prescriptionItems.map((item, index) => (
                    <View key={index} style={{ marginBottom: 12, padding: 14, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 16, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                         <Text style={{ fontWeight: '900', color: isDark ? '#FFF' : '#1A1A1A' }}>{item.name}</Text>
                         <TouchableOpacity onPress={() => setPrescriptionItems(prev => prev.filter((_, i) => i !== index))}>
                            <MaterialIcons name="close" size={18} color="#EF4444" />
                         </TouchableOpacity>
                      </View>
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Qté: {item.quantity} · {item.instructions}</Text>
                    </View>
                  ))}

                  <View style={{ marginTop: 8 }}>
                    <TextInput
                      style={{ backgroundColor: isDark ? '#0A0A0A' : '#FFF', color: isDark ? '#FFF' : '#0A0A0A', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', marginBottom: 10 }}
                      placeholder="Chercher un médicament..." placeholderTextColor={isDark ? "#555555" : '#94A3B8'}
                      value={medSearch}
                      onChangeText={q => {
                        setMedSearch(q);
                        if (q.length > 1) {
                           const needle = normalizeSearch(q);
                           setMedResults(medicines.filter(m => normalizeSearch(m.name).includes(needle) || normalizeSearch(m.dosage).includes(needle)).slice(0, 5));
                        } else setMedResults([]);
                      }}
                    />
                    {medResults.length > 0 && (
                       <View style={{ backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 16, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                          {medResults.map(m => (
                             <TouchableOpacity 
                                key={m.id} 
                                style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: isDark ? '#2E2E2E' : '#F1F5F9' }}
                                onPress={() => {
                                   setPrescriptionItems(prev => [...prev, { medicine_id: m.id, name: m.name, quantity: 1, instructions: m.dosage || '' }]);
                                   setMedSearch('');
                                   setMedResults([]);
                                }}
                             >
                                <Text style={{ fontWeight: '800', color: isDark ? '#FFF' : '#0A0A0A' }}>{m.name}</Text>
                                <Text style={{ fontSize: 11, color: '#64748B' }}>{m.dosage} · Stock: {m.stock_quantity}</Text>
                             </TouchableOpacity>
                          ))}
                       </View>
                    )}
                  </View>
                  
                  <TouchableOpacity 
                     onPress={() => setPrescriptionItems(prev => [...prev, { name: 'Autre produit...', quantity: 1, instructions: '' }])}
                     style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 14, borderStyle: 'dashed', borderWidth: 1, borderColor: '#10B981' }}
                  >
                     <MaterialCommunityIcons name="help-circle" size={18} color="#10B981" />
                     <Text style={{ color: '#10B981', fontWeight: '900', fontSize: 11, marginLeft: 8 }}>AJOUTER MANUELLEMENT</Text>
                  </TouchableOpacity>
                </FadeInView>
              )}

              <TouchableOpacity style={{ height: 66, borderRadius: 33, overflow: 'hidden', marginBottom: 20 }} onPress={handleForward} disabled={isSubmitting}>
                <LinearGradient colors={transferDestination === 'completed' ? ['#22C55E', '#16A34A'] : Theme.colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  {isSubmitting ? <ActivityIndicator color={brandColor} /> : (
                    <>
                      <MaterialIcons name={transferDestination === 'completed' ? "check-circle" : "send"} size={24} color="#FFF" style={{ marginRight: 12 }} />
                      <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 1 }}>{transferDestination === 'completed' ? 'VALIDER & TERMINER' : 'ENVOYER PATIENT'}</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </FadeInView>
          )}
        </View>
      </ScrollView>
      )}

      {/* BOTTOM SLIDE PANEL (QUICK STATS) */}
      {activeBottomTab === 'stats' && (
        <Animated.View style={[
          {
            position: 'absolute',
            bottom: insets.bottom + 85,
            left: 10,
            right: 10,
            maxHeight: height * 0.7,
            backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF',
            borderRadius: 36,
            borderWidth: 1.5,
            borderColor: isDark ? '#1A1A1A' : '#F1F5F9',
            elevation: 40,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -12 },
            shadowOpacity: 0.3,
            shadowRadius: 24,
            overflow: 'hidden',
            zIndex: 1000,
          },
          { transform: [{ translateY: bottomPanelAnim.interpolate({ inputRange: [0, 1], outputRange: [800, 0] }) }] }
        ]}>
          {/* Handle bar */}
          <View style={{ width: 45, height: 6, backgroundColor: isDark ? '#2E2E2E' : '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginTop: 14 }} />

          {/* Header */}
          <View style={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: isDark ? '#1A1A1A' : '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <LinearGradient colors={[brandColor, '#805AD5']} style={{ width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <MaterialCommunityIcons name="chart-box-outline" size={26} color="#FFF" />
              </LinearGradient>
              <View>
                <Text style={{ fontSize: 19, fontWeight: '900', color: isDark ? '#F1F5F9' : '#0A0A0A', letterSpacing: -0.5 }}>STATISTIQUES SOINS</Text>
                <Text style={{ fontSize: 11, color: isDark ? '#888888' : '#94A3B8', fontWeight: '800' }}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => toggleBottomTab('stats')} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: isDark ? '#1A1A1A' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="help-circle" size={24} color={brandColor} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Row 1: En Soins + Urgences */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1, padding: 20, backgroundColor: isDark ? '#121212' : '#F8FAFC', borderRadius: 28, borderWidth: 1, borderColor: isDark ? '#222222' : '#E2E8F0' }}>
                <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: isDark ? '#1A1A1A' : brandColor + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <MaterialCommunityIcons name="needle" size={22} color={brandColor} />
                </View>
                <Text style={{ fontSize: 34, fontWeight: '950', color: isDark ? '#F1F5F9' : '#0A0A0A' }}>{stats?.inCare ?? careList.length}</Text>
                <Text style={{ fontSize: 9, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1.2, marginTop: 4 }}>EN COURS</Text>
              </View>

              <View style={{ flex: 1, padding: 20, backgroundColor: '#EF444408', borderRadius: 28, borderWidth: 1, borderColor: '#EF444425' }}>
                <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#EF444415', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <MaterialCommunityIcons name="help-circle" size={22} color="#EF4444" />
                </View>
                <Text style={{ fontSize: 34, fontWeight: '950', color: '#EF4444' }}>{stats?.urgencies ?? urgenciesList.length}</Text>
                <Text style={{ fontSize: 9, fontWeight: '900', color: '#EF4444', letterSpacing: 1.2, marginTop: 4 }}>URGENCES</Text>
              </View>
            </View>

            {/* Completed today - hero card */}
            <LinearGradient colors={[brandColor, '#805AD5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 32, padding: 26, marginBottom: 16, elevation: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', letterSpacing: 2 }}>TRAITEMENTS TERMINÉS</Text>
                  <Text style={{ color: '#FFF', fontSize: 52, fontWeight: '950', marginTop: 4 }}>{stats?.completedToday ?? historyList.length}</Text>
                </View>
                <MaterialCommunityIcons name="check-decagram" size={70} color="rgba(255,255,255,0.2)" />
              </View>
              <View style={{ height: 1.5, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 18 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' }}>Taux d'efficacité</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600' }}>Basé sur les flux du jour</Text>
                </View>
                <Text style={{ color: '#FFF', fontWeight: '950', fontSize: 18 }}>
                  {visits.length + historyList.length > 0
                    ? Math.round((historyList.length / (visits.length + historyList.length)) * 100)
                    : 100}%
                </Text>
              </View>
              <View style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 4, marginTop: 12, overflow: 'hidden' }}>
                <View style={{
                  width: `${visits.length + historyList.length > 0
                    ? Math.round((historyList.length / (visits.length + historyList.length)) * 100)
                    : 100}%`,
                  height: '100%', backgroundColor: '#FFF', borderRadius: 4
                }} />
              </View>
            </LinearGradient>

            {/* Patients en attente de triage (Queue) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#F8FAFC', borderRadius: 28, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', marginBottom: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: isDark ? '#1A1A1A' : brandColor + '15', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <MaterialCommunityIcons name="account-clock-outline" size={26} color={brandColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, fontWeight: '900', color: brandColor, letterSpacing: 1.5, marginBottom: 4 }}>EN ATTENTE (TRIAGE)</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: isDark ? '#F1F5F9' : '#0A0A0A' }}>{queueList.length} <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#888888' : '#94A3B8' }}>patients</Text></Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={isDark ? "#2E2E2E" : '#CBD5E1'} />
            </View>

            {/* Total hospitalisations */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#F8FAFC', borderRadius: 28, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#22C55E15', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <MaterialCommunityIcons name="bed-outline" size={26} color="#22C55E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, fontWeight: '900', color: '#22C55E', letterSpacing: 1.5, marginBottom: 4 }}>HOSPITALISATIONS</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: isDark ? '#F1F5F9' : '#0A0A0A' }}>{hospitalizations.length} <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#888888' : '#94A3B8' }}>patients internés</Text></Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={isDark ? "#2E2E2E" : '#CBD5E1'} />
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {/* BOTTOM TAB BAR */}
      <PremiumFooter
        isDark={isDark}
        activeTab={activeBottomTab === 'stats' ? 'stats' : activeTab}
        tabs={[
          { id: 'queue', icon: 'heart-pulse', activeIcon: 'heart', label: bt.care || 'Soins' },
          { id: 'history', icon: 'history', activeIcon: 'history', label: bt.history || 'Historique' },
          { id: 'stats', icon: 'chart-arc', activeIcon: 'chart-pie', label: bt.stats || 'Statistiques' },
        ]}
        onTabPress={(tabId) => {
          if (tabId === 'stats') toggleBottomTab('stats');
          else {
            setActiveTab(tabId);
            setActiveView(tabId);
            if (tabId === 'history') fetchHistory();
            else fetchVisits();
            if (activeBottomTab) toggleBottomTab('stats');
          }
        }}
      />

      <PremiumRightPanel
        isOpen={isRightOpen}
        anim={rightAnim}
        onClose={() => toggleRight(false)}
        isDark={isDark}
        isOnline={isOnline}
        lang={lang}
        toggleLang={toggleLang}
        toggleTheme={toggleTheme}
        roleName={t.roles.soins}
        roleIcon="medical-bag"
        onLogout={handleLogout}
        t={t}
        setActiveView={(v) => { toggleRight(false); setActiveView(v); }}
      />

      {/* LEFT SOINS ACTION PANEL */}
      <PremiumLeftDrawer
        isOpen={isNavPanelOpen}
        anim={navPanelAnim}
        onClose={() => toggleNavPanel(false)}
        activeView={activeView}
        setActiveView={(v) => { setActiveView(v); if (v === 'control' || v === 'history') fetchHistory(); else fetchVisits(); }}
        menuItems={soinsMenu}
        roleName={t.roles.soins}
        isDark={isDark}
        t={t}
      />

      <SoinsActionPanel
        isOpen={isActionPanelOpen}
        anim={actionPanelAnim}
        onClose={() => toggleActionPanel(false)}
        isDark={isDark}
        onAppendNotes={handleAppendNotes}
      />
    </View>
  );
}

const createStyles = (C, S, brandColor) => StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: C.bg
  },
  fieldHeading: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    color: C.sub,
    marginBottom: 12,
    marginLeft: 4
  },
  vitalCard: {
    width: '48%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
});
