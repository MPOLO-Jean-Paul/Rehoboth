import React, { useEffect, useState, useRef, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, TextInput, Animated, Dimensions, Switch, Image, StatusBar, Modal, FlatList, Alert, AppState, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import tw from 'twrnc';
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
import Storage from '../services/Storage';
import { isValidPhone, detectOperator, operatorColor } from '../utils/phoneValidator';

const { width, height } = Theme.layout;
const ADMIN_REFRESH_INTERVAL_MS = 60000;
const asArray = (value) => Array.isArray(value) ? value : [];
const asText = (value) => value === undefined || value === null ? '' : String(value);
const formatMoney = (value) => Number(value || 0).toLocaleString();
const safePadId = (value) => String(value ?? '').padStart(5, '0');
const isInsuranceExpired = (ins) => ins?.status === 'expired' || ins?.is_expired || (ins?.contract_end_date && new Date(ins.contract_end_date) < new Date());

export default function AdminScreen({ navigation }) {
  const { themeMode, toggleTheme, lang, toggleLang, isOnline, brandColor, C, S, isDark } = useTheme();
  const { showToast } = useContext(ToastContext);
  const t = translations[lang] || translations.fr;
  const insets = useSafeAreaInsets();

  const styles = createStyles(C, S, isDark, brandColor);

  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [patients, setPatients] = useState([]);
  const [messages, setMessages] = useState([]);
  const [insurances, setInsurances] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');

  const [showUserModal, setShowUserModal] = useState(false);
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [newUser, setNewUser] = useState({ name: '', postname: '', phone: '', email: '', role: 'reception', password: '', confirmPassword: '', specialty: '' });
  const [newInsurance, setNewInsurance] = useState({ name: '', email: '', contract_date: '', contract_end_date: '', contract_type: 'mensuel', monthly_flat_fee: '', contact_info: '', status: 'active' });
  const [newMember, setNewMember] = useState({ insurance_id: null, member_name: '', membership_code: '' });
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [activeInsurance, setActiveInsurance] = useState(null);
  const [insuredMembers, setInsuredMembers] = useState([]);
  const [broadcast, setBroadcast] = useState({ subject: '', message: '', target_role: '', priority: 'normal' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [showResetSection, setShowResetSection] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [newCatalogItem, setNewCatalogItem] = useState({ type: 'Produit', label: '', price: '' });
  const [revenuePeriod, setRevenuePeriod] = useState('day');
  const [reportFrequency, setReportFrequency] = useState('daily'); // daily, weekly, monthly
  const [showBilanModal, setShowBilanModal] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [activeBottomTab, setActiveBottomTab] = useState(null);
  const [diseasePeriod, setDiseasePeriod] = useState('7');
  const [diseases, setDiseases] = useState([]);
  const [expiryData, setExpiryData] = useState({ expiring: [], expired: [] });
  const [cashData, setCashData] = useState({ items: [], patient_count: 0, insured_count: 0, private_count: 0 });
  const [priceCatalog, setPriceCatalog] = useState([]);
  const [bottomLoading, setBottomLoading] = useState(false);
  const [selectedMonthFolder, setSelectedMonthFolder] = useState(null);
  const [selectedDateFolder, setSelectedDateFolder] = useState(null);
  const [selectedYearFolder, setSelectedYearFolder] = useState(null);
  const [insuranceSearch, setInsuranceSearch] = useState('');
  const [dataRecords, setDataRecords] = useState([]);
  const [dataSearch, setDataSearch] = useState('');
  const [dataBirthYear, setDataBirthYear] = useState('');
  const [editingPatient, setEditingPatient] = useState(null);
  const [autoExportEnabled, setAutoExportEnabled] = useState(false);
  const [autoExportFrequency, setAutoExportFrequency] = useState('daily');
  const [lastExportUri, setLastExportUri] = useState(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [bulkCatalogItems, setBulkCatalogItems] = useState([{ label: '', price: '', dosage: '' }]);
  const [bulkCategory, setBulkCategory] = useState('Produit');
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetService, setResetService] = useState('pharmacie');
  const [resetPassword, setResetPassword] = useState('');

  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [selectedTimeline, setSelectedTimeline] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const bottomPanelAnim = useRef(new Animated.Value(0)).current;

  const leftAnim = useRef(new Animated.Value(-width)).current;
  const rightAnim = useRef(new Animated.Value(width)).current;
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);

  useEffect(() => {
    loadCachedData();
    Storage.get('admin_auto_export_config').then(config => {
      if (config) {
        setAutoExportEnabled(!!config.enabled);
        setAutoExportFrequency(config.frequency || 'daily');
      }
    });
    fetchGlobalData();
    fetchSettings();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        fetchGlobalData(revenuePeriod, true);
      }
    }, ADMIN_REFRESH_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        fetchGlobalData(revenuePeriod, true);
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [revenuePeriod]);

  useEffect(() => {
    if (activeView === 'data') {
      fetchDataRecords(true);
      maybeAutoExportData();
    }
  }, [activeView, dataSearch, dataBirthYear, autoExportEnabled, autoExportFrequency]);

  useEffect(() => {
    Storage.save('admin_auto_export_config', {
      enabled: autoExportEnabled,
      frequency: autoExportFrequency,
    });
  }, [autoExportEnabled, autoExportFrequency]);

  const loadCachedData = async () => {
    const cached = await Storage.get('admin_bootstrap');
    if (cached) {
      setStats(cached.stats || null);
      setUsers(asArray(cached.users));
      setPatients(asArray(cached.patients));
      setMessages(Array.isArray(cached.messages) ? cached.messages : asArray(cached.messages?.data));
      setInsurances(asArray(cached.insurances));
      setLoading(false);
    }
  };

  const fetchGlobalData = async (period = revenuePeriod, isBg = false) => {
    if (!isBg && !stats) setLoading(true);
    try {
      const resp = await api.get(`/admin/bootstrap?period=${period}`);
      const data = resp.data;

      setStats(data.stats || null);
      setUsers(asArray(data.users));
      setPatients(asArray(data.patients));
      setMessages(Array.isArray(data.messages) ? data.messages : asArray(data.messages?.data));
      setInsurances(asArray(data.insurances));
      setDataRecords(asArray(data.patients));
      
      // Save for next time
      Storage.save('admin_bootstrap', data);
    } catch (e) {
      console.error('[AdminScreen] Bootstrap error:', e);
      if (!stats) setStats({ total_patients_period: 0, total_visits_period: 0, revenue_period: 0, lab_period_count: 0 });
    } finally {
      if (!isBg) setLoading(false);
    }
  };

  const setupEditInsurance = (ins) => {
    setEditingInsurance(ins);
    setNewInsurance({
       name: ins.name,
       email: ins.email || '',
       status: ins.status || 'active',
       contract_type: ins.contract_type || 'mensuel',
       contract_date: ins.contract_date ? new Date(ins.contract_date).toLocaleDateString('fr-FR') : '',
       contract_end_date: ins.contract_end_date ? new Date(ins.contract_end_date).toLocaleDateString('fr-FR') : '',
       monthly_flat_fee: ins.monthly_flat_fee ? String(ins.monthly_flat_fee) : '',
       contact_info: ins.contact_info || ''
    });
    setShowInsuranceModal(true);
  };

  const fetchDataRecords = async (isBg = false) => {
    try {
      const res = await api.get('/admin/patient-records', {
        params: {
          q: dataSearch || undefined,
          birth_year: dataBirthYear || undefined,
          limit: 800,
        },
      });
      setDataRecords(asArray(res.data));
    } catch (e) {
      if (!isBg) showToast(parseError(e), 'error');
    }
  };

  const handleUpdatePatient = async () => {
    if (!editingPatient?.first_name || !editingPatient?.last_name) {
      return showToast('Nom et prénom requis', 'error');
    }

    setIsSubmitting(true);
    try {
      await api.put(`/admin/patient-records/${editingPatient.id}`, editingPatient);
      showToast('Dossier patient mis à jour', 'success');
      setEditingPatient(null);
      fetchDataRecords(true);
      fetchGlobalData(revenuePeriod, true);
    } catch (e) {
      showToast(parseError(e), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchTimeline = async (patientId) => {
    setTimelineLoading(true);
    setShowTimelineModal(true);
    try {
      const resp = await api.get(`/patients/${patientId}`);
      setSelectedTimeline(resp.data);
    } catch (e) {
      showToast("Impossible de charger l'historique", 'error');
      setShowTimelineModal(false);
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleDeletePatient = (patient) => {
    Alert.alert('Confirmation', `Supprimer le dossier de ${patient.first_name} ${patient.last_name} ?`, [
      { text: t.cancel || 'Annuler', style: 'cancel' },
      {
        text: 'SUPPRIMER',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/admin/patient-records/${patient.id}`);
            showToast('Dossier patient supprimé', 'success');
            setDataRecords(current => current.filter(item => item.id !== patient.id));
            setPatients(current => current.filter(item => item.id !== patient.id));
          } catch (e) {
            showToast(parseError(e), 'error');
          }
        },
      },
    ]);
  };

  const buildExportHtml = (payload) => {
    const patientsList = asArray(payload?.patients);
    const insuranceList = asArray(payload?.insurances);
    const rows = patientsList.slice(0, 2000).map(p => `
      <tr>
        <td>${p.id}</td><td>${p.first_name || ''} ${p.last_name || ''}</td>
        <td>${p.birth_year || ''}</td><td>${p.pathology || ''}</td>
        <td>${p.is_insured ? (p.insurance?.name || 'Assuré') : 'Privé'}</td>
      </tr>`).join('');

    return `
      <html><body style="font-family: Arial; padding: 24px;">
        <h1>Export général Rehoboth</h1>
        <p>Généré le ${new Date(payload?.generated_at || Date.now()).toLocaleString()}</p>
        <h2>Résumé</h2>
        <p>${patientsList.length} dossiers patients • ${insuranceList.length} assurances</p>
        <h2>Dossiers patients</h2>
        <table style="width:100%; border-collapse: collapse;" border="1" cellpadding="6">
          <thead><tr><th>ID</th><th>Patient</th><th>Naissance</th><th>Pathologie</th><th>Couverture</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body></html>`;
  };

  const downloadHospitalData = async (share = true) => {
    setIsSubmitting(true);
    try {
      const res = await api.get('/admin/data/export');
      const file = await Print.printToFileAsync({ html: buildExportHtml(res.data) });
      setLastExportUri(file.uri);
      await Storage.save('admin_last_data_export', { uri: file.uri, at: Date.now() });
      if (share && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri);
      }
      showToast('Export des données généré sur cet appareil', 'success');
    } catch (e) {
      showToast(parseError(e), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const maybeAutoExportData = async () => {
    if (!autoExportEnabled) return;
    const saved = await Storage.get('admin_auto_export_state');
    const lastRun = Number(saved?.lastRun || 0);
    const intervalMs = autoExportFrequency === 'weekly' ? 7 * 86400000 : autoExportFrequency === 'monthly' ? 30 * 86400000 : 86400000;
    if (Date.now() - lastRun < intervalMs) return;
    await downloadHospitalData(false);
    await Storage.save('admin_auto_export_state', { lastRun: Date.now(), frequency: autoExportFrequency });
  };

  const handleResetAll = async () => {
    if (resetPassword !== 'REHOBOTH_ADMIN_RESET') {
       return showToast("Code de sécurité incorrect", "error");
    }
    
    Alert.alert("ATTENTION", "Voulez-vous vraiment TOUT EFFACER ? Cette action est irréversible et supprimera tous les dossiers, visites, factures et comptes (sauf admin).", [
       { text: "ANNULER", style: "cancel" },
       { text: "OUI, TOUT RÉINITIALISER", style: "destructive", onPress: async () => {
          setIsSubmitting(true);
          try {
             const res = await api.post('/admin/data/reset-all');
             showToast(res.data.message, "success");
             setShowResetModal(false);
             setResetPassword('');
             fetchGlobalData();
          } catch (e) { showToast(parseError(e), "error"); }
          finally { setIsSubmitting(false); }
       }}
    ]);
  };

  const handleResetService = async () => {
    if (resetPassword !== 'REHOBOTH_ADMIN_RESET') {
       return showToast("Code de sécurité incorrect", "error");
    }

    Alert.alert("Confirmation", `Réinitialiser les données du service ${resetService.toUpperCase()} ? Les comptes ne seront pas supprimés.`, [
       { text: "ANNULER", style: "cancel" },
       { text: "CONFIRMER", style: "destructive", onPress: async () => {
          setIsSubmitting(true);
          try {
             const res = await api.post('/admin/data/reset-service', { service: resetService });
             showToast(res.data.message, "success");
             setShowResetModal(false);
             setResetPassword('');
             fetchGlobalData();
          } catch (e) { showToast(parseError(e), "error"); }
          finally { setIsSubmitting(false); }
       }}
    ]);
  };

  const handleRenewInsurance = async (ins) => {
    const start = new Date();
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);

    setIsSubmitting(true);
    try {
      await api.post(`/admin/insurances/${ins.id}/renew`, {
        contract_date: start.toLocaleDateString('fr-FR'),
        contract_end_date: end.toLocaleDateString('fr-FR'),
        monthly_flat_fee: ins.monthly_flat_fee,
        contract_type: ins.contract_type || 'annuel',
      });
      showToast('Contrat renouvelé pour 12 mois', 'success');
      fetchGlobalData(revenuePeriod, true);
    } catch (e) {
      showToast(parseError(e), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const parseError = (e) => {
    if (e.response?.data?.errors) {
      const errors = e.response.data.errors;
      const firstKey = Object.keys(errors)[0];
      return errors[firstKey][0]; // Retourne le premier message d'erreur de validation
    }
    return e.response?.data?.message || t.error;
  };

  const handleSaveInsurance = async () => {
    if (!newInsurance.name || !newInsurance.monthly_flat_fee) return showToast("Champs requis", "error");
    setIsSubmitting(true);

    // Nettoyage des données pour éviter d'envoyer des chaînes vides pour des champs optionnels
    const payload = {
       ...newInsurance,
       contract_date: newInsurance.contract_date || null,
       contract_end_date: newInsurance.contract_end_date || null,
       contract_type: newInsurance.contract_type || 'mensuel',
       contact_info: newInsurance.contact_info || null
    };

    try {
      if (editingInsurance) {
        await api.put(`/admin/insurances/${editingInsurance.id}`, payload);
        showToast("Assurance mise à jour avec succès", "success");
      } else {
        await api.post('/admin/insurances', payload);
        showToast("Assurance créée avec succès", "success");
      }
      setShowInsuranceModal(false);
      setEditingInsurance(null);
      setNewInsurance({ name: '', email: '', contract_date: '', contract_end_date: '', contract_type: 'mensuel', monthly_flat_fee: '', contact_info: '', status: 'active' });
      fetchGlobalData();
    } catch (e) {
      showToast(parseError(e), 'error');
    }
    finally { setIsSubmitting(false); }
  };

  const handleAddBulkRow = () => {
    setBulkCatalogItems([...bulkCatalogItems, { label: '', price: '', dosage: '' }]);
  };

  const handleSaveBulkCatalog = async () => {
    const validItems = bulkCatalogItems.filter(it => it.label && it.price);
    if (validItems.length === 0) return showToast("Aucun service valide à ajouter", "error");
    
    setIsSubmitting(true);
    try {
      const finalCategory = bulkCategory === 'Autre' ? (customCategoryName || 'Autre') : bulkCategory;
      const newItems = validItems.map(it => ({
        id: Math.random().toString(36).substr(2, 9),
        type: finalCategory,
        label: it.label,
        price: it.price,
        dosage: finalCategory === 'Produit' ? it.dosage : undefined,
        code: finalCategory === 'Examen' ? it.code : undefined,
        locked: false
      }));
      
      const updatedCatalog = [...priceCatalog, ...newItems];
      setPriceCatalog(updatedCatalog);
      
      const fiche = updatedCatalog.find(c => c.id === 'fiche_price')?.price || '0';
      const soins = updatedCatalog.find(c => c.id === 'soins_price')?.price || '0';
      const consult = updatedCatalog.find(c => c.id === 'consultation_price')?.price || '0';
      const labTests = updatedCatalog.filter(c => c.type === 'Examen').map(c => ({ code: c.code || (c.label.substring(0,4).toUpperCase().replace(/[^A-Z0-9]/g, '') + Math.random().toString(36).substr(2, 3).toUpperCase()), label: c.label, price: c.price }));
      const others = updatedCatalog.filter(c => c.id !== 'fiche_price' && c.id !== 'soins_price' && c.id !== 'consultation_price' && c.type !== 'Examen');

      await api.post('/admin/settings/bulk', {
        settings: {
          fiche_price: fiche,
          soins_price: soins,
          consultation_price: consult,
          lab_tests_catalog: labTests,
          other_prices_catalog: others
        }
      });
      
      showToast("Catalogue mis à jour", "success");
      setShowCatalogModal(false);
      setBulkCatalogItems([{ label: '', price: '', dosage: '' }]);
    } catch (e) {
      showToast("Erreur lors de la mise à jour", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCatalogItem = (globalIndex) => {
    Alert.alert("Confirmation", "Supprimer ce service du catalogue ? ", [
      { text: t.cancel, style: "cancel" },
      { text: "SUPPRIMER", style: "destructive", onPress: () => {
          const next = [...priceCatalog];
          next.splice(globalIndex, 1);
          setPriceCatalog(next);
          showToast("Élément supprimé", "info");
        }
      }
    ]);
  };

  const handleAddMember = async () => {
    if (!newMember.member_name || !newMember.membership_code) return showToast("Champs requis", "error");
    setIsSubmitting(true);
    try {
      if (editingMember) {
        await api.put(`/admin/insurances/members/${editingMember.id}`, newMember);
        showToast("Membre mis à jour", "success");
      } else {
        await api.post('/admin/insurances/members', { ...newMember, insurance_id: activeInsurance.id });
        showToast("Membre ajouté", "success");
      }
      setNewMember({ insurance_id: null, member_name: '', membership_code: '' });
      setEditingMember(null);
      fetchMembers(activeInsurance.id);
    } catch (e) { showToast(parseError(e), 'error'); }
    finally { setIsSubmitting(false); }
  };

  const handleEditMember = (member) => {
    setEditingMember(member);
    setNewMember({
      insurance_id: member.insurance_id,
      member_name: member.member_name,
      membership_code: member.membership_code
    });
  };

  const handleDeleteMember = (memberId) => {
    Alert.alert("Confirmation", "Supprimer cet adhérent de la liste ? ", [
      { text: t.cancel, style: "cancel" },
      { text: "SUPPRIMER", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/admin/insurances/members/${memberId}`);
            showToast("Adhérent supprimé", "success");
            fetchMembers(activeInsurance.id);
          } catch (e) { showToast(parseError(e), 'error'); }
        }
      }
    ]);
  };

  const fetchMembers = async (id) => {
    try {
      const res = await api.get(`/admin/insurances/${id}/members`);
      setInsuredMembers(res.data);
    } catch (e) {}
  };

  const toggleLeft = (open) => {
    setIsLeftOpen(open);
    Animated.spring(leftAnim, { toValue: open ? 0 : -width, friction: 8, tension: 40, useNativeDriver: true }).start();
  };
  const toggleRight = (open) => {
    setIsRightOpen(open);
    Animated.spring(rightAnim, { toValue: open ? 0 : width, friction: 8, tension: 40, useNativeDriver: true }).start();
  };

  const handleLogout = async () => {
    await clearAuthSession();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const toggleBottomTab = (tab) => {
    if (activeBottomTab === tab) {
      setActiveBottomTab(null);
      Animated.spring(bottomPanelAnim, { toValue: 0, friction: 8, useNativeDriver: true }).start();
      return;
    }
    setActiveBottomTab(tab);
    Animated.spring(bottomPanelAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
    if (tab === 'maladies') fetchDiseases(diseasePeriod);
    if (tab === 'stock') fetchExpiry();
    if (tab === 'caisse') fetchCash();
  };

  const fetchDiseases = async (days) => {
    setBottomLoading(true);
    try {
      const res = await api.get(`/admin/diseases?days=${days}`);
      setDiseases(res.data);
    } catch {
      setDiseases([{ name: 'Paludisme', count: 42, percentage: 38 }, { name: 'Typhoïde', count: 28, percentage: 25 }]);
    } finally { setBottomLoading(false); }
  };

  const fetchExpiry = async () => {
    setBottomLoading(true);
    try {
      const res = await api.get('/admin/stock-expiry');
      setExpiryData(res.data);
    } catch {
      setExpiryData({ expiring: [], expired: [] });
    } finally { setBottomLoading(false); }
  };

  const fetchCash = async () => {
    setBottomLoading(true);
    try {
      const res = await api.get('/admin/cash-today');
      // res.data is now { items: [], insured_count: X, ... }
      setCashData(res.data);
    } catch {
      setCashData({ items: [], patient_count: 0, insured_count: 0, private_count: 0 });
    } finally { setBottomLoading(false); }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      let catalog = [];
      let foundFiche = false, foundSoins = false, foundConsult = false;
      let rawLab = [];
      let rawOther = [];

      res.data.forEach((setting) => {
        if (setting.key === 'fiche_price') { catalog.push({ id: 'fiche_price', type: 'Dossier', label: 'Ouverture de Dossier (Fiche)', price: setting.value, locked: true }); foundFiche = true; }
        else if (setting.key === 'soins_price') { catalog.push({ id: 'soins_price', type: 'Soins', label: 'Soins Infirmiers Standard', price: setting.value, locked: true }); foundSoins = true; }
        else if (setting.key === 'consultation_price') { catalog.push({ id: 'consultation_price', type: 'Consultation', label: 'Consultation Médicale', price: setting.value, locked: true }); foundConsult = true; }
        else if (setting.key === 'lab_tests_catalog') {
           try { rawLab = JSON.parse(setting.value); } catch(e){}
        }
        else if (setting.key === 'other_prices_catalog') {
           try { rawOther = JSON.parse(setting.value); } catch(e){}
        }
      });
      
      if (!foundFiche) catalog.push({ id: 'fiche_price', type: 'Dossier', label: 'Ouverture de Dossier (Fiche)', price: '5000', locked: true });
      if (!foundSoins) catalog.push({ id: 'soins_price', type: 'Soins', label: 'Soins Infirmiers Standard', price: '3000', locked: true });
      if (!foundConsult) catalog.push({ id: 'consultation_price', type: 'Consultation', label: 'Consultation Médicale', price: '10000', locked: true });

      rawLab.forEach((lt, idx) => catalog.push({ id: `lab_${idx}`, type: 'Examen', code: lt.code, label: lt.label, price: lt.price }));
      rawOther.forEach((ot, idx) => catalog.push({ id: `other_${idx}`, type: ot.type, label: ot.label, price: ot.price, dosage: ot.dosage }));

      setPriceCatalog(catalog);
    } catch (e) {}
  };

  const handleSaveWorkflowSettings = async () => {
    setIsSubmitting(true);
    try {
      const fiche = priceCatalog.find(c => c.id === 'fiche_price')?.price || '0';
      const soins = priceCatalog.find(c => c.id === 'soins_price')?.price || '0';
      const consult = priceCatalog.find(c => c.id === 'consultation_price')?.price || '0';
      const labTests = priceCatalog.filter(c => c.type === 'Examen').map(c => ({ code: c.code || (c.label.substring(0,4).toUpperCase().replace(/[^A-Z0-9]/g, '') + Math.random().toString(36).substr(2, 3).toUpperCase()), label: c.label, price: c.price }));
      const others = priceCatalog.filter(c => c.id !== 'fiche_price' && c.id !== 'soins_price' && c.id !== 'consultation_price' && c.type !== 'Examen');

      await api.post('/admin/settings/bulk', {
        settings: {
          fiche_price: fiche,
          soins_price: soins,
          consultation_price: consult,
          lab_tests_catalog: labTests,
          other_prices_catalog: others
        },
      });

      showToast("Catalogue mis à jour", "success");
      fetchSettings();
    } catch (e) { showToast(parseError(e), 'error'); }
    finally { setIsSubmitting(false); }
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) return showToast("Champs requis", "error");
    if (newUser.password !== newUser.confirmPassword) return showToast("Les mots de passe ne correspondent pas", "error");
    
    if (newUser.phone && !isValidPhone(newUser.phone)) {
      return showToast("Numéro de téléphone invalide (Orange, Airtel, Vodacom, Africell requis)", "error");
    }
    
    setIsSubmitting(true);
    try {
      const payload = { ...newUser };
      delete payload.confirmPassword;
      
      await api.post('/admin/users', payload);
      showToast(`${t.success}: ${newUser.name}`, 'success');
      setShowUserModal(false);
      setNewUser({ name: '', postname: '', phone: '', email: '', role: 'reception', password: '', confirmPassword: '', specialty: '' });
      fetchGlobalData();
    } catch (e) { 
      showToast(parseError(e), 'error'); 
    }
    finally { setIsSubmitting(false); }
  };

  const setupEditUser = (user) => {
    setEditingUser({ ...user });
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser.name || !editingUser.email) return showToast("Champs requis", "error");
    if (editingUser.phone && !isValidPhone(editingUser.phone)) {
      return showToast("Numéro de téléphone invalide", "error");
    }
    setIsSubmitting(true);
    try {
      await api.put(`/admin/users/${editingUser.id}`, editingUser);
      showToast("Mis à jour", "success");
      setShowEditModal(false);
      fetchGlobalData();
    } catch (e) { showToast(parseError(e), 'error'); }
    finally { setIsSubmitting(false); }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordVal || resetPasswordVal.length < 6) return showToast("Mot de passe trop court", "error");
    setIsResetting(true);
    try {
      await api.post(`/admin/users/${editingUser.id}/reset-password`, { password: resetPasswordVal });
      showToast("Mot de passe réinitialisé", "success");
      setShowResetSection(false);
      setResetPasswordVal('');
    } catch (e) { showToast(parseError(e), 'error'); }
    finally { setIsResetting(false); }
  };

  const handleDeleteUser = (userId) => {
    Alert.alert("Confirmation", "Supprimer cet utilisateur ? ", [
      { text: t.cancel, style: "cancel" },
      { text: "SUPPRIMER", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/admin/users/${userId}`);
            showToast("Supprimé", "success");
            setShowEditModal(false);
            fetchGlobalData();
          } catch (e) { showToast(parseError(e), 'error'); }
        }
      }
    ]);
  };

  const handleDeleteInsurance = (id) => {
    Alert.alert("Confirmation", "Supprimer ce contrat d'assurance ? ", [
      { text: t.cancel, style: "cancel" },
      { text: "SUPPRIMER", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/admin/insurances/${id}`);
            showToast("Contrat supprimé", "success");
            fetchGlobalData();
          } catch (e) { showToast(t.error, 'error'); }
        }
      }
    ]);
  };

  const handleBroadcast = async () => {
    if (!broadcast.subject || !broadcast.message) return showToast("Objet et message requis", "error");
    setIsSubmitting(true);
    try {
      if (broadcast.id) {
         await api.put(`/admin/messages/${broadcast.id}`, {
            ...broadcast,
            target_role: broadcast.target_role || null,
         });
         showToast("Message modifié", "success");
      } else {
         await api.post('/admin/broadcast', {
            ...broadcast,
            target_role: broadcast.target_role || null,
         });
         showToast("Message envoyé", "success");
      }
      setBroadcast({ subject: '', message: '', target_role: '', priority: 'normal' });
      fetchGlobalData(revenuePeriod, true);
    } catch (e) { showToast(t.error, 'error'); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteMessage = (messageId) => {
    Alert.alert(
      'Supprimer le message',
      'Retirer ce message de la liste ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'SUPPRIMER',
          style: 'destructive',
          onPress: async () => {
            const previousMessages = messages;
            setMessages((current) => current.filter((msg) => msg.id !== messageId));
            try {
              await api.delete(`/messages/${messageId}`);
              showToast('Message supprimé', 'success');
            } catch (e) {
              setMessages(previousMessages);
              showToast('Impossible de supprimer ce message', 'error');
            }
          },
        },
      ]
    );
  };


  const renderMetric = (label, value, icon, color, delay) => (
    <FadeInView delay={delay} style={{ width: '31%', marginBottom: 14 }}>
       <View style={[{ borderRadius: 24, borderWidth: 1.5, overflow: 'hidden', elevation: 6, shadowColor: color, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12 }, { backgroundColor: C.surface, borderColor: C.border }]}>
          <LinearGradient colors={[color + '18', color + '05']} start={{x:0,y:0}} end={{x:1,y:1}} style={{ padding: 16, alignItems: 'center' }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: color + '20', marginBottom: 10 }}>
              <MaterialCommunityIcons name={icon} size={22} color={color} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '900', color: C.text }}>{value}</Text>
            <Text style={{ fontSize: 8, fontWeight: '900', textAlign: 'center', marginTop: 4, color: color, letterSpacing: 0.8 }}>{label.toUpperCase()}</Text>
          </LinearGradient>
       </View>
    </FadeInView>
  );

  const adminMenu = [
    { id: 'dashboard', icon: 'view-dashboard', label: t.navDashboard, sub: t.navDashboardSub }, 
    { id: 'users', icon: 'account-group', label: t.adminPersonnel, sub: t.navPersonnelSub }, 
    { id: 'patients', icon: 'folder', label: t.navPatients, sub: t.navPatientsSub }, 
    { id: 'data', icon: 'database-cog', label: 'Données', sub: 'Archives patients' },
    { id: 'insurances', icon: 'shield-account', label: t.adminInsurances, sub: 'Contrats actifs' }, 
    { id: 'comm', icon: 'email-fast', label: t.navMessaging, sub: t.navMessagingSub }, 
    { id: 'stats', icon: 'chart-bar', label: t.adminAnalytics, sub: t.navStatsSub }, 
    { id: 'pricing', icon: 'cash-multiple', label: t.adminPricing, sub: 'Tarificateur' }
  ];

  return (
    <View style={[styles.mainContainer, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={C.bg} />
      <PremiumHeader 
        onLeftPress={() => toggleLeft(true)}
        onRightPress={() => toggleRight(true)}
        title="REHOBOTH"
        subtitle=""
        isDark={isDark}
        navigation={navigation}
      />

      <FloatingActionDock
        title={activeView === 'dashboard' ? 'Administration' : adminMenu.find(m => m.id === activeView)?.label}
        searchValue={activeView === 'patients' ? patientSearch : activeView === 'pricing' ? catalogSearch : activeView === 'insurances' ? insuranceSearch : undefined}
        onSearchChange={activeView === 'patients' ? setPatientSearch : activeView === 'pricing' ? setCatalogSearch : activeView === 'insurances' ? setInsuranceSearch : undefined}
        searchPlaceholder={t.search}
        actions={[
          activeView !== 'dashboard' && { key: 'back-dashboard', icon: 'arrow-back', onPress: () => { setActiveView('dashboard'); if (activeBottomTab) toggleBottomTab(activeBottomTab); } },
          activeView === 'users' && { key: 'add-user', icon: 'person-add', onPress: () => setShowUserModal(true), active: true },
          activeView === 'insurances' && { key: 'add-insurance', icon: 'add-business', onPress: () => { setEditingInsurance(null); setShowInsuranceModal(true); }, active: true },
          activeView === 'pricing' && { key: 'add-catalog', icon: 'playlist-add', onPress: () => setShowCatalogModal(true), active: true },
          { key: 'refresh', icon: 'refresh', onPress: () => { fetchGlobalData(revenuePeriod); fetchSettings(); } },
        ]}
      />

      <ScrollView contentContainerStyle={{ paddingTop: 125 + insets.top, paddingBottom: 160 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
           {activeView === 'profile' && (
              <FadeInView>
                 <ProfileView onBack={() => setActiveView('dashboard')} />
              </FadeInView>
           )}

           {activeView === 'dashboard' && (
              <FadeInView>
                     <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderRadius: 20, padding: 5, marginBottom: 20, borderWidth: 1, borderColor: C.divider, elevation: 2 }}>
                     {[
                        { id: 'day', label: 'Journalier' },
                        { id: 'week', label: 'Hebdomadaire' },
                        { id: 'month', label: 'Mensuel' }
                     ].map(p => (
                        <TouchableOpacity 
                           key={p.id} 
                           onPress={() => { setRevenuePeriod(p.id); fetchGlobalData(p.id); }}
                           style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 16, backgroundColor: revenuePeriod === p.id ? brandColor : 'transparent' }}
                        >
                           <Text style={{ fontSize: 10, fontWeight: '900', color: revenuePeriod === p.id ? '#FFF' : C.sub }}>{p.label.toUpperCase()}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>

                 <View style={styles.heroSummary}>
                    <LinearGradient colors={Theme.colors.brandGradient} style={styles.heroBox}>
                        <View style={{ flex: 1 }}>
                           <View style={{ marginBottom: 5 }}>
                              <Text style={styles.heroLabel}>
                                 {revenuePeriod === 'day' ? "CHIFFRE D'AFFAIRES JOUR" : revenuePeriod === "week" ? "CHIFFRE D'AFFAIRES SEMAINE" : "CHIFFRE D'AFFAIRES MOIS"}
                              </Text>
                           </View>
                           <TouchableOpacity onPress={() => setShowRevenueModal(true)}>
                              <Text style={styles.heroValue}>{(stats?.revenue_period || 0).toLocaleString()} FC</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                 <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700' }}>VOIR LE DÉTAIL DES REVENUS</Text>
                                 <MaterialIcons name="chevron-right" size={14} color="rgba(255,255,255,0.7)" />
                              </View>
                           </TouchableOpacity>
                        </View>
                        <MaterialCommunityIcons name="finance" size={42} color="rgba(255,255,255,0.15)" style={{ marginLeft: 10 }} />
                    </LinearGradient>
                 </View>
                 <View style={styles.metricsGrid}>
                     {renderMetric("Patients", stats?.total_patients_period || 0, "account-group", "#3182CE", 0)}
                     {renderMetric("Visites", stats?.total_visits_period || 0, "clipboard-pulse", "#D69E2E", 100)}
                     {renderMetric("Labo", stats?.lab_period_count || 0, "flask", "#805AD5", 200)}
                  </View>

                  <View style={{ marginTop: 25 }}>
                     <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 }}>
                        <Text style={{ fontSize: 12, fontWeight: '900', color: C.sub, letterSpacing: 1 }}>RÉPARTITION DES REVENUS</Text>
                        <MaterialCommunityIcons name="chart-pie" size={18} color={brandColor} />
                     </View>
                     <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                     {asArray(stats?.revenue_by_service).map((rev, i) => (
                           <FadeInView key={i} delay={i * 100}>
                              <View style={{ width: 140, padding: 16, borderRadius: 24, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, marginRight: 15, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 }}>
                                 <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: brandColor + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                    <MaterialCommunityIcons name={rev.service.toLowerCase().includes('labo') ? 'flask' : rev.service.toLowerCase().includes('pharmacie') ? 'pill' : rev.service.toLowerCase().includes('soins') ? 'medical-bag' : rev.service.toLowerCase().includes('matern') ? 'mother-heart' : 'cash-register'} size={18} color={brandColor} />
                                 </View>
                                 <Text style={{ color: C.sub, fontSize: 10, fontWeight: '800', marginBottom: 4 }} numberOfLines={1}>{rev.service.toUpperCase()}</Text>
                                 <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{rev.total.toLocaleString()} FC</Text>
                              </View>
                           </FadeInView>
                        ))}
                        {(!stats?.revenue_by_service || stats.revenue_by_service.length === 0) && (
                           <Text style={{ color: C.sub, fontStyle: 'italic', marginVertical: 20, marginLeft: 5 }}>Aucun revenu enregistré.</Text>
                        )}
                     </ScrollView>
                  </View>
              </FadeInView>
           )}

           {activeView === 'users' && (
              <FadeInView>
                 <View style={styles.rowBetween}>
                    <Text style={[styles.vTitle, { color: C.text }]}>PERSONNEL</Text>
                    <TouchableOpacity style={styles.addBtn} onPress={() => setShowUserModal(true)}>
                       <MaterialIcons name="add" size={18} color="#FFF" />
                       <Text style={styles.addBtnT}>AJOUTER</Text>
                    </TouchableOpacity>
                 </View>

                 {users.map((u, i) => (
                    <View key={u.id} style={[styles.userCardPremium, { backgroundColor: C.surface, borderColor: C.border }]}>
                       <LinearGradient colors={Theme.colors.brandGradient} style={styles.uAvatarPrem}>
                          <Text style={styles.uInitials}>{u.name?.[0]}</Text>
                       </LinearGradient>
                       <View style={{ flex: 1, marginLeft: 16 }}>
                          <Text style={[styles.uName, { color: C.text }]}>{u.name}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 4 }}>
                             <View style={{ backgroundColor: brandColor + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 4 }}>
                                <Text style={{ color: brandColor, fontSize: 8, fontWeight: '900' }}>{u.role.toUpperCase()}</Text>
                             </View>
                             {u.role === 'medecin' && u.specialty ? (
                                <View style={{ backgroundColor: '#10B98118', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 4 }}>
                                   <Text style={{ color: '#10B981', fontSize: 8, fontWeight: '900' }}>{u.specialty.toUpperCase()}</Text>
                                </View>
                             ) : null}
                             <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 4 }} />
                             <Text style={{ color: C.sub, fontSize: 9, fontWeight: '700' }}>ACTIF</Text>
                          </View>
                       </View>
                       <View style={styles.uActions}>
                          <TouchableOpacity onPress={() => setupEditUser(u)} style={styles.uActionBtn}><MaterialIcons name="edit" size={18} color={brandColor} /></TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteUser(u.id)} style={[styles.uActionBtn, { marginLeft: 8 }]}><MaterialIcons name="delete-outline" size={20} color={C.danger} /></TouchableOpacity>
                       </View>
                    </View>
                 ))}
              </FadeInView>
           )}

           {activeView === 'patients' && (
              <FadeInView>
                 <View style={styles.rowBetween}>
                    <Text style={[styles.vTitle, { color: C.text }]}>BASE PATIENTS</Text>
                    <View style={{ backgroundColor: brandColor + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                       <Text style={{ color: brandColor, fontSize: 10, fontWeight: '900' }}>{patients.length} DOSSIERS</Text>
                    </View>
                 </View>
                 
                 <View style={[styles.searchBox, { backgroundColor: C.surface, borderColor: C.border, marginTop: 10, marginBottom: 20 }]}>
                    <MaterialIcons name="search" size={22} color={brandColor} />
                    <TextInput 
                       placeholder="Chercher par nom ou numéro..." 
                       placeholderTextColor={C.sub} 
                       style={[styles.searchInput, { color: C.text }]} 
                       value={patientSearch} 
                       onChangeText={v => { setPatientSearch(v); if(v) setSelectedMonthFolder(null); }} 
                    />
                 </View>

                 {patientSearch ? (
                    patients.filter(p => `${p.first_name} ${p.last_name} ${p.id}`.toLowerCase().includes(patientSearch.toLowerCase())).map((p, i) => (
                       <TouchableOpacity key={p.id} style={[styles.pCardPremium, { backgroundColor: C.surface, borderColor: C.border, padding: 16 }]}>
                          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.divider, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                             <MaterialCommunityIcons name="information-outline" size={24} color={brandColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                             <Text style={[styles.pName, { color: C.text }]}>{p.first_name} {p.last_name}</Text>
                           <Text style={{ color: C.sub, fontSize: 10, fontWeight: '700', marginTop: 2 }}>ID: {safePadId(p.id)} • {p.pathology || "Pas de pathologie"}</Text>
                          </View>
                          <MaterialIcons name="chevron-right" size={24} color={C.sub} />
                       </TouchableOpacity>
                    ))
                 ) : !selectedMonthFolder ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15 }}>
                       {Object.entries(
                          patients.reduce((acc, p) => {
                             const month = new Date(p.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                             if (!acc[month]) acc[month] = [];
                             acc[month].push(p);
                             return acc;
                          }, {})
                       ).sort((a, b) => new Date(b[1][0].created_at) - new Date(a[1][0].created_at)).map(([month, monthPatients]) => (
                          <TouchableOpacity 
                             key={month}
                             onPress={() => setSelectedMonthFolder({ month, patients: monthPatients })}
                             style={styles.folderContainer}
                          >
                             <MaterialCommunityIcons name="folder" size={48} color={brandColor} style={{ opacity: 0.8 }} />
                             <Text style={{ color: C.text, fontWeight: '900', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{month.toUpperCase()}</Text>
                             <View style={{ backgroundColor: C.brandLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 8 }}>
                                <Text style={{ color: brandColor, fontSize: 10, fontWeight: '900' }}>{monthPatients.length} PATIENTS</Text>
                             </View>
                          </TouchableOpacity>
                       ))}
                    </View>
                 ) : (
                    <View>
                       <TouchableOpacity 
                          onPress={() => setSelectedMonthFolder(null)}
                          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: C.divider, padding: 12, borderRadius: 15, alignSelf: 'flex-start' }}
                       >
                          <MaterialIcons name="arrow-back" size={20} color={C.text} />
                          <Text style={{ marginLeft: 8, fontWeight: '900', color: C.text, fontSize: 12 }}>RETOUR AUX DOSSIERS</Text>
                       </TouchableOpacity>

                       <View style={{ backgroundColor: brandColor, padding: 20, borderRadius: 28, marginBottom: 20, elevation: 6 }}>
                          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>DOSSIER MENSUEL</Text>
                          <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 4 }}>{selectedMonthFolder.month.toUpperCase()}</Text>
                       </View>

                       {selectedMonthFolder.patients.map((p, i) => (
                          <TouchableOpacity key={p.id} onPress={() => fetchTimeline(p.id)} style={[styles.pCardPremium, { backgroundColor: C.surface, borderColor: C.border, padding: 16 }]}>
                             <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.divider, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                                <MaterialCommunityIcons name="account-details" size={24} color={brandColor} />
                             </View>
                             <View style={{ flex: 1 }}>
                                <Text style={[styles.pName, { color: C.text }]}>{p.first_name} {p.last_name}</Text>
                                <Text style={{ color: C.sub, fontSize: 10, fontWeight: '700', marginTop: 2 }}>{p.pathology || "Pas de pathologie"}</Text>
                             </View>
                             <View style={{ backgroundColor: p.is_insured ? brandColor + '15' : '#22C55E15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                <Text style={{ color: p.is_insured ? brandColor : '#22C55E', fontSize: 8, fontWeight: '900' }}>
                                   {p.is_insured ? 'ASSURÉ' : 'PRIVÉ'}
                                </Text>
                             </View>
                          </TouchableOpacity>
                       ))}
                    </View>
                 )}
              </FadeInView>
           )}

           {activeView === 'data' && (
               <FadeInView>
                  <View style={styles.rowBetween}>
                     <View>
                        <Text style={[styles.vTitle, { color: C.text }]}>DONNÉES HÔPITAL</Text>
                        <Text style={{ color: C.sub, fontSize: 10, fontWeight: '800' }}>Archives classées par année de naissance</Text>
                     </View>
                     <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                           onPress={() => setShowResetModal(true)}
                           style={{ backgroundColor: '#EF444415', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#EF444430' }}
                        >
                           <MaterialCommunityIcons name="database-remove" size={18} color="#EF4444" />
                           <Text style={{ color: '#EF4444', fontWeight: '900', fontSize: 10, marginLeft: 6 }}>RESET</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => downloadHospitalData(true)}
                          disabled={isSubmitting}
                          style={{ backgroundColor: brandColor, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', opacity: isSubmitting ? 0.6 : 1 }}
                        >
                           <MaterialCommunityIcons name="download" size={18} color="#FFF" />
                           <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 10, marginLeft: 6 }}>EXPORTER</Text>
                        </TouchableOpacity>
                     </View>
                  </View>

                  {!selectedYearFolder ? (
                    <View>
                       <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 20 }}>
                          <View style={[styles.searchBox, { flex: 1, backgroundColor: C.surface, borderColor: C.border, marginBottom: 0 }]}>
                             <MaterialIcons name="search" size={20} color={brandColor} />
                             <TextInput placeholder="Nom, code, téléphone..." placeholderTextColor={C.sub} style={[styles.searchInput, { color: C.text }]} value={dataSearch} onChangeText={setDataSearch} />
                          </View>
                       </View>

                       <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15 }}>
                          {Object.entries(
                            asArray(dataRecords).reduce((acc, p) => {
                              const year = p.birth_year || 'Sans année';
                              if (!acc[year]) acc[year] = [];
                              acc[year].push(p);
                              return acc;
                            }, {})
                          ).sort((a, b) => {
                             if (a[0] === 'Sans année') return 1;
                             if (b[0] === 'Sans année') return -1;
                             return Number(b[0]) - Number(a[0]);
                          }).map(([year, records]) => (
                             <TouchableOpacity 
                                key={year}
                                onPress={() => setSelectedYearFolder({ year, records })}
                                style={styles.folderContainer}
                             >
                                <MaterialCommunityIcons name="folder-account" size={48} color={brandColor} style={{ opacity: 0.8 }} />
                                <Text style={{ color: C.text, fontWeight: '900', fontSize: 13, marginTop: 12, textAlign: 'center' }}>ANNÉE {year}</Text>
                                <View style={{ backgroundColor: C.brandLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 8 }}>
                                   <Text style={{ color: brandColor, fontSize: 10, fontWeight: '900' }}>{records.length} DOSSIERS</Text>
                                </View>
                             </TouchableOpacity>
                          ))}
                       </View>
                    </View>
                  ) : (
                    <View>
                        <TouchableOpacity 
                           onPress={() => setSelectedYearFolder(null)}
                           style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: C.divider, padding: 12, borderRadius: 15, alignSelf: 'flex-start', marginTop: 10 }}
                        >
                           <MaterialIcons name="arrow-back" size={20} color={C.text} />
                           <Text style={{ marginLeft: 8, fontWeight: '900', color: C.text, fontSize: 11 }}>RETOUR AUX ANNÉES</Text>
                        </TouchableOpacity>

                        <View style={{ backgroundColor: brandColor, padding: 24, borderRadius: 28, marginBottom: 20, elevation: 6 }}>
                           <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>DOSSIER ANNUEL</Text>
                           <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 4 }}>NAISSANCE {selectedYearFolder.year}</Text>
                        </View>

                        {selectedYearFolder.records.map(p => (
                          <PressableScale key={p.id} onPress={() => fetchTimeline(p.id)} style={[styles.pCardPremium, { backgroundColor: C.surface, borderColor: C.border, padding: 16 }]}>
                             <View style={{ flex: 1 }}>
                                <Text style={[styles.pName, { color: C.text }]}>{p.first_name} {p.last_name} {p.post_name || ''}</Text>
                                <Text style={{ color: C.sub, fontSize: 10, fontWeight: '700', marginTop: 3 }}>ID {safePadId(p.id)} • {p.pathology || 'Pas de pathologie'} • {p.is_insured ? (p.insurance?.name || 'Assuré') : 'Privé'}</Text>
                             </View>
                             <TouchableOpacity onPress={() => setEditingPatient({ ...p })} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: brandColor + '12', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                <MaterialIcons name="edit" size={20} color={brandColor} />
                             </TouchableOpacity>
                             <TouchableOpacity onPress={() => handleDeletePatient(p)} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#EF444412', alignItems: 'center', justifyContent: 'center' }}>
                                <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                             </TouchableOpacity>
                          </PressableScale>
                        ))}
                    </View>
                  )}
                  
                  <View style={{ marginTop: 30, padding: 20, backgroundColor: C.surface, borderRadius: 28, borderWidth: 1, borderColor: C.border }}>
                     <Text style={{ color: C.text, fontWeight: '900', fontSize: 14, marginBottom: 15 }}>PARAMÈTRES D'EXPORTATION</Text>
                     <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <View>
                           <Text style={{ color: C.text, fontWeight: '800', fontSize: 12 }}>Téléchargement automatique</Text>
                           <Text style={{ color: C.sub, fontWeight: '700', fontSize: 10 }}>Génère un backup local périodiquement</Text>
                        </View>
                        <Switch value={autoExportEnabled} onValueChange={setAutoExportEnabled} trackColor={{ true: brandColor }} />
                     </View>
                     <View style={{ flexDirection: 'row', gap: 8 }}>
                        {[
                          { id: 'daily', label: 'JOUR' },
                          { id: 'weekly', label: 'SEMAINE' },
                          { id: 'monthly', label: 'MOIS' },
                        ].map(freq => (
                          <TouchableOpacity
                            key={freq.id}
                            onPress={() => setAutoExportFrequency(freq.id)}
                            style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: autoExportFrequency === freq.id ? brandColor : C.bg, borderWidth: 1, borderColor: autoExportFrequency === freq.id ? brandColor : C.border }}
                          >
                            <Text style={{ color: autoExportFrequency === freq.id ? '#FFF' : C.sub, fontSize: 9, fontWeight: '900' }}>{freq.label}</Text>
                          </TouchableOpacity>
                        ))}
                     </View>
                  </View>
               </FadeInView>
            )}

           {/* MESSAGING VIEW */}
            {activeView === 'comm' && (
               <FadeInView>
                  <Text style={[styles.vTitle, { color: C.text }]}>BROADCAST & EMAILS</Text>
                  
                   <View style={[styles.premiumCard, { backgroundColor: C.surface, borderColor: C.border, marginTop: 16, elevation: 6, borderRadius: 28, overflow: 'hidden', borderWidth: 1 }]}>
                     <LinearGradient colors={Theme.colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                           <MaterialCommunityIcons name={broadcast.id ? "edit" : "email-fast-outline"} size={32} color="#FFF" />
                           <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900', marginLeft: 15 }}>{broadcast.id ? "MODIFIER LE MESSAGE" : "DIFFUSION GÉNÉRALE"}</Text>
                        </View>
                        {broadcast.id && (
                           <TouchableOpacity onPress={() => setBroadcast({ subject: '', message: '', target_role: '', priority: 'normal' })}>
                              <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900' }}>ANNULER</Text>
                           </TouchableOpacity>
                        )}
                     </LinearGradient>
                     <View style={{ padding: 20 }}>
                        <Text style={{ fontSize: 10, fontWeight: '900', color: C.sub, marginBottom: 8 }}>OBJET</Text>
                        <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} placeholder="Objet du message..." placeholderTextColor={C.placeholder} value={broadcast.subject} onChangeText={v => setBroadcast({...broadcast, subject: v})} />
                        <Text style={{ fontSize: 10, fontWeight: '900', color: C.sub, marginBottom: 8 }}>MESSAGE</Text>
                        <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input, height: 120, textAlignVertical: 'top', paddingTop: 15 }]} multiline placeholder="Contenu du broadcast..." placeholderTextColor={C.placeholder} value={broadcast.message} onChangeText={v => setBroadcast({...broadcast, message: v})} />
                        <Text style={{ fontSize: 10, fontWeight: '900', color: C.sub, marginBottom: 8 }}>DESTINATAIRES</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                           {[
                              { id: '', label: 'Tous' },
                              { id: 'reception', label: 'Réception' },
                              { id: 'caisse', label: 'Caisse' },
                              { id: 'medecin', label: 'Médecins' },
                              { id: 'labo', label: 'Labo' },
                              { id: 'soins', label: 'Soins' },
                              { id: 'pharmacie', label: 'Pharmacie' },
                              { id: 'maternite', label: 'Maternité' },
                              { id: 'admin', label: 'Admin' },
                           ].map(role => {
                              const selected = broadcast.target_role === role.id;
                              return (
                                 <TouchableOpacity
                                    key={role.label}
                                    onPress={() => setBroadcast({...broadcast, target_role: role.id})}
                                    style={{ paddingHorizontal: 12, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: selected ? brandColor : C.input, borderWidth: 1, borderColor: selected ? brandColor : C.border }}
                                 >
                                    <Text style={{ color: selected ? '#FFF' : C.sub, fontSize: 10, fontWeight: '900' }}>{role.label.toUpperCase()}</Text>
                                 </TouchableOpacity>
                              );
                           })}
                        </ScrollView>
                        <Text style={{ fontSize: 10, fontWeight: '900', color: C.sub, marginBottom: 8 }}>PRIORITÉ</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                           {[
                              { id: 'normal', label: 'Info', color: brandColor },
                              { id: 'important', label: 'Important', color: '#F59E0B' },
                              { id: 'urgent', label: 'Urgent', color: '#EF4444' },
                           ].map(priority => {
                              const selected = broadcast.priority === priority.id;
                              return (
                                 <TouchableOpacity
                                    key={priority.id}
                                    onPress={() => setBroadcast({...broadcast, priority: priority.id})}
                                    style={{ flex: 1, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? priority.color : C.input, borderWidth: 1, borderColor: selected ? priority.color : C.border }}
                                 >
                                    <Text style={{ color: selected ? '#FFF' : priority.color, fontSize: 10, fontWeight: '900' }}>{priority.label.toUpperCase()}</Text>
                                 </TouchableOpacity>
                              );
                           })}
                        </View>
                        <TouchableOpacity style={{ marginTop: 10 }} onPress={handleBroadcast} disabled={isSubmitting}>
                           <LinearGradient colors={Theme.colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                              <MaterialIcons name={broadcast.id ? "save" : "send"} size={20} color="#FFF" />
                              <Text style={{ color: '#FFF', fontWeight: '900', marginLeft: 10 }}>{broadcast.id ? "METTRE À JOUR" : t.adminBroadcastSend}</Text>
                           </LinearGradient>
                        </TouchableOpacity>
                      </View>
                   </View>

                   <View style={[styles.premiumCard, { backgroundColor: C.surface, borderColor: C.border, marginTop: 18, padding: 18 }]}>
                      <View style={styles.rowBetween}>
                         <Text style={[styles.vTitle, { color: C.text, fontSize: 18 }]}>MESSAGES REÇUS</Text>
                         <TouchableOpacity onPress={fetchGlobalData}>
                            <MaterialCommunityIcons name="information-outline" size={22} color={brandColor} />
                         </TouchableOpacity>
                      </View>

                      {messages.length > 0 ? messages.map((m, i) => (
                         <View key={m.id || i} style={{ paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.border }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                               <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: brandColor + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                  <MaterialCommunityIcons name="email-outline" size={19} color={brandColor} />
                               </View>
                               <View style={{ flex: 1 }}>
                                  <Text style={{ color: C.text, fontWeight: '900', fontSize: 14 }}>{m.subject || 'Sans objet'}</Text>
                                  <Text style={{ color: brandColor, fontWeight: '800', fontSize: 9, marginTop: 2 }}>{m.sender?.name || 'Administration'}</Text>
                               </View>
                               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={{ color: C.sub, fontWeight: '700', fontSize: 10 }}>
                                     {new Date(m.created_at || Date.now()).toLocaleDateString()}
                                  </Text>
                                  {m.is_sender && (
                                     <TouchableOpacity onPress={() => {
                                        setBroadcast({ id: m.id, subject: m.subject, message: m.message, target_role: m.target_role || '', priority: m.priority || 'normal' });
                                     }} style={{ padding: 6, backgroundColor: brandColor + '15', borderRadius: 8 }}>
                                        <MaterialIcons name="edit" size={14} color={brandColor} />
                                     </TouchableOpacity>
                                  )}
                                  <TouchableOpacity
                                     onPress={() => handleDeleteMessage(m.id)}
                                     style={{ padding: 6, backgroundColor: '#EF444420', borderRadius: 8 }}
                                     hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  >
                                     <MaterialCommunityIcons name="trash-can-outline" size={15} color="#EF4444" />
                                  </TouchableOpacity>
                               </View>
                            </View>
                            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                               <Text style={{ color: m.priority === 'urgent' ? '#EF4444' : (m.priority === 'important' ? '#F59E0B' : brandColor), fontSize: 8, fontWeight: '900', marginRight: 10 }}>
                                  {(m.priority || 'normal').toUpperCase()}
                               </Text>
                               <Text style={{ color: C.sub, fontSize: 8, fontWeight: '900' }}>
                                  {m.target_role ? m.target_role.toUpperCase() : 'TOUS LES SERVICES'}
                               </Text>
                            </View>
                            <Text style={{ color: C.sub, fontSize: 13, lineHeight: 19 }}>{m.message}</Text>
                         </View>
                      )) : (
                         <View style={{ alignItems: 'center', paddingVertical: 35 }}>
                            <MaterialCommunityIcons name="email-open-outline" size={48} color={C.sub} />
                            <Text style={{ color: C.sub, marginTop: 12, fontWeight: '800' }}>Aucun message reçu pour le moment.</Text>
                         </View>
                      )}
                   </View>
                </FadeInView>
             )}

            {/* STATS VIEW */}
            {activeView === 'stats' && (
               <FadeInView style={{ flex: 1 }}>
                  <View style={styles.rowBetween}>
                     <Text style={[styles.vTitle, { color: C.text, marginBottom: 0 }]}>BILAN & ANALYTIQUE</Text>
                     <TouchableOpacity onPress={() => fetchGlobalData()} style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: brandColor + '10', alignItems: 'center', justifyContent: 'center' }}>
                        <MaterialIcons name="refresh" size={24} color={brandColor} />
                     </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false}>

                  {/* MAIN PERFORMANCE CARD */}
                  <LinearGradient colors={['#1A1A1A', '#0A0A0A']} style={{ borderRadius: 32, padding: 24, marginBottom: 25, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 }}>
                     <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <View>
                           <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>INDEX DE PERFORMANCE GLOBALE</Text>
                           <Text style={{ color: '#FFF', fontSize: 28, fontWeight: '900', marginTop: 5 }}>94.2%</Text>
                        </View>
                        <View style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 4, borderColor: '#22C55E', alignItems: 'center', justifyContent: 'center' }}>
                           <Text style={{ color: '#22C55E', fontWeight: '900', fontSize: 14 }}>A+</Text>
                        </View>
                     </View>
                     <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{ width: '94%', height: '100%', backgroundColor: '#22C55E' }} />
                     </View>
                     <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, marginTop: 8, fontWeight: '700' }}>BASÉ SUR LE FLUX DE PATIENTS ET LES REVENUS DU MOIS</Text>
                  </LinearGradient>

                  {/* SERVICE DISTRIBUTION */}
                  <Text style={{ fontSize: 16, fontWeight: '900', color: C.text, marginBottom: 15, marginLeft: 5 }}>RÉPARTITION DU FLUX ACTUEL</Text>
                  <View style={{ backgroundColor: C.surface, borderRadius: 28, padding: 20, borderWidth: 1, borderColor: C.border, marginBottom: 25 }}>
                     {stats?.visits_by_service?.length > 0 ? stats.visits_by_service.map((s, idx) => (
                        <View key={idx} style={{ marginBottom: 15 }}>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                              <Text style={{ color: C.text, fontWeight: '800', fontSize: 13 }}>{s.current_service.toUpperCase()}</Text>
                              <Text style={{ color: brandColor, fontWeight: '900', fontSize: 13 }}>{s.count} patients</Text>
                           </View>
                           <View style={{ height: 6, backgroundColor: C.divider, borderRadius: 3, overflow: 'hidden' }}>
                              <View style={{ width: `${Math.min((s.count / 20) * 100, 100)}%`, height: '100%', backgroundColor: brandColor }} />
                           </View>
                        </View>
                     )) : (
                        <Text style={{ color: C.sub, textAlign: 'center', fontStyle: 'italic' }}>Aucune donnée de flux en direct.</Text>
                     )}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 15, marginBottom: 25 }}>
                     {/* TOP INSURANCES */}
                     <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: 28, padding: 20, borderWidth: 1, borderColor: C.border }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: C.text, marginBottom: 15 }}>TOP ASSURANCES</Text>
                        {asArray(stats?.top_insurances).map((ins, i) => (
                           <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ['#3B82F6', '#8B5CF6', '#EC4899'][i] || brandColor, marginRight: 10 }} />
                              <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>{ins.insurance_company}</Text>
                              <Text style={{ color: C.text, fontSize: 12, fontWeight: '900' }}>{ins.count}</Text>
                           </View>
                        ))}
                     </View>

                     {/* CRITICAL ALERTS */}
                     <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: 28, padding: 20, borderWidth: 1, borderColor: C.border }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: C.danger, marginBottom: 15 }}>ALERTES CRITIQUES</Text>
                        {(stats?.low_stock_medicines?.length || 0) > 0 ? (
                           <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={C.danger} />
                              <View style={{ marginLeft: 10 }}>
                                 <Text style={{ color: C.text, fontWeight: '900', fontSize: 14 }}>{stats.low_stock_medicines.length}</Text>
                                 <Text style={{ color: C.sub, fontSize: 9, fontWeight: '700' }}>STOCK FAIBLE</Text>
                              </View>
                           </View>
                        ) : (
                           <View style={{ flexDirection: 'row', alignItems: 'center', opacity: 0.5 }}>
                              <MaterialCommunityIcons name="check-circle-outline" size={20} color="#22C55E" />
                              <Text style={{ color: '#22C55E', fontWeight: '900', fontSize: 10, marginLeft: 8 }}>STOCK STABLE</Text>
                           </View>
                        )}
                        <View style={{ height: 1, backgroundColor: C.border, marginVertical: 12 }} />
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                           <MaterialCommunityIcons name="information-outline" size={20} color="#F59E0B" />
                           <View style={{ marginLeft: 10 }}>
                              <Text style={{ color: C.text, fontWeight: '900', fontSize: 14 }}>0</Text>
                              <Text style={{ color: C.sub, fontSize: 9, fontWeight: '700' }}>URGENCES ATTENTE</Text>
                           </View>
                        </View>
                     </View>
                  </View>

                  <Text style={{ fontSize: 16, fontWeight: '900', color: C.text, marginBottom: 15, marginLeft: 5 }}>BILAN ET RENDEMENT DES SERVICES</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingBottom: 10 }}>
                     {[
                        { name: 'Caisse', status: 'Stable', icon: 'cash-check', col: '#38A169', rate: '98%', yield: 'Recette Optimale' },
                        { name: 'Labo', status: 'Flux Moyen', icon: 'flask-empty-minus', col: '#F59E0B', rate: '85%', yield: 'Analyses Stables' },
                        { name: 'Pharmacie', status: 'Optimal', icon: 'pill', col: '#38A169', rate: '92%', yield: 'Stocks Gérés' },
                        { name: 'Soins', status: 'Surchargé', icon: 'medical-bag', col: '#D93025', rate: '105%', yield: 'Haut Rendement' }
                     ].map((s, i) => (
                        <View key={i} style={{ width: 180, padding: 20, borderRadius: 28, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, marginRight: 15, elevation: 4 }}>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <MaterialCommunityIcons name={s.icon} size={28} color={s.col} />
                              <Text style={{ color: s.col, fontWeight: '900', fontSize: 12 }}>{s.rate}</Text>
                           </View>
                           <Text style={{ fontWeight: '900', fontSize: 15, color: C.text, marginTop: 15 }}>{s.name}</Text>
                           <Text style={{ fontSize: 10, color: C.sub, marginTop: 4 }}>{s.yield}</Text>
                           <View style={{ backgroundColor: s.col + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginTop: 10, alignSelf: 'flex-start' }}>
                              <Text style={{ color: s.col, fontSize: 8, fontWeight: '900' }}>{s.status.toUpperCase()}</Text>
                           </View>
                        </View>
                     ))}
                  </ScrollView>

                  {/* REPORT CONFIGURATION SECTION */}
                  <View style={{ marginTop: 30, backgroundColor: isDark ? '#121212' : '#F8FAFC', borderRadius: 32, padding: 25, borderWidth: 1, borderColor: C.divider }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                         <LinearGradient colors={Theme.colors.brandGradient} style={{ width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 15 }}>
                            <MaterialCommunityIcons name="file-chart" size={24} color="#FFF" />
                         </LinearGradient>
                         <View>
                            <Text style={{ fontSize: 16, fontWeight: '900', color: C.text }}>RAPPORTS AUTOMATIQUES</Text>
                            <Text style={{ fontSize: 11, color: C.sub, fontWeight: '700' }}>Recevoir le bilan par email/notif</Text>
                         </View>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                         {[
                            { id: 'daily', label: 'CHAQUE JOUR' },
                            { id: 'weekly', label: 'CHAQUE SEMAINE' },
                            { id: 'monthly', label: 'CHAQUE MOIS' }
                         ].map(f => (
                            <TouchableOpacity 
                               key={f.id} 
                               onPress={() => setReportFrequency(f.id)}
                               style={{ flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center', backgroundColor: reportFrequency === f.id ? brandColor : C.surface, borderWidth: 1, borderColor: reportFrequency === f.id ? brandColor : C.divider }}
                            >
                               <Text style={{ fontSize: 9, fontWeight: '900', color: reportFrequency === f.id ? '#FFF' : C.sub }}>{f.label}</Text>
                            </TouchableOpacity>
                         ))}
                      </View>

                      <TouchableOpacity 
                        style={{ height: 60, borderRadius: 20, overflow: 'hidden', elevation: 8, shadowColor: brandColor, shadowOpacity: 0.3, shadowRadius: 10 }}
                        onPress={() => setShowBilanModal(true)}
                      >
                         <LinearGradient colors={Theme.colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                            <MaterialCommunityIcons name="presentation" size={22} color="#FFF" style={{ marginRight: 12 }} />
                            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 1 }}>GÉNÉRER BILAN COMPLET</Text>
                         </LinearGradient>
                      </TouchableOpacity>
                  </View>
               </ScrollView>
               </FadeInView>
            )}

            {activeView === 'notifications' && (
               <FadeInView>
                  <View style={styles.rowBetween}>
                     <Text style={[styles.vTitle, { color: C.text }]}>NOTIFICATIONS</Text>
                     <TouchableOpacity onPress={fetchGlobalData}><MaterialIcons name="refresh" size={24} color={brandColor} /></TouchableOpacity>
                  </View>

                  {messages.length > 0 ? messages.map((m, i) => (
                     <View key={i} style={[styles.pCardPremium, { backgroundColor: C.surface, borderColor: C.border, padding: 18 }]}>
                        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: brandColor + '15', alignItems: 'center', justifyContent: 'center', marginRight: 15 }}>
                           <MaterialCommunityIcons name="bell-outline" size={22} color={brandColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                           <Text style={{ fontWeight: '800', fontSize: 15, color: C.text }}>{m.subject || "Sans objet"}</Text>
                           <Text style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{m.message}</Text>
                           <Text style={{ fontSize: 9, color: brandColor, fontWeight: '900', marginTop: 8 }}>{new Date(m.created_at || Date.now()).toLocaleString()}</Text>
                        </View>
                     </View>
                  )) : (
                     <View style={{ alignItems: 'center', paddingVertical: 60, opacity: 0.5 }}>
                        <MaterialCommunityIcons name="bell-off-outline" size={64} color={C.sub} />
                        <Text style={{ color: C.sub, marginTop: 15, fontWeight: '800' }}>Aucune notification pour le moment.</Text>
                     </View>
                  )}
               </FadeInView>
            )}



            {activeView === 'insurances' && (
               <FadeInView>
                  <View style={styles.rowBetween}>
                     <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={[styles.vTitle, { color: C.text, marginBottom: 0 }]} numberOfLines={1}>ASSURANCES</Text>
                        <Text style={{ fontSize: 9, color: C.sub, fontWeight: '700' }} numberOfLines={1}>GESTION & RENTABILITÉ</Text>
                     </View>
                     <TouchableOpacity 
                        style={[styles.addBtn, { backgroundColor: brandColor, paddingHorizontal: 12, height: 40, borderRadius: 14 }]} 
                        onPress={() => { setEditingInsurance(null); setNewInsurance({ name: '', email: '', contract_date: '', contract_end_date: '', contract_type: 'annuel', monthly_flat_fee: '', contact_info: '', status: 'active' }); setShowInsuranceModal(true); }}
                     >
                        <MaterialCommunityIcons name="email-check-outline" size={18} color="#FFF" />
                        <Text style={[styles.addBtnT, { fontSize: 11, marginLeft: 4 }]}>NOUVEAU</Text>
                     </TouchableOpacity>
                  </View>

                  {/* PREMIUM ANALYTICS CARDS */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 20, paddingBottom: 10 }}>
                     {asArray(insurances).map(ins => {
                        const consumption = ins.real_consumption || 0;
                        const flatFee = Number(ins.monthly_flat_fee || 0);
                        const isProfit = flatFee > consumption;
                        const diff = Math.abs(flatFee - consumption);
                        const ratio = flatFee > 0 ? Math.min(consumption / flatFee, 1.2) : 0;
                        const progressColor = ratio > 0.9 ? '#EF4444' : (ratio > 0.7 ? '#F59E0B' : '#22C55E');

                        return (
                           <View key={ins.id} style={{ width: 280, padding: 20, backgroundColor: C.surface, borderRadius: 32, marginRight: 16, borderWidth: 1, borderColor: isProfit ? '#22C55E20' : '#EF444420', elevation: 8, shadowColor: isProfit ? '#22C55E' : '#EF4444', shadowOpacity: 0.1 }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                 <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 16, fontWeight: '900', color: C.text }} numberOfLines={1}>{ins.name}</Text>
                                    <Text style={{ fontSize: 9, color: isProfit ? '#22C55E' : '#EF4444', fontWeight: '900', marginTop: 2 }}>{isProfit ? 'RENTABLE' : 'DÉFICITAIRE'}</Text>
                                 </View>
                                 <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: (isProfit ? '#22C55E' : '#EF4444') + '15', alignItems: 'center', justifyContent: 'center' }}>
                                    <MaterialCommunityIcons name={isProfit ? "trending-up" : "trending-down"} size={22} color={isProfit ? "#22C55E" : "#EF4444"} />
                                 </View>
                              </View>
                              
                              <View style={{ marginVertical: 15 }}>
                                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <Text style={{ fontSize: 9, fontWeight: '900', color: C.sub }}>CONSOMMATION</Text>
                                    <Text style={{ fontSize: 9, fontWeight: '900', color: C.text }}>{Math.round(ratio * 100)}%</Text>
                                 </View>
                                 <View style={{ height: 6, backgroundColor: C.divider, borderRadius: 3, overflow: 'hidden' }}>
                                    <View style={{ height: '100%', width: `${ratio * 100}%`, backgroundColor: progressColor }} />
                                 </View>
                              </View>

                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                 <View>
                                    <Text style={{ fontSize: 8, fontWeight: '900', color: C.sub }}>FORFAIT</Text>
                                    <Text style={{ fontSize: 13, fontWeight: '900', color: C.text }}>{formatMoney(flatFee)} FC</Text>
                                 </View>
                                 <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 8, fontWeight: '900', color: C.sub }}>{isProfit ? 'PROFIT' : 'PERTE'}</Text>
                                    <Text style={{ fontSize: 13, fontWeight: '900', color: isProfit ? "#22C55E" : "#EF4444" }}>
                                       {isProfit ? "+" : "-"} {formatMoney(diff)} FC
                                    </Text>
                                 </View>
                              </View>
                           </View>
                        );
                     })}
                  </ScrollView>

                  <View style={[styles.searchBox, { backgroundColor: C.surface, borderColor: C.border, marginBottom: 20, borderRadius: 20, height: 50 }]}>
                     <MaterialIcons name="search" size={22} color={brandColor} />
                     <TextInput 
                        placeholder="Chercher une compagnie..." 
                        placeholderTextColor={C.placeholder}
                        style={[styles.searchInput, { color: C.text, fontSize: 14 }]}
                        value={insuranceSearch}
                        onChangeText={setInsuranceSearch}
                     />
                   </View>

                  {asArray(insurances).filter(ins => asText(ins.name).toLowerCase().includes(asText(insuranceSearch).toLowerCase())).map((ins, i) => (
                     <FadeInView key={ins.id} delay={i * 50}>
                        {(() => {
                           const expired = isInsuranceExpired(ins);
                           const statusColor = expired ? '#EF4444' : (ins.status === 'suspended' ? '#F59E0B' : (ins.status === 'terminated' ? '#EF4444' : '#22C55E'));
                           const statusLabel = expired ? 'EXPIRÉ' : (ins.status ? ins.status.toUpperCase() : 'ACTIF');
                           return (
                        <TouchableOpacity 
                           onPress={() => { setActiveInsurance(ins); fetchMembers(ins.id); setShowMemberModal(true); }}
                           activeOpacity={0.9}
                           style={{ backgroundColor: C.surface, borderRadius: 28, padding: 20, borderWidth: 1, borderColor: C.border, elevation: 4, marginBottom: 16, overflow: 'hidden' }}
                        >
                           <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: expired ? '#EF4444' : ((ins.real_consumption > ins.monthly_flat_fee) ? '#EF4444' : brandColor) }} />
                           
                           <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                              <LinearGradient colors={[brandColor, '#4F46E5']} style={{ width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                                 <MaterialCommunityIcons name="account-search-outline" size={26} color="#FFF" />
                              </LinearGradient>
                              <View style={{ flex: 1, marginLeft: 16 }}>
                                 <Text style={{ fontSize: 19, fontWeight: '900', color: C.text }}>{ins.name}</Text>
                                 <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: statusColor + '20', marginRight: 10 }}>
                                       <Text style={{ fontSize: 8, fontWeight: '900', color: statusColor }}>
                                          {statusLabel}
                                       </Text>
                                    </View>
                                    <MaterialIcons name="event-available" size={12} color={C.sub} />
                                    <Text style={{ fontSize: 10, color: C.sub, fontWeight: '700', marginLeft: 4 }}>
                                       CONTRAT DU {ins.contract_date ? new Date(ins.contract_date).toLocaleDateString() : 'NON SPÉCIFIÉ'} AU {ins.contract_end_date ? new Date(ins.contract_end_date).toLocaleDateString() : 'NON SPÉCIFIÉ'}
                                    </Text>
                                 </View>
                              </View>
                              <View style={{ flexDirection: 'row' }}>
                                 {expired && (
                                   <TouchableOpacity onPress={() => handleRenewInsurance(ins)} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#22C55E12', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                      <MaterialCommunityIcons name="autorenew" size={20} color="#22C55E" />
                                   </TouchableOpacity>
                                 )}
                                 <TouchableOpacity onPress={() => setupEditInsurance(ins)} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: brandColor + '10', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                    <MaterialIcons name="edit" size={20} color={brandColor} />
                                 </TouchableOpacity>
                                 <TouchableOpacity onPress={() => handleDeleteInsurance(ins.id)} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#EF444410', alignItems: 'center', justifyContent: 'center' }}>
                                    <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                                 </TouchableOpacity>
                              </View>
                           </View>

                           <View style={{ flexDirection: 'row', backgroundColor: C.bg, borderRadius: 20, padding: 15 }}>
                              <View style={{ flex: 1 }}>
                                 <Text style={{ fontSize: 8, fontWeight: '900', color: C.sub, letterSpacing: 1 }}>NB MEMBRES</Text>
                                 <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                                    <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>{ins.insured_members_count || 0}</Text>
                                    <Text style={{ fontSize: 10, color: C.sub, fontWeight: '700', marginLeft: 4 }}>PERSONNES</Text>
                                 </View>
                              </View>
                              <View style={{ width: 1, backgroundColor: C.border, marginHorizontal: 15 }} />
                              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                 <Text style={{ fontSize: 8, fontWeight: '900', color: C.sub, letterSpacing: 1 }}>VALEUR MENSUELLE</Text>
                                 <Text style={{ fontSize: 18, fontWeight: '900', color: brandColor, marginTop: 4 }}>{formatMoney(ins.monthly_flat_fee)} FC</Text>
                              </View>
                           </View>

                           <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 15, justifyContent: 'space-between' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                 <MaterialCommunityIcons name="bell-ring-outline" size={14} color={C.sub} />
                                 <Text style={{ fontSize: 10, color: C.sub, marginLeft: 5, fontWeight: '600' }} numberOfLines={1}>
                                    {ins.contact_info || "Aucune information de contact"}
                                 </Text>
                              </View>
                              <MaterialIcons name="chevron-right" size={20} color={C.sub} />
                           </View>
                        </TouchableOpacity>
                           );
                        })()}
                     </FadeInView>
                  ))}
               </FadeInView>
            )}

            {activeView === 'pricing' && (
               <FadeInView>
                  <View style={styles.rowBetween}>
                     <View style={{ flex: 1 }}>
                        <Text style={[styles.vTitle, { color: C.text, marginBottom: 0 }]}>CATALOGUE</Text>
                        <Text style={{ fontSize: 9, color: C.sub, fontWeight: '700' }}>GESTION DES PRIX & SERVICES</Text>
                     </View>
                     <TouchableOpacity 
                       onPress={() => setShowCatalogModal(true)}
                       style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: brandColor, alignItems: 'center', justifyContent: 'center', elevation: 4 }}
                     >
                        <MaterialIcons name="add" size={24} color="#FFF" />
                     </TouchableOpacity>
                  </View>

                  <View style={[styles.searchBox, { backgroundColor: C.surface, borderColor: C.border, marginBottom: 15, borderRadius: 20, height: 48, marginTop: 10 }]}>
                     <MaterialIcons name="search" size={20} color={brandColor} />
                     <TextInput 
                        placeholder="Chercher un service ou produit..." 
                        placeholderTextColor={C.placeholder}
                        style={[styles.searchInput, { color: C.text, fontSize: 13 }]}
                        value={catalogSearch}
                        onChangeText={setCatalogSearch}
                     />
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                     {['Tous', 'Dossier', 'Consultation', 'Examen', 'Soins', 'Produit', 'Autre'].map(cat => {
                        const isSelected = (cat === 'Tous' && !bulkCategory) || (bulkCategory === cat);
                        return (
                           <TouchableOpacity 
                             key={cat} 
                             onPress={() => setBulkCategory(cat === 'Tous' ? '' : cat)}
                             style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: isSelected ? brandColor : C.surface, marginRight: 8, borderWidth: 1, borderColor: isSelected ? brandColor : C.border }}
                           >
                              <Text style={{ color: isSelected ? '#FFF' : C.sub, fontWeight: '800', fontSize: 11 }}>{cat.toUpperCase()}</Text>
                           </TouchableOpacity>
                        );
                     })}
                  </ScrollView>

                  {Array.from(new Set(['Dossier', 'Consultation', 'Examen', 'Soins', 'Produit', 'Autre', ...priceCatalog.map(c => c.type)])).filter(c => !bulkCategory || c === bulkCategory).map(category => {
                     const items = priceCatalog.filter(c => c.type === category && (c.label.toLowerCase().includes(catalogSearch.toLowerCase()) || category.toLowerCase().includes(catalogSearch.toLowerCase())));
                     if (items.length === 0) return null;

                     return (
                        <View key={category} style={{ marginBottom: 25 }}>
                           <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: brandColor, marginRight: 8 }} />
                              <Text style={{ fontWeight: '900', fontSize: 13, color: C.text, letterSpacing: 1 }}>{category.toUpperCase()}</Text>
                              <View style={{ flex: 1, height: 1, backgroundColor: C.border, marginLeft: 10 }} />
                           </View>

                           {items.map((item) => {
                              const globalIndex = priceCatalog.findIndex(c => c.id === item.id);
                              return (
                                 <View key={item.id} style={[styles.premiumCard, { backgroundColor: C.surface, borderRadius: 20, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border }]}>
                                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: category === 'Examen' ? '#805AD515' : (category === 'Soins' ? '#10B98115' : (category === 'Consultation' ? '#3B82F615' : brandColor + '10')), alignItems: 'center', justifyContent: 'center' }}>
                                       <MaterialCommunityIcons 
                                          name={category === 'Examen' ? 'flask' : (category === 'Soins' ? 'medical-bag' : (category === 'Consultation' ? 'stethoscope' : 'tag'))} 
                                          size={22} 
                                          color={category === 'Examen' ? '#805AD5' : (category === 'Soins' ? '#10B981' : (category === 'Consultation' ? '#3B82F6' : brandColor))} 
                                       />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 15 }}>
                                       <TextInput 
                                         style={{ fontWeight: '800', color: C.text, fontSize: 14, padding: 0 }}
                                         value={item.label}
                                         multiline={true}
                                         onChangeText={v => {
                                            const next = [...priceCatalog];
                                            next[globalIndex].label = v;
                                            setPriceCatalog(next);
                                         }}
                                       />
                                       {item.code && <Text style={{ fontSize: 9, color: C.sub, fontWeight: '700' }}>CODE: {item.code}</Text>}
                                       {item.type === 'Produit' && (
                                          <TextInput 
                                            style={{ fontSize: 11, color: C.sub, padding: 0, marginTop: 2, fontWeight: '700' }}
                                            placeholder="Dosage (ex: 500mg)..."
                                            placeholderTextColor={C.sub}
                                            value={item.dosage || ''}
                                            multiline
                                            onChangeText={v => {
                                               const next = [...priceCatalog];
                                               next[globalIndex].dosage = v;
                                               setPriceCatalog(next);
                                            }}
                                          />
                                       )}
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.input, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
                                           <TextInput 
                                              style={{ color: brandColor, fontWeight: '900', fontSize: 14, textAlign: 'right', minWidth: 60, padding: 0 }}
                                              keyboardType="numeric"
                                              value={String(item.price)}
                                              onChangeText={v => {
                                                 const next = [...priceCatalog];
                                                 next[globalIndex].price = v;
                                                 setPriceCatalog(next);
                                              }}
                                           />
                                           <Text style={{ color: brandColor, fontWeight: '900', fontSize: 10, marginLeft: 4 }}>FC</Text>
                                        </View>
                                        {!item.locked && (
                                           <TouchableOpacity 
                                              onPress={() => handleDeleteCatalogItem(globalIndex)}
                                              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.danger + '15', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
                                           >
                                              <MaterialCommunityIcons name="trash-can-outline" size={18} color={C.danger} />
                                           </TouchableOpacity>
                                        )}
                                     </View>
                                 </View>
                              );
                           })}
                        </View>
                     );
                  })}

                  <TouchableOpacity onPress={handleSaveWorkflowSettings} disabled={isSubmitting} style={{ marginTop: 20, marginBottom: 100 }}>
                     <LinearGradient colors={Theme.colors.brandGradient} style={{ height: 60, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 4 }}>
                        {isSubmitting ? <ActivityIndicator color='#FFF' /> : (
                           <>
                              <MaterialIcons name="save" size={24} color="#FFF" />
                              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16, marginLeft: 10 }}>{t.adminSaveCatalog}</Text>
                           </>
                        )}
                     </LinearGradient>
                  </TouchableOpacity>
               </FadeInView>
            )}
        </View>
      </ScrollView>

      {activeBottomTab && (
        <Animated.View style={[{ position: 'absolute', bottom: 72, left: 0, right: 0, maxHeight: height * 0.55, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: C.border, zIndex: 120 }, { transform: [{ translateY: bottomPanelAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }] }]}>
           <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: C.divider }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: C.text }}>{activeBottomTab.toUpperCase()}</Text>
              <TouchableOpacity onPress={() => toggleBottomTab(activeBottomTab)} style={{ padding: 8, backgroundColor: C.closeBg, borderRadius: 12 }}><MaterialIcons name="close" size={20} color={C.closeIc} /></TouchableOpacity>
           </View>
           <ScrollView contentContainerStyle={{ padding: 20 }}>
              {bottomLoading ? (
                 <ActivityIndicator color={brandColor} />
              ) : activeBottomTab === 'maladies' ? (
                 <View>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: C.sub, marginBottom: 15, letterSpacing: 1.5 }}>PATHOLOGIES LES PLUS FRÉQUENTES ({diseasePeriod} JOURS)</Text>
                    {diseases.map((d, i) => (
                       <View key={i} style={{ marginBottom: 18 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                             <Text style={{ color: C.text, fontWeight: '800', fontSize: 14 }}>{d.name}</Text>
                             <Text style={{ color: brandColor, fontWeight: '900' }}>{d.count} cas ({d.percentage}%)</Text>
                          </View>
                          <View style={{ height: 8, backgroundColor: C.surface, borderRadius: 4, overflow: 'hidden' }}>
                             <View style={{ width: `${d.percentage}%`, height: '100%', backgroundColor: brandColor }} />
                          </View>
                       </View>
                    ))}
                    {diseases.length === 0 && <Text style={{ color: C.sub, textAlign: 'center' }}>Aucune donnée de diagnostic.</Text>}
                 </View>
              ) : activeBottomTab === 'stock' ? (
                 <View>
                    <View style={{ backgroundColor: expiryData.pharmacy_health?.alert_level === 'critical' ? '#EF444420' : (expiryData.pharmacy_health?.alert_level === 'warning' ? '#F59E0B20' : '#10B98120'), padding: 15, borderRadius: 20, marginBottom: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: expiryData.pharmacy_health?.alert_level === 'critical' ? '#EF444440' : (expiryData.pharmacy_health?.alert_level === 'warning' ? '#F59E0B40' : '#10B98140') }}>
                       <MaterialCommunityIcons 
                         name={expiryData.pharmacy_health?.alert_level === 'critical' ? "" : (expiryData.pharmacy_health?.alert_level === "warning" ? "alert" : "check-decagram")} 
                         size={24} 
                         color={expiryData.pharmacy_health?.alert_level === 'critical' ? '#EF4444' : (expiryData.pharmacy_health?.alert_level === 'warning' ? '#F59E0B' : '#10B981')} 
                       />
                       <View style={{ marginLeft: 12 }}>
                          <Text style={{ fontWeight: '900', color: expiryData.pharmacy_health?.alert_level === 'critical' ? '#EF4444' : (expiryData.pharmacy_health?.alert_level === 'warning' ? '#F59E0B' : '#10B981'), fontSize: 11 }}>SANTÉ DE LA PHARMACIE</Text>
                          <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>
                             {expiryData.pharmacy_health?.alert_level === 'critical' ? "" : (expiryData.pharmacy_health?.alert_level === "warning" ? "Attention requise" : "État du stock stable")}
                          </Text>
                       </View>
                    </View>
                    {expiryData.expired?.length > 0 && (
                       <View style={{ marginBottom: 20 }}>
                          <Text style={{ color: '#EF4444', fontWeight: '900', fontSize: 10, marginBottom: 10, letterSpacing: 1 }}>PÉRIMÉS ({expiryData.expired.length})</Text>
                          {expiryData.expired.map((it, i) => (
                             <View key={i} style={{ padding: 12, backgroundColor: '#EF444410', borderRadius: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: C.text, fontWeight: '700' }}>{it.name}</Text>
                                <Text style={{ color: '#EF4444', fontWeight: '900' }}>{it.quantity} restants</Text>
                             </View>
                          ))}
                       </View>
                    )}
                    {expiryData.low_stock?.length > 0 && (
                       <View style={{ marginBottom: 20 }}>
                          <Text style={{ color: '#F59E0B', fontWeight: '900', fontSize: 10, marginBottom: 10, letterSpacing: 1 }}>STOCK FAIBLE ({expiryData.low_stock.length})</Text>
                          {expiryData.low_stock.map((it, i) => (
                             <View key={i} style={{ padding: 12, backgroundColor: '#F59E0B10', borderRadius: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: C.text, fontWeight: '700' }}>{it.name}</Text>
                                <Text style={{ color: '#F59E0B', fontWeight: '900' }}>{it.quantity} en stock</Text>
                             </View>
                          ))}
                       </View>
                    )}
                    {expiryData.expiring?.length > 0 && (
                       <View>
                          <Text style={{ color: '#3B82F6', fontWeight: '900', fontSize: 10, marginBottom: 10, letterSpacing: 1 }}>EXPIRATION PROCHE ({expiryData.expiring.length})</Text>
                          {expiryData.expiring.map((it, i) => (
                             <View key={i} style={{ padding: 12, backgroundColor: '#3B82F610', borderRadius: 12, marginBottom: 8 }}>
                                <Text style={{ color: C.text, fontWeight: '700' }}>{it.name}</Text>
                                <Text style={{ color: '#3B82F6', fontSize: 11 }}>Expire le {new Date(it.expires_at).toLocaleDateString()}</Text>
                             </View>
                          ))}
                       </View>
                    )}
                 </View>
              ) : activeBottomTab === 'caisse' ? (
                 <View>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: C.sub, marginBottom: 15, letterSpacing: 1.5 }}>BILAN DES ENTRÉES PAR SERVICE</Text>
                    {cashData.items?.map((c, i) => (
                       <View key={i} style={{ padding: 18, backgroundColor: C.surface, borderRadius: 24, marginBottom: 14, borderWidth: 1, borderColor: C.border, elevation: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                             <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color, marginRight: 10 }} />
                             <Text style={{ color: C.text, fontWeight: '900', fontSize: 15, flex: 1 }}>{c.service}</Text>
                             <Text style={{ color: c.color, fontWeight: '900', fontSize: 17 }}>{c.amount.toLocaleString()} FC</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                             <Text style={{ color: C.sub, fontSize: 11 }}>{c.count} transactions effectuées</Text>
                             <View style={{ backgroundColor: c.color + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ color: c.color, fontSize: 9, fontWeight: '900' }}>VALIDE</Text>
                             </View>
                          </View>
                       </View>
                    ))}
                    {(!cashData.items || cashData.items.length === 0) && (
                       <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                          <MaterialCommunityIcons name="cash-remove" size={48} color={C.sub} style={{ opacity: 0.3 }} />
                          <Text style={{ color: C.sub, marginTop: 10 }}>Aucune recette enregistrée pour cette période.</Text>
                       </View>
                    )}
                 </View>
              ) : (
                 <Text style={{ color: C.text }}>Sélectionnez une catégorie</Text>
              )}
           </ScrollView>
        </Animated.View>
      )}

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border, zIndex: 110 }}>
        <View style={{ paddingBottom: insets.bottom }}>
          <View style={{ flexDirection: 'row', height: 65 }}>
            {[
              { id: 'stock', icon: 'package-variant-closed', label: 'Stocks' },
              { id: 'caisse', icon: 'safe-square-outline', label: 'Caisse' },
            ].map(tab => (
              <TouchableOpacity key={tab.id} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onPress={() => toggleBottomTab(tab.id)}>
                <MaterialCommunityIcons name={tab.icon} size={24} color={activeBottomTab === tab.id ? brandColor : C.sub} />
                <Text style={{ fontSize: 10, color: activeBottomTab === tab.id ? brandColor : C.sub, fontWeight: activeBottomTab === tab.id ? '900' : '500', marginTop: 2 }}>{tab.label}</Text>
                {activeBottomTab === tab.id && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: brandColor, marginTop: 4 }} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <Modal visible={showTimelineModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ height: height * 0.9, backgroundColor: C.bg, borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 25, borderBottomWidth: 1, borderBottomColor: C.divider }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>DOSSIER MÉDICAL</Text>
                <Text style={{ fontSize: 10, color: brandColor, fontWeight: '900', letterSpacing: 1 }}>HISTORIQUE COMPLET DU MALADE</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTimelineModal(false)} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.divider, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="close" size={24} color={C.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {timelineLoading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator color={brandColor} size="large" />
                  <Text style={{ marginTop: 15, color: C.sub, fontWeight: '700' }}>Chargement du dossier...</Text>
                </View>
              ) : selectedTimeline ? (
                <View style={{ padding: 20 }}>
                  <LinearGradient colors={[brandColor, '#4F46E5']} style={{ padding: 25, borderRadius: 32, marginBottom: 25, elevation: 8 }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFF' }}>{selectedTimeline.patient?.first_name} {selectedTimeline.patient?.last_name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 10 }}>
                        <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900' }}>{selectedTimeline.patient?.gender === 'M' ? 'MASCULIN' : 'FÉMININ'}</Text>
                      </View>
                      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700' }}>Né(e) en {selectedTimeline.patient?.birth_year} ({selectedTimeline.patient?.age} ans)</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 15 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '900' }}>STATUT DOSSIER</Text>
                        <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{selectedTimeline.patient?.status?.toUpperCase() || 'ACTIF'}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '900' }}>TYPE DE CHARGE</Text>
                        <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{selectedTimeline.patient?.is_insured ? 'ASSURÉ' : 'PRIVÉ'}</Text>
                      </View>
                    </View>
                  </LinearGradient>

                  <Text style={{ fontSize: 13, fontWeight: '900', color: C.text, marginBottom: 20, letterSpacing: 1.5 }}>TIMELINE DES SOINS</Text>

                  {selectedTimeline.timeline?.length > 0 ? (
                    selectedTimeline.timeline.map((item, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', marginBottom: 25 }}>
                        <View style={{ alignItems: 'center', width: 40, marginRight: 15 }}>
                          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: brandColor + '15', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                            <MaterialCommunityIcons 
                              name={
                                item.type === 'vitals' ? 'heart-pulse' :
                                item.type === 'diagnosis' ? 'clipboard-text-pulse' :
                                item.type === 'lab' ? 'flask' :
                                item.type === 'prescription' ? 'pill' :
                                item.type === 'invoice' ? 'cash-multiple' : 'calendar-clock'
                              } 
                              size={20} color={brandColor} 
                            />
                          </View>
                          {idx < selectedTimeline.timeline.length - 1 && (
                            <View style={{ flex: 1, width: 2, backgroundColor: C.divider, marginVertical: 4 }} />
                          )}
                        </View>
                        <View style={{ flex: 1, backgroundColor: C.surface, padding: 18, borderRadius: 24, borderWidth: 1, borderColor: C.divider }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={{ fontSize: 10, fontWeight: '900', color: brandColor, letterSpacing: 1 }}>{item.type.toUpperCase()} • {new Date(item.date).toLocaleDateString()}</Text>
                            <Text style={{ fontSize: 9, color: C.sub, fontWeight: '700' }}>{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 4 }}>{item.title}</Text>
                          <Text style={{ fontSize: 12, color: C.sub, lineHeight: 18 }}>{item.content}</Text>
                          {item.meta && (
                            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.divider }}>
                              <Text style={{ fontSize: 10, fontStyle: 'italic', color: brandColor }}>{item.meta}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={{ alignItems: 'center', paddingVertical: 40, opacity: 0.5 }}>
                      <MaterialCommunityIcons name="history" size={48} color={C.sub} />
                      <Text style={{ marginTop: 15, color: C.sub, fontWeight: '700' }}>Aucun événement enregistré.</Text>
                    </View>
                  )}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <PremiumLeftDrawer 
        isOpen={isLeftOpen} 
        anim={leftAnim} 
        onClose={() => toggleLeft(false)} 
        activeView={activeView} 
        setActiveView={setActiveView} 
        menuItems={adminMenu} 
        roleName="ADMIN" 
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
        roleName="ADMIN" 
        roleIcon="account-cog" 
        onLogout={handleLogout} 
        t={t}
        activeView={activeView}
        setActiveView={setActiveView}
        menuItems={adminMenu}
      />

      <Modal visible={showUserModal || showEditModal} animationType="slide" transparent>
         <View style={styles.modalOverlay}>
             <View style={[styles.modalSheet, { backgroundColor: C.bg, height: height * 0.85 }]}>
                <View style={[styles.dimH, { borderBottomColor: C.divider }]}>
                  <Text style={[styles.dimT, { color: C.text }]}>{showEditModal ? t.users.editStaff : t.users.newStaff}</Text>
                  <TouchableOpacity onPress={() => {setShowUserModal(false); setShowEditModal(false);}} style={{ padding: 8, backgroundColor: C.closeBg, borderRadius: 12 }}>
                     <MaterialIcons name="close" size={22} color={C.closeIc} />
                  </TouchableOpacity>
               </View>
               <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                  <Text style={styles.label}>{t.users.fullName}</Text>
                  <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} placeholder="Ex: Jean Mpolo" placeholderTextColor={C.placeholder} value={showEditModal ? editingUser?.name : newUser.name} onChangeText={v => showEditModal ? setEditingUser({...editingUser, name: v}) : setNewUser({...newUser, name: v})} />
                  <Text style={styles.label}>POSTNOM</Text>
                  <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} placeholder="Ex: Bakole" placeholderTextColor="#64748B" value={showEditModal ? editingUser?.postname : newUser.postname} onChangeText={v => showEditModal ? setEditingUser({...editingUser, postname: v}) : setNewUser({...newUser, postname: v})} />
                  <Text style={styles.label}>TÉLÉPHONE</Text>
                  <View style={{ marginBottom: 20 }}>
                     <View style={{ borderColor: C.border, backgroundColor: C.input, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 56 }}>
                        <MaterialCommunityIcons name="phone" size={20} color={brandColor} />
                        <TextInput 
                           style={{ flex: 1, height: '100%', marginLeft: 10, color: C.text, fontWeight: '800' }} 
                           placeholder="08X XXX XXXX" placeholderTextColor={C.placeholder} 
                           keyboardType="phone-pad" 
                           value={showEditModal ? editingUser?.phone : newUser.phone} 
                           onChangeText={v => {
                              if (showEditModal) setEditingUser({...editingUser, phone: v});
                              else setNewUser({...newUser, phone: v});
                           }} 
                        />
                        {detectOperator(showEditModal ? editingUser?.phone : newUser.phone).valid && (
                           <View style={{ backgroundColor: operatorColor(detectOperator(showEditModal ? editingUser?.phone : newUser.phone).operator) + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                              <Text style={{ color: operatorColor(detectOperator(showEditModal ? editingUser?.phone : newUser.phone).operator), fontSize: 10, fontWeight: '900' }}>
                                 {detectOperator(showEditModal ? editingUser?.phone : newUser.phone).operator}
                              </Text>
                           </View>
                        )}
                     </View>
                  </View>
                  <Text style={styles.label}>{t.users.emailAddress}</Text>
                  <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} placeholder="agent@test.com" placeholderTextColor={C.placeholder} autoCapitalize="none" keyboardType="email-address" value={showEditModal ? editingUser?.email : newUser.email} onChangeText={v => showEditModal ? setEditingUser({...editingUser, email: v}) : setNewUser({...newUser, email: v})} />
                  
                  {!showEditModal && (
                     <>
                        <Text style={styles.label}>MOT DE PASSE</Text>
                        <View style={{ marginBottom: 20 }}>
                           <View style={{ borderColor: C.border, backgroundColor: C.input, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 56 }}>
                              <MaterialCommunityIcons name="lock-outline" size={20} color={brandColor} />
                              <TextInput 
                                 style={{ flex: 1, height: '100%', marginLeft: 10, color: C.text, fontWeight: '800' }} 
                                 placeholder="••••••••" placeholderTextColor={C.placeholder} 
                                 secureTextEntry={!showPassword} 
                                 value={newUser.password} 
                                 onChangeText={v => setNewUser({...newUser, password: v})} 
                              />
                              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                 <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={22} color={C.sub} />
                              </TouchableOpacity>
                           </View>
                        </View>

                        <Text style={styles.label}>CONFIRMER LE MOT DE PASSE</Text>
                        <View style={{ marginBottom: 20 }}>
                           <View style={{ borderColor: C.border, backgroundColor: C.input, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 56 }}>
                              <MaterialCommunityIcons name="lock-check-outline" size={20} color={brandColor} />
                              <TextInput 
                                 style={{ flex: 1, height: '100%', marginLeft: 10, color: C.text, fontWeight: '800' }} 
                                 placeholder="••••••••" placeholderTextColor={C.placeholder} 
                                 secureTextEntry={!showConfirmPassword} 
                                 value={newUser.confirmPassword} 
                                 onChangeText={v => setNewUser({...newUser, confirmPassword: v})} 
                              />
                              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                 <MaterialCommunityIcons name={showConfirmPassword ? "eye-off" : "eye"} size={22} color={C.sub} />
                              </TouchableOpacity>
                           </View>
                        </View>
                     </>
                  )}
                  
                  <Text style={styles.label}>{t.users.roleAccess}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                     {['reception', 'caisse', 'medecin', 'labo', 'pharmacie', 'soins', 'maternite', 'admin'].map(r => {
                        const isSel = (showEditModal ? editingUser?.role : newUser.role) === r;
                        return (
                           <TouchableOpacity 
                             key={r} 
                             onPress={() => showEditModal ? setEditingUser({...editingUser, role: r}) : setNewUser({...newUser, role: r})}
                             style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: isSel ? brandColor : C.surface, borderWidth: 1, borderColor: isSel ? brandColor : C.border }}
                           >
                              <Text style={{ color: isSel ? '#FFF' : C.sub, fontSize: 10, fontWeight: '900' }}>{r.toUpperCase()}</Text>
                           </TouchableOpacity>
                        );
                     })}
                  </View>

                  {(showEditModal ? editingUser?.role : newUser.role) === 'medecin' && (
                     <FadeInView>
                        <Text style={styles.label}>SPÉCIALITÉ MÉDICALE</Text>
                        <TextInput 
                           style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} 
                           placeholder="Ex: Cardiologie, Pédiatrie..." 
                           placeholderTextColor="#64748B" 
                           value={showEditModal ? editingUser?.specialty : newUser.specialty} 
                           onChangeText={v => showEditModal ? setEditingUser({...editingUser, specialty: v}) : setNewUser({...newUser, specialty: v})} 
                        />
                     </FadeInView>
                  )}
                  {showEditModal && (
                     <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: C.divider, paddingTop: 20 }}>
                        <TouchableOpacity 
                          onPress={() => setShowResetSection(!showResetSection)}
                          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}
                        >
                           <MaterialCommunityIcons name="lock-reset" size={20} color={brandColor} />
                           <Text style={{ color: brandColor, fontWeight: '800', marginLeft: 10 }}>RÉINITIALISER LE MOT DE PASSE</Text>
                        </TouchableOpacity>

                        {showResetSection && (
                           <FadeInView style={{ marginBottom: 20, backgroundColor: C.surface, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: C.border }}>
                              <Text style={styles.label}>NOUVEAU MOT DE PASSE</Text>
                              <View style={{ marginBottom: 15 }}>
                                 <View style={{ borderColor: C.border, backgroundColor: C.input, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 56 }}>
                                    <MaterialIcons name="vpn-key" size={20} color={brandColor} />
                                    <TextInput 
                                       style={{ flex: 1, height: '100%', marginLeft: 10, color: C.text, fontWeight: '800' }} 
                                       placeholder="••••••••" placeholderTextColor={C.placeholder} 
                                       secureTextEntry={!showResetPassword} 
                                       value={resetPasswordVal} 
                                       onChangeText={setResetPasswordVal} 
                                    />
                                    <TouchableOpacity onPress={() => setShowResetPassword(!showResetPassword)}>
                                       <MaterialCommunityIcons name={showResetPassword ? "eye-off" : "eye"} size={22} color={C.sub} />
                                    </TouchableOpacity>
                                 </View>
                              </View>
                              <TouchableOpacity onPress={handleResetPassword} disabled={isResetting}>
                                 <LinearGradient colors={Theme.colors.brandGradient} style={{ height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                                    {isResetting ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: "#FFF", fontWeight: '900', fontSize: 12 }}>VALIDER LE NOUVEAU PASS</Text>}
                                 </LinearGradient>
                              </TouchableOpacity>
                           </FadeInView>
                        )}

                        <TouchableOpacity 
                          onPress={() => handleDeleteUser(editingUser.id)}
                          style={{ flexDirection: 'row', alignItems: 'center' }}
                        >
                           <MaterialCommunityIcons name="alert-outline" size={20} color="#EF4444" />
                           <Text style={{ color: '#EF4444', fontWeight: '800', marginLeft: 10 }}>SUPPRIMER LE COMPTE DÉFINITIVEMENT</Text>
                        </TouchableOpacity>
                     </View>
                  )}

                  <TouchableOpacity onPress={showEditModal ? handleUpdateUser : handleCreateUser} disabled={isSubmitting} style={{ marginTop: 30 }}>
                     <LinearGradient colors={Theme.colors.brandGradient} style={{ height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', elevation: 4 }}>
                        {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: "#FFF", fontWeight: '900', letterSpacing: 1 }}>{showEditModal ? t.save.toUpperCase() : t.users.generate.toUpperCase()}</Text>}
                     </LinearGradient>
                  </TouchableOpacity>
                  <View style={{ height: 40 }} />
               </ScrollView>
            </View>
         </View>
      </Modal>

      {/* MODAL: BILAN COMPLET DES ACTIVITÉS */}
      <Modal visible={showBilanModal} animationType="fade" transparent>
         <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
            <View style={[styles.modalSheet, { backgroundColor: C.bg, height: height * 0.9, width: width * 0.95, borderRadius: 40 }]}>
               <View style={[styles.dimH, { borderBottomColor: C.divider, paddingVertical: 25 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                     <LinearGradient colors={['#FFD700', '#FFA500']} style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 15 }}>
                        <MaterialCommunityIcons name="trophy-variant" size={24} color="#FFF" />
                     </LinearGradient>
                     <View>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>BILAN GÉNÉRAL MDCD</Text>
                        <Text style={{ fontSize: 11, color: C.sub, fontWeight: '700' }}>Période : {reportFrequency === 'daily' ? 'Journalière' : reportFrequency === 'weekly' ? 'Hebdomadaire' : 'Mensuelle'}</Text>
                     </View>
                  </View>
                  <TouchableOpacity onPress={() => setShowBilanModal(false)} style={styles.closeBtn}>
                     <MaterialCommunityIcons name="close" size={24} color={C.text} />
                  </TouchableOpacity>
               </View>

               <ScrollView contentContainerStyle={{ padding: 25 }}>
                  <View style={{ backgroundColor: isDark ? '#1A1A1A' : '#F8FAFC', borderRadius: 28, padding: 25, borderWidth: 1, borderColor: C.divider, marginBottom: 25 }}>
                     <Text style={{ fontSize: 12, fontWeight: '900', color: brandColor, letterSpacing: 2, marginBottom: 15 }}>RÉSUMÉ FINANCIER</Text>
                     <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <View>
                           <Text style={{ fontSize: 34, fontWeight: '900', color: C.text }}>{(stats?.revenue_period || 0).toLocaleString()} <Text style={{ fontSize: 14 }}>FC</Text></Text>
                           <Text style={{ fontSize: 11, fontWeight: '800', color: '#22C55E', marginTop: 5 }}>Rendement Optimal (+12.5%)</Text>
                        </View>
                        <MaterialCommunityIcons name="trending-up" size={44} color="#22C55E15" />
                     </View>
                  </View>

                  <Text style={{ fontSize: 14, fontWeight: '900', color: C.text, marginBottom: 18, marginLeft: 5 }}>DÉTAILS PAR SERVICE</Text>
                  
                  {[
                     { name: 'RÉCEPTION / ACCUEIL', val: stats?.total_visits_period || 0, unit: 'Visites', yield: '100%', col: '#3182CE', icon: 'account-multiple-check' },
                     { name: 'LABORATOIRE MDCD', val: stats?.lab_period_count || 0, unit: 'Examens', yield: '94%', col: '#805AD5', icon: 'flask-round-bottom' },
                     { name: 'PHARMACIE / STOCK', val: '92%', unit: 'Disponibilité', yield: '88%', col: '#38A169', icon: 'pill' },
                     { name: 'SOINS INFIRMIERS', val: stats?.care_period_count || 0, unit: 'Actes', yield: '105%', col: '#E53E3E', icon: 'medical-bag' }
                  ].map((s, i) => (
                     <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 24, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.divider }}>
                        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: s.col + '15', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                           <MaterialCommunityIcons name={s.icon} size={24} color={s.col} />
                        </View>
                        <View style={{ flex: 1 }}>
                           <Text style={{ fontSize: 10, fontWeight: '900', color: C.sub }}>{s.name}</Text>
                           <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                              <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>{s.val} </Text>
                              <Text style={{ fontSize: 11, color: C.sub, fontWeight: '700' }}>{s.unit}</Text>
                           </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                           <Text style={{ fontSize: 12, fontWeight: '900', color: s.col }}>{s.yield}</Text>
                           <Text style={{ fontSize: 8, color: C.sub, fontWeight: '800' }}>RENDEMENT</Text>
                        </View>
                     </View>
                  ))}

                  <View style={{ marginTop: 20, padding: 20, backgroundColor: brandColor + '08', borderRadius: 24, borderWidth: 1, borderColor: brandColor + '20' }}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <MaterialIcons name="info-outline" size={18} color={brandColor} />
                        <Text style={{ fontSize: 12, fontWeight: '900', color: brandColor, marginLeft: 8 }}>RECOMMANDATION SYSTÈME</Text>
                     </View>
                     <Text style={{ fontSize: 12, color: C.text, lineHeight: 18, fontWeight: '600' }}>Le service des soins est en sur-capacité. Envisagez de renforcer l'équipe de nuit pour maintenir la qualité MDCD.</Text>
                  </View>

                  <TouchableOpacity 
                    style={{ marginTop: 30, height: 54, borderRadius: 16, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
                    onPress={() => { setShowBilanModal(false); showToast("Rapport envoyé à l'administration", "success"); }}
                  >
                     <MaterialCommunityIcons name="send-check" size={20} color={C.bg} style={{ marginRight: 10 }} />
                     <Text style={{ color: C.bg, fontWeight: '900', fontSize: 13 }}>ARCHIVER & PARTAGER</Text>
                  </TouchableOpacity>
                  <View style={{ height: 40 }} />
               </ScrollView>
            </View>
         </View>
      </Modal>

      <Modal visible={!!editingPatient} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.bg, height: height * 0.88 }]}>
            <View style={[styles.dimH, { borderBottomColor: C.divider }]}>
              <Text style={[styles.dimT, { color: C.text }]}>MODIFIER DOSSIER PATIENT</Text>
              <TouchableOpacity onPress={() => setEditingPatient(null)} style={{ padding: 8, backgroundColor: C.closeBg, borderRadius: 12 }}>
                <MaterialIcons name="close" size={22} color={C.closeIc} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>PRÉNOM</Text>
              <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} value={editingPatient?.first_name || ''} onChangeText={v => setEditingPatient(p => ({ ...p, first_name: v }))} />
              <Text style={styles.label}>NOM</Text>
              <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} value={editingPatient?.last_name || ''} onChangeText={v => setEditingPatient(p => ({ ...p, last_name: v }))} />
              <Text style={styles.label}>POSTNOM</Text>
              <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} value={editingPatient?.post_name || ''} onChangeText={v => setEditingPatient(p => ({ ...p, post_name: v }))} />
              <Text style={styles.label}>ANNÉE DE NAISSANCE</Text>
              <TextInput keyboardType="numeric" style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} value={String(editingPatient?.birth_year || '')} onChangeText={v => setEditingPatient(p => ({ ...p, birth_year: v }))} />
              <Text style={styles.label}>PATHOLOGIE / NOTE</Text>
              <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} value={editingPatient?.pathology || ''} onChangeText={v => setEditingPatient(p => ({ ...p, pathology: v }))} />
              <Text style={styles.label}>CONTACT</Text>
              <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} value={editingPatient?.contact_info || ''} onChangeText={v => setEditingPatient(p => ({ ...p, contact_info: v }))} />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={styles.label}>PATIENT ASSURÉ</Text>
                <Switch value={!!editingPatient?.is_insured} onValueChange={v => setEditingPatient(p => ({ ...p, is_insured: v }))} trackColor={{ true: brandColor }} />
              </View>

              {editingPatient?.is_insured && (
                <>
                  <Text style={styles.label}>ASSURANCE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                    {asArray(insurances).map(ins => {
                      const expired = isInsuranceExpired(ins);
                      const selected = editingPatient?.insurance_id === ins.id;
                      return (
                        <TouchableOpacity
                          key={ins.id}
                          disabled={expired}
                          onPress={() => setEditingPatient(p => ({ ...p, insurance_id: ins.id }))}
                          style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginRight: 8, backgroundColor: selected ? brandColor : C.surface, borderWidth: 1, borderColor: expired ? '#EF4444' : (selected ? brandColor : C.border), opacity: expired ? 0.45 : 1 }}
                        >
                          <Text style={{ color: selected ? '#FFF' : C.text, fontSize: 10, fontWeight: '900' }}>{ins.name}</Text>
                          {expired ? <Text style={{ color: '#EF4444', fontSize: 8, fontWeight: '900' }}>EXPIRÉ</Text> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <Text style={styles.label}>CODE ASSURÉ</Text>
                  <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} value={editingPatient?.insurance_code || ''} onChangeText={v => setEditingPatient(p => ({ ...p, insurance_code: v }))} />
                </>
              )}

              <TouchableOpacity onPress={handleUpdatePatient} disabled={isSubmitting} style={{ height: 58, borderRadius: 18, overflow: 'hidden', marginTop: 8, marginBottom: 40, opacity: isSubmitting ? 0.6 : 1 }}>
                <LinearGradient colors={Theme.colors.brandGradient} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFF', fontWeight: '900' }}>{isSubmitting ? 'ENREGISTREMENT...' : 'ENREGISTRER LE DOSSIER'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showInsuranceModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
           <View style={[styles.modalSheet, { backgroundColor: C.bg, height: height * 0.92 }]}>
            <View style={[styles.dimH, { borderBottomColor: C.divider }]}>
              <Text style={[styles.dimT, { color: C.text }]}>{editingInsurance ? "MODIFIER L'ASSURANCE" : "NOUVELLE ASSURANCE"}</Text>
              <TouchableOpacity onPress={() => setShowInsuranceModal(false)} style={{ padding: 8, backgroundColor: C.closeBg, borderRadius: 12 }}>
                <MaterialIcons name="close" size={22} color={C.closeIc} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <Text style={styles.label}>NOM DE LA COMPAGNIE</Text>
              <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} placeholder="Ex: ASCOMA, SONAS, CNSS..." placeholderTextColor="#64748B" value={newInsurance.name} onChangeText={v => setNewInsurance({...newInsurance, name: v})} />

              <Text style={styles.label}>EMAIL DE CONTACT</Text>
              <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} placeholder="contact@ascoma.cd" placeholderTextColor="#64748B" keyboardType="email-address" autoCapitalize="none" value={newInsurance.email} onChangeText={v => setNewInsurance({...newInsurance, email: v})} />

              <Text style={styles.label}>TYPE DE CONTRAT (PÉRIODICITÉ)</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {[
                  { id: 'mensuel', label: 'MENSUEL', icon: 'calendar-month' },
                  { id: 'trimestriel', label: 'TRIM.', icon: 'calendar-range' },
                  { id: 'annuel', label: 'ANNUEL', icon: 'calendar-star' },
                ].map(ct => {
                  const isSel = newInsurance.contract_type === ct.id;
                  return (
                    <TouchableOpacity
                      key={ct.id}
                      onPress={() => setNewInsurance({...newInsurance, contract_type: ct.id})}
                      style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: isSel ? brandColor : C.surface, borderWidth: 1.5, borderColor: isSel ? brandColor : C.border, alignItems: 'center', gap: 4 }}
                    >
                      <MaterialCommunityIcons name={ct.icon} size={20} color={isSel ? '#FFF' : C.sub} />
                      <Text style={{ color: isSel ? '#FFF' : C.sub, fontSize: 9, fontWeight: '900' }}>{ct.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>MONTANT DU FORFAIT (FC)</Text>
              <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} placeholder="Ex: 500000" placeholderTextColor={C.placeholder} keyboardType="numeric" value={newInsurance.monthly_flat_fee} onChangeText={v => setNewInsurance({...newInsurance, monthly_flat_fee: v})} />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>DÉBUT CONTRAT (JJ/MM/AAAA)</Text>
                  <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} placeholder="01/01/2026" placeholderTextColor="#64748B" value={newInsurance.contract_date} onChangeText={v => setNewInsurance({...newInsurance, contract_date: v})} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>FIN CONTRAT (JJ/MM/AAAA)</Text>
                  <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input }]} placeholder="31/12/2026" placeholderTextColor="#64748B" value={newInsurance.contract_end_date} onChangeText={v => setNewInsurance({...newInsurance, contract_end_date: v})} />
                </View>
              </View>

              <Text style={styles.label}>CONTACTS / INFOS COMPLÉMENTAIRES</Text>
              <TextInput style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.input, height: 90, textAlignVertical: 'top', paddingTop: 12 }]} multiline placeholder="Numéro de téléphone, personne de contact..." placeholderTextColor="#64748B" value={newInsurance.contact_info} onChangeText={v => setNewInsurance({...newInsurance, contact_info: v})} />

              <Text style={styles.label}>ÉTAT DU CONTRAT</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                {[
                  { id: 'active', label: 'ACTIF', color: '#22C55E' },
                  { id: 'suspended', label: 'SUSPENDU', color: '#F59E0B' },
                  { id: 'terminated', label: 'ROMPU', color: '#EF4444' },
                  { id: 'expired', label: 'EXPIRÉ', color: '#EF4444' }
                ].map(s => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setNewInsurance({...newInsurance, status: s.id})}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: newInsurance.status === s.id ? s.color : C.surface, borderWidth: 1, borderColor: newInsurance.status === s.id ? s.color : C.border, alignItems: 'center' }}
                  >
                    <Text style={{ color: newInsurance.status === s.id ? '#FFF' : s.color, fontSize: 9, fontWeight: '900' }}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity onPress={handleSaveInsurance} disabled={isSubmitting} style={{ marginTop: 10 }}>
                <LinearGradient colors={Theme.colors.brandGradient} style={{ height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', elevation: 4 }}>
                   {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: "#FFF", fontWeight: '900', letterSpacing: 1 }}>{editingInsurance ? "METTRE À JOUR" : "CRÉER LE CONTRAT"}</Text>}
                </LinearGradient>
              </TouchableOpacity>
              <View style={{ height: 50 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showMemberModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
           <View style={[styles.modalSheet, { backgroundColor: C.bg, height: height * 0.9 }]}>
            <View style={[styles.dimH, { borderBottomColor: C.divider }]}>
               <View>
                  <Text style={[styles.dimT, { color: C.text }]}>{activeInsurance?.name}</Text>
                  <Text style={{ fontSize: 10, color: brandColor, fontWeight: '900' }}>GESTION DES ADHÉRENTS</Text>
               </View>
               <TouchableOpacity onPress={() => setShowMemberModal(false)} style={{ padding: 8, backgroundColor: C.closeBg, borderRadius: 12 }}>
                  <MaterialCommunityIcons name="information-outline" size={22} color={C.closeIc} />
               </TouchableOpacity>
            </View>
            
            <View style={{ padding: 20, flex: 1 }}>
               {/* ADD MEMBER FORM */}
               <View style={{ backgroundColor: C.surface, padding: 15, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: C.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={styles.label}>{editingMember ? "MODIFIER ADHÉRENT" : "NOUVEL ADHÉRENT"}</Text>
                    {editingMember && (
                      <TouchableOpacity onPress={() => { setEditingMember(null); setNewMember({ member_name: '', membership_code: '' }); }}>
                        <Text style={{ color: brandColor, fontSize: 10, fontWeight: '900' }}>ANNULER</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                     <TextInput style={[styles.input, { flex: 1, height: 48, marginBottom: 0, color: C.text, borderColor: C.border, backgroundColor: C.input }]} placeholder="Nom Complet" placeholderTextColor="#64748B" value={newMember.member_name} onChangeText={v => setNewMember({...newMember, member_name: v})} />
                     <TextInput style={[styles.input, { width: 100, height: 48, marginBottom: 0, color: C.text, borderColor: C.border, backgroundColor: C.input }]} placeholder="Code ID" placeholderTextColor={C.placeholder} value={newMember.membership_code} onChangeText={v => setNewMember({...newMember, membership_code: v})} />
                  </View>
                  <TouchableOpacity onPress={handleAddMember} disabled={isSubmitting} style={{ marginTop: 12 }}>
                     <LinearGradient colors={editingMember ? ['#F59E0B', '#D97706'] : ['#3B82F6', '#2563EB']} style={{ height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                        {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: "#FFF", fontWeight: '900', fontSize: 12 }}>{editingMember ? "ENREGISTRER LES MODIFICATIONS" : "AJOUTER À LA LISTE"}</Text>}
                     </LinearGradient>
                  </TouchableOpacity>
               </View>

               {/* SEARCH MEMBERS */}
               <View style={[styles.searchBox, { height: 44, borderRadius: 12, backgroundColor: C.input, marginBottom: 15 }]}>
                  <MaterialIcons name="search" size={20} color={C.sub} />
                  <TextInput 
                    placeholder="Chercher un adhérent..." placeholderTextColor={C.sub} 
                    style={[styles.searchInput, { color: C.text, fontSize: 13 }]} 
                    value={memberSearch}
                    onChangeText={setMemberSearch}
                  />
               </View>

               <FlatList 
                  data={insuredMembers.filter(m => m.member_name.toLowerCase().includes(memberSearch.toLowerCase()) || m.membership_code.toLowerCase().includes(memberSearch.toLowerCase()))} 
                  keyExtractor={item => item.id.toString()} 
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                     <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.divider, flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#3B82F615', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                           <MaterialCommunityIcons name="account-circle-outline" size={20} color="#3B82F6" />
                        </View>
                        <View style={{ flex: 1 }}>
                           <Text style={{ color: C.text, fontWeight: '800', fontSize: 14 }}>{item.member_name}</Text>
                           <Text style={{ color: brandColor, fontSize: 11, fontWeight: '900' }}>ID: {item.membership_code}</Text>
                        </View>
                        <View style={{ flexDirection: 'row' }}>
                          <TouchableOpacity onPress={() => handleEditMember(item)} style={{ padding: 6, backgroundColor: '#F59E0B15', borderRadius: 8, marginRight: 8 }}>
                            <MaterialIcons name="edit" size={18} color="#F59E0B" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteMember(item.id)} style={{ padding: 6, backgroundColor: '#EF444415', borderRadius: 8 }}>
                             <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                     </View>
                  )} 
                  ListEmptyComponent={() => (
                     <View style={{ alignItems: 'center', marginTop: 40 }}>
                        <MaterialCommunityIcons name="account-search-outline" size={48} color={C.sub} style={{ opacity: 0.3 }} />
                        <Text style={{ color: C.sub, marginTop: 10, fontSize: 12 }}>Aucun adhérent trouvé.</Text>
                     </View>
                  )}
               />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showCatalogModal} animationType="fade" transparent>
         <View style={styles.modalOverlay}>
             <View style={[styles.modalSheet, { backgroundColor: C.bg, height: '85%' }]}>
                <View style={[styles.dimH, { borderBottomColor: C.divider }]}>
                  <Text style={[styles.dimT, { color: C.text }]}>AJOUTER SERVICES</Text>
                  <TouchableOpacity onPress={() => setShowCatalogModal(false)} style={{ padding: 8, backgroundColor: C.closeBg, borderRadius: 12 }}>
                     <MaterialCommunityIcons name="information-outline" size={22} color={C.closeIc} />
                  </TouchableOpacity>
               </View>
               
               <ScrollView style={{ padding: 20 }} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                  <Text style={styles.label}>CATÉGORIE COMMUNE</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                     {['Dossier', 'Consultation', 'Examen', 'Soins', 'Produit', 'Autre'].map(cat => (
                        <TouchableOpacity 
                          key={cat} 
                          onPress={() => setBulkCategory(cat)}
                          style={{ 
                             paddingHorizontal: 12, 
                             paddingVertical: 8, 
                             borderRadius: 12, 
                             backgroundColor: bulkCategory === cat ? brandColor : C.surface,
                             borderWidth: 1,
                             borderColor: bulkCategory === cat ? brandColor : C.border
                          }}
                        >
                           <Text style={{ color: bulkCategory === cat ? '#FFF' : brandColor, fontSize: 11, fontWeight: '800' }}>{cat.toUpperCase()}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>

                  {bulkCategory === 'Autre' && (
                     <FadeInView style={{ marginBottom: 20 }}>
                        <Text style={styles.label}>NOM DE LA CATÉGORIE PERSONNALISÉE</Text>
                        <TextInput 
                           style={[styles.input, { color: isDark ? '#FFF' : '#000', borderColor: brandColor, backgroundColor: isDark ? '#1A1A1A' : '#F8FAFC' }]} 
                           placeholder="Ex: Maintenance, Services Externes..." placeholderTextColor={C.placeholder}
                           value={customCategoryName}
                           onChangeText={setCustomCategoryName}
                        />
                     </FadeInView>
                  )}

                  <Text style={[styles.label, { marginBottom: 15 }]}>LISTE DES ÉLÉMENTS</Text>
                  {bulkCatalogItems.map((item, idx) => (
                     <View key={idx} style={{ flexDirection: 'row', gap: 10, marginBottom: 15, alignItems: 'center' }}>
                        <View style={{ flex: 2 }}>
                           <TextInput 
                                             style={[styles.input, { marginBottom: 0, color: C.text, borderColor: C.border, backgroundColor: C.input }]} 
                              placeholder="Libellé..." 
                              placeholderTextColor="#64748B"
                              value={item.label}
                              onChangeText={v => {
                                 const next = [...bulkCatalogItems];
                                 next[idx].label = v;
                                 setBulkCatalogItems(next);
                              }}
                           />
                        </View>
                        {bulkCategory === 'Examen' && (
                        <View style={{ width: 80 }}>
                           <TextInput 
                              style={[styles.input, { marginBottom: 0, color: C.text, borderColor: C.border, backgroundColor: C.input }]} 
                              placeholder="Code..." placeholderTextColor={C.placeholder}
                              value={item.code || ''}
                              onChangeText={v => {
                                 const next = [...bulkCatalogItems];
                                 next[idx].code = v.toUpperCase();
                                 setBulkCatalogItems(next);
                              }}
                           />
                        </View>
                        )}
                        {bulkCategory === 'Produit' && (
                        <View style={{ flex: 1 }}>
                           <TextInput 
                                             style={[styles.input, { marginBottom: 0, color: C.text, borderColor: C.border, backgroundColor: C.input }]} 
                              placeholder="Dosage..." placeholderTextColor={C.placeholder}
                              value={item.dosage || ''}
                              onChangeText={v => {
                                 const next = [...bulkCatalogItems];
                                 next[idx].dosage = v;
                                 setBulkCatalogItems(next);
                              }}
                           />
                        </View>
                        )}
                        <View style={{ flex: 1 }}>
                           <TextInput 
                                             style={[styles.input, { marginBottom: 0, color: C.text, borderColor: C.border, backgroundColor: C.input }]} 
                              placeholder="Prix..." placeholderTextColor={C.placeholder}
                              keyboardType="numeric"
                              value={item.price}
                              onChangeText={v => {
                                 const next = [...bulkCatalogItems];
                                 next[idx].price = v;
                                 setBulkCatalogItems(next);
                              }}
                           />
                        </View>
                        {bulkCatalogItems.length > 1 && (
                           <TouchableOpacity onPress={() => {
                              const next = [...bulkCatalogItems];
                              next.splice(idx, 1);
                              setBulkCatalogItems(next);
                           }}>
                              <MaterialIcons name="remove-circle-outline" size={24} color={C.danger} />
                           </TouchableOpacity>
                        )}
                     </View>
                  ))}

                  <TouchableOpacity 
                     onPress={handleAddBulkRow}
                     style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: brandColor, borderStyle: 'dashed', marginTop: 10 }}
                  >
                     <MaterialIcons name="add" size={20} color={brandColor} />
                     <Text style={{ color: brandColor, fontWeight: '800', marginLeft: 8 }}>AJOUTER UNE LIGNE</Text>
                  </TouchableOpacity>
               </ScrollView>

               <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: C.divider }}>
               <TouchableOpacity onPress={handleSaveBulkCatalog} disabled={isSubmitting}>
                     <LinearGradient colors={Theme.colors.brandGradient} style={{ height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                        {isSubmitting ? <ActivityIndicator color="#FFF" /> : (
                           <>
                              <MaterialIcons name="cloud-upload" size={24} color="#FFF" />
                              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16, marginLeft: 10 }}>ENREGISTRER TOUT</Text>
                           </>
                        )}
                     </LinearGradient>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

     <Modal visible={showRevenueModal} transparent animationType="fade" onRequestClose={() => setShowRevenueModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
           <View style={{ backgroundColor: C.surface, borderRadius: 32, padding: 24, elevation: 10, borderWidth: 1, borderColor: C.border, maxHeight: S.height * 0.8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                 <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="finance" size={24} color={brandColor} />
                    <Text style={{ fontSize: 16, fontWeight: '900', color: C.text, marginLeft: 10 }}>DÉTAIL DES REVENUS</Text>
                 </View>
                 <TouchableOpacity onPress={() => setShowRevenueModal(false)} style={{ padding: 8, backgroundColor: C.closeBg, borderRadius: 12 }}>
                    <MaterialCommunityIcons name="close" size={20} color={C.closeIc} />
                 </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.sub, marginBottom: 20 }}>
                 Total généré pour la période ({revenuePeriod === 'day' ? 'Jour' : revenuePeriod === 'week' ? 'Semaine' : 'Mois'}): <Text style={{ color: brandColor, fontWeight: '900' }}>{(stats?.revenue_period || 0).toLocaleString()} FC</Text>
              </Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                     {asArray(stats?.revenue_by_service).map((rev, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginBottom: 12, borderRadius: 20, backgroundColor: C.input, borderWidth: 1, borderColor: C.border }}>
                       <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: brandColor + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                             <MaterialCommunityIcons name={rev.service.toLowerCase().includes('labo') ? 'flask' : rev.service.toLowerCase().includes('pharmacie') ? 'pill' : rev.service.toLowerCase().includes('soins') ? 'medical-bag' : rev.service.toLowerCase().includes('matern') ? 'mother-heart' : 'cash-register'} size={20} color={brandColor} />
                          </View>
                          <Text style={{ color: C.text, fontWeight: '800', fontSize: 14 }}>{rev.service}</Text>
                       </View>
                       <Text style={{ color: brandColor, fontWeight: '900', fontSize: 16 }}>{rev.total.toLocaleString()} FC</Text>
                    </View>
                 ))}
                 {(!stats?.revenue_by_service || stats.revenue_by_service.length === 0) && (
                    <Text style={{ textAlign: 'center', color: C.sub, fontStyle: 'italic', paddingVertical: 20 }}>"Aucun revenu pour cette période."</Text>
                 )}
              </ScrollView>
           </View>
        </View>
      </Modal>

      <Modal visible={showResetModal} animationType="slide" transparent>
         <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: C.bg, height: height * 0.65 }]}>
               <View style={[styles.dimH, { borderBottomColor: C.divider }]}>
                  <Text style={[styles.dimT, { color: C.text }]}>RÉINITIALISATION DES DONNÉES</Text>
                  <TouchableOpacity onPress={() => setShowResetModal(false)} style={{ padding: 8, backgroundColor: C.closeBg, borderRadius: 12 }}>
                     <MaterialIcons name="close" size={22} color={C.closeIc} />
                  </TouchableOpacity>
               </View>
               <ScrollView style={{ padding: 25 }}>
                  <View style={{ backgroundColor: '#EF444410', padding: 18, borderRadius: 20, marginBottom: 25, borderWidth: 1, borderColor: '#EF444430' }}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <MaterialCommunityIcons name="alert-decagram" size={24} color="#EF4444" />
                        <Text style={{ color: '#EF4444', fontWeight: '900', fontSize: 14, marginLeft: 10 }}>ZONE DE DANGER</Text>
                     </View>
                     <Text style={{ color: C.sub, fontSize: 12, lineHeight: 18 }}>Cette opération supprimera définitivement les données sélectionnées. Assurez-vous d'avoir exporté les données importantes avant de continuer.</Text>
                  </View>

                  <Text style={styles.label}>OPTION DE RÉINITIALISATION</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                     <TouchableOpacity 
                        onPress={() => setResetService('ALL')}
                        style={{ flex: 1, padding: 15, borderRadius: 18, backgroundColor: resetService === 'ALL' ? '#EF4444' : C.surface, borderWidth: 1, borderColor: resetService === 'ALL' ? '#EF4444' : C.border, alignItems: 'center' }}
                     >
                        <MaterialCommunityIcons name="database-remove" size={24} color={resetService === 'ALL' ? '#FFF' : '#EF4444'} />
                        <Text style={{ color: resetService === 'ALL' ? '#FFF' : C.text, fontWeight: '900', fontSize: 10, marginTop: 8 }}>TOUT EFFACER</Text>
                     </TouchableOpacity>
                     <TouchableOpacity 
                        onPress={() => setResetService('pharmacie')}
                        style={{ flex: 1, padding: 15, borderRadius: 18, backgroundColor: (resetService !== 'ALL' && resetService !== '') ? brandColor : C.surface, borderWidth: 1, borderColor: (resetService !== 'ALL' && resetService !== '') ? brandColor : C.border, alignItems: 'center' }}
                     >
                        <MaterialCommunityIcons name="layers-remove" size={24} color={(resetService !== 'ALL' && resetService !== '') ? '#FFF' : brandColor} />
                        <Text style={{ color: (resetService !== 'ALL' && resetService !== '') ? '#FFF' : C.text, fontWeight: '900', fontSize: 10, marginTop: 8 }}>PAR SERVICE</Text>
                     </TouchableOpacity>
                  </View>

                  {resetService !== 'ALL' && (
                     <FadeInView style={{ marginBottom: 20 }}>
                        <Text style={styles.label}>SÉLECTIONNER LE SERVICE</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 5 }}>
                           {['pharmacie', 'labo', 'soins', 'maternite', 'reception', 'caisse'].map(s => (
                              <TouchableOpacity
                                 key={s}
                                 onPress={() => setResetService(s)}
                                 style={{ paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, backgroundColor: resetService === s ? brandColor : C.input, marginRight: 8, borderWidth: 1, borderColor: resetService === s ? brandColor : C.border }}
                              >
                                 <Text style={{ color: resetService === s ? '#FFF' : C.sub, fontSize: 10, fontWeight: '900' }}>{s.toUpperCase()}</Text>
                              </TouchableOpacity>
                           ))}
                        </ScrollView>
                     </FadeInView>
                  )}

                  <Text style={styles.label}>CODE DE SÉCURITÉ ADMIN</Text>
                  <TextInput 
                     style={[styles.input, { color: C.text, borderColor: '#EF4444', backgroundColor: C.input }]} 
                     placeholder="Entrez REHOBOTH_ADMIN_RESET" 
                     placeholderTextColor={C.placeholder}
                     secureTextEntry={true}
                     value={resetPassword}
                     onChangeText={setResetPassword}
                  />

                  <TouchableOpacity 
                     onPress={resetService === 'ALL' ? handleResetAll : handleResetService} 
                     disabled={isSubmitting || !resetPassword}
                     style={{ marginTop: 10, marginBottom: 40 }}
                  >
                     <LinearGradient colors={resetService === 'ALL' ? ['#EF4444', '#B91C1C'] : Theme.colors.brandGradient} style={{ height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: (!resetPassword || isSubmitting) ? 0.6 : 1 }}>
                        {isSubmitting ? <ActivityIndicator color="#FFF" /> : (
                           <>
                              <MaterialCommunityIcons name="trash-can-outline" size={22} color="#FFF" />
                              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15, marginLeft: 10 }}>CONFIRMER LA SUPPRESSION</Text>
                           </>
                        )}
                     </LinearGradient>
                  </TouchableOpacity>
               </ScrollView>
            </View>
         </View>
      </Modal>

    </View>
  );
}

const createStyles = (C, S, isDark, brandColor) => StyleSheet.create({
  mainContainer: { flex: 1 },
  content: { padding: 20 },
  vTitle: { fontSize: 24, fontWeight: '900', marginBottom: 20 },
  heroSummary: { marginBottom: 20 },
  heroBox: { padding: 24, borderRadius: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 10 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900' },
  heroValue: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  addBtn: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: brandColor },
  addBtnT: { color: '#FFF', fontWeight: '900', fontSize: 12, marginLeft: 5 },
  userCardPremium: { padding: 15, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  uAvatarPrem: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  uInitials: { color: '#FFF', fontWeight: '900' },
  uName: { fontWeight: '800', fontSize: 15 },
  uActions: { flexDirection: 'row' },
  uActionBtn: { padding: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 50, borderRadius: 25, borderWidth: 1, marginBottom: 20 },
  searchInput: { flex: 1, marginLeft: 10 },
  pCardPremium: { padding: 15, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  pName: { fontWeight: '800', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 40 },
  dimH: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', borderBottomWidth: 1 },
  dimT: { fontSize: 18, fontWeight: '900' },
  label: { fontSize: 9, fontWeight: '900', color: '#94A3B8', marginBottom: 8, letterSpacing: 1 },
  input: { height: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, marginBottom: 20, fontSize: 15, fontWeight: '600' },
  premiumCard: { elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  folderContainer: { width: (S.width - 55) / 2, backgroundColor: C.surface, borderRadius: 24, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: C.border, elevation: 4 }
});
