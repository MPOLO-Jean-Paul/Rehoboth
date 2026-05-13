import React, { useEffect, useState, useRef, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, TextInput, Animated, Switch, Image, Modal, StatusBar, Alert, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
import { Theme } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { isValidPhone, detectOperator, operatorColor } from '../utils/phoneValidator';

const { width, height } = Theme.layout;

export default function ReceptionScreen({ navigation, route }) {
   const { isDark, C, S, brandColor, themeMode, toggleTheme, lang, toggleLang, isOnline } = useTheme();
   const styles = createStyles(C, S, brandColor);
   const insets = useSafeAreaInsets();
   const { showToast } = useContext(ToastContext);
   const t = translations[lang] || translations.fr;
   const bt = t.bottomTabs || {};

   const [patients, setPatients] = useState([]);
   const [insurances, setInsurances] = useState([]);
   const [loading, setLoading] = useState(true);
   const [activeTab, setActiveTab] = useState('list'); // list, new
   const [activeView, setActiveView] = useState('dashboard'); // dashboard, patients_all, insurances_all, bilan_day
   const [activeBottomTab, setActiveBottomTab] = useState(null); // null | 'stats'
   const [search, setSearch] = useState('');
   const [sortField, setSortField] = useState('Nom'); // name, birth_year, disease
   const [filterType, setFilterType] = useState('all'); // all, insured, private

   const [isSubmitting, setIsSubmitting] = useState(false);
   const [stats, setStats] = useState(null);
   const [bottomLoading, setBottomLoading] = useState(false);
   const [serviceRevenues, setServiceRevenues] = useState([]);
   const [bilanPeriod, setBilanPeriod] = useState('day');
   const [realPatientCount, setRealPatientCount] = useState(0);
   const [insuredCount, setInsuredCount] = useState(0);
   const [privateCount, setPrivateCount] = useState(0);
   const [selectedDateFolder, setSelectedDateFolder] = useState(null);
   const [selectedYearFolder, setSelectedYearFolder] = useState(null);
   const [form, setForm] = useState({
      id: null,
      first_name: '',
      last_name: '',
      post_name: '', 
      is_insured: false,
      insurance_id: null,
      insurance_code: '',
      contact_info: '',
      complaints: '',
      birth_year: '',
      pathology: '',
      gender: 'M',
   });
   const [isVerifying, setIsVerifying] = useState(false);
   const [verifiedMember, setVerifiedMember] = useState(null);

   const [isSearchDossierOpen, setIsSearchDossierOpen] = useState(false);
   const [searchDossierQuery, setSearchDossierQuery] = useState('');

   const [newCatalogItem, setNewCatalogItem] = useState({ type: 'Examen', label: '', price: '', service: '' });

   // Panel States
   const [isRightOpen, setIsRightOpen] = useState(false);
   const [isLeftOpen, setIsLeftOpen] = useState(false);
   const leftAnim = useRef(new Animated.Value(-width)).current;
   const rightAnim = useRef(new Animated.Value(width)).current;
   const bottomPanelAnim = useRef(new Animated.Value(0)).current;

   useEffect(() => {
      const loadAll = async () => {
         setLoading(true);
         try {
            await Promise.all([
               fetchPatients(true),
               fetchInsurances(true),
               fetchServiceRevenues(true, bilanPeriod)
            ]);
         } finally {
            setLoading(false);
         }
      };

      loadAll();

      const startInterval = () => {
         return setInterval(() => {
            Promise.all([
               fetchPatients(true),
               fetchInsurances(true),
               fetchServiceRevenues(true, bilanPeriod)
            ]);
         }, 10000);
      };

      let interval = startInterval();

      const subscription = AppState.addEventListener('change', nextAppState => {
         if (nextAppState === 'active') {
            Promise.all([
               fetchPatients(true),
               fetchInsurances(true),
               fetchServiceRevenues(true, bilanPeriod)
            ]);
            interval = startInterval();
         } else {
            clearInterval(interval);
         }
      });

      return () => {
         clearInterval(interval);
         subscription.remove();
      };
   }, [bilanPeriod]);

   useEffect(() => {
      const requestedTab = route.params?.tab;
      if (!requestedTab && !route.params?.patientId) return;

      if (requestedTab === 'new') {
         setActiveView('dashboard');
         setActiveTab('new');
      } else if (['patients', 'list'].includes(requestedTab)) {
         setActiveView('dashboard');
         setActiveTab('list');
      } else if (['archive', 'patients_all'].includes(requestedTab)) {
         setActiveView('patients_all');
      } else if (['insurances', 'insurances_all'].includes(requestedTab)) {
         setActiveView('insurances_all');
      } else if (requestedTab === 'bilan_day') {
         setActiveView('bilan_day');
      } else if (requestedTab === 'catalog') {
         setActiveView('catalog');
      }

      if (route.params?.patientId) {
         const patient = patients.find(p => String(p.id) === String(route.params.patientId));
         if (patient) {
            setSearch(`${patient.first_name || ''} ${patient.last_name || ''}`.trim());
            setActiveView('dashboard');
            setActiveTab('list');
         }
      }

      navigation.setParams({ patientId: null, tab: null });
   }, [route.params?.patientId, route.params?.tab, patients]);

   const toggleLeft = (open) => {
      setIsLeftOpen(open);
      Animated.spring(leftAnim, { toValue: open ? 0 : -width, friction: 8, tension: 40, useNativeDriver: true }).start();
   };

   const filteredPatients = (patients || [])
      .filter(p => {
         if (!p) return false;
         // Si la recherche est vide, on garde tout le lot (déjà filtré par le serveur si search existe)
         if (!search) return true;
         // Fallback local pour les petits lots
         const matchSearch = `${p.first_name} ${p.last_name} ${p.pathology || ''}`.toLowerCase().includes(search.toLowerCase());
         const matchType = filterType === 'all' || (filterType === 'insured' ? p.is_insured : !p.is_insured);
         return matchSearch && matchType;
      })
      .sort((a, b) => {
         if (sortField === 'Nom') return (a.last_name || '').localeCompare(b.last_name || '');
         if (sortField === 'Année') return (a.birth_year || 0) - (b.birth_year || 0);
         if (sortField === 'Maladie') return (a.pathology || '').localeCompare(b.pathology || '');
         return 0;
      });

   const groupedByDate = (patients || []).reduce((acc, p) => {
      if (!p?.created_at) return acc;
      const date = new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      if (!acc[date]) acc[date] = [];
      acc[date].push(p);
      return acc;
   }, {});

   const groupedByYear = (patients || []).reduce((acc, p) => {
      const year = p?.birth_year || 'Inconnu';
      if (!acc[year]) acc[year] = [];
      acc[year].push(p);
      return acc;
   }, {});

   const archiveYears = Object.keys(groupedByYear).filter(y => (groupedByYear[y] || []).length >= 2).sort((a, b) => b - a);

   const menuItems = [
      { id: 'dashboard', icon: 'view-dashboard', label: 'Accueil', sub: 'File d\'attente' },
      { id: 'patients_all', icon: 'folder', label: 'Archive', sub: 'Par année de naissance' },
      { id: 'insurances_all', icon: 'shield-check', label: 'Assurances', sub: 'Analyse & Rentabilité' },
      { id: 'bilan_day', icon: 'chart-box', label: 'Bilan du Jour', sub: 'Recettes par service' },
      { id: 'catalog', icon: 'book-plus', label: 'Catalogue', sub: 'Ajouter Examens & Services' },
   ];

   const fetchInsurances = async (isBg = false) => {
      try {
         const resp = await api.get('/insurances');
         setInsurances(Array.isArray(resp.data) ? resp.data : []);
      } catch (e) {}
   };

   const parseError = (e) => {
      if (e.response?.data?.errors) {
         const errors = e.response.data.errors;
         const firstKey = Object.keys(errors)[0];
         return errors[firstKey][0];
      }
      return e.response?.data?.message || t.error;
   };

   const fetchPatients = async (isBg = false) => {
      if (!isBg) setLoading(true);
      try {
         // Best practice: Server-side search for performance
         const url = search.length > 2 ? `/patients?q=${encodeURIComponent(search)}` : '/patients';
         const resp = await api.get(url);
         const data = resp.data;
         // Support both raw array and Laravel paginated object
         setPatients(Array.isArray(data) ? data : (data.data || []));
      } catch (e) { if (!isBg) showToast(parseError(e), 'error'); }
      finally { if (!isBg) setLoading(false); }
   };

   const fetchServiceRevenues = async (isBg = false, period = bilanPeriod) => {
      try {
         const resp = await api.get(`/reception/cash-today?period=${period}`);
         const data = resp.data || {};
         setServiceRevenues(data.items || []);
         setRealPatientCount(data.patient_count || 0);
         setInsuredCount(data.insured_count || 0);
         setPrivateCount(data.private_count || 0);
      } catch (e) {}
   };

   const fetchStats = async () => {
      setBottomLoading(true);
      try {
         const resp = await api.get('/reception/stats-today');
         setStats(resp.data || { today_count: 0, yesterday_count: 0, insured_count: 0, private_count: 0, diff_percent: 0 });
      } catch (e) {
         setStats({ today_count: 12, yesterday_count: 8, insured_count: 4, private_count: 8, diff_percent: 50 });
      } finally { setBottomLoading(false); }
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

   const handleAddCatalogItem = async () => {
      if (!newCatalogItem.label || !newCatalogItem.price) return showToast("Veuillez remplir tous les champs", 'error');
      if (newCatalogItem.type === 'Autre' && !newCatalogItem.service) return showToast("Veuillez renseigner le service concerné", 'error');
      
      setIsSubmitting(true);
      try {
         const payload = {
            ...newCatalogItem,
            type: newCatalogItem.type === 'Autre' ? newCatalogItem.service : 'Examen'
         };
         await api.post('/reception/catalog/add', payload);
         showToast("Ajouté avec succès au catalogue. L'administrateur pourra le modifier.", 'success');
         setNewCatalogItem({ type: 'Examen', label: '', price: '', service: '' });
      } catch (e) {
         showToast(parseError(e), 'error');
      } finally {
         setIsSubmitting(false);
      }
   };

   const checkInsurance = async () => {
      if (!form.insurance_id || !form.insurance_code) {
         return showToast("Sélectionnez une assurance et entrez un code", 'error');
      }

      setIsVerifying(true);
      setVerifiedMember(null);
      try {
         const res = await api.get(`/insurances/verify?insurance_id=${form.insurance_id}&code=${form.insurance_code}`);
         if (res.data.success) {
            setVerifiedMember(res.data.member_name);
            showToast(`Vérifié : ${res.data.member_name}`, 'success');
            if (!form.last_name) {
               const parts = res.data.member_name.split(' ');
               setForm({
                  ...form,
                  last_name: parts[0] || '',
                  first_name: parts.slice(1).join(' ') || ''
               });
            }
         }
      } catch (e) {
         showToast(parseError(e), 'error');
      } finally {
         setIsSubmitting(false);
      }
   };

   const handleCreate = async () => {
      if (!form.first_name || !form.last_name) return showToast(t.error, 'error');
      if (form.contact_info && !isValidPhone(form.contact_info)) {
         return showToast("Numéro de téléphone invalide (Orange, Airtel, Vodacom, Africell requis)", 'error');
      }
      setIsSubmitting(true);
      try {
         const resp = await api.post('/patients', form);
         const createdPatient = resp.data.patient;
         showToast(t.success, 'success');

         Alert.alert(
            t.success,
            "Voulez-vous imprimer la fiche d'accueil ?",
            [
               { text: t.cancel, style: 'cancel' },
               { text: "IMPRIMER", onPress: () => printPatientSheet(createdPatient) }
            ]
         );

         setForm({ id: null, first_name: '', last_name: '', post_name: '', is_insured: false, insurance_id: null, insurance_code: '', contact_info: '', complaints: '', birth_year: '', pathology: '', gender: 'M' });
         setActiveTab('list');
         fetchPatients();
      } catch (e) {
         showToast(parseError(e), 'error');
      }
      finally { setIsSubmitting(false); }
   };

   const printPatientSheet = async (patient) => {
      const escapeHtml = (value = '') =>
         String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

      const htmlContent = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
            .header { border-bottom: 4px solid ${brandColor}; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .logo-text { font-size: 28px; font-weight: 900; color: ${brandColor}; letter-spacing: 2px; }
            .title { font-size: 22px; font-weight: bold; text-align: center; background: #f0f0f0; padding: 10px; border-radius: 8px; margin-bottom: 40px; }
            .section { margin-bottom: 25px; }
            .label { font-size: 12px; color: #666; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
            .value { font-size: 18px; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .footer { margin-top: 60px; border-top: 1px dashed #ccc; padding-top: 20px; font-size: 10px; color: #999; text-align: center; }
            .badge { display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-top: 10px; }
            .insured { background: #e6f4ea; color: #1e8e3e; }
            .private { background: #fef7e0; color: #f9ab00; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-text">REHOBOTH</div>
            <div style="text-align: right;">
              <div style="font-size: 14px; font-weight: bold;">FICHE D'ACCUEIL</div>
              <div style="font-size: 12px; color: #666;">Date: ${new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}</div>
            </div>
          </div>
          <div class="title">FICHE D'ENREGISTREMENT PATIENT</div>
          <div class="section">
             <div class="label">Numéro de Dossier</div>
             <div class="value">REF-${Math.floor(Math.random() * 90000) + 10000}</div>
          </div>
          <div class="section" style="display: flex; gap: 40px;">
             <div style="flex: 1;">
                <div class="label">Prénom</div>
                 <div class="value">${escapeHtml(patient.first_name)}</div>
              </div>
              <div style="flex: 1;">
                 <div class="label">Nom</div>
                 <div class="value">${escapeHtml(patient.last_name)}</div>
              </div>
           </div>
          <div class="section">
             <div class="label">Type de Prise en Charge</div>
             <div class="badge ${patient.is_insured ? 'insured' : 'private'}">
                 ${patient.is_insured ? "ASSURÉ (" + escapeHtml(patient.insurance_company || "NON SPÉCIFIÉ") + ")" : "PATIENT PRIVÉ"}
              </div>
           </div>
          <div class="section">
             <div class="label">Motifs de Consultation / Symptômes</div>
              <div class="value" style="min-height: 80px;">${escapeHtml(patient.complaints || "Aucun motif spécifié")}</div>
           </div>
           <div class="section">
              <div class="label">Contact Téléphonique</div>
              <div class="value">${escapeHtml(patient.contact_info || "N/A")}</div>
           </div>
          <div class="footer">
             Document généré numériquement par REHOBOTH ERP System v3.0<br/>
             REHOBOTH - Excellence & Soins Professionnels
          </div>
        </body>
      </html>
    `;

      try {
         const { uri } = await Print.printToFileAsync({ html: htmlContent });
         await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } catch (e) {
         showToast(t.error, 'error');
      }
   };

   const handleLogout = async () => {
      await clearAuthSession();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
   };

   const toggleRight = (open) => {
      setIsRightOpen(open);
      Animated.spring(rightAnim, { toValue: open ? 0 : width, friction: 8, tension: 40, useNativeDriver: true }).start();
   };

   return (
      <View style={[styles.mainContainer, { backgroundColor: C.bg }]}>
         <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

         <PremiumHeader
            onLeftPress={() => toggleLeft(true)}
            onRightPress={() => toggleRight(true)}
            title={(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["REHOBOTH"] || "REHOBOTH"}
            subtitle={menuItems.find(m => m.id === activeView)?.label || 'RECEPTION'}
            icon="hospital-building"
            isDark={isDark}
            navigation={navigation}
         />

         <FloatingActionDock
            title={activeView === 'dashboard' && activeTab === 'new' ? 'Nouveau patient' : selectedDateFolder ? selectedDateFolder : 'Actions réception'}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={t.search}
            actions={[
               selectedDateFolder && { key: 'back-folder', icon: 'arrow-back', onPress: () => setSelectedDateFolder(null), active: true },
               activeTab === 'new' && { key: 'back-list', icon: 'list', onPress: () => setActiveTab('list') },
               { key: 'add-patient', icon: 'person-add', onPress: () => { setActiveView('dashboard'); setActiveTab('new'); if (activeBottomTab) toggleBottomTab('stats'); }, active: activeTab === 'new' },
               { key: 'refresh', icon: 'refresh', onPress: fetchPatients },
            ]}
         />

         <ScrollView
            contentContainerStyle={{ paddingTop: 125 + insets.top, paddingBottom: 130 + insets.bottom }}
            showsVerticalScrollIndicator={false}
         >
            <View style={{ paddingHorizontal: 20, paddingTop: insets.top > 40 ? 10 : 0 }}>
               {activeView === 'profile' ? (
                  <FadeInView>
                     <ProfileView onBack={() => setActiveView('dashboard')} />
                  </FadeInView>
               ) : (
                  <>
                     {activeView === 'dashboard' && activeTab === 'list' && (
                        <>
                           <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                              <View style={{ flex: 1, height: 54, backgroundColor: C.surface, borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: C.border, elevation: 2 }}>
                                 <MaterialIcons name="search" size={20} color={brandColor} />
                                 <TextInput
                                    placeholder={t.search}
                                    placeholderTextColor={C.placeholder}
                                    style={{ flex: 1, marginLeft: 10, color: C.text, fontWeight: '600' }}
                                    value={search}
                                    onChangeText={setSearch}
                                 />
                              </View>
                              <TouchableOpacity onPress={fetchPatients} style={{ width: 54, height: 54, borderRadius: 20, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginLeft: 12, borderWidth: 1, borderColor: C.border, elevation: 2 }}>
                                 <MaterialIcons name="refresh" size={24} color={brandColor} />
                              </TouchableOpacity>
                           </View>

                           <Text style={{ fontSize: 13, fontWeight: '900', color: C.sub, marginBottom: 16, letterSpacing: 1 }}>
                              {selectedDateFolder ? `DOSSIER DU ${selectedDateFolder.toUpperCase()}` : "FILE D'ATTENTE PAR JOUR"}
                           </Text>

                           {loading ? (
                              <View>{[1, 2, 3, 4].map(idx => <SkeletonItem key={idx} height={90} style={{ marginBottom: 14, borderRadius: 24 }} />)}</View>
                           ) : selectedDateFolder ? (
                              <FadeInView>
                                 <TouchableOpacity
                                    onPress={() => setSelectedDateFolder(null)}
                                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, padding: 10, backgroundColor: brandColor + '10', borderRadius: 12, alignSelf: 'flex-start' }}
                                 >
                                    <MaterialIcons name="arrow-back" size={18} color={brandColor} />
                                    <Text style={{ color: brandColor, fontWeight: '900', fontSize: 12, marginLeft: 8 }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["RETOUR AUX DOSSIERS"] || "RETOUR AUX DOSSIERS"}</Text>
                                 </TouchableOpacity>

                                 {groupedByDate[selectedDateFolder]?.filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase())).map((p, i) => (
                                    <FadeInView key={p.id} delay={i * 50}>
                                       <PressableScale style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: C.surface, borderRadius: 24, marginBottom: 12, borderWidth: 1, borderColor: C.divider, elevation: 3 }}>
                                          <LinearGradient colors={[brandColor + '20', brandColor + '05']} style={{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                                             <Text style={{ fontWeight: '900', fontSize: 20, color: brandColor }}>{p.first_name[0]}{p.last_name[0]}</Text>
                                          </LinearGradient>
                                          <View style={{ flex: 1, marginLeft: 16 }}>
                                             <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{p.first_name} {p.last_name}</Text>
                                             <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                <MaterialIcons name="access-time" size={12} color={brandColor} />
                                                <Text style={{ color: C.sub, fontSize: 11, marginLeft: 4 }}>{new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                             </View>
                                          </View>
                                          <TouchableOpacity onPress={() => printPatientSheet(p)} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: brandColor + '10', alignItems: 'center', justifyContent: 'center' }}>
                                             <MaterialCommunityIcons name="printer" size={22} color={brandColor} />
                                          </TouchableOpacity>
                                       </PressableScale>
                                    </FadeInView>
                                 ))}
                              </FadeInView>
                           ) : (
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                 {Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a)).map((date, i) => (
                                    <TouchableOpacity
                                       key={date}
                                       onPress={() => setSelectedDateFolder(date)}
                                       style={{ width: '48%', backgroundColor: C.surface, borderRadius: 24, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: C.divider, alignItems: 'center', elevation: 4 }}
                                    >
                                       <MaterialCommunityIcons name="folder" size={48} color={brandColor} />
                                       <Text style={{ color: C.text, fontWeight: '900', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{date}</Text>
                                       <View style={{ backgroundColor: brandColor + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginTop: 10 }}>
                                          <Text style={{ color: brandColor, fontSize: 10, fontWeight: '900' }}>{groupedByDate[date].length} PATIENTS</Text>
                                       </View>
                                    </TouchableOpacity>
                                 ))}
                                 {Object.keys(groupedByDate).length === 0 && (
                                    <View style={{ width: '100%', alignItems: 'center', paddingVertical: 60, opacity: 0.5 }}>
                                       <MaterialCommunityIcons name="folder-outline" size={64} color={brandColor} />
                                       <Text style={{ color: C.sub, marginTop: 16, fontWeight: '700' }}>{t.emptyPatients}</Text>
                                    </View>
                                 )}
                              </View>
                           )}
                        </>
                     )}

                     {activeView === 'dashboard' && activeTab === 'new' && (
                        <FadeInView style={{ paddingTop: 10 }}>
                           <View style={{ backgroundColor: C.surface, borderRadius: 32, padding: 24, borderWidth: 1, borderColor: C.divider, elevation: 4 }}>
                              <View style={{ marginBottom: 25 }}>
                                 <Text style={{ fontSize: 12, fontWeight: '900', color: brandColor, letterSpacing: 2, marginBottom: 12 }}>{t.newPatient.toUpperCase()}</Text>
                                 <TouchableOpacity
                                    onPress={() => setIsSearchDossierOpen(!isSearchDossierOpen)}
                                    style={{
                                       flexDirection: 'row',
                                       alignItems: 'center',
                                       justifyContent: 'center',
                                       backgroundColor: isSearchDossierOpen ? brandColor : C.bg,
                                       paddingVertical: 14,
                                       borderRadius: 18,
                                       borderWidth: 1,
                                       borderColor: brandColor,
                                       borderStyle: 'dashed'
                                    }}
                                 >
                                    <MaterialIcons name={isSearchDossierOpen ? "close" : "person-search"} size={20} color={isSearchDossierOpen ? "#FFF" : brandColor} />
                                    <Text style={{ fontSize: 12, fontWeight: '900', color: isSearchDossierOpen ? "#FFF" : brandColor, marginLeft: 10 }}>
                                       {isSearchDossierOpen ? "ANNULER LA RECHERCHE" : "RETROUVER UN DOSSIER EXISTANT"}
                                    </Text>
                                 </TouchableOpacity>
                              </View>

                              {isSearchDossierOpen && (
                                 <FadeInView style={{ marginBottom: 20 }}>
                                    <View style={{ height: 50, backgroundColor: C.bg, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: brandColor }}>
                                       <MaterialIcons name="search" size={18} color={brandColor} />
                                       <TextInput
                                          placeholder={(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["Taper nom, postnom ou prénom..."] || "Taper nom, postnom ou prénom..."}
                                          placeholderTextColor={C.placeholder}
                                          style={{ flex: 1, marginLeft: 10, color: C.text, fontWeight: '700' }}
                                          value={searchDossierQuery}
                                          onChangeText={setSearchDossierQuery}
                                       />
                                    </View>

                                    {searchDossierQuery.length > 1 && (
                                       <View style={{ marginTop: 8, backgroundColor: C.surface, borderRadius: 16, padding: 8, maxHeight: 200, borderWidth: 1, borderColor: C.border, elevation: 10 }}>
                                          <ScrollView nestedScrollEnabled>
                                             {(patients || [])
                                                .filter(p => p && `${p.first_name} ${p.last_name} ${p.post_name || ''}`.toLowerCase().includes(searchDossierQuery.toLowerCase()))
                                                .slice(0, 5)
                                                .map(p => (
                                                   <TouchableOpacity
                                                      key={p.id}
                                                      onPress={() => {
                                                         setForm({
                                                            id: p.id,
                                                            first_name: p.first_name,
                                                            last_name: p.last_name,
                                                            post_name: p.post_name || '',
                                                            birth_year: String(p.birth_year || ''),
                                                            contact_info: p.contact_info || '',
                                                            is_insured: !!p.is_insured,
                                                            insurance_id: p.insurance_id,
                                                            insurance_code: p.insurance_code || '',
                                                            pathology: p.pathology || '',
                                                            complaints: '',
                                                            gender: p.gender || 'M'
                                                         });
                                                         setIsSearchDossierOpen(false);
                                                         setSearchDossierQuery('');
                                                         showToast("Dossier retrouvé !", 'success');
                                                      }}
                                                      style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: C.divider, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                                                   >
                                                      <View>
                                                         <Text style={{ color: C.text, fontWeight: '800' }}>{p.first_name} {p.last_name}</Text>
                                                         <Text style={{ fontSize: 9, color: brandColor, fontWeight: '900' }}>{p.age} ANS • Né(e) en {p.birth_year}</Text>
                                                      </View>
                                                      <View style={{ backgroundColor: brandColor + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                                                         <Text style={{ color: brandColor, fontSize: 10, fontWeight: '900' }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["SÉLECTIONNER"] || "SÉLECTIONNER"}</Text>
                                                      </View>
                                                   </TouchableOpacity>
                                                ))
                                             }
                                          </ScrollView>
                                       </View>
                                    )}
                                 </FadeInView>
                              )}

                              {form.id && (
                                 <FadeInView style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#22C55E15', padding: 16, borderRadius: 24, marginBottom: 25, borderWidth: 1, borderColor: '#22C55E30' }}>
                                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' }}>
                                       <MaterialIcons name="check-circle" size={24} color="#FFF" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 16 }}>
                                       <Text style={{ color: '#22C55E', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["DOSSIER CHARGÉ"] || "DOSSIER CHARGÉ"}</Text>
                                       <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{form.first_name} {form.last_name}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setForm({ ...form, id: null, complaints: '' })} style={{ padding: 8 }}>
                                       <MaterialIcons name="refresh" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                 </FadeInView>
                              )}

                              <Text style={styles.label}>{t.lastName.toUpperCase()}</Text>
                              <TextInput style={[styles.input, { color: C.text, backgroundColor: C.bg, borderColor: C.border }]} placeholder={(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["Ex: Mukendi"] || "Ex: Mukendi"} placeholderTextColor={C.placeholder} value={form.last_name} onChangeText={v => setForm({ ...form, last_name: v })} />

                              <Text style={styles.label}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["POSTNOM"] || "POSTNOM"}</Text>
                              <TextInput style={[styles.input, { color: C.text, backgroundColor: C.bg, borderColor: C.border }]} placeholder={(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["Ex: Kalonji"] || "Ex: Kalonji"} placeholderTextColor={C.placeholder} value={form.post_name} onChangeText={v => setForm({ ...form, post_name: v })} />

                              <Text style={styles.label}>{t.firstName.toUpperCase()}</Text>
                              <TextInput style={[styles.input, { color: C.text, backgroundColor: C.bg, borderColor: C.border }]} placeholder={(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["Ex: Jean"] || "Ex: Jean"} placeholderTextColor={C.placeholder} value={form.first_name} onChangeText={v => setForm({ ...form, first_name: v })} />

                              <Text style={styles.label}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["SEXE"] || "SEXE"}</Text>
                              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                                 {['M', 'F'].map(g => (
                                    <TouchableOpacity
                                       key={g}
                                       onPress={() => setForm({ ...form, gender: g })}
                                       style={{
                                          flex: 1,
                                          height: 50,
                                          borderRadius: 15,
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          backgroundColor: form.gender === g ? brandColor : C.bg,
                                          borderWidth: 1,
                                          borderColor: form.gender === g ? brandColor : C.border
                                       }}
                                    >
                                       <Text style={{ color: form.gender === g ? '#FFF' : C.sub, fontWeight: '900' }}>{g === 'M' ? 'MASCULIN' : 'FÉMININ'}</Text>
                                    </TouchableOpacity>
                                 ))}
                              </View>

                              <View style={{ flexDirection: 'row', gap: 12 }}>
                                 <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                       <Text style={styles.label}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["ANNÉE DE NAISSANCE"] || "ANNÉE DE NAISSANCE"}</Text>
                                       {form.birth_year?.length === 4 && (
                                          <Text style={{ fontSize: 10, fontWeight: '900', color: brandColor }}>{new Date().getFullYear() - parseInt(form.birth_year)} ANS</Text>
                                       )}
                                    </View>
                                    <TextInput style={[styles.input, { color: C.text, backgroundColor: C.bg, borderColor: C.border }]} placeholder={(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["1990"] || "1990"} keyboardType="numeric" value={form.birth_year} onChangeText={v => setForm({ ...form, birth_year: v })} />
                                 </View>
                                 <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["PATHOLOGIE (SI CONNUE)"] || "PATHOLOGIE (SI CONNUE)"}</Text>
                                    <TextInput style={[styles.input, { color: C.text, backgroundColor: C.bg, borderColor: C.border }]} placeholder={(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["Ex: Diabète"] || "Ex: Diabète"} value={form.pathology} onChangeText={v => setForm({ ...form, pathology: v })} />
                                 </View>
                              </View>

                              <Text style={styles.label}>{t.phone.toUpperCase()}</Text>
                              <TextInput style={[styles.input, { color: C.text, backgroundColor: C.bg, borderColor: C.border }]} placeholder={(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["Ex: +243..."] || "Ex: +243..."} placeholderTextColor={C.placeholder} value={form.contact_info} onChangeText={v => setForm({ ...form, contact_info: v })} keyboardType="phone-pad" />
                              
                              {(form.contact_info || '').length >= 2 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -12, marginBottom: 15, marginLeft: 5 }}>
                                  {detectOperator(form.contact_info).valid ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: operatorColor(detectOperator(form.contact_info).operator) + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                      <MaterialCommunityIcons name="check-circle" size={10} color={operatorColor(detectOperator(form.contact_info).operator)} />
                                      <Text style={{ fontSize: 9, fontWeight: '800', color: operatorColor(detectOperator(form.contact_info).operator), marginLeft: 4 }}>
                                        {detectOperator(form.contact_info).operator.toUpperCase()}
                                      </Text>
                                    </View>
                                  ) : form.contact_info.length >= 9 && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF444415', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                      <MaterialCommunityIcons name="alert-circle" size={10} color="#EF4444" />
                                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#EF4444', marginLeft: 4 }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["NUMÉRO INVALIDE"] || "NUMÉRO INVALIDE"}</Text>
                                    </View>
                                  )}
                                </View>
                              )}

                              <Text style={styles.label}>{t.complaints.toUpperCase()}</Text>
                              <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: 14, color: C.text, backgroundColor: C.bg, borderColor: C.border }]} multiline placeholder={t.complaints} placeholderTextColor={C.placeholder} value={form.complaints} onChangeText={v => setForm({ ...form, complaints: v })} />

                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingHorizontal: 4 }}>
                                 <View>
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: C.text }}>{t.insured}</Text>
                                    <Text style={{ fontSize: 10, color: C.sub }}>{t.insuranceCompany}</Text>
                                 </View>
                                 <Switch value={form.is_insured} onValueChange={v => setForm({ ...form, is_insured: v })} trackColor={{ true: brandColor }} />
                              </View>

                              {form.is_insured && (
                                 <FadeInView>
                                    <Text style={styles.label}>{t.insuranceCompany.toUpperCase()}</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                                       {(insurances || []).map(ins => (
                                          <TouchableOpacity
                                             key={ins.id}
                                             onPress={() => setForm({ ...form, insurance_id: ins.id })}
                                             style={{
                                                paddingHorizontal: 16,
                                                paddingVertical: 10,
                                                borderRadius: 12,
                                                borderWidth: 2,
                                                borderColor: form.insurance_id === ins.id ? brandColor : C.divider,
                                                backgroundColor: form.insurance_id === ins.id ? brandColor + '10' : 'transparent'
                                             }}
                                          >
                                             <Text style={{ color: form.insurance_id === ins.id ? brandColor : C.sub, fontWeight: '700', fontSize: 12 }}>{ins.name}</Text>
                                          </TouchableOpacity>
                                       ))}
                                    </View>

                                    <Text style={styles.label}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["CODE D'ASSURÉ"] || "CODE D'ASSURÉ"}</Text>
                                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                       <TextInput
                                          style={[styles.input, { flex: 1, color: C.text, backgroundColor: C.bg, borderColor: C.border, marginBottom: 0 }]}
                                          placeholder={(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["Ex: MERY-123"] || "Ex: MERY-123"}
                                          placeholderTextColor={C.placeholder}
                                          value={form.insurance_code}
                                          onChangeText={v => { setForm({ ...form, insurance_code: v }); setVerifiedMember(null); }}
                                       />
                                       <TouchableOpacity
                                          onPress={checkInsurance}
                                          disabled={isVerifying}
                                          style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: brandColor, alignItems: 'center', justifyContent: 'center', elevation: 2 }}
                                       >
                                          {isVerifying ? <ActivityIndicator color="#FFF" size="small" /> : <MaterialIcons name="fact-check" size={24} color="#FFF" />}
                                       </TouchableOpacity>
                                    </View>

                                    {verifiedMember && (
                                       <FadeInView style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#22C55E15', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#22C55E40' }}>
                                          <MaterialIcons name="verified" size={18} color="#22C55E" />
                                          <Text style={{ color: '#22C55E', fontWeight: '800', fontSize: 11, marginLeft: 8 }}>MEMBRE VÉRIFIÉ : {verifiedMember.toUpperCase()}</Text>
                                       </FadeInView>
                                    )}
                                    <View style={{ height: 20 }} />
                                 </FadeInView>
                              )}

                              <TouchableOpacity style={{ height: 60, borderRadius: 20, overflow: 'hidden', marginTop: 10 }} onPress={handleCreate} disabled={isSubmitting}>
                                 <LinearGradient colors={Theme.colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                    {isSubmitting ? <ActivityIndicator color="#FFF" /> : (
                                       <>
                                          <MaterialIcons name="person-add" size={20} color="#FFF" style={{ marginRight: 10 }} />
                                          <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15, letterSpacing: 1 }}>{t.users.generate.toUpperCase()}</Text>
                                       </>
                                    )}
                                 </LinearGradient>
                              </TouchableOpacity>
                           </View>
                        </FadeInView>
                     )}

                     {activeView === 'patients_all' && (
                        <FadeInView>
                           <Text style={{ fontSize: 20, fontWeight: '900', color: C.text, marginBottom: 20 }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["ARCHIVE PAR ANNÉE"] || "ARCHIVE PAR ANNÉE"}</Text>

                           {selectedYearFolder ? (
                              <View>
                                 <TouchableOpacity
                                    onPress={() => setSelectedYearFolder(null)}
                                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, padding: 10, backgroundColor: brandColor + '10', borderRadius: 12, alignSelf: 'flex-start' }}
                                 >
                                    <MaterialIcons name="arrow-back" size={18} color={brandColor} />
                                    <Text style={{ color: brandColor, fontWeight: '900', fontSize: 12, marginLeft: 8 }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["RETOUR AUX ARCHIVES"] || "RETOUR AUX ARCHIVES"}</Text>
                                 </TouchableOpacity>

                                 <Text style={{ fontSize: 14, fontWeight: '900', color: brandColor, marginBottom: 15 }}>LISTE DES PATIENTS NÉS EN {selectedYearFolder}</Text>

                                 {groupedByYear[selectedYearFolder].map(p => (
                                    <View key={p.id} style={{ padding: 18, backgroundColor: C.surface, borderRadius: 24, marginBottom: 12, borderWidth: 1, borderColor: C.divider, elevation: 2 }}>
                                       <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <View style={{ flex: 1 }}>
                                             <Text style={{ fontSize: 17, fontWeight: '900', color: C.text }}>{p.first_name} {p.last_name}</Text>
                                             <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                <MaterialIcons name="event" size={12} color={C.sub} />
                                                <Text style={{ fontSize: 12, color: C.sub, marginLeft: 4 }}>{p.age} ANS ({p.birth_year || 'N/A'})</Text>
                                                {p.pathology && (
                                                   <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}>
                                                      <MaterialIcons name="healing" size={12} color={brandColor} />
                                                      <Text style={{ fontSize: 12, color: brandColor, fontWeight: '700', marginLeft: 4 }}>{p.pathology}</Text>
                                                   </View>
                                                )}
                                             </View>
                                          </View>
                                          <View style={{ backgroundColor: p.is_insured ? brandColor + '15' : '#22C55E15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                                             <Text style={{ fontSize: 10, color: p.is_insured ? brandColor : '#22C55E', fontWeight: '900' }}>{p.is_insured ? 'ASSURÉ' : 'PRIVÉ'}</Text>
                                          </View>
                                       </View>
                                    </View>
                                 ))}
                              </View>
                           ) : (
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                 {archiveYears.map((year, i) => (
                                    <TouchableOpacity
                                       key={year}
                                       onPress={() => setSelectedYearFolder(year)}
                                       style={{ width: '48%', backgroundColor: C.surface, borderRadius: 24, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: C.divider, alignItems: 'center', elevation: 4 }}
                                    >
                                       <MaterialCommunityIcons name="folder" size={48} color={brandColor} />
                                       <Text style={{ color: C.text, fontWeight: '900', fontSize: 16, marginTop: 12 }}>{year}</Text>
                                       <View style={{ backgroundColor: brandColor + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginTop: 10 }}>
                                          <Text style={{ color: brandColor, fontSize: 10, fontWeight: '900' }}>{groupedByYear[year].length} MALADES</Text>
                                       </View>
                                    </TouchableOpacity>
                                 ))}
                              </View>
                           )}
                        </FadeInView>
                     )}

                     {activeView === 'insurances_all' && (
                        <FadeInView>
                           <Text style={{ fontSize: 20, fontWeight: '900', color: C.text, marginBottom: 20 }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["ANALYSE RENTABILITÉ ASSURANCES"] || "ANALYSE RENTABILITÉ ASSURANCES"}</Text>
                           {(insurances || []).map(ins => {
                              const patientCount = ins.patients_count || 0;
                              const consumption = ins.real_consumption || 0;
                              const flatFee = Number(ins.monthly_flat_fee || 0);
                              const isProfit = flatFee > consumption;
                              const diff = Math.abs(flatFee - consumption);

                              return (
                                 <View key={ins.id} style={{ padding: 20, backgroundColor: C.surface, borderRadius: 28, marginBottom: 16, borderWidth: 1, borderColor: C.divider, elevation: 4 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                       <View>
                                          <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>{ins.name}</Text>
                                          <Text style={{ fontSize: 11, color: brandColor, fontWeight: '800' }}>{patientCount} PATIENTS ENREGISTRÉS</Text>
                                       </View>
                                       <MaterialCommunityIcons name="shield-check" size={32} color={brandColor} style={{ opacity: 0.3 }} />
                                    </View>

                                    <View style={{ height: 1, backgroundColor: C.divider, marginVertical: 15 }} />

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                                       <View>
                                          <Text style={{ fontSize: 9, fontWeight: '900', color: C.sub }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["FORFAIT MENSUEL"] || "FORFAIT MENSUEL"}</Text>
                                          <Text style={{ fontSize: 15, fontWeight: '900', color: C.text }}>{flatFee.toLocaleString()} FC</Text>
                                       </View>
                                       <View style={{ alignItems: 'flex-end' }}>
                                          <Text style={{ fontSize: 9, fontWeight: '900', color: C.sub }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["CONSOMMATION RÉELLE"] || "CONSOMMATION RÉELLE"}</Text>
                                          <Text style={{ fontSize: 15, fontWeight: '900', color: C.text }}>{consumption.toLocaleString()} FC</Text>
                                       </View>
                                    </View>

                                    <View style={{ backgroundColor: isProfit ? '#22C55E15' : '#EF444415', padding: 12, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isProfit ? '#22C55E30' : '#EF444430' }}>
                                       <MaterialIcons name={isProfit ? "trending-up" : "trending-down"} size={20} color={isProfit ? "#22C55E" : "#EF4444"} />
                                       <Text style={{ fontSize: 12, fontWeight: '900', color: isProfit ? "#22C55E" : "#EF4444", marginLeft: 8 }}>
                                          {isProfit ? "AVANTAGE :" : "PERTE :"} {diff.toLocaleString()} FC
                                       </Text>
                                    </View>
                                 </View>
                              );
                           })}
                        </FadeInView>
                     )}

                     {activeView === 'bilan_day' && (
                        <FadeInView>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                              <Text style={{ fontSize: 20, fontWeight: '900', color: C.text }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["BILAN D'ACTIVITÉ"] || "BILAN D'ACTIVITÉ"}</Text>
                              <TouchableOpacity onPress={() => fetchServiceRevenues(false, bilanPeriod)}><MaterialIcons name="refresh" size={24} color={brandColor} /></TouchableOpacity>
                           </View>

                           <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderRadius: 20, padding: 5, marginBottom: 20, borderWidth: 1, borderColor: C.divider, elevation: 2 }}>
                              {[
                                 { id: 'day', label: 'Journalier' },
                                 { id: 'week', label: 'Hebdomadaire' },
                                 { id: 'month', label: 'Mensuel' }
                              ].map(p => (
                                 <TouchableOpacity
                                    key={p.id}
                                    onPress={() => { setBilanPeriod(p.id); fetchServiceRevenues(false, p.id); }}
                                    style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 16, backgroundColor: bilanPeriod === p.id ? brandColor : 'transparent' }}
                                 >
                                    <Text style={{ fontSize: 10, fontWeight: '900', color: bilanPeriod === p.id ? '#FFF' : C.sub }}>{p.label.toUpperCase()}</Text>
                                 </TouchableOpacity>
                              ))}
                           </View>

                           <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                              <LinearGradient colors={Theme.colors.brandGradient} style={{ flex: 1, padding: 20, borderRadius: 28, elevation: 8 }}>
                                 <MaterialCommunityIcons name="account-group" size={24} color="rgba(255,255,255,0.6)" />
                                 <Text style={{ color: '#FFF', fontSize: 32, fontWeight: '900', marginTop: 8 }}>{realPatientCount}</Text>
                                 <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{bilanPeriod === 'day' ? 'PATIENTS AUJOURD\'HUI' : bilanPeriod === 'week' ? 'PATIENTS CETTE SEMAINE' : 'PATIENTS CE MOIS'}</Text>
                              </LinearGradient>

                              <View style={{ flex: 1, padding: 20, backgroundColor: C.surface, borderRadius: 28, borderWidth: 1, borderColor: C.divider, elevation: 4 }}>
                                 <MaterialCommunityIcons name="currency-usd" size={24} color="#22C55E" />
                                 <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', marginTop: 8 }}>{serviceRevenues.reduce((acc, s) => acc + s.amount, 0).toLocaleString()}</Text>
                                 <Text style={{ color: C.sub, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>RECETTES {bilanPeriod === 'day' ? 'DU JOUR' : bilanPeriod === 'week' ? 'HEBDOMADAIRES' : 'MENSUELLES'}</Text>
                              </View>
                           </View>

                           <View style={{ backgroundColor: C.surface, borderRadius: 32, padding: 24, borderWidth: 1, borderColor: C.divider, marginBottom: 25 }}>
                              <Text style={{ fontSize: 12, fontWeight: '900', color: brandColor, letterSpacing: 1.5, marginBottom: 20 }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["DÉTAILS DES RECETTES PAR SERVICE"] || "DÉTAILS DES RECETTES PAR SERVICE"}</Text>

                              {serviceRevenues.length > 0 ? serviceRevenues.map((item, i) => {
                                 const icons = {
                                    reception: 'folder-open',
                                    labo: 'flask',
                                    pharmacie: 'pill',
                                    soins: 'medical-bag',
                                    consultation: 'stethoscope',
                                    caisse: 'cash-register'
                                 };
                                 return (
                                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                                       <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: (item.color || brandColor) + '15', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                                          <MaterialCommunityIcons name={icons[item.key] || 'cash'} size={22} color={item.color || brandColor} />
                                       </View>
                                       <View style={{ flex: 1 }}>
                                          <Text style={{ color: C.text, fontWeight: '800', fontSize: 14 }}>{item.service}</Text>
                                          <View style={{ height: 4, backgroundColor: C.divider, borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                                             <View style={{ width: Math.min(100, (item.amount / (serviceRevenues.reduce((acc, s) => acc + s.amount, 1)) * 300)) + '%', height: '100%', backgroundColor: item.color || brandColor }} />
                                          </View>
                                       </View>
                                       <View style={{ alignItems: 'flex-end' }}>
                                          <Text style={{ color: item.color || brandColor, fontWeight: '900', fontSize: 14, marginLeft: 15 }}>{item.amount.toLocaleString()} FC</Text>
                                          <Text style={{ fontSize: 9, color: C.sub, fontWeight: '700' }}>{item.count} act(s)</Text>
                                       </View>
                                    </View>
                                 );
                              }) : (
                                 <View style={{ alignItems: 'center', padding: 20 }}>
                                    <MaterialCommunityIcons name="cash-off" size={40} color={C.divider} />
                                    <Text style={{ color: C.sub, fontSize: 12, marginTop: 10, fontWeight: '700' }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["Aucune recette aujourd'hui"] || "Aucune recette aujourd'hui"}</Text>
                                 </View>
                              )}
                           </View>

                           <View style={{ backgroundColor: C.surface, borderRadius: 32, padding: 24, borderWidth: 1, borderColor: C.divider, marginBottom: 25 }}>
                              <Text style={{ fontSize: 12, fontWeight: '900', color: brandColor, letterSpacing: 1.5, marginBottom: 20 }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["RÉPARTITION PAR PRISE EN CHARGE"] || "RÉPARTITION PAR PRISE EN CHARGE"}</Text>

                              {[
                                 { label: "Assurés (Contrats)", count: insuredCount, color: brandColor },
                                 { label: "Privés (Cash)", count: privateCount, color: '#22C55E' }
                              ].map((item, i) => (
                                 <View key={i} style={{ marginBottom: 16 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                       <Text style={{ color: C.text, fontWeight: '800', fontSize: 13 }}>{item.label}</Text>
                                       <Text style={{ color: item.color, fontWeight: '900', fontSize: 13 }}>{item.count}</Text>
                                    </View>
                                    <View style={{ height: 6, backgroundColor: C.divider, borderRadius: 3, overflow: 'hidden' }}>
                                       <View style={{ width: `${Math.min(100, (item.count / (realPatientCount || 1)) * 100)}%`, height: '100%', backgroundColor: item.color }} />
                                    </View>
                                 </View>
                              ))}
                           </View>
                        </FadeInView>
                     )}

                     {activeView === 'catalog' && (
                        <FadeInView>
                           <View style={{ marginBottom: 25 }}>
                              <Text style={{ fontSize: 20, fontWeight: '900', color: C.text }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["NOUVEAU SERVICE / EXAMEN"] || "NOUVEAU SERVICE / EXAMEN"}</Text>
                              <Text style={{ color: C.sub, marginTop: 4 }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["Ajoutez un nouvel élément au catalogue. L'administrateur pourra le modifier."] || "Ajoutez un nouvel élément au catalogue. L'administrateur pourra le modifier."}</Text>
                           </View>

                           <View style={{ backgroundColor: C.surface, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: C.divider, elevation: 4 }}>
                              <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#64748B', marginBottom: 16 }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["TYPE DE SERVICE"] || "TYPE DE SERVICE"}</Text>
                              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                                 {['Examen', 'Autre'].map(type => (
                                    <TouchableOpacity
                                       key={type}
                                       onPress={() => setNewCatalogItem({ ...newCatalogItem, type })}
                                       style={{
                                          flex: 1,
                                          height: 50,
                                          borderRadius: 15,
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          backgroundColor: newCatalogItem.type === type ? brandColor : C.bg,
                                          borderWidth: 1,
                                          borderColor: newCatalogItem.type === type ? brandColor : C.border
                                       }}
                                    >
                                       <Text style={{ color: newCatalogItem.type === type ? '#FFF' : C.sub, fontWeight: '900' }}>
                                          {type === 'Autre' ? 'AUTRE SERVICE' : 'EXAMEN LABO'}
                                       </Text>
                                    </TouchableOpacity>
                                 ))}
                              </View>

                              <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#64748B', marginBottom: 16 }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["LIBELLÉ DU SERVICE / EXAMEN"] || "LIBELLÉ DU SERVICE / EXAMEN"}</Text>
                              <TextInput
                                 style={{ height: 54, paddingHorizontal: 16, borderRadius: 16, color: C.text, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, marginBottom: 20 }}
                                 placeholder={(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["Ex: Échographie, Test Goutte Epaisse..."] || "Ex: Échographie, Test Goutte Epaisse..."}
                                 placeholderTextColor={C.placeholder}
                                 value={newCatalogItem.label}
                                 onChangeText={v => setNewCatalogItem({ ...newCatalogItem, label: v })}
                              />

                              <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#64748B', marginBottom: 16 }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["PRIX (FC)"] || "PRIX (FC)"}</Text>
                              <TextInput
                                 style={{ height: 54, paddingHorizontal: 16, borderRadius: 16, color: C.text, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, marginBottom: 20 }}
                                 placeholder={(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["Ex: 5000"] || "Ex: 5000"}
                                 placeholderTextColor={C.placeholder}
                                 keyboardType="numeric"
                                 value={newCatalogItem.price}
                                 onChangeText={v => setNewCatalogItem({ ...newCatalogItem, price: v })}
                              />

                              {newCatalogItem.type === 'Autre' && (
                                 <FadeInView>
                                    <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#64748B', marginBottom: 16 }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["NOM DU SERVICE CONCERNÉ"] || "NOM DU SERVICE CONCERNÉ"}</Text>
                                    <TextInput
                                       style={{ height: 54, paddingHorizontal: 16, borderRadius: 16, color: C.text, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, marginBottom: 20 }}
                                       placeholder={(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["Ex: Soins, Maternité, Chirurgie..."] || "Ex: Soins, Maternité, Chirurgie..."}
                                       placeholderTextColor={C.placeholder}
                                       value={newCatalogItem.service}
                                       onChangeText={v => setNewCatalogItem({ ...newCatalogItem, service: v })}
                                    />
                                 </FadeInView>
                              )}

                              <TouchableOpacity style={{ height: 60, borderRadius: 20, overflow: 'hidden', marginTop: 10 }} onPress={handleAddCatalogItem} disabled={isSubmitting}>
                                 <LinearGradient colors={Theme.colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                    {isSubmitting ? <ActivityIndicator color="#FFF" /> : (
                                       <>
                                          <MaterialIcons name="add-circle-outline" size={20} color="#FFF" style={{ marginRight: 10 }} />
                                          <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15, letterSpacing: 1 }}>{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["AJOUTER AU CATALOGUE"] || "AJOUTER AU CATALOGUE"}</Text>
                                       </>
                                    )}
                                 </LinearGradient>
                              </TouchableOpacity>
                           </View>
                        </FadeInView>
                     )}
                  </>
               )}
            </View>
         </ScrollView>

         {/* BOTTOM SLIDE PANEL (STATS) */}
         {activeBottomTab === 'stats' && (
            <Animated.View style={[
               { position: 'absolute', bottom: 85, left: 16, right: 16, maxHeight: height * 0.45, backgroundColor: C.bg, borderRadius: 28, borderWidth: 1, borderColor: C.divider, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 16 },
               { transform: [{ translateY: bottomPanelAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }
            ]}>
               <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: C.divider, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: C.text }}>{bt.receptionStatsTitle}</Text>
                  <TouchableOpacity onPress={() => toggleBottomTab('stats')} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.closeBg, alignItems: 'center', justifyContent: 'center' }}>
                     <MaterialIcons name="close" size={18} color={brandColor} />
                  </TouchableOpacity>
               </View>
               <ScrollView style={{ padding: 16 }}>
                  {bottomLoading ? (
                     <ActivityIndicator size="large" color={brandColor} style={{ marginTop: 40 }} />
                  ) : stats && (
                     <View>
                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                           <View style={{ flex: 1, padding: 16, backgroundColor: brandColor + '10', borderRadius: 20, borderWidth: 1, borderColor: brandColor + '20' }}>
                              <Text style={{ fontSize: 10, fontWeight: '900', color: brandColor, letterSpacing: 1 }}>{bt.today.toUpperCase()}</Text>
                              <Text style={{ fontSize: 24, fontWeight: '900', color: C.text, marginTop: 4 }}>{stats.today_count}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                 <MaterialIcons name="trending-up" size={12} color="#22C55E" />
                                 <Text style={{ fontSize: 10, color: '#22C55E', fontWeight: '800', marginLeft: 4 }}>+{stats.diff_percent}%</Text>
                              </View>
                           </View>
                           <View style={{ flex: 1, padding: 16, backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border }}>
                              <Text style={{ fontSize: 10, fontWeight: '900', color: C.sub, letterSpacing: 1 }}>{bt.yesterday.toUpperCase()}</Text>
                              <Text style={{ fontSize: 24, fontWeight: '900', color: C.sub, marginTop: 4 }}>{stats.yesterday_count}</Text>
                           </View>
                        </View>

                        <View style={{ padding: 20, backgroundColor: C.surface, borderRadius: 24, borderWidth: 1, borderColor: C.border }}>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: C.text }}>{t.insured}</Text>
                              <Text style={{ fontSize: 13, fontWeight: '900', color: brandColor }}>{stats.insured_count}</Text>
                           </View>
                           <View style={{ height: 8, backgroundColor: C.divider, borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
                              <View style={{ width: (stats.insured_count / (stats.today_count || 1) * 100) + '%', height: '100%', backgroundColor: brandColor }} />
                           </View>

                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: C.text }}>{t.private}</Text>
                              <Text style={{ fontSize: 13, fontWeight: '900', color: C.sub }}>{stats.private_count}</Text>
                           </View>
                           <View style={{ height: 8, backgroundColor: C.divider, borderRadius: 4, overflow: 'hidden' }}>
                              <View style={{ width: (stats.private_count / (stats.today_count || 1) * 100) + '%', height: '100%', backgroundColor: C.sub }} />
                           </View>
                        </View>
                     </View>
                  )}
               </ScrollView>
            </Animated.View>
         )}

         {/* BOTTOM TAB BAR */}
         <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 75 + insets.bottom, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'row', elevation: 20, paddingBottom: 10 + insets.bottom }}>
            {[
               { id: 'list', icon: 'account-group', label: bt.queue },
               { id: 'new', icon: 'account-plus', label: bt.new },
               { id: 'stats', icon: 'chart-bar', label: bt.stats },
            ].map(tab => {
               const isAct = tab.id === 'stats' ? activeBottomTab === 'stats' : (activeTab === tab.id && !activeBottomTab);
               return (
                  <TouchableOpacity key={tab.id} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onPress={() => {
                     if (tab.id === 'stats') toggleBottomTab('stats');
                     else { setActiveTab(tab.id); if (activeBottomTab) toggleBottomTab('stats'); }
                     if (activeView !== 'dashboard') setActiveView('dashboard');
                  }}>
                     <View style={{ width: 50, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: isAct ? brandColor + '15' : 'transparent' }}>
                        <MaterialCommunityIcons name={tab.icon} size={22} color={isAct ? brandColor : C.placeholder} />
                     </View>
                     <Text style={{ fontSize: 10, fontWeight: isAct ? '900' : '600', color: isAct ? brandColor : C.placeholder, marginTop: 4 }}>{tab.label}</Text>
                  </TouchableOpacity>
               );
            })}
         </View>

         <PremiumLeftDrawer
            isOpen={isLeftOpen}
            anim={leftAnim}
            onClose={() => toggleLeft(false)}
            activeView={activeView}
            setActiveView={setActiveView}
            menuItems={menuItems}
            roleName={t.roles.reception}
            isDark={isDark}
            t={t}
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
            roleName={t.roles.reception}
            roleIcon="account-details"
            onLogout={handleLogout}
            t={t}
            setActiveView={(v) => { toggleRight(false); setActiveView(v); }}
         />
      </View>
   );
}

const createStyles = (C, S, brandColor) => StyleSheet.create({
   mainContainer: {
      flex: 1,
      backgroundColor: C.bg
   },
   label: {
      fontSize: 10,
      fontWeight: '900',
      color: brandColor,
      letterSpacing: 2,
      marginBottom: 10,
      opacity: 0.8
   },
   input: {
      height: 60,
      borderRadius: 20,
      paddingHorizontal: 22,
      marginBottom: 24,
      fontSize: 15,
      fontWeight: '700',
      borderWidth: 1.5,
      backgroundColor: C.surface,
      color: C.text,
      borderColor: C.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
      elevation: 2,
   }
});
