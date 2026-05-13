import React, { useEffect, useState, useRef, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, TextInput, Animated, Dimensions, Switch, StatusBar, AppState, useColorScheme } from 'react-native';
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
import DoctorActionPanel from '../components/DoctorActionPanel';
import PremiumHeader from '../components/PremiumHeader';
import FloatingActionDock from '../components/FloatingActionDock';
import PremiumFooter from '../components/PremiumFooter';
import ProfileView from '../components/ProfileView';
import { Theme } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

const { width, height } = Theme.layout;

export default function DoctorScreen({ navigation, route }) {
  const { themeMode, toggleTheme, lang, toggleLang, isOnline, brandColor, user } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useContext(ToastContext);
  const t = translations[lang] || translations.fr;
  const bt = t.bottomTabs || {};
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';
  const styles = createStyles(isDark, brandColor);

  const [visits, setVisits] = useState([]);
  const [history, setHistory] = useState([]);
  const [patientHistory, setPatientHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const [bottomLoading, setBottomLoading] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [activeTab, setActiveTab] = useState('queue'); // queue, history
  const [activeBottomTab, setActiveBottomTab] = useState(null); // null | 'stats'
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States
  const [diagnosis, setDiagnosis] = useState('');
  const [consultationNotes, setConsultationNotes] = useState('');
  const [vitals, setVitals] = useState({ temp: '', bp: '', weight: '', pulse: '', respiratory_rate: '', oxygen_saturation: '', height: '' });
  const [nextService, setNextService] = useState('pharmacie');
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [soinsNotes, setSoinsNotes] = useState('');
  const [prescriptionItems, setPrescriptionItems] = useState([{ medicine_id: null, name: '', dosage: '', instructions: '', quantity: 1, price: 0 }]);
  const [labCatalog, setLabCatalog] = useState([]);
  const [selectedLabTests, setSelectedLabTests] = useState([{ code: '' }]);
  const [medicines, setMedicines] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState(null);
  const [activeSearchType, setActiveSearchType] = useState(null); // 'lab' or 'med'

  // Hospitalization State
  const [hospForm, setHospForm] = useState({ ward: '', diagnosis: '', daily_rate: '25000' });

  const [isRightOpen, setIsRightOpen] = useState(false);
  const rightAnim = useRef(new Animated.Value(width)).current;
  const bottomPanelAnim = useRef(new Animated.Value(0)).current;

  // Nav Panel State
  const [isNavPanelOpen, setIsNavPanelOpen] = useState(false);
  const navPanelAnim = useRef(new Animated.Value(-width)).current;
  const [activeView, setActiveView] = useState('consultations'); // consultations, queue, appointments, history, results, profile
  const [appointments, setAppointments] = useState([]);

  // Rendez-vous form state
  const [rdvForm, setRdvForm] = useState({ patient_id: null, date: '', time: '' });

  // Action Panel State
  const [isActionPanelOpen, setIsActionPanelOpen] = useState(false);
  const actionPanelAnim = useRef(new Animated.Value(-width)).current;

  // Scroll position for sticky header effects
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchVisits(true),
          fetchWorkflowCatalog(),
          fetchMedicines(),
          fetchHistory(true)
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadAll();

    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        Promise.all([
          fetchVisits(true),
          fetchHistory(true)
        ]);
      }
    }, 15000);

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        Promise.all([
          fetchVisits(true),
          fetchHistory(true)
        ]);
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const requestedTab = route.params?.tab;
    if (requestedTab && ['consultations', 'queue', 'appointments', 'history', 'results'].includes(requestedTab)) {
      setActiveView(requestedTab);
      navigation.setParams({ tab: null });
    }

    if (route.params?.visitId && visits.length > 0) {
      const visit = visits.find(v => String(v.id) === String(route.params.visitId));
      if (visit) {
        setSelectedVisit(visit);
        setActiveView('consultations');
        navigation.setParams({ visitId: null });
      }
    }
  }, [route.params?.visitId, route.params?.tab, visits]);

  const fetchMedicines = async () => {
    try {
      const resp = await api.get('/pharmacy/medicines');
      setMedicines(resp.data);
    } catch (e) { }
  };

  const fetchVisits = async (isBg = false) => {
    if (!isBg) setLoading(true);
    try {
      const resp = await api.get('/visits');
      const data = resp.data;
      setVisits(Array.isArray(data) ? data : (data.data || []));
    } catch (e) { if (!isBg) showToast(parseError(e), 'error'); }
    finally { if (!isBg) setLoading(false); }
  };

  const parseError = (e) => {
    if (e.response?.data?.errors) {
      const errors = e.response.data.errors;
      const firstKey = Object.keys(errors)[0];
      return errors[firstKey][0];
    }
    return e.response?.data?.message || t.error;
  };

  const fetchWorkflowCatalog = async () => {
    try {
      const resp = await api.get('/workflow/catalog');
      setLabCatalog(resp.data?.lab_tests || []);
    } catch (e) { setLabCatalog([]); }
  };

  const fetchHistory = async (isBg = false) => {
    if (!isBg) setLoading(true);
    try {
      const resp = await api.get('/visits/my-today');
      const data = resp.data;
      setHistory(Array.isArray(data) ? data : (data.data || []));
    } catch (e) { if (!isBg) showToast(parseError(e), 'error'); }
    finally { if (!isBg) setLoading(false); }
  };

  const fetchPatientHistory = async (patientId) => {
    setHistLoading(true);
    try {
      const resp = await api.get('/visits', { params: { patient_id: patientId } });
      const data = resp.data;
      const results = Array.isArray(data) ? data : (data.data || []);
      setPatientHistory(results.filter(v => v?.status === 'completed'));
    } catch (e) { }
    finally { setHistLoading(false); }
  };

  const fetchStats = async () => {
    setBottomLoading(true);
    try {
      const resp = await api.get('/visits/my-today');
      const dataRaw = resp.data;
      const data = Array.isArray(dataRaw) ? dataRaw : (dataRaw.data || []);
      setStats({
        count: data.length,
        mostFrequent: data.length > 0 ? "Paludisme" : "Aucun cas",
        urgencies: data.filter(v => v?.complaints_notes?.includes('[URGENCE]')).length
      });
    } catch (e) {
      setStats({ count: 0, mostFrequent: "N/A", urgencies: 0 });
    } finally { setBottomLoading(false); }
  };

  const handleSearch = (text, type, index) => {
    setActiveSearchIndex(index);
    setActiveSearchType(type);
    
    if (!text || text.length < 1) {
      setSuggestions([]);
      return;
    }

    const query = text.toLowerCase();
    if (type === 'lab') {
      const filtered = labCatalog.filter(t => 
        t.code.toLowerCase().includes(query) || 
        t.label.toLowerCase().includes(query)
      );
      setSuggestions(filtered.slice(0, 5));
    } else {
      const filtered = medicines.filter(m => 
        m.name.toLowerCase().includes(query)
      );
      setSuggestions(filtered.slice(0, 5));
    }
  };

  const handleSelectSuggestion = (item) => {
    if (activeSearchType === 'lab') {
      const newTests = [...selectedLabTests];
      newTests[activeSearchIndex] = { code: item.code, label: item.label };
      setSelectedLabTests(newTests);
    } else {
      const newItems = [...prescriptionItems];
      newItems[activeSearchIndex] = { 
        ...newItems[activeSearchIndex], 
        name: item.name, 
        medicine_id: item.id,
        price: item.price
      };
      setPrescriptionItems(newItems);
    }
    setSuggestions([]);
    setActiveSearchIndex(null);
    setActiveSearchType(null);
  };

  const renderSuggestions = (type, index) => {
    if (activeSearchType !== type || activeSearchIndex !== index || suggestions.length === 0) return null;

    return (
      <View style={[styles.suggestionBox, { backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }]}>
        {suggestions.map((s, i) => (
          <TouchableOpacity 
            key={i} 
            style={[styles.suggestionItem, { borderBottomWidth: i === suggestions.length - 1 ? 0 : 1, borderBottomColor: isDark ? '#2E2E2E' : '#F1F5F9' }]}
            onPress={() => handleSelectSuggestion(s)}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: isDark ? '#FFF' : '#0A0A0A', fontWeight: '900', fontSize: 13 }}>
                {type === 'lab' ? s.code : s.name}
              </Text>
              <Text style={{ color: '#64748B', fontSize: 10, marginTop: 2 }}>
                {type === 'lab' ? s.label : `${Number(s.price || 0).toLocaleString()} FC • Stock: ${s.stock_quantity || 0}`}
              </Text>
            </View>
            <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: brandColor + '15', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="add" size={16} color={brandColor} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
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

  const handleForward = async () => {
    if (!selectedVisit) return;
    if (!diagnosis && nextService !== 'completed') return showToast("Le diagnostic est obligatoire", 'error');

    setIsSubmitting(true);
    try {
      if (nextService === 'hospitalisation') {
        await api.post('/hospitalizations', {
          patient_id: selectedVisit.patient_id,
          visit_id: selectedVisit.id,
          ward: hospForm.ward,
          daily_rate: parseFloat(hospForm.daily_rate),
          diagnosis: diagnosis,
          attending_doctor_id: selectedVisit.doctor_id,
          notes: consultationNotes
        });

        await api.post(`/visits/${selectedVisit.id}/forward`, {
          next_service: 'soins',
          diagnosis,
          consultation_notes: 'DEMANDE HOSPITALISATION: ' + hospForm.ward + '\n' + consultationNotes,
          notes: 'Admission prévue en ' + hospForm.ward
        });
      } else if (nextService === 'maternite') {
        await api.post('/maternity/cases', {
          patient_id: selectedVisit.patient_id,
          visit_id: selectedVisit.id,
          pregnancy_status: 'prenatal',
          risk_level: 'moderate',
          notes: consultationNotes || diagnosis,
          doctor_id: selectedVisit.doctor_id || user?.id,
        });

        await api.post(`/visits/${selectedVisit.id}/forward`, {
          next_service: 'maternite',
          diagnosis,
          consultation_notes: consultationNotes,
          notes: soinsNotes || 'Orientation maternité'
        });
      } else {
        await api.post(`/visits/${selectedVisit.id}/forward`, {
          next_service: nextService,
          diagnosis,
          consultation_notes: consultationNotes,
          notes: soinsNotes,
          prescription_notes: prescriptionNotes,
          prescription_items: prescriptionItems
            .filter(p => p.name && p.name.trim() !== '')
            .map(p => ({
              name: p.name.trim(),
              dosage: p.dosage || '',
              instructions: p.instructions || '',
              quantity: parseInt(p.quantity) || 1,
              price: parseFloat(p.price) || 0,
              medicine_id: p.medicine_id || null,
            })),
          lab_tests: selectedLabTests.filter(t => t.code).map(item => {
            const test = labCatalog.find(cat => cat.code === item.code);
            return { code: item.code, label: test?.label || item.label || item.code, price: test?.price || 0 };
          }),
        });
      }

      showToast(t.success, 'success');
      setSelectedVisit(null);
      resetForms();
      fetchVisits();
    } catch (e) { showToast(parseError(e), 'error'); }
    finally { setIsSubmitting(false); }
  };

  const resetForms = () => {
    setDiagnosis('');
    setConsultationNotes('');
    setSoinsNotes('');
    setPrescriptionNotes('');
    setPrescriptionItems([{ name: '', dosage: '', instructions: '', quantity: 1, price: 0 }]);
    setSelectedLabTests([{ code: '' }]);
    setHospForm({ ward: '', diagnosis: '', daily_rate: '25000' });
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

  const doctorMenu = [
    { id: 'consultations', label: 'Consultations', icon: 'stethoscope', sub: 'Vos patients assignés' },
    { id: 'queue', label: 'File d\'attente', icon: 'account-group', sub: 'Patients en attente' },
    { id: 'results', label: 'Résultats Labo', icon: 'flask', sub: 'Analyses terminées' },
    { id: 'appointments', label: 'Rendez-vous', icon: 'calendar-clock', sub: 'Patients planifiés' },
    { id: 'history', label: 'Historique', icon: 'history', sub: 'Dossiers archivés' },
  ];

  const currentList = activeView === 'queue' ? (visits || []).filter(v => !v?.lab_results && v?.current_service === 'medecin' && !v?.doctor_id)
    : activeView === 'consultations' ? (visits || []).filter(v => !v?.lab_results && v?.current_service === 'medecin' && v?.doctor_id)
      : activeView === 'results' ? (visits || []).filter(v => v?.lab_results && v?.current_service === 'medecin')
        : activeView === 'history' ? (history || []) : [];

  const renderVisitCard = (v, idx) => (
    <FadeInView key={v.id} delay={idx * 50}>
      <PressableScale
        style={[styles.card, { backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderColor: isDark ? '#2E2E2E' : '#F1F5F9' }]}
        onPress={() => {
          setSelectedVisit(v);
          fetchPatientHistory(v.patient_id);
          setDiagnosis(v.diagnosis || '');
          setConsultationNotes(v.consultation_notes || '');
          setSoinsNotes('');
          setPrescriptionNotes(v.prescription_notes || '');
          
          if (v.prescription_items?.length) {
            const items = v.prescription_items.map(p => {
               if (typeof p === 'string') {
                  const parts = p.split(' - ');
                  return { name: parts[0] || '', dosage: parts[1] || '', quantity: 1, price: 0 };
               }
               return p;
            });
            setPrescriptionItems(items);
          } else {
            setPrescriptionItems([{ name: '', medicine_id: null, dosage: '', instructions: '', quantity: 1, price: 0 }]);
          }

          if (v.lab_tests?.length) {
            setSelectedLabTests(v.lab_tests.map(t => ({ code: t.code, label: t.label || t.code })));
          } else {
            setSelectedLabTests([{ code: '', label: '' }]);
          }

          setVitals({
            temp: v.vitals?.temperature || '',
            bp: v.vitals?.blood_pressure || '',
            weight: v.vitals?.weight || '',
            height: v.vitals?.height || '',
            pulse: v.vitals?.pulse || '',
            respiratory_rate: v.vitals?.respiratory_rate || '',
            oxygen_saturation: v.vitals?.oxygen_saturation || '',
          });
        }}
      >
        <LinearGradient colors={[brandColor + '20', brandColor + '05']} style={styles.avatar}>
          <Text style={styles.avatarText}>{v.patient?.first_name?.[0]}{v.patient?.last_name?.[0]}</Text>
        </LinearGradient>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={[styles.patientName, { color: isDark ? '#F1F5F9' : '#1A1A1A' }]}>{v.patient?.first_name} {v.patient?.last_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <View style={[styles.statusDot, { backgroundColor: activeView === 'history' ? '#22C55E' : activeView === 'results' ? brandColor : activeView === 'consultations' ? '#1A73E8' : '#F9AB00' }]} />
            <Text style={[styles.statusText, { color: isDark ? '#888888' : '#94A3B8' }]}>
              {activeView === 'history' ? 'ARCHIVÉ' : activeView === 'results' ? 'RÉSULTATS DISPONIBLES' : activeView === 'consultations' ? 'DOSSIER OUVERT' : 'EN ATTENTE'}
            </Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={brandColor} />
      </PressableScale>
    </FadeInView>
  );

  return (
    <View style={[styles.mainContainer, { backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <PremiumHeader
        onLeftPress={() => toggleNavPanel(true)}
        onRightPress={() => toggleRight(true)}
        title="REHOBOTH"
        subtitle={user?.specialty ? `Dr. ${user.specialty}` : (doctorMenu.find(m => m.id === activeView)?.label || 'ESPACE MÉDICAL')}
        icon="stethoscope"
        isDark={isDark}
        navigation={navigation}
      />

      <FloatingActionDock
        title={selectedVisit ? 'Consultation en cours' : 'Actions médicales'}
        actions={[
          selectedVisit && { key: 'back-list', icon: 'arrow-back', onPress: () => setSelectedVisit(null), active: true },
          { key: 'refresh', icon: 'refresh', onPress: () => { fetchVisits(); fetchHistory(); } },
          activeView !== 'appointments' && !selectedVisit && { key: 'appointment', icon: 'event-available', onPress: () => setActiveView('appointments') },
        ]}
      />

      <ScrollView
        contentContainerStyle={{ paddingTop: 125 + insets.top, paddingBottom: 130 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: insets.top > 40 ? 10 : 0 }}>
          {activeView === 'profile' ? (
            <FadeInView>
              <ProfileView onBack={() => setActiveView('consultations')} />
            </FadeInView>
          ) : !selectedVisit ? (
            <>
              <View style={styles.listHeader}>
                <Text style={[styles.listTitle, { color: isDark ? '#888888' : '#94A3B8' }]}>
                  {activeView === 'queue' ? 'LISTE D\'ATTENTE' : activeView === 'consultations' ? 'MES CONSULTATIONS' : activeView === 'history' ? 'HISTORIQUE DU JOUR' : activeView === 'results' ? 'RÉSULTATS LABO' : 'RENDEZ-VOUS'}
                </Text>
                <TouchableOpacity onPress={() => { fetchVisits(); fetchHistory(); }} style={styles.refreshBtn}>
                  <MaterialIcons name="refresh" size={20} color={brandColor} />
                </TouchableOpacity>
              </View>

              {activeView === 'appointments' && (
                <FadeInView style={[styles.rdvCard, { backgroundColor: brandColor + '10', borderColor: brandColor + '30' }]}>
                  <Text style={[styles.rdvTitle, { color: brandColor }]}>PLANIFIER UN RENDEZ-VOUS</Text>

                  <Text style={[styles.inputLabel, { color: isDark ? '#AAAAAA' : '#64748B' }]}>SÉLECTIONNER UN PATIENT</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {[...visits, ...history].map((v, idx) => (
                      <TouchableOpacity
                        key={v.id + '-' + idx}
                        onPress={() => setRdvForm(prev => ({ ...prev, patient_id: v.patient?.id }))}
                        style={[styles.patientChip, {
                          backgroundColor: rdvForm.patient_id === v.patient?.id ? brandColor : (isDark ? '#1A1A1A' : '#FFF'),
                          borderColor: rdvForm.patient_id === v.patient?.id ? brandColor : (isDark ? '#2E2E2E' : '#E2E8F0')
                        }]}
                      >
                        <MaterialCommunityIcons name="account" size={14} color={rdvForm.patient_id === v.patient?.id ? '#FFF' : brandColor} />
                        <Text style={[styles.patientChipText, { color: rdvForm.patient_id === v.patient?.id ? '#FFF' : (isDark ? '#E2E8F0' : '#1A1A1A') }]}>{v.patient?.first_name} {v.patient?.last_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                    <TextInput style={[styles.rdvInput, { backgroundColor: isDark ? '#1A1A1A' : '#FFF', color: isDark ? '#FFF' : '#0A0A0A', borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }]} placeholder="Date (JJ/MM/AAAA)" placeholderTextColor={isDark ? '#888888' : '#94A3B8'} value={rdvForm.date} onChangeText={v => setRdvForm(prev => ({ ...prev, date: v }))} />
                    <TextInput style={[styles.rdvInput, { backgroundColor: isDark ? '#1A1A1A' : '#FFF', color: isDark ? '#FFF' : '#0A0A0A', borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }]} placeholder="Heure (HH:MM)" placeholderTextColor={isDark ? '#888888' : '#94A3B8'} value={rdvForm.time} onChangeText={v => setRdvForm(prev => ({ ...prev, time: v }))} />
                  </View>
                  <TouchableOpacity onPress={() => showToast("Rendez-vous planifié", 'success')} style={styles.rdvSubmit}>
                    <Text style={{ color: '#FFF', fontWeight: '900' }}>VALIDER LE RENDEZ-VOUS</Text>
                  </TouchableOpacity>
                </FadeInView>
              )}

              {loading ? (
                <View>{[1, 2, 3].map(i => <SkeletonItem key={i} height={100} style={{ marginBottom: 16, borderRadius: 28 }} />)}</View>
              ) : (
                currentList.length > 0 ? currentList.map(renderVisitCard) : (
                  <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="stethoscope-variant" size={64} color={brandColor} style={{ opacity: 0.3 }} />
                    <Text style={[styles.emptyText, { color: isDark ? '#888888' : '#94A3B8' }]}>Aucun patient dans cette file</Text>
                  </View>
                )
              )}
            </>
          ) : (
            <FadeInView style={{ paddingTop: 10 }}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedVisit(null)}>
                <MaterialIcons name="arrow-back" size={20} color={brandColor} />
                <Text style={[styles.backBtnText, { color: brandColor }]}>RETOUR À LA LISTE</Text>
              </TouchableOpacity>

              <View style={[styles.patientHeader, { backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderColor: isDark ? '#2E2E2E' : '#F1F5F9' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={styles.headerAvatar}>
                    <Text style={styles.headerAvatarText}>{selectedVisit.patient?.first_name?.[0]}{selectedVisit.patient?.last_name?.[0]}</Text>
                  </View>
                  <View style={{ marginLeft: 16 }}>
                    <Text style={[styles.headerName, { color: isDark ? '#FFF' : '#0A0A0A' }]}>{selectedVisit.patient?.first_name} {selectedVisit.patient?.last_name}</Text>
                    <Text style={{ color: brandColor, fontSize: 13, fontWeight: '900', marginTop: 2 }}>
                       {selectedVisit.patient?.gender === 'M' ? 'HOMME' : 'FEMME'} • {selectedVisit.patient?.age} ANS
                    </Text>
                    <Text style={{ color: isDark ? '#888888' : '#94A3B8', fontSize: 10, fontWeight: '700', marginTop: 2 }}>Né(e) en {selectedVisit.patient?.birth_year || 'N/A'}</Text>
                  </View>
                </View>

                <View style={[styles.insuranceBadge, { backgroundColor: selectedVisit.patient?.is_insured ? '#22C55E15' : '#F9AB0015' }]}>
                  <MaterialCommunityIcons name={selectedVisit.patient?.is_insured ? "shield-check" : "account-lock"} size={14} color={selectedVisit.patient?.is_insured ? '#22C55E' : '#F9AB00'} />
                  <Text style={[styles.insuranceText, { color: selectedVisit.patient?.is_insured ? '#22C55E' : '#F9AB00' }]}>
                    {selectedVisit.patient?.is_insured ? `ASSURÉ : ${selectedVisit.patient?.insurance_company || 'OUI'}` : "PATIENT PRIVÉ"}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <MaterialIcons name="phone" size={14} color="#64748B" />
                  <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '700', marginLeft: 6 }}>
                    {selectedVisit.patient?.phone || 'Pas de téléphone'}
                  </Text>
                </View>
              </View>

              {/* PATIENT HISTORY */}
              <TouchableOpacity style={[styles.sectionHeader, { marginTop: 0 }]} activeOpacity={0.7}>
                <Text style={styles.fieldHeading}>HISTORIQUE MÉDICAL</Text>
                <MaterialIcons name="history" size={16} color="#64748B" />
              </TouchableOpacity>
              <View style={[styles.historyContainer, { backgroundColor: isDark ? '#111827' : '#F1F5F9' }]}>
                {histLoading ? <ActivityIndicator color={brandColor} /> :
                  patientHistory.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {patientHistory.map((h, i) => (
                        <View key={i} style={[styles.historyCard, { backgroundColor: isDark ? '#1A1A1A' : '#FFF' }]}>
                          <Text style={[styles.historyDate, { color: brandColor }]}>{new Date(h.updated_at).toLocaleDateString()}</Text>
                          <Text style={[styles.historyDiag, { color: isDark ? '#E2E8F0' : '#1A1A1A' }]} numberOfLines={2}>{h.diagnosis || 'Pas de diag.'}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  ) : <Text style={{ color: '#64748B', fontSize: 11, fontStyle: 'italic' }}>Aucun antécédent enregistré dans le système.</Text>
                }
              </View>

              {/* VITALS ROW */}
              <Text style={styles.fieldHeading}>{t.vitals?.toUpperCase() || 'CONSTANTES'}</Text>
              <View style={styles.vitalsRow}>
                <View style={[styles.vitalBox, { backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }]}>
                  <MaterialCommunityIcons name="thermometer" size={18} color="#EF4444" />
                  <TextInput editable={false} style={[styles.vitalInput, { color: isDark ? '#FFF' : '#0A0A0A' }]} value={vitals.temp} />
                  <Text style={styles.vitalUnit}>°C</Text>
                </View>
                <View style={[styles.vitalBox, { backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }]}>
                  <MaterialCommunityIcons name="heart-pulse" size={18} color="#3B82F6" />
                  <TextInput editable={false} style={[styles.vitalInput, { color: isDark ? '#FFF' : '#0A0A0A' }]} value={vitals.bp} />
                </View>
                <View style={[styles.vitalBox, { backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }]}>
                  <MaterialCommunityIcons name="weight-kilogram" size={18} color="#10B981" />
                  <TextInput editable={false} style={[styles.vitalInput, { color: isDark ? '#FFF' : '#0A0A0A' }]} value={vitals.weight} />
                </View>
              </View>

              <View style={[styles.nursingBox, { backgroundColor: isDark ? '#111827' : '#FFF', borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <MaterialCommunityIcons name="comment-text-outline" size={14} color="#64748B" />
                  <Text style={styles.nursingLabel}>NOTE DE TRIAGE</Text>
                </View>
                <Text style={[styles.nursingText, { color: isDark ? '#E2E8F0' : '#1A1A1A' }]}>
                  {selectedVisit.nursing_notes || 'Le patient n\'a pas de notes spécifiques de l\'infirmier.'}
                </Text>
              </View>

              {/* LAB RESULTS */}
              {selectedVisit.lab_results && (
                <FadeInView style={[styles.resultsBox, { backgroundColor: brandColor + '10', borderColor: brandColor + '30' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <MaterialCommunityIcons name="flask" size={18} color={brandColor} />
                    <Text style={[styles.resultsTitle, { color: brandColor }]}>RÉSULTATS DU LABORATOIRE</Text>
                  </View>
                  <View style={[styles.resultsContent, { backgroundColor: isDark ? '#0A0A0A' : '#FFF', borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }]}>
                    <Text style={{ color: isDark ? '#E2E8F0' : '#1A1A1A', lineHeight: 22, fontSize: 14 }}>
                      {selectedVisit.lab_results}
                    </Text>
                  </View>
                </FadeInView>
              )}

              {/* DIAGNOSIS */}
              <View style={styles.formHeader}>
                <Text style={[styles.fieldHeading, { marginBottom: 0 }]}>DIAGNOSTIC & OBSERVATIONS</Text>
                <TouchableOpacity onPress={() => toggleActionPanel(true)} style={styles.modelBtn}>
                  <MaterialCommunityIcons name="clipboard-pulse" size={14} color={brandColor} />
                  <Text style={styles.modelBtnText}>MODÈLES</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.textAreaContainer, { borderColor: isDark ? '#2E2E2E' : '#E2E8F0', backgroundColor: isDark ? '#1A1A1A' : '#FFF' }]}>
                <TextInput
                  style={[styles.textArea, { color: isDark ? '#FFF' : '#0A0A0A' }]}
                  placeholder="Diagnostic principal..."
                  placeholderTextColor={isDark ? '#555555' : '#94A3B8'}
                  multiline
                  value={diagnosis}
                  onChangeText={setDiagnosis}
                />
              </View>

              <View style={[styles.textAreaContainer, { height: 130, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', backgroundColor: isDark ? '#1A1A1A' : '#FFF' }]}>
                <TextInput
                  style={[styles.textArea, { color: isDark ? '#FFF' : '#0A0A0A' }]}
                  placeholder="Conduite à tenir / Observations cliniques..."
                  placeholderTextColor={isDark ? '#555555' : '#94A3B8'}
                  multiline
                  value={consultationNotes}
                  onChangeText={setConsultationNotes}
                />
              </View>

              {/* DYNAMIC FORMS */}
              {nextService === 'labo' && (
                <FadeInView style={styles.ordonnanceContainer}>
                  <LinearGradient colors={[brandColor + '15', brandColor + '05']} style={styles.ordonnanceHeader}>
                    <MaterialCommunityIcons name="flask" size={20} color={brandColor} />
                    <Text style={[styles.ordonnanceTitle, { color: brandColor }]}>BON DE LABORATOIRE</Text>
                  </LinearGradient>
                  
                  <View style={styles.ordonnanceBody}>
                    {selectedLabTests.map((test, index) => (
                      <View key={index} style={styles.labItemRow}>
                        <View style={[styles.labInputWrapper, { zIndex: activeSearchIndex === index && activeSearchType === 'lab' ? 10 : 1 }]}>
                          <TextInput
                            style={[styles.labInput, { color: isDark ? '#FFF' : '#0A0A0A' }]}
                            placeholder="Code ou Nom de l'examen..."
                            placeholderTextColor={isDark ? '#555' : '#94A3B8'}
                            value={test.code}
                            onChangeText={(v) => {
                              const newTests = [...selectedLabTests];
                              newTests[index].code = v.toUpperCase();
                              setSelectedLabTests(newTests);
                              handleSearch(v, 'lab', index);
                            }}
                            onFocus={() => handleSearch(test.code, 'lab', index)}
                          />
                          {renderSuggestions('lab', index)}
                          {test.label && test.label !== test.code && (
                             <Text style={styles.labLabelPreview} numberOfLines={1}>{test.label}</Text>
                          )}
                        </View>
                        <TouchableOpacity onPress={() => setSelectedLabTests(prev => prev.filter((_, i) => i !== index))} style={styles.labDeleteBtn}>
                          <MaterialIcons name="remove-circle-outline" size={22} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    
                    <TouchableOpacity 
                      onPress={() => { setSelectedLabTests(prev => [...prev, { code: '', label: '' }]); setSuggestions([]); }} 
                      style={[styles.ordonnanceAddBtn, { borderColor: brandColor + '30' }]}
                    >
                      <MaterialIcons name="add-circle-outline" size={20} color={brandColor} />
                      <Text style={[styles.ordonnanceAddText, { color: brandColor }]}>AJOUTER UN EXAMEN</Text>
                    </TouchableOpacity>
                  </View>
                </FadeInView>
              )}

              {nextService === 'pharmacie' && (
                <FadeInView style={styles.ordonnanceContainer}>
                  <LinearGradient colors={['#10B98115', '#10B98105']} style={styles.ordonnanceHeader}>
                    <MaterialCommunityIcons name="pill" size={20} color="#10B981" />
                    <Text style={[styles.ordonnanceTitle, { color: '#10B981' }]}>ORDONNANCE MÉDICALE</Text>
                  </LinearGradient>

                  <View style={styles.ordonnanceBody}>
                    {prescriptionItems.map((item, index) => (
                      <View key={index} style={[styles.medCard, { backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }]}>
                        <View style={styles.medCardHeader}>
                          <View style={{ flex: 1, zIndex: activeSearchIndex === index && activeSearchType === 'med' ? 10 : 1 }}>
                            <TextInput
                              style={[styles.medNameInput, { color: isDark ? '#FFF' : '#0A0A0A' }]}
                              placeholder="Nom du médicament..."
                              placeholderTextColor={isDark ? '#555' : '#94A3B8'}
                              value={item.name}
                              onChangeText={(v) => { 
                                const n = [...prescriptionItems]; n[index].name = v; setPrescriptionItems(n);
                                handleSearch(v, 'med', index);
                              }}
                              onFocus={() => handleSearch(item.name, 'med', index)}
                            />
                            {renderSuggestions('med', index)}
                          </View>
                          <TouchableOpacity onPress={() => setPrescriptionItems(prev => prev.filter((_, i) => i !== index))} style={styles.medDeleteBtn}>
                            <MaterialIcons name="cancel" size={22} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                        
                        <View style={styles.medCardBody}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.medInputLabel}>DOSAGE (EX: 500MG)</Text>
                            <TextInput
                              style={[styles.medQtyInput, { color: isDark ? '#FFF' : '#0A0A0A', width: '100%', marginBottom: 10 }]}
                              placeholder="500mg, 1 amp, etc."
                              placeholderTextColor={isDark ? '#444' : '#CBD5E1'}
                              value={item.dosage}
                              onChangeText={(v) => { const n = [...prescriptionItems]; n[index].dosage = v; setPrescriptionItems(n); }}
                            />
                            
                            <Text style={styles.medInputLabel}>POSOLOGIE / INSTRUCTIONS</Text>
                            <TextInput
                              style={[styles.medInstructionInput, { color: isDark ? '#E2E8F0' : '#475569', minHeight: 60 }]}
                              placeholder="1 comp x 3 / jour pendant 5 jours..."
                              placeholderTextColor={isDark ? '#444' : '#CBD5E1'}
                              value={item.instructions}
                              onChangeText={(v) => { const n = [...prescriptionItems]; n[index].instructions = v; setPrescriptionItems(n); }}
                              multiline
                            />
                          </View>
                          <View style={[styles.medQtyGroup, { marginLeft: 10 }]}>
                            <Text style={styles.medInputLabel}>QTÉ</Text>
                            <TextInput
                              style={[styles.medQtyInput, { color: isDark ? '#FFF' : '#0A0A0A' }]}
                              keyboardType="numeric"
                              value={String(item.quantity || 1)}
                              onChangeText={(v) => { const n = [...prescriptionItems]; n[index].quantity = v; setPrescriptionItems(n); }}
                            />
                          </View>
                        </View>
                      </View>
                    ))}

                    <TouchableOpacity 
                      onPress={() => { setPrescriptionItems(prev => [...prev, { name: '', medicine_id: null, dosage: '', instructions: '', quantity: 1, price: 0 }]); setSuggestions([]); }} 
                      style={[styles.ordonnanceAddBtn, { borderColor: '#10B98130' }]}
                    >
                      <MaterialIcons name="add-circle-outline" size={20} color="#10B981" />
                      <Text style={[styles.ordonnanceAddText, { color: '#10B981' }]}>AJOUTER UN PRODUIT</Text>
                    </TouchableOpacity>
                  </View>
                </FadeInView>
              )}

              {/* ORIENTATION */}
              <Text style={styles.fieldHeading}>ORIENTATION DU PATIENT</Text>
              <View style={styles.serviceSelector}>
                {[
                  { id: 'pharmacie', label: 'PHARMACIE', icon: 'pill' },
                  { id: 'labo', label: 'LABORATOIRE', icon: 'flask' },
                  { id: 'soins', label: 'SOINS / INJ', icon: 'medical-bag' },
                  { id: 'maternite', label: 'MATERNITÉ', icon: 'mother-heart' },
                  { id: 'hospitalisation', label: 'HOSPIT.', icon: 'bed-outline' },
                  { id: 'completed', label: 'TERMINER', icon: 'check-all' }
                ].map(s => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setNextService(s.id)}
                    style={[styles.serviceBtn, {
                      backgroundColor: nextService === s.id ? brandColor : 'transparent',
                      borderColor: nextService === s.id ? brandColor : (isDark ? '#2E2E2E' : '#E2E8F0')
                    }]}
                  >
                    <MaterialCommunityIcons name={s.icon} size={16} color={nextService === s.id ? '#FFF' : brandColor} />
                    <Text style={[styles.serviceBtnText, { color: nextService === s.id ? '#FFF' : (isDark ? '#E2E8F0' : '#1A1A1A') }]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleForward} disabled={isSubmitting}>
                <LinearGradient colors={Theme.colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitGrad}>
                  {isSubmitting ? <ActivityIndicator color="#FFF" /> : (
                    <>
                      <MaterialIcons name="done-all" size={24} color="#FFF" style={{ marginRight: 10 }} />
                      <Text style={styles.submitText}>VALIDER & TRANSMETTRE</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </FadeInView>
          )}
        </View>
      </ScrollView>

      {/* FOOTER */}
      <PremiumFooter
        isDark={isDark}
        activeTab={activeBottomTab === 'stats' ? 'stats' : activeTab}
        tabs={[
          { id: 'queue', icon: 'account-clock', activeIcon: 'account-group', label: 'File' },
          { id: 'history', icon: 'history', activeIcon: 'history', label: 'Archives' },
          { id: 'stats', icon: 'chart-arc', activeIcon: 'chart-pie', label: 'Stats' },
        ]}
        onTabPress={(tabId) => {
          if (tabId === 'stats') toggleBottomTab('stats');
          else {
            setActiveTab(tabId);
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
        roleName={t.roles.medecin}
        roleIcon="doctor"
        onLogout={handleLogout}
        t={t}
        setActiveView={(v) => { toggleRight(false); setActiveView(v); }}
      />

      <PremiumLeftDrawer
        isOpen={isNavPanelOpen}
        anim={navPanelAnim}
        onClose={() => toggleNavPanel(false)}
        activeView={activeView}
        setActiveView={(v) => { setActiveView(v); if (v === 'history') fetchHistory(); else fetchVisits(); }}
        menuItems={doctorMenu}
        roleName={t.roles.medecin}
        isDark={isDark}
        t={t}
      />

      <DoctorActionPanel
        isOpen={isActionPanelOpen}
        anim={actionPanelAnim}
        onClose={() => toggleActionPanel(false)}
        isDark={isDark}
        onAppendDiagnosis={(diag) => setDiagnosis(prev => prev ? prev + ', ' + diag : diag)}
        onAppendNotes={(note) => setConsultationNotes(prev => prev ? prev + '\n' + note : note)}
      />
    </View>
  );
}

function createStyles(isDark, brandColor) {
  return StyleSheet.create({
  mainContainer: { flex: 1 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  listTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  refreshBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 32, marginBottom: 12, borderWidth: 1, elevation: 3 },
  avatar: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '900', fontSize: 20, color: brandColor },
  patientName: { fontSize: 17, fontWeight: '800' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', paddingVertical: 100 },
  emptyText: { marginTop: 16, fontWeight: '700', fontSize: 14 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingVertical: 8 },
  backBtnText: { fontWeight: '900', marginLeft: 8, fontSize: 13, letterSpacing: 1 },
  patientHeader: { padding: 24, borderRadius: 32, borderWidth: 1, elevation: 4, marginBottom: 20 },
  headerAvatar: { width: 64, height: 64, borderRadius: 24, backgroundColor: brandColor, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#FFF', fontWeight: '900', fontSize: 24 },
  headerName: { fontSize: 24, fontWeight: '900' },
  insuranceBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, alignSelf: 'flex-start' },
  insuranceText: { fontWeight: '900', fontSize: 10, marginLeft: 6 },
  fieldHeading: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#64748B', marginBottom: 16, marginLeft: 4, marginTop: 10 },
  historyContainer: { padding: 16, borderRadius: 24, marginBottom: 24 },
  historyCard: { width: 140, padding: 14, borderRadius: 18, marginRight: 12, elevation: 2 },
  historyDate: { fontSize: 10, fontWeight: '900', marginBottom: 6 },
  historyDiag: { fontSize: 12, fontWeight: '700', lineHeight: 18 },
  vitalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  vitalBox: { width: '31%', height: 56, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  vitalInput: { flex: 1, marginLeft: 6, fontSize: 15, fontWeight: '800' },
  vitalUnit: { fontSize: 10, fontWeight: '900', color: '#64748B' },
  nursingBox: { padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 32 },
  nursingLabel: { color: '#64748B', fontSize: 10, fontWeight: '900', marginLeft: 6 },
  nursingText: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
  resultsBox: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 32 },
  resultsTitle: { fontSize: 11, fontWeight: '900', marginLeft: 6, letterSpacing: 1 },
  resultsContent: { padding: 16, borderRadius: 16, borderWidth: 1, marginTop: 12 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modelBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: brandColor + '15', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  modelBtnText: { marginLeft: 8, fontSize: 11, fontWeight: '900', color: brandColor },
  textAreaContainer: { borderRadius: 28, borderWidth: 1, padding: 20, height: 110, marginBottom: 16 },
  textArea: { flex: 1, fontSize: 16, textAlignVertical: 'top', fontWeight: '500' },
  dynamicForm: { padding: 20, borderRadius: 28, backgroundColor: '#F1F5F9', marginBottom: 32 },
  dynamicTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: 16 },
  table: { gap: 10 },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tableInput: { height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  deleteBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EF444415', alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginTop: 10 },
  addBtnText: { marginLeft: 8, fontWeight: '900', fontSize: 12 },
  serviceSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 40 },
  serviceBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, borderWidth: 1.5 },
  serviceBtnText: { fontSize: 10, fontWeight: '900', marginLeft: 8 },
  submitBtn: { height: 68, borderRadius: 34, overflow: 'hidden', marginBottom: 40, elevation: 8 },
  submitGrad: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  rdvCard: { padding: 24, borderRadius: 32, borderWidth: 1, marginBottom: 24 },
  rdvTitle: { fontWeight: '900', fontSize: 14, letterSpacing: 1, marginBottom: 20 },
  inputLabel: { fontSize: 10, fontWeight: '800', marginBottom: 12, letterSpacing: 0.5 },
  patientChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, marginRight: 10, flexDirection: 'row', alignItems: 'center' },
  patientChipText: { fontWeight: '800', fontSize: 12, marginLeft: 8 },
  rdvInput: { flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, fontSize: 14 },
  rdvSubmit: { padding: 18, borderRadius: 18, backgroundColor: brandColor, alignItems: 'center', marginTop: 8 },
  suggestionBox: { position: 'absolute', top: 50, left: 0, right: 0, borderRadius: 14, borderWidth: 1, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, zIndex: 1000 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  
  // New Structured Form Styles
  ordonnanceContainer: { borderRadius: 32, backgroundColor: isDark ? '#111827' : '#FFF', borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', overflow: 'hidden', marginBottom: 32, elevation: 4 },
  ordonnanceHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 },
  ordonnanceTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  ordonnanceBody: { padding: 20 },
  ordonnanceAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 10 },
  ordonnanceAddText: { marginLeft: 8, fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  
  labItemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  labInputWrapper: { flex: 1, backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', borderRadius: 18, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', paddingHorizontal: 16, paddingVertical: 12 },
  labInput: { fontSize: 15, fontWeight: '700' },
  labLabelPreview: { fontSize: 10, color: '#64748B', marginTop: 4, fontWeight: '600' },
  labDeleteBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EF444410', alignItems: 'center', justifyContent: 'center' },
  
  medCard: { borderRadius: 24, borderWidth: 1, marginBottom: 16, padding: 18, elevation: 2 },
  medCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  medNameInput: { fontSize: 17, fontWeight: '900' },
  medDeleteBtn: { padding: 4, marginLeft: 10 },
  medCardBody: { flexDirection: 'row', gap: 12 },
  medInputGroup: { flex: 1 },
  medQtyGroup: { width: 60 },
  medInputLabel: { fontSize: 9, fontWeight: '900', color: '#64748B', marginBottom: 6, letterSpacing: 0.5 },
  medInstructionInput: { backgroundColor: isDark ? '#0A0A0A' : '#F1F5F9', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, fontWeight: '600', minHeight: 44 },
  medQtyInput: { backgroundColor: isDark ? '#0A0A0A' : '#F1F5F9', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15, fontWeight: '900', textAlign: 'center', height: 44 },
  });
}
