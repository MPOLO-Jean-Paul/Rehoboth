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
import PremiumRightPanel from '../components/PremiumRightPanel';
import PremiumLeftDrawer from '../components/PremiumLeftDrawer';
import PremiumHeader from '../components/PremiumHeader';
import FloatingActionDock from '../components/FloatingActionDock';
import ProfileView from '../components/ProfileView';
import PremiumFooter from '../components/PremiumFooter';
import { Theme } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

import Storage from '../services/Storage';

const { width, height } = Theme.layout;

export default function LaboScreen({ navigation, route }) {
  const { isDark, C, S, brandColor, themeMode, toggleTheme, lang, toggleLang, isOnline } = useTheme();
  const styles = createStyles(C, S, brandColor);
  const insets = useSafeAreaInsets();
  const { showToast } = useContext(ToastContext);
  const t = translations[lang] || translations.fr;
  const bt = t.bottomTabs || {};

  const [visits, setVisits] = useState([]);
  const [history, setHistory] = useState([]);
  const [expandedDates, setExpandedDates] = useState({});
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bottomLoading, setBottomLoading] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // pending, history
  const [activeBottomTab, setActiveBottomTab] = useState(null); // null | 'stats'
  const [results, setResults] = useState('');
  const [structuredResults, setStructuredResults] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeView, setActiveView] = useState('pending');
  const [isRightOpen, setIsRightOpen] = useState(false);
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const rightAnim = useRef(new Animated.Value(width)).current;
  const leftAnim = useRef(new Animated.Value(-width)).current;
  const bottomPanelAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadCachedData();
    fetchVisits();
    fetchHistory();

    const startInterval = () => {
      return setInterval(() => {
        fetchVisits(true);
        fetchHistory(true);
      }, 10000);
    };

    let interval = startInterval();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        fetchVisits(true);
        fetchHistory(true);
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

  useEffect(() => {
    const requestedTab = route.params?.tab;
    if (requestedTab && ['pending', 'sent', 'stats', 'history'].includes(requestedTab)) {
      setActiveView(requestedTab);
      setActiveTab(requestedTab === 'history' ? 'history' : 'pending');
      setActiveBottomTab(requestedTab === 'stats' ? 'stats' : null);
      navigation.setParams({ tab: null });
    }

    if (route.params?.visitId && visits.length > 0) {
      const visit = visits.find(v => String(v.id) === String(route.params.visitId));
      if (visit) {
        setSelectedVisit(visit);
        setActiveView('pending');
        // Clear params to avoid re-triggering
        navigation.setParams({ visitId: null });
      }
    }
  }, [route.params?.visitId, route.params?.tab, visits]);

  const loadCachedData = async () => {
    const cached = await Storage.get('labo_data');
    if (cached) {
      setVisits(cached.visits || []);
      setHistory(cached.history || []);
      setLoading(false);
    }
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
      const resp = await api.get('/labo/prescriptions');
      const dataRaw = resp.data;
      const data = Array.isArray(dataRaw) ? dataRaw : (dataRaw.data || []);
      // On convertit le format LabOrder en format compatible UI (Visit)
      const mappedOrders = data.map(order => ({
        ...order,
        id: order.visit_id, // Identifiant de visite pour compatibilité
        lab_order_id: order.id,
        lab_tests: order.items ? order.items.map(item => ({
          id: item.id,
          label: item.test_name,
          category: item.category,
          status: item.status
        })) : []
      }));
      setVisits(mappedOrders);
      
      // Update cache
      const currentCache = await Storage.get('labo_data') || {};
      Storage.save('labo_data', { ...currentCache, visits: mappedOrders });
    } catch (e) { if (!isBg) showToast(t.error, 'error'); }
    finally { if (!isBg) setLoading(false); }
  };

  const fetchHistory = async (isBg = false) => {
    if (!isBg && (activeView === 'sent' || activeView === 'history')) setLoading(true);
    try {
      const resp = await api.get('/labo/history');
      const dataRaw = resp.data;
      const data = Array.isArray(dataRaw) ? dataRaw : (dataRaw.data || []);
      setHistory(data);
      
      // Update cache
      const currentCache = await Storage.get('labo_data') || {};
      Storage.save('labo_data', { ...currentCache, history: data });

      // Auto-expand today if it exists
      const todayStr = new Date().toISOString().split('T')[0];
      if (!isBg && data.some(v => v.updated_at && v.updated_at.startsWith(todayStr))) {
        setExpandedDates(prev => ({ ...prev, [todayStr]: true }));
      }
    } catch (e) { if (!isBg) showToast(t.error, 'error'); }
    finally { if (!isBg) setLoading(false); }
  };

  const fetchStats = () => {
    // No API call needed anymore, we compute stats directly from the already fetched state
    setStats({
      completed: sentTodayList.length,
      urgent: sentTodayList.filter(v => v.complaints_notes?.toLowerCase().includes('urgent')).length,
      total_pending: visits.length,
      total_archived: history.length
    });
  };

  const handleSubmit = async () => {
    // Merge structured results into a readable text format for legacy compatibility or final display
    const finalResults = Object.entries(structuredResults)
      .map(([label, value]) => `${label}: ${value}`)
      .join('\n') || results;

    if (!finalResults) return showToast(t.error, 'error');
    setIsSubmitting(true);

    // Préparer les résultats individuels pour la base de données structurée
    const itemResults = (selectedVisit?.lab_tests || []).map(test => ({
      id: test.id,
      value: structuredResults[test.label] || '—'
    }));

    try {
      await api.post(`/labo/results/${selectedVisit.id}`, {
        results: finalResults,
        item_results: itemResults
      });
      showToast(t.success, 'success');
      setSelectedVisit(null); setResults(''); setStructuredResults({}); fetchVisits();
    } catch (e) { showToast(parseError(e), 'error'); }
    finally { setIsSubmitting(false); }
  };

  const prefillTemplate = () => {
    const template = {};
    (selectedVisit?.lab_tests || []).forEach(test => {
      template[test.label] = 'Négatif';
    });
    setStructuredResults(template);
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

  const toggleLeft = (open) => {
    setIsLeftOpen(open);
    Animated.spring(leftAnim, { toValue: open ? 0 : -width, friction: 8, tension: 40, useNativeDriver: true }).start();
  };

  const laboMenu = [
    { id: 'pending', icon: 'flask-outline', label: 'En Attente', sub: 'Analyses à traiter' },
    { id: 'sent', icon: 'check-circle-outline', label: 'Résultats Envoyés', sub: 'Résultats transmis aujourd\'hui' },
    { id: 'stats', icon: 'chart-bar', label: 'Statistiques', sub: 'Performance du labo' },
    { id: 'history', icon: 'history', label: 'Historique', sub: 'Toutes les analyses' },
  ];

  const currentList = activeTab === 'pending' ? visits : history;

  const todayStr = new Date().toISOString().split('T')[0];
  const sentTodayList = history.filter(v => v.updated_at && v.updated_at.startsWith(todayStr));

  const groupedHistory = history.reduce((acc, visit) => {
    if (!visit.updated_at) return acc;
    const dateStr = visit.updated_at.split('T')[0].split(' ')[0];
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(visit);
    return acc;
  }, {});

  const toggleDateExpansion = (dateStr) => {
    setExpandedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

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
        <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 1 }}>{"ACTUALISER"</Text>
      </TouchableOpacity>
    </FadeInView>
  );

  return (
    <View style={[styles.mainContainer, { backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDark ? "" : "dark-content"} />

      <PremiumHeader
        onLeftPress={() => toggleLeft(true)}
        onRightPress={() => toggleRight(true)}
        title="REHOBOTH"
        subtitle={laboMenu.find(m => m.id === activeView)?.label || 'LABORATOIRE'}
        icon=""
        isDark={isDark}
        navigation={navigation}
      />

      <FloatingActionDock
        title={selectedVisit ? 'Résultats en saisie' : 'Actions laboratoire'}
        actions={[
          selectedVisit && { key: 'back-list', icon: 'arrow-back', onPress: () => setSelectedVisit(null), active: true },
          { key: 'refresh', icon: 'refresh', onPress: () => { fetchVisits(); fetchHistory(); } },
          activeView !== 'pending' && !selectedVisit && { key: 'pending', icon: 'science', onPress: () => { setActiveView('pending'); setActiveTab('pending'); if (activeBottomTab) toggleBottomTab('stats'); } },
        ]}
      />

      {/* VUE: PROFIL — rendu hors du ScrollView principal */}
      {activeView === 'profile' && (
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 100,
            paddingBottom: insets.bottom + 40,
            paddingHorizontal: 20,
          }}
          showsVerticalScrollIndicator={false}
        >
          <ProfileView onBack={() => setActiveView('pending')} />
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
          {/* VUE: EN ATTENTE */}
          {activeView === 'pending' && !selectedVisit && (
            <FadeInView>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1 }}>{"ANALYSES EN ATTENTE"</Text>
                <TouchableOpacity onPress={fetchVisits}><MaterialIcons name="help-circle" size={24} color={brandColor} /></TouchableOpacity>
              </View>
              {loading ? (
                <View>{[1, 2, 3].map(i => <SkeletonItem key={i} height={120} style={{ marginBottom: 16, borderRadius: 28 }} />)}</View>
              ) : visits.length > 0 ? (
                <>
                  <LinearGradient colors={[brandColor, '#805AD5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 28, padding: 20, marginBottom: 20, elevation: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{"FILE D'ATTENTE"</Text>
                        <Text style={{ color: '#FFF', fontSize: 36, fontWeight: '900' }}>{visits.length}</Text>
                      </View>
                      <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                        <MaterialCommunityIcons name="help-circle" size={30} color="#FFF" />
                      </View>
                    </View>
                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 14 }} />
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700' }}>{"Appuyez sur un dossier pour saisir les résultats"</Text>
                  </LinearGradient>
                  {visits.map((v, idx) => {
                    const isUrgent = v.complaints_notes?.toLowerCase().includes('urgent');
                    const examCount = (v.lab_tests || []).length;
                    const timeStr = v.created_at ? new Date(v.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
                    return (
                      <FadeInView key={v.id} delay={idx * 60}>
                        <PressableScale
                          style={{ padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 28, marginBottom: 14, borderWidth: isUrgent ? 2 : 1, borderColor: isUrgent ? '#EF4444' : (isDark ? '#2E2E2E' : '#F1F5F9'), elevation: 4 }}
                          onPress={() => setSelectedVisit(v)}
                        >
                          {isUrgent && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF444415', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 12 }}>
                              <MaterialCommunityIcons name="help-circle" size={12} color="#EF4444" />
                              <Text style={{ color: '#EF4444', fontSize: 9, fontWeight: '900', marginLeft: 5 }}>{"URGENT"</Text>
                            </View>
                          )}
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <LinearGradient colors={isUrgent ? ['#EF444420', '#EF444405'] : ['#805AD520', '#805AD505']} style={{ width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                              <MaterialCommunityIcons name="help-circle" size={28} color={isUrgent ? '#EF4444' : '#805AD5'} />
                            </LinearGradient>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 17, fontWeight: '900', color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{v.patient?.first_name} {v.patient?.last_name}</Text>
                              {v.doctor && <Text style={{ color: isDark ? '#888888' : '#94A3B8', fontSize: 10, fontWeight: '700', marginTop: 2 }}>Dr. {v.doctor.name}</Text>}
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <View style={{ backgroundColor: brandColor + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 6 }}>
                                <Text style={{ color: brandColor, fontWeight: '900', fontSize: 11 }}>{examCount} test{examCount > 1 ? 's' : ''}</Text>
                              </View>
                              {timeStr ? <Text style={{ color: isDark ? '#555555' : '#94A3B8', fontSize: 10, fontWeight: '700' }}>{timeStr}</Text> : null}
                            </View>
                          </View>
                          {(v.lab_tests || []).length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                              {v.lab_tests.slice(0, 4).map((test, ti) => (
                                <View key={ti} style={{ backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                                  <Text style={{ color: isDark ? '#AAAAAA' : '#64748B', fontSize: 10, fontWeight: '700' }}>{test.label}</Text>
                                </View>
                              ))}
                              {v.lab_tests.length > 4 && (
                                <View style={{ backgroundColor: brandColor + '10', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                                  <Text style={{ color: brandColor, fontSize: 10, fontWeight: '900' }}>+{v.lab_tests.length - 4}</Text>
                                </View>
                              )}
                            </View>
                          )}
                        </PressableScale>
                      </FadeInView>
                    );
                  })}
                </>
              ) : (
                renderEmptyState(
                  "flask-empty-outline",
                  "Aucune analyse",
                  "Il n'y a actuellement aucune analyse en attente de traitement."
                )
              )}
            </FadeInView>
          )}

          {/* VUE: RÉSULTATS ENVOYÉS */}
          {activeView === 'sent' && (
            <FadeInView>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1 }}>{"RÉSULTATS ENVOYÉS AUJOURD'HUI"</Text>
                <TouchableOpacity onPress={fetchHistory}><MaterialIcons name="help-circle" size={24} color={brandColor} /></TouchableOpacity>
              </View>
              {loading ? (
                <View>{[1, 2, 3].map(i => <SkeletonItem key={i} height={90} style={{ marginBottom: 12, borderRadius: 24 }} />)}</View>
              ) : sentTodayList.length > 0 ? sentTodayList.map((v, idx) => (
                <FadeInView key={v.id} delay={idx * 50}>
                  <View style={{ padding: 18, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 24, marginBottom: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9', borderLeftWidth: 4, borderLeftColor: '#22C55E' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#22C55E15', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                        <MaterialCommunityIcons name="check-circle" size={26} color="#22C55E" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{v.patient?.first_name} {v.patient?.last_name}</Text>
                        <Text style={{ color: '#22C55E', fontSize: 10, fontWeight: '900', marginTop: 2 }}>{"RÉSULTATS TRANSMIS AU MÉDECIN"</Text>
                      </View>
                    </View>
                    {v.lab_results && <Text style={{ color: isDark ? '#AAAAAA' : '#64748B', fontSize: 12, marginTop: 10, lineHeight: 18 }} numberOfLines={2}>{v.lab_results}</Text>}
                  </View>
                </FadeInView>
              )) : (
                renderEmptyState(
                  "",
                  "Aucun résultat envoyé",
                  "Vous n'avez transmis aucun résultat d'analyse aujourd'hui."
                )
              )}
            </FadeInView>
          )}

          {/* VUE: STATISTIQUES (DASHBOARD PLEIN ÉCRAN) */}
          {activeView === 'stats' && (
            <FadeInView>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1 }}>{"TABLEAU DE BORD"</Text>
                <TouchableOpacity onPress={() => { fetchHistory(); fetchVisits(); }}><MaterialIcons name="help-circle" size={24} color={brandColor} /></TouchableOpacity>
              </View>

              <LinearGradient colors={[brandColor, '#805AD5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 32, padding: 28, marginBottom: 16, elevation: 8, shadowColor: brandColor, shadowOpacity: 0.4, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>{"ANALYSES TRAITÉES (AUJOURD'HUI)"</Text>
                    <Text style={{ color: '#FFF', fontSize: 48, fontWeight: '900', marginTop: 4 }}>{sentTodayList.length}</Text>
                  </View>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="help-circle" size={28} color="#FFF" />
                  </View>
                </View>
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 16 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' }}>{"Taux de traitement quotidien"</Text>
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>Excellent</Text>
                </View>
              </LinearGradient>

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                <View style={{ flex: 1, padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 28, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#805AD515', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <MaterialCommunityIcons name="flask-empty-outline" size={22} color="#805AD5" />
                  </View>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>{visits.length}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#805AD5', marginTop: 2, letterSpacing: 0.5 }}>{"FILE D'ATTENTE"</Text>
                </View>

                <View style={{ flex: 1, padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 28, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#F59E0B15', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <MaterialCommunityIcons name="help-circle" size={22} color="#F59E0B" />
                  </View>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>{sentTodayList.filter(v => v.complaints_notes?.toLowerCase().includes('urgent')).length}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#F59E0B', marginTop: 2, letterSpacing: 0.5 }}>{"URGENCES TRAITÉES"</Text>
                </View>
              </View>

              {/* Bloc Archive Global */}
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 24, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9' }}>
                <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: '#22C55E15', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                  <MaterialCommunityIcons name="help-circle" size={28} color="#22C55E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#22C55E', letterSpacing: 1, marginBottom: 4 }}>{"ARCHIVES GLOBALES"</Text>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{history.length} <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#AAAAAA' : '#64748B' }}>Dossiers</Text></Text>
                </View>
              </View>
            </FadeInView>
          )}

          {/* VUE: HISTORIQUE (GROUPÉ PAR DATE) */}
          {activeView === 'history' && (
            <FadeInView>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1 }}>{"ARCHIVES DES ANALYSES"</Text>
                <TouchableOpacity onPress={fetchHistory}><MaterialIcons name="help-circle" size={24} color={brandColor} /></TouchableOpacity>
              </View>
              {loading ? (
                <View>{[1, 2, 3, 4].map(i => <SkeletonItem key={i} height={85} style={{ marginBottom: 10, borderRadius: 20 }} />)}</View>
              ) : Object.keys(groupedHistory).length > 0 ? (
                Object.keys(groupedHistory).sort((a, b) => new Date(b) - new Date(a)).map((dateStr, idx) => {
                  const dayVisits = groupedHistory[dateStr];
                  const isExpanded = !!expandedDates[dateStr];
                  const isToday = dateStr === todayStr;
                  const displayDate = isToday ? "Aujourd'hui" : new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

                  return (
                    <View key={dateStr} style={{ marginBottom: 16 }}>
                      {/* En-tête du dossier (Date) */}
                      <TouchableOpacity
                        onPress={() => toggleDateExpansion(dateStr)}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: isExpanded ? brandColor : (isDark ? '#1A1A1A' : '#FFF'), borderRadius: 20, borderWidth: 1, borderColor: isExpanded ? brandColor : (isDark ? '#2E2E2E' : '#F1F5F9'), elevation: isExpanded ? 6 : 2, shadowColor: brandColor, shadowOpacity: isExpanded ? 0.3 : 0.05, shadowRadius: isExpanded ? 10 : 4, shadowOffset: { width: 0, height: isExpanded ? 4 : 2 } }}
                      >
                        <MaterialCommunityIcons name={isExpanded ? "folder-open" : "folder"} size={26} color={isExpanded ? '#FFF' : brandColor} style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '900', fontSize: 15, color: isExpanded ? '#FFF' : (isDark ? '#F1F5F9' : '#1A1A1A'), textTransform: 'capitalize' }}>{displayDate}</Text>
                          <Text style={{ color: isExpanded ? 'rgba(255,255,255,0.8)' : (isDark ? '#AAAAAA' : '#64748B'), fontSize: 11, fontWeight: '700', marginTop: 2 }}>{dayVisits.length} dossier(s) traité(s)</Text>
                        </View>
                        <MaterialCommunityIcons name={isExpanded ? "chevron-up" : "chevron-down"} size={24} color={isExpanded ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B')} />
                      </TouchableOpacity>

                      {/* Contenu du dossier (Historique du jour) */}
                      {isExpanded && (
                        <View style={{ marginTop: 12, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: isDark ? '#2E2E2E' : '#E2E8F0', marginLeft: 22 }}>
                          {dayVisits.map((v, vIdx) => (
                            <FadeInView key={v.id} delay={vIdx * 30} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9' }}>
                              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#22C55E15', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                                <MaterialCommunityIcons name="flask-check" size={22} color="#22C55E" />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: '800', fontSize: 15, color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{v.patient?.first_name} {v.patient?.last_name}</Text>
                                <Text style={{ color: isDark ? '#888888' : '#94A3B8', fontSize: 10, fontWeight: '700', marginTop: 2 }}>TERMINÉ • {(v.lab_tests || []).length} examen(s)</Text>
                              </View>
                              <View style={{ backgroundColor: '#22C55E15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                                <Text style={{ color: '#22C55E', fontSize: 9, fontWeight: '900' }}>{"DONE"</Text>
                              </View>
                            </FadeInView>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })
              ) : (
                renderEmptyState(
                  "",
                  "Aucun historique",
                  "Les archives du laboratoire sont actuellement vides."
                )
              )}
            </FadeInView>
          )}

          {/* FORMULAIRE DE RÉSULTAT */}
          {selectedVisit && (
            <FadeInView style={{ paddingTop: 10 }}>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }} onPress={() => setSelectedVisit(null)}>
                <MaterialIcons name="arrow-back" size={20} color={brandColor} />
                <Text style={{ color: brandColor, fontWeight: '900', marginLeft: 8, fontSize: 13 }}>{"RETOUR AUX DOSSIERS"</Text>
              </TouchableOpacity>

              {/* Patient document card */}
              <View style={{ borderRadius: 32, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', overflow: 'hidden', marginBottom: 28, elevation: 6 }}>
                <LinearGradient colors={[brandColor, '#805AD5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 24 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', letterSpacing: 2 }}>BON DE LABORATOIRE N° {selectedVisit.lab_order_id || selectedVisit.id}</Text>
                      <Text style={{ fontSize: 26, fontWeight: '900', color: '#FFF', marginTop: 8 }}>{selectedVisit.patient?.first_name} {selectedVisit.patient?.last_name}</Text>
                    </View>
                    <View style={{ width: 50, height: 50, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name="help-circle" size={26} color="#FFF" />
                    </View>
                  </View>
                  <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 18 }} />
                  <View style={{ flexDirection: 'row', gap: 24 }}>
                    <View>
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '900' }}>{"ÂGE / SEXE"</Text>
                      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{selectedVisit.patient?.age || '—'} Ans • {selectedVisit.patient?.gender === 'M' ? 'Masculin' : 'Féminin'}</Text>
                    </View>
                    <View>
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '900' }}>PRISE EN CHARGE</Text>
                      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{selectedVisit.patient?.is_insured ? 'Assurance' : 'Cash'}</Text>
                    </View>
                  </View>
                </LinearGradient>

                <View style={{ padding: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#888' : '#64748B', letterSpacing: 1 }}>{"SAISIE DES RÉSULTATS"</Text>
                    <TouchableOpacity onPress={prefillTemplate} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: brandColor + '15', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
                      <MaterialCommunityIcons name="help-circle" size={14} color={brandColor} />
                      <Text style={{ color: brandColor, fontSize: 10, fontWeight: '900', marginLeft: 6 }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["RÉPONDRE \"NÉGATIF\""] || "RÉPONDRE \"NÉGATIF\""}</Text>
                    </TouchableOpacity>
                  </View>

                  {(selectedVisit.lab_tests || []).length > 0 ? (
                    <View style={{ gap: 16, marginBottom: 20 }}>
                      {selectedVisit.lab_tests.map((test, idx) => (
                        <View key={`${test.id}-${idx}`} style={{ backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: structuredResults[test.label] ? '#22C55E' : '#F59E0B', marginRight: 10 }} />
                              <Text style={{ fontWeight: '900', color: isDark ? '#F1F5F9' : '#1A1A1A', fontSize: 15 }}>{test.label}</Text>
                            </View>
                            {test.category && <Text style={{ fontSize: 9, color: '#64748B', fontWeight: '900', backgroundColor: isDark ? '#1A1A1A' : '#E2E8F0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>{test.category.toUpperCase()}</Text>}
                          </View>
                          <TextInput
                            style={{ backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: isDark ? '#FFF' : '#0A0A0A', fontWeight: '800', fontSize: 15, borderWidth: 1, borderColor: structuredResults[test.label] ? brandColor + '40' : (isDark ? '#2E2E2E' : '#E2E8F0') }}
                            placeholder={"Entrez le résultat..." placeholderTextColor={isDark ? '#444' : '#94A3B8'}
                            value={structuredResults[test.label] || ''}
                            onChangeText={(val) => setStructuredResults(prev => ({ ...prev, [test.label]: val }))}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={{ borderRadius: 24, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', padding: 18, height: 180, marginBottom: 20 }}>
                      <TextInput
                        style={{ flex: 1, color: isDark ? '#FFF' : '#0A0A0A', fontSize: 16, fontWeight: '700', textAlignVertical: 'top' }}
                        placeholder="Saisissez les résultats détaillés ici..."
                        placeholderTextColor={isDark ? '#444' : '#94A3B8'}
                        multiline
                        value={results}
                        onChangeText={setResults}
                      />
                    </View>
                  )}

                  <View style={{ padding: 16, backgroundColor: selectedVisit.patient?.is_insured ? brandColor + '10' : '#22C55E10', borderRadius: 20, marginBottom: 24, borderWidth: 1, borderColor: selectedVisit.patient?.is_insured ? brandColor + '30' : '#22C55E30', flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name={selectedVisit.patient?.is_insured ? 'shield-check-outline' : 'cash'} size={20} color={selectedVisit.patient?.is_insured ? brandColor : '#22C55E'} />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: selectedVisit.patient?.is_insured ? brandColor : '#22C55E', marginLeft: 12, flex: 1 }}>
                      {selectedVisit.patient?.is_insured
                        ? 'Patient Assuré : Résultats transmis directement au médecin.'
                        : 'Patient Cash : Passage à la caisse requis pour validation.'}
                    </Text>
                  </View>

                  <TouchableOpacity style={{ height: 64, borderRadius: 32, overflow: 'hidden', elevation: 8 }} onPress={handleSubmit} disabled={isSubmitting}>
                    <LinearGradient colors={Theme.colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                      {isSubmitting ? <ActivityIndicator color="#FFF" /> : (
                        <>
                          <MaterialIcons name="send" size={22} color="#FFF" style={{ marginRight: 12 }} />
                          <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 1 }}>{"TRANSMETTRE LES RÉSULTATS"</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
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
            bottom: insets.bottom + 90,   // sits just above the footer bar + safe area
            left: 12,
            right: 12,
            maxHeight: height * 0.62,     // cap at 62% of screen height
            backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF',
            borderRadius: 36,
            borderWidth: 1,
            borderColor: isDark ? '#1A1A1A' : '#F1F5F9',
            elevation: 30,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.2,
            shadowRadius: 20,
            overflow: 'hidden',
          },
          { transform: [{ translateY: bottomPanelAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }] }
        ]}>
          {/* Handle bar */}
          <View style={{ width: 40, height: 5, backgroundColor: isDark ? '#2E2E2E' : '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginTop: 12 }} />

          {/* Header */}
          <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: isDark ? '#1A1A1A' : '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <LinearGradient colors={[brandColor, '#805AD5']} style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <MaterialCommunityIcons name="help-circle" size={24} color="#FFF" />
              </LinearGradient>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#F1F5F9' : '#0A0A0A', letterSpacing: -0.5 }}>{"STATISTIQUES LABO"</Text>
                <Text style={{ fontSize: 11, color: isDark ? '#555555' : '#94A3B8', fontWeight: '700' }}>Résumé en temps réel</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => toggleBottomTab('stats')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? '#1A1A1A' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="close" size={22} color={brandColor} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 + insets.bottom }}
            showsVerticalScrollIndicator={false}
          >
            {/* Row 1: En Attente + Urgences */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <View style={{ flex: 1, padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#F8FAFC', borderRadius: 24, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: brandColor + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <MaterialCommunityIcons name="flask-outline" size={20} color={brandColor} />
                </View>
                <Text style={{ fontSize: 32, fontWeight: '900', color: isDark ? '#F1F5F9' : '#0A0A0A' }}>{stats?.total_pending ?? visits.length}</Text>
                <Text style={{ fontSize: 9, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1, marginTop: 4 }}>{"EN ATTENTE"</Text>
              </View>

              <View style={{ flex: 1, padding: 20, backgroundColor: '#EF444408', borderRadius: 24, borderWidth: 1, borderColor: '#EF444425' }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#EF444415', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <MaterialCommunityIcons name="help-circle" size={20} color="#EF4444" />
                </View>
                <Text style={{ fontSize: 32, fontWeight: '900', color: '#EF4444' }}>{stats?.urgent ?? visits.filter(v => v.complaints_notes?.toLowerCase().includes('urgent')).length}</Text>
                <Text style={{ fontSize: 9, fontWeight: '900', color: '#EF4444', letterSpacing: 1, marginTop: 4 }}>{"URGENCES"</Text>
              </View>
            </View>

            {/* Completed today - hero card */}
            <LinearGradient colors={[brandColor, '#805AD5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 28, padding: 24, marginBottom: 12, elevation: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }}>ANALYSES COMPLÉTÉES</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700' }}>{"Aujourd'hui"</Text>
                  <Text style={{ color: '#FFF', fontSize: 48, fontWeight: '900', marginTop: 4 }}>{stats?.completed ?? sentTodayList.length}</Text>
                </View>
                <MaterialCommunityIcons name="help-circle" size={64} color="rgba(255,255,255,0.2)" />
              </View>
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 14 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700' }}>{"Taux de traitement"</Text>
                <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 12 }}>
                  {visits.length + sentTodayList.length > 0
                    ? Math.round((sentTodayList.length / (visits.length + sentTodayList.length)) * 100)
                    : 100}%
                </Text>
              </View>
              <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                <View style={{
                  width: `${visits.length + sentTodayList.length > 0
                    ? Math.round((sentTodayList.length / (visits.length + sentTodayList.length)) * 100)
                    : 100}%`,
                  height: '100%', backgroundColor: '#FFF', borderRadius: 3
                }} />
              </View>
            </LinearGradient>

            {/* Archive global */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#F8FAFC', borderRadius: 24, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#22C55E15', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <MaterialCommunityIcons name="help-circle" size={26} color="#22C55E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, fontWeight: '900', color: '#22C55E', letterSpacing: 1.5, marginBottom: 4 }}>{"ARCHIVES GLOBALES"</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{history.length} <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#888888' : '#94A3B8' }}>dossiers traités</Text></Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={isDark ? '#2E2E2E' : '#CBD5E1'} />
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {/* BOTTOM TAB BAR */}
      <PremiumFooter
        isDark={isDark}
        activeTab={activeBottomTab === 'stats' ? 'stats' : activeTab}
        tabs={[
          { id: 'pending', icon: 'flask-outline', activeIcon: 'flask', label: bt.pending || 'En Attente' },
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
        roleName={t.roles.labo}
        roleIcon="flask"
        onLogout={handleLogout}
        t={t}
        setActiveView={(v) => { toggleRight(false); setActiveView(v); }}
      />
      <PremiumLeftDrawer
        isOpen={isLeftOpen}
        anim={leftAnim}
        onClose={() => toggleLeft(false)}
        activeView={activeView}
        setActiveView={(v) => { setActiveView(v); if (v === 'history' || v === 'sent') fetchHistory(); if (v === 'pending') fetchVisits(); }}
        menuItems={laboMenu}
        roleName={t.roles.labo}
        isDark={isDark}
        t={t}
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
  }
});
