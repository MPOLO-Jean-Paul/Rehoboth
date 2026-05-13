import React, { useEffect, useState, useRef, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, TextInput, Animated, Switch, FlatList, StatusBar, Modal, Image, AppState } from 'react-native';
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
import PremiumFooter from '../components/PremiumFooter';
import PremiumHeader from '../components/PremiumHeader';
import FloatingActionDock from '../components/FloatingActionDock';
import ProfileView from '../components/ProfileView';
import { Theme } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { isValidPhone, detectOperator, operatorColor } from '../utils/phoneValidator';

const { width, height } = Theme.layout;
const paymentMethods = [
   { id: 'cash', icon: 'cash-marker', label: 'CASH', color: '#22C55E', type: 'icon' },
   {
      id: 'mpesa',
      label: 'M-PESA',
      color: '#22C55E',
      type: 'logo',
      logo: require('../../assets/payment/mpesa.jpg'),
   },
   {
      id: 'orange',
      label: 'ORANGE',
      color: '#FF6600',
      type: 'logo',
      logo: require('../../assets/payment/orange.png'),
   },
   {
      id: 'airtel',
      label: 'AIRTEL',
      color: '#E11900',
      type: 'logo',
      logo: require('../../assets/payment/airtel.png'),
   },
];

export default function CashierScreen({ navigation, route }) {
   const { isDark, C, S, brandColor, themeMode, toggleTheme, lang, toggleLang, isOnline } = useTheme();
   const styles = createStyles(C, S, brandColor);
   const insets = useSafeAreaInsets();
   const { showToast } = useContext(ToastContext);
   const t = translations[lang] || translations.fr;
   const bt = t.bottomTabs || {};

   const [invoices, setInvoices] = useState([]);
   const [history, setHistory] = useState([]);
   const [summary, setSummary] = useState(null);
   const [loading, setLoading] = useState(true);
   const [activeTab, setActiveTab] = useState('pending');
   const [activeView, setActiveView] = useState('dashboard');
   const [activeBottomTab, setActiveBottomTab] = useState(null);
   const [search, setSearch] = useState('');
   const [payingId, setPayingId] = useState(null);

   const [showPaymentModal, setShowPaymentModal] = useState(false);
   const [activeInvoice, setActiveInvoice] = useState(null);
   const [paymentMethod, setPaymentMethod] = useState('cash');
   const [paymentPhone, setPaymentPhone] = useState('');
   const [isSimulating, setIsSimulating] = useState(false);
   const [bottomLoading, setBottomLoading] = useState(false);
   const [isInsuranceVerified, setIsInsuranceVerified] = useState(false);
   const [verifyingInsurance, setVerifyingInsurance] = useState(false);
   const [insuranceError, setInsuranceError] = useState(null);
   const [isSubmitting, setIsSubmitting] = useState(false);

   const [autoJournalEnabled, setAutoJournalEnabled] = useState(false);
   const [autoJournalFreq, setAutoJournalFreq] = useState('day');
   const [showAutoModal, setShowAutoModal] = useState(false);
   const [selectedJournal, setSelectedJournal] = useState(null);
   const [showJournalDetails, setShowJournalDetails] = useState(false);
   const [journalLoading, setJournalLoading] = useState(false);

   const [recettePeriod, setRecettePeriod] = useState('day');
   const [accountingData, setAccountingData] = useState({ insured: 0, private: 0, monthly_journals: [] });
   const [journalSort, setJournalSort] = useState('date_desc');
   const [isLeftOpen, setIsLeftOpen] = useState(false);
   const [isRightOpen, setIsRightOpen] = useState(false);
   const [insurances, setInsurances] = useState([]);
   const [selectedInsurance, setSelectedInsurance] = useState(null);
   const [insuranceReport, setInsuranceReport] = useState(null);
   const [reportLoading, setReportLoading] = useState(false);
   const [showSettleModal, setShowSettleModal] = useState(false);
   const [paymentRef, setPaymentRef] = useState('');

   const leftAnim = useRef(new Animated.Value(-width)).current;
   const rightAnim = useRef(new Animated.Value(width)).current;
   const bottomPanelAnim = useRef(new Animated.Value(0)).current;

   useEffect(() => {
      fetchInvoices();
      fetchHistory();
      fetchAccountingData();
      fetchInsurances();

      const startInterval = () => {
         return setInterval(() => {
            fetchInvoices(true);
            fetchHistory(true);
            if (activeView === 'accounting') fetchAccountingData(true);
            if (activeView === 'insurances') fetchInsurances(true);
         }, 10000);
      };

      let interval = startInterval();

      const subscription = AppState.addEventListener('change', nextAppState => {
         if (nextAppState === 'active') {
            fetchInvoices(true);
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
   }, [recettePeriod, activeView]);

   useEffect(() => {
      const requestedTab = route.params?.tab;
      if (requestedTab) {
         if (['pending', 'history', 'summary'].includes(requestedTab)) {
            setActiveTab(requestedTab);
            setActiveView('dashboard');
         } else if (['insurances', 'accounting', 'reports', 'recettes'].includes(requestedTab)) {
            setActiveView(requestedTab);
         }
         navigation.setParams({ tab: null });
      }

      if (route.params?.invoiceId && invoices.length > 0) {
         const inv = invoices.find(i => String(i.id) === String(route.params.invoiceId));
         if (inv) {
            setActiveInvoice(inv);
            setShowPaymentModal(true);
            setActiveView('dashboard');
            setActiveTab('pending');
            // Clear params to avoid re-triggering
            navigation.setParams({ invoiceId: null });
         }
      }
   }, [route.params?.invoiceId, route.params?.tab, invoices]);

   const fetchAccountingData = async (isBg = false) => {
      try {
         const stats = await api.get(`/cashier/accounting/stats?period=${recettePeriod}`);
         const journals = await api.get('/cashier/accounting/journals');
         setAccountingData({ ...stats.data, monthly_journals: journals.data });

         const settingsResp = await api.get('/cashier/accounting/auto-settings');
         setAutoJournalEnabled(settingsResp.data.enabled);
         setAutoJournalFreq(settingsResp.data.frequency);
      } catch (e) { console.log("Accounting fetch error", e); }
   };

   const fetchInsurances = async (isBg = false) => {
      try {
         const res = await api.get('/insurances');
         setInsurances(res.data);
      } catch (e) { console.log("Insurances fetch error", e); }
   };

   const fetchInsuranceReport = async (insId) => {
      setReportLoading(true);
      try {
         const res = await api.get(`/insurances/${insId}/report`);
         setInsuranceReport(res.data);
      } catch (e) {
         showToast("Erreur rapport assurance", 'error');
      } finally {
         setReportLoading(false);
      }
   };

   const handleSettleInvoices = async () => {
      if (!paymentRef || !insuranceReport?.invoices) return;
      const pendingIds = insuranceReport.invoices.filter(i => i.status === 'insurance_billed').map(i => i.id);
      if (pendingIds.length === 0) return showToast("Aucune facture en attente", 'info');

      setIsSubmitting(true);
      try {
         await api.post(`/insurances/${selectedInsurance.id}/settle`, {
            invoice_ids: pendingIds,
            payment_reference: paymentRef
         });
         showToast("Règlement enregistré", 'success');
         setShowSettleModal(false);
         setPaymentRef('');
         fetchInsuranceReport(selectedInsurance.id);
      } catch (e) {
         showToast("Erreur règlement", 'error');
      } finally {
         setIsSubmitting(false);
      }
   };

   const handleCloseSession = async () => {
      try {
         setLoading(true);
         const res = await api.post('/cashier/accounting/close');
         showToast(res.data.message, 'success');
         fetchAccountingData();
      } catch (e) {
         showToast("Erreur lors de la clôture", 'error');
      } finally {
         setLoading(false);
      }
   };

   const handleCreateJournal = async () => {
      try {
         const res = await api.post('/cashier/accounting/journals');
         showToast(res.data.message, 'success');
         fetchAccountingData();
      } catch (e) {
         const msg = e.response?.data?.message || "Erreur lors de la création du journal";
         showToast(msg, 'error');
      }
   };

   const handleExportAccounting = async () => {
      try {
         const res = await api.get('/cashier/accounting/export');
         showToast(res.data.message, 'success');
      } catch (e) {
         showToast("Erreur lors de l'exportation", 'error');
      }
   };

   const handleStartPayment = (inv) => {
      setActiveInvoice(inv);
      setIsInsuranceVerified(false);
      setInsuranceError(null);
      if (inv.patient?.is_insured) {
         setPaymentMethod('insurance');
      } else {
         setPaymentMethod('cash');
      }
      setShowPaymentModal(true);
   };

   const handleVerifyInsurance = async () => {
      setVerifyingInsurance(true);
      setInsuranceError(null);
      try {
         const res = await api.get(`/invoices/${activeInvoice.id}/check-insurance-status`);
         if (res.data.success) {
            setIsInsuranceVerified(true);
            showToast(res.data.message, 'success');
         } else {
            setInsuranceError(res.data.message);
         }
      } catch (e) {
         setInsuranceError(e.response?.data?.message || "Erreur lors de la vérification");
      } finally {
         setVerifyingInsurance(false);
      }
   };

   const switchToPrivate = () => {
      setPaymentMethod('cash');
      setIsInsuranceVerified(false);
      setInsuranceError(null);
      // We also need to update the activeInvoice patient status temporarily in UI or just handle it in process
      showToast("Passage en mode privé (Cash/Mobile)", 'info');
   };

   const handleProcessPayment = async () => {
      if (paymentMethod !== 'cash' && paymentMethod !== 'insurance') {
         if (!isValidPhone(paymentPhone)) {
            return showToast("Numéro de téléphone invalide (Orange, Airtel, Vodacom requis)", 'error');
         }
      }
      if (paymentMethod !== 'cash') {
         setIsSimulating(true);
         await new Promise(r => setTimeout(r, 3000));
         setIsSimulating(false);
      }
      setPayingId(activeInvoice.id);
      try {
         await api.post(`/invoices/${activeInvoice.id}/pay`, {
            payment_method: paymentMethod,
            payment_phone: paymentPhone
         });
         showToast(t.paySuccess, 'success');
         setShowPaymentModal(false);
         setPaymentPhone('');
         fetchInvoices();
         fetchHistory();
      } catch (e) {
         const msg = e.response?.data?.message || t.error;
         showToast(msg, 'error');
      }
      finally { setPayingId(null); }
   };

   const printReceipt = async (invoice) => {
      try {
         const htmlContent = `
         <html>
           <head>
             <style>
               body { font-family: 'Courier New', Courier, monospace; padding: 20px; font-size: 14px; }
               .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 20px; }
               .title { font-size: 24px; font-weight: bold; margin: 0; }
               .subtitle { font-size: 14px; margin: 5px 0; }
               .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
               .bold { font-weight: bold; }
               .total { font-size: 18px; border-top: 2px dashed #000; padding-top: 10px; margin-top: 20px; }
               .footer { text-align: center; margin-top: 40px; font-size: 12px; border-top: 1px solid #ccc; padding-top: 10px; }
             </style>
           </head>
           <body>
             <div class="header">
               <h1 class="title">POLYCLINIQUE</h1>
               <p class="subtitle">REÇU DE PAIEMENT</p>
               <p class="subtitle">Date: ${new Date(invoice.updated_at || invoice.created_at).toLocaleString('fr-FR')}</p>
             </div>
             <div class="row">
               <span>Référence:</span>
               <span class="bold">#${invoice.id}</span>
             </div>
             <div class="row">
               <span>Patient:</span>
               <span class="bold">${invoice.patient?.first_name} ${invoice.patient?.last_name}</span>
             </div>
             <div class="row">
               <span>Service:</span>
               <span class="bold">${(invoice.service || 'Non spécifié').toUpperCase()}</span>
             </div>
             <div class="row">
               <span>Méthode:</span>
               <span class="bold">${(invoice.payment_method || 'CASH').toUpperCase()}</span>
             </div>
             <div class="row total">
               <span class="bold">MONTANT PAYÉ:</span>
               <span class="bold">${Number(invoice.amount).toLocaleString()} FC</span>
             </div>
             <div class="footer">
               <p>Merci de votre confiance.</p>
               <p>Document généré automatiquement.</p>
             </div>
           </body>
         </html>
       `;
         const { uri } = await Print.printToFileAsync({ html: htmlContent });
         await Sharing.shareAsync(uri);
      } catch (e) {
         showToast("Erreur lors de l'impression", 'error');
      }
   };

   const toggleLeft = (open) => {
      setIsLeftOpen(open);
      Animated.spring(leftAnim, { toValue: open ? 0 : -width, friction: 8, tension: 40, useNativeDriver: true }).start();
   };

   const menuItems = [
      { id: 'dashboard', icon: 'cash-register', label: 'Caisse', sub: 'Factures en attente' },
      { id: 'recettes', icon: 'currency-usd', label: 'Recettes', sub: 'Journal de caisse' },
      { id: 'insurances', icon: 'shield-account-outline', label: 'Assurances', sub: 'Comptes sociétés' },
      { id: 'accounting', icon: 'calculator-variant', label: 'Comptabilité', sub: 'Journaux et balances' },
      { id: 'reports', icon: 'file-chart-outline', label: 'Rapports', sub: 'Analyse des flux financiers' },
   ];

   const parseError = (e) => {
      if (e.response?.data?.errors) {
         const errors = e.response.data.errors;
         const firstKey = Object.keys(errors)[0];
         return errors[firstKey][0];
      }
      return e.response?.data?.message || t.error;
   };

   const fetchInvoices = async (isBg = false) => {
      if (!isBg) setLoading(true);
      try {
         const resp = await api.get('/invoices');
         setInvoices(resp.data);
      } catch (e) { if (!isBg) showToast(parseError(e), 'error'); }
      finally { if (!isBg) setLoading(false); }
   };

   const fetchHistory = async (isBg = false) => {
      try {
         const resp = await api.get(`/cashier/history?period=${recettePeriod}`);
         setHistory(resp.data.invoices || []);
      } catch (e) { if (!isBg) showToast(parseError(e), 'error'); }
   };

   const fetchSummary = async () => {
      setBottomLoading(true);
      try {
         const resp = await api.get('/cashier/daily-summary');
         setSummary(resp.data);
      } catch (e) { console.log(e); }
      finally { setBottomLoading(false); }
   };

   const toggleBottomTab = (tab) => {
      if (activeBottomTab === tab) {
         setActiveBottomTab(null);
         Animated.spring(bottomPanelAnim, { toValue: 0, friction: 8, useNativeDriver: true }).start();
         return;
      }
      setActiveBottomTab(tab);
      Animated.spring(bottomPanelAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
      if (tab === 'summary') fetchSummary();
   };

   const handleSaveAutoSettings = async () => {
      setIsSubmitting(true);
      try {
         await api.post('/cashier/accounting/auto-settings', { enabled: autoJournalEnabled, frequency: autoJournalFreq });
         showToast("Paramètres du journal automatique enregistrés", 'success');
         setShowAutoModal(false);
         fetchAccountingData();
      } catch (e) {
         showToast("Erreur lors de l'enregistrement", 'error');
      } finally {
         setIsSubmitting(false);
      }
   };

   const viewJournalDetails = async (j) => {
      setJournalLoading(true);
      setSelectedJournal(null);
      setShowJournalDetails(true);
      try {
         const res = await api.get(`/cashier/accounting/journals/${j.reference || j.id}`);
         setSelectedJournal(res.data);
      } catch (e) {
         showToast("Erreur lors du chargement des détails", 'error');
         setShowJournalDetails(false);
      } finally {
         setJournalLoading(false);
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

   const dataToDisplay = activeTab === 'pending' ? invoices : history;
   const filteredData = dataToDisplay.filter(inv =>
      `${inv.patient?.first_name} ${inv.patient?.last_name}`.toLowerCase().includes(search.toLowerCase())
   );

   const renderEmptyState = (icon, title, sub) => (
      <FadeInView style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 }}>
         <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: isDark ? '#1A1A1A' : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
            <MaterialCommunityIcons name={icon} size={54} color={brandColor} style={{ opacity: 0.6 }} />
         </View>
         <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#F1F5F9' : '#1A1A1A', textAlign: 'center', letterSpacing: -0.5 }}>{title}</Text>
         <Text style={{ fontSize: 14, color: isDark ? '#888888' : '#94A3B8', textAlign: 'center', marginTop: 10, fontWeight: '600', lineHeight: 22 }}>{sub}</Text>
         <TouchableOpacity
            onPress={() => { fetchInvoices(); fetchHistory(); fetchAccountingData(); }}
            style={{ marginTop: 32, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 18, backgroundColor: brandColor, elevation: 4, shadowColor: brandColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
         >
            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }}>{bt.today?.toUpperCase() || 'ACTUALISER'}</Text>
         </TouchableOpacity>
      </FadeInView>
   );

   const renderInvoice = ({ item, index }) => (
      <FadeInView delay={index * 50} style={{ marginBottom: 16 }}>
         <View style={{ padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 32, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9', elevation: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
               <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: brandColor + '15', marginRight: 12 }}>
                  <Text style={{ color: brandColor, fontWeight: '900', fontSize: 10 }}>#{item.id}</Text>
               </View>
               <View style={{ flex: 1 }}>
                  <Text style={{ color: isDark ? '#888888' : '#94A3B8', fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>{t.patient.toUpperCase()}</Text>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{item.patient?.first_name} {item.patient?.last_name}</Text>
               </View>
               <MaterialCommunityIcons name="receipt-text" size={24} color={brandColor} style={{ opacity: 0.2 }} />
            </View>

            <View style={{ height: 1, backgroundColor: isDark ? '#2E2E2E' : '#F1F5F9', marginBottom: 12 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
               <View style={{ flex: 1 }}>
                  <Text style={{ color: isDark ? '#888888' : '#94A3B8', fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>{t.amount.toUpperCase()}</Text>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: '#22C55E' }} numberOfLines={1} adjustsFontSizeToFit>{item.amount.toLocaleString()} <Text style={{ fontSize: 12 }}>{"FC"</Text></Text>
               </View>

               {activeTab === 'pending' ? (
                  <TouchableOpacity
                     onPress={() => handleStartPayment(item)}
                     disabled={payingId === item.id}
                     style={{ minWidth: 140, height: 48, borderRadius: 16, overflow: 'hidden', elevation: 4, shadowColor: brandColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
                  >
                     <LinearGradient colors={Theme.colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
                        {payingId === item.id ? <ActivityIndicator size="" color="#FFF" /> : (
                           <>
                              <MaterialIcons name="account-balance-wallet" size={20} color="#FFF" style={{ marginRight: 8 }} />
                              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 }}>{t.pay.toUpperCase()}</Text>
                           </>
                        )}
                     </LinearGradient>
                  </TouchableOpacity>
               ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#22C55E15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginRight: 10 }}>
                        <MaterialIcons name="check-circle" size={16} color="#22C55E" />
                        <Text style={{ color: '#22C55E', fontWeight: '900', fontSize: 11, marginLeft: 6 }}>{"PAYÉ"</Text>
                     </View>
                     <TouchableOpacity onPress={() => printReceipt(item)} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: isDark ? '#2E2E2E' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                        <MaterialCommunityIcons name="help-circle" size={20} color={brandColor} />
                     </TouchableOpacity>
                  </View>
               )}
            </View>
         </View>
      </FadeInView>
   );

   return (
      <View style={[styles.mainContainer, { backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC' }]}>
         <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

         <PremiumHeader
            onLeftPress={() => toggleLeft(true)}
            onRightPress={() => toggleRight(true)}
            title="REHOBOTH"
            subtitle={menuItems.find(m => m.id === activeView)?.label || 'CAISSE'}
            icon=""
            isDark={isDark}
            navigation={navigation}
         />

         <FloatingActionDock
            title={activeView === 'dashboard' ? 'Factures et paiements' : 'Actions caisse'}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={t.search}
            actions={[
               activeView !== 'dashboard' && { key: 'back-dashboard', icon: 'arrow-back', onPress: () => { setActiveView('dashboard'); setActiveTab('pending'); if (activeBottomTab) toggleBottomTab('summary'); } },
               { key: 'refresh', icon: 'refresh', onPress: () => { fetchInvoices(); fetchHistory(); fetchSummary(); } },
               activeView === 'accounting' && { key: 'print', icon: 'printer-outline', iconFamily: 'community', onPress: handleExportAccounting },
            ]}
         />

         <View style={{ flex: 1 }}>
            {activeView === 'profile' ? (
               <ScrollView contentContainerStyle={{ paddingTop: 125 + insets.top, paddingBottom: 130 + insets.bottom, paddingHorizontal: 20 }}>
                  <View style={{ paddingTop: insets.top > 40 ? 10 : 0 }}>
                     <ProfileView onBack={() => setActiveView('dashboard')} />
                  </View>
               </ScrollView>
            ) : (
               <>
                  {activeView === 'dashboard' && (
                     <FlatList
                        data={loading ? [] : filteredData}
                        keyExtractor={item => item.id.toString()}
                        renderItem={renderInvoice}
                        contentContainerStyle={{ paddingTop: 125 + insets.top, paddingBottom: 130 + insets.bottom, paddingHorizontal: 20, paddingTop: insets.top > 40 ? 10 : 0 }}
                        ListHeaderComponent={
                           <View style={{ marginBottom: 25 }}>
                              {activeTab === 'pending' && invoices.length > 0 && (
                                 <FadeInView>
                                    <LinearGradient
                                       colors={Theme.colors.brandGradient}
                                       start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                       style={{ padding: 24, borderRadius: 32, marginBottom: 25, elevation: 12, shadowColor: brandColor, shadowOpacity: 0.3, shadowRadius: 15 }}
                                    >
                                       <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <View>
                                             <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }}>{"EN ATTENTE D'ENCAISSEMENT"</Text>
                                             <Text style={{ color: '#FFF', fontSize: 32, fontWeight: '900', marginTop: 8 }}>
                                                {invoices.reduce((acc, inv) => acc + Number(inv.amount), 0).toLocaleString()} <Text style={{ fontSize: 16 }}>FC</Text>
                                             </Text>
                                          </View>
                                          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                                             <MaterialCommunityIcons name="wallet-outline" size={30} color="#FFF" />
                                          </View>
                                       </View>
                                       <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 18 }} />
                                       <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                          <MaterialIcons name="info-outline" size={14} color="rgba(255,255,255,0.6)" />
                                          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700', marginLeft: 6 }}>{invoices.length} factures à régulariser aujourd'hui</Text>
                                       </View>
                                    </LinearGradient>
                                 </FadeInView>
                              )}
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                                 <View style={{ flex: 1, height: 54, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', elevation: 2 }}>
                                    <MaterialIcons name="search" size={20} color={brandColor} />
                                    <TextInput
                                       placeholder={t.search}
                                       placeholderTextColor={isDark ? '#888888' : '#94A3B8'}
                                       style={{ flex: 1, marginLeft: 10, color: isDark ? '#FFF' : '#0A0A0A', fontWeight: '600' }}
                                       value={search}
                                       onChangeText={setSearch}
                                    />
                                 </View>
                                 <TouchableOpacity onPress={activeTab === 'pending' ? fetchInvoices : fetchHistory} style={{ width: 54, height: 54, borderRadius: 20, backgroundColor: isDark ? '#1A1A1A' : '#FFF', alignItems: 'center', justifyContent: 'center', marginLeft: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', elevation: 2 }}>
                                    <MaterialIcons name="refresh" size={24} color={brandColor} />
                                 </TouchableOpacity>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                 <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1 }}>
                                    {activeTab === 'pending' ? t.pendingInvoices.toUpperCase() : bt.history.toUpperCase()}
                                 </Text>
                                 {activeTab === 'history' && (
                                    <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1A1A1A' : '#E2E8F0', borderRadius: 12, padding: 4 }}>
                                       {['day', 'week', 'month', 'quarter', 'all'].map(p => (
                                          <TouchableOpacity key={p} onPress={() => setRecettePeriod(p)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: recettePeriod === p ? brandColor : 'transparent' }}>
                                             <Text style={{ color: recettePeriod === p ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B'), fontSize: 9, fontWeight: '900' }}>
                                                {p === 'quarter' ? 'TRIM' : p === 'all' ? 'TOUT' : p.toUpperCase()}
                                             </Text>
                                          </TouchableOpacity>
                                       ))}
                                    </View>
                                 )}
                              </View>
                           </View>
                        }
                        ListEmptyComponent={
                           loading ? (
                              <View>{[1, 2, 3, 4].map(i => <SkeletonItem key={i} height={130} style={{ marginBottom: 16, borderRadius: 28 }} />)}</View>
                           ) : renderEmptyState(
                              search ? "account-search-outline" : (activeTab === 'pending' ? "wallet-giftcard" : "history"),
                              search ? "Aucun résultat" : (activeTab === 'pending' ? "Aucune facture" : "Historique vide"),
                              search ? `Aucun patient ne correspond à "${search}" dans cette liste.` : (activeTab === 'pending' ? "Il n'y a aucune facture en attente de paiement pour le moment." : "Aucune transaction n'a été enregistrée pour cette période.")
                           )
                        }
                     />
                  )}

                  {/* --- SECTION RECETTES --- */}
                  {activeView === 'recettes' && (
                     <ScrollView contentContainerStyle={{ paddingTop: 125 + insets.top, paddingBottom: 130 + insets.bottom, paddingHorizontal: 20 }}>
                        <FadeInView>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                              <Text style={{ fontSize: 24, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A', letterSpacing: -0.5 }}>{"RECETTES"</Text>
                              <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1A1A1A' : '#E2E8F0', borderRadius: 14, padding: 4 }}>
                                 {['day', 'week', 'month', 'all'].map(p => (
                                    <TouchableOpacity key={p} onPress={() => setRecettePeriod(p)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: recettePeriod === p ? brandColor : 'transparent' }}>
                                       <Text style={{ color: recettePeriod === p ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B'), fontSize: 10, fontWeight: '900' }}>{p.toUpperCase()}</Text>
                                    </TouchableOpacity>
                                 ))}
                              </View>
                           </View>

                           <LinearGradient colors={Theme.colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 32, borderRadius: 40, marginBottom: 24, elevation: 15, shadowColor: brandColor, shadowOpacity: 0.4, shadowRadius: 20 }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                 <View>
                                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>TOTAL ENCAISSÉ</Text>
                                    <Text style={{ fontSize: 42, fontWeight: '900', color: '#FFF', marginTop: 8 }}>{history.reduce((acc, inv) => acc + Number(inv.amount), 0).toLocaleString()} <Text style={{ fontSize: 18 }}>{"FC"</Text></Text>
                                 </View>
                                 <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                                    <MaterialCommunityIcons name="help-circle" size={32} color="#FFF" />
                                 </View>
                              </View>
                              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 24 }} />
                              <View style={{ flexDirection: 'row', gap: 20 }}>
                                 <View>
                                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800' }}>{"TRANSACTIONS"</Text>
                                    <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900' }}>{history.length}</Text>
                                 </View>
                                 <View>
                                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800' }}>PÉRIODE</Text>
                                    <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900' }}>{recettePeriod === 'day' ? 'AUJOURD\'HUI' : recettePeriod.toUpperCase()}</Text>
                                 </View>
                              </View>
                           </LinearGradient>

                           <Text style={{ fontSize: 12, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', marginBottom: 16, letterSpacing: 1.5, marginLeft: 4 }}>{"RÉPARTITION PAR DÉPARTEMENT"</Text>
                           <View style={{ gap: 12 }}>
                              {Object.entries(history.reduce((acc, inv) => {
                                 const s = inv.service || 'AUTRE';
                                 acc[s] = (acc[s] || 0) + Number(inv.amount);
                                 return acc;
                              }, {})).map(([service, amount], i) => (
                                 <View key={i} style={{ padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9', elevation: 2 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                       <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: brandColor + '10', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                                          <MaterialIcons name="help-circle" size={20} color={brandColor} />
                                       </View>
                                       <View>
                                          <Text style={{ fontWeight: '800', color: isDark ? '#E2E8F0' : '#1A1A1A', fontSize: 14 }}>{service.toUpperCase()}</Text>
                                          <Text style={{ fontSize: 11, color: isDark ? '#888888' : '#94A3B8' }}>{"Performance Service"</Text>
                                       </View>
                                    </View>
                                    <Text style={{ fontWeight: '900', color: brandColor, fontSize: 16 }}>{amount.toLocaleString()} FC</Text>
                                 </View>
                              ))}
                           </View>
                        </FadeInView>
                     </ScrollView>
                  )}

                  {/* --- SECTION ASSURANCES --- */}
                  {activeView === 'insurances' && (
                     <ScrollView contentContainerStyle={{ paddingTop: 125 + insets.top, paddingBottom: 130 + insets.bottom, paddingHorizontal: 20 }}>
                        <FadeInView>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                              <View>
                                 <Text style={{ fontSize: 24, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A', letterSpacing: -0.5 }}>ASSURANCES</Text>
                                 <Text style={{ fontSize: 11, color: brandColor, fontWeight: '900', marginTop: 4 }}>{"GESTION DES COMPTES SOCIÉTÉS"</Text>
                              </View>
                              <TouchableOpacity onPress={() => fetchInsurances()} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: brandColor + '10', alignItems: 'center', justifyContent: 'center' }}>
                                 <MaterialIcons name="help-circle" size={20} color={brandColor} />
                              </TouchableOpacity>
                           </View>

                           <View style={{ gap: 16 }}>
                              {insurances.map((ins) => (
                                 <TouchableOpacity
                                    key={ins.id}
                                    onPress={() => { setSelectedInsurance(ins); fetchInsuranceReport(ins.id); }}
                                    style={{ padding: 24, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 32, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', elevation: 4 }}
                                 >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                                       <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: brandColor + '10', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                                          <MaterialCommunityIcons name="shield-check-outline" size={30} color={brandColor} />
                                       </View>
                                       <View style={{ flex: 1 }}>
                                          <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{ins.name}</Text>
                                          <Text style={{ fontSize: 12, color: isDark ? '#888888' : '#94A3B8', fontWeight: '700', marginTop: 2 }}>{ins.email || 'Aucun email contact'}</Text>
                                       </View>
                                       <MaterialIcons name="chevron-right" size={24} color={isDark ? '#2E2E2E' : '#CBD5E1'} />
                                    </View>

                                    <View style={{ height: 1, backgroundColor: isDark ? '#2E2E2E' : '#F1F5F9', marginBottom: 20 }} />

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                       <View>
                                          <Text style={{ fontSize: 9, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1 }}>{"STATUT CONTRAT"</Text>
                                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                                             <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ins.status === 'active' ? '#22C55E' : '#EF4444', marginRight: 8 }} />
                                             <Text style={{ fontSize: 13, fontWeight: '900', color: ins.status === 'active' ? '#22C55E' : '#EF4444' }}>{ins.status === 'active' ? 'ACTIF' : 'INACTIF'}</Text>
                                          </View>
                                       </View>
                                       <View style={{ alignItems: 'flex-end' }}>
                                          <Text style={{ fontSize: 9, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1 }}>COUVERTURE</Text>
                                          <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#F1F5F9' : '#1A1A1A', marginTop: 6 }}>{ins.coverage_percentage}% DES FRAIS</Text>
                                       </View>
                                    </View>
                                 </TouchableOpacity>
                              ))}
                           </View>
                        </FadeInView>
                     </ScrollView>
                  )}

                  {/* --- SECTION COMPTABILITÉ --- */}
                  {activeView === 'accounting' && (
                     <ScrollView contentContainerStyle={{ paddingTop: 125 + insets.top, paddingBottom: 130 + insets.bottom, paddingHorizontal: 20 }}>
                        <FadeInView>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                              <View>
                                 <Text style={{ fontSize: 26, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A', letterSpacing: -1 }}>{"COMPTABILITÉ"</Text>
                                 <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#888888' : '#94A3B8' }}>Gestion des journaux et balances</Text>
                              </View>
                              <TouchableOpacity onPress={handleExportAccounting} style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: isDark ? '#1A1A1A' : '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9' }}>
                                 <MaterialCommunityIcons name="printer-outline" size={24} color={brandColor} />
                              </TouchableOpacity>
                           </View>

                           {/* BALANCE DES PAIEMENTS CARD */}
                           <View style={{ backgroundColor: isDark ? '#1A1A1A' : '#FFF', padding: 28, borderRadius: 35, marginBottom: 32, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9', elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20 }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                 <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#F1F5F9' : '#0A0A0A', letterSpacing: 1 }}>{"RÉPARTITION DES FLUX"</Text>
                                 <MaterialIcons name="help-circle" size={20} color={brandColor} />
                              </View>

                              <View style={{ gap: 20 }}>
                                 <View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                                       <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                          <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: brandColor, marginRight: 10 }} />
                                          <Text style={{ fontWeight: '800', color: isDark ? '#AAAAAA' : '#475569', fontSize: 12 }}>{"ASSURANCES (PRISE EN CHARGE)"</Text>
                                       </View>
                                       <Text style={{ fontWeight: '900', color: isDark ? '#FFF' : '#1A1A1A' }}>{(accountingData.insured || 0).toLocaleString()} FC</Text>
                                    </View>
                                    <View style={{ height: 10, backgroundColor: isDark ? '#0A0A0A' : '#F1F5F9', borderRadius: 5, overflow: 'hidden' }}>
                                       <View style={{ width: `${(accountingData.insured / (accountingData.insured + accountingData.private || 1)) * 100}%`, height: '100%', backgroundColor: brandColor }} />
                                    </View>
                                 </View>

                                 <View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                                       <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                          <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 10 }} />
                                          <Text style={{ fontWeight: '800', color: isDark ? '#AAAAAA' : '#475569', fontSize: 12 }}>PRIVÉS (CASH / MOBILE)</Text>
                                       </View>
                                       <Text style={{ fontWeight: '900', color: isDark ? '#FFF' : '#1A1A1A' }}>{(accountingData.private || 0).toLocaleString()} FC</Text>
                                    </View>
                                    <View style={{ height: 10, backgroundColor: isDark ? '#0A0A0A' : '#F1F5F9', borderRadius: 5, overflow: 'hidden' }}>
                                       <View style={{ width: `${(accountingData.private / (accountingData.insured + accountingData.private || 1)) * 100}%`, height: '100%', backgroundColor: '#22C55E' }} />
                                    </View>
                                 </View>
                              </View>
                           </View>

                           {/* QUICK ACTIONS ROW */}
                           <View style={{ flexDirection: 'row', gap: 10, marginBottom: 32 }}>
                              <TouchableOpacity onPress={handleCreateJournal} style={{ flex: 1, backgroundColor: brandColor, paddingVertical: 15, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 4 }}>
                                 <MaterialIcons name="add-chart" size={22} color="#FFF" />
                                 <Text style={{ color: '#FFF', fontSize: 8, fontWeight: '900', marginTop: 5 }}>{"NOUVEAU"</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => setShowAutoModal(true)} style={{ flex: 1, backgroundColor: isDark ? '#1A1A1A' : '#FFF', paddingVertical: 15, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: autoJournalEnabled ? brandColor : (isDark ? '#2E2E2E' : '#E2E8F0') }}>
                                 <MaterialIcons name="help-circle" size={22} color={autoJournalEnabled ? brandColor : (isDark ? '#F1F5F9' : '#0A0A0A')} />
                                 <Text style={{ color: autoJournalEnabled ? brandColor : (isDark ? '#F1F5F9' : '#0A0A0A'), fontSize: 8, fontWeight: '900', marginTop: 5 }}>AUTO : {autoJournalEnabled ? autoJournalFreq.toUpperCase() : 'OFF'}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={handleCloseSession} style={{ flex: 1, backgroundColor: isDark ? '#1A1A1A' : '#FFF', paddingVertical: 15, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                                 <MaterialIcons name="lock-clock" size={22} color={isDark ? '#F1F5F9' : '#0A0A0A'} />
                                 <Text style={{ color: isDark ? '#F1F5F9' : '#0A0A0A', fontSize: 8, fontWeight: '900', marginTop: 5 }}>{"CLÔTURE"</Text>
                              </TouchableOpacity>
                           </View>

                           {/* JOURNALS LIST */}
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                              <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1.5, marginLeft: 4 }}>ARCHIVES DES JOURNAUX</Text>
                              <MaterialCommunityIcons name="sort-variant" size={20} color={brandColor} />
                           </View>

                           <View style={{ flexDirection: 'row', marginBottom: 25, gap: 8 }}>
                              {[
                                 { id: 'date_desc', label: 'Récents', icon: 'clock-outline' },
                                 { id: 'amount_desc', label: 'Montant', icon: 'currency-usd' },
                                 { id: 'count_desc', label: 'Volume', icon: 'chart-line' }
                              ].map(s => (
                                 <TouchableOpacity key={s.id} onPress={() => setJournalSort(s.id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: journalSort === s.id ? brandColor : (isDark ? '#1A1A1A' : '#FFF'), borderWidth: 1, borderColor: journalSort === s.id ? brandColor : (isDark ? '#2E2E2E' : '#E2E8F0') }}>
                                    <MaterialCommunityIcons name={s.icon} size={14} color={journalSort === s.id ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B')} />
                                    <Text style={{ fontSize: 9, fontWeight: '900', color: journalSort === s.id ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B'), marginLeft: 6 }}>{s.label.toUpperCase()}</Text>
                                 </TouchableOpacity>
                              ))}
                           </View>

                           {[...(accountingData.monthly_journals || [])].sort((a, b) => {
                              if (journalSort === 'amount_desc') return Number(b.total) - Number(a.total);
                              if (journalSort === 'count_desc') return Number(b.count) - Number(a.count);
                              return 0;
                           }).map((j, i) => (
                              <TouchableOpacity key={i} onPress={() => viewJournalDetails(j)} style={{ padding: 18, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 28, marginBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9', elevation: 2 }}>
                                 <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <LinearGradient colors={isDark ? ['#0A0A0A', '#1A1A1A'] : ['#F8FAFC', '#F1F5F9']} style={{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 18, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                                       <MaterialCommunityIcons name={j.status === 'open' ? "book-open-page-variant" : "book-check"} size={26} color={j.status === 'open' ? "#22C55E" : brandColor} />
                                    </LinearGradient>
                                    <View>
                                       <Text style={{ fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A', fontSize: 16 }}>{j.month.toUpperCase()}</Text>
                                       <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                          <Text style={{ fontSize: 11, color: isDark ? '#555555' : '#94A3B8', fontWeight: '700' }}>{j.count} Opérations • </Text>
                                          <Text style={{ fontSize: 10, color: j.status === 'open' ? "#22C55E" : (isDark ? '#555555' : '#94A3B8'), fontWeight: '900' }}>{j.status === 'open' ? 'EN COURS' : 'VÉRIFIÉ'}</Text>
                                       </View>
                                    </View>
                                 </View>
                                 <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontWeight: '900', color: brandColor, fontSize: 15 }}>{Number(j.total).toLocaleString()} FC</Text>
                                    <MaterialIcons name="chevron-right" size={22} color={isDark ? '#2E2E2E' : '#CBD5E1'} style={{ marginTop: 2 }} />
                                 </View>
                              </TouchableOpacity>
                           ))}
                        </FadeInView>
                     </ScrollView>
                  )}

                  {/* --- SECTION RAPPORTS --- */}
                  {activeView === 'reports' && (
                     <ScrollView contentContainerStyle={{ paddingTop: 125 + insets.top, paddingBottom: 130 + insets.bottom, paddingHorizontal: 20 }}>
                        <FadeInView>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                              <View>
                                 <Text style={{ fontSize: 26, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A', letterSpacing: -1 }}>{"RAPPORTS"</Text>
                                 <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#888888' : '#94A3B8' }}>Analyse des flux financiers</Text>
                              </View>
                              <TouchableOpacity style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: isDark ? '#1A1A1A' : '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9' }}>
                                 <MaterialIcons name="file-download" size={24} color={brandColor} />
                              </TouchableOpacity>
                           </View>

                           <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 20, padding: 4, marginBottom: 24, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9', elevation: 2 }}>
                              {['day', 'week', 'month', 'all'].map(p => (
                                 <TouchableOpacity key={p} onPress={() => setRecettePeriod(p)} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 16, backgroundColor: recettePeriod === p ? brandColor : 'transparent' }}>
                                    <Text style={{ color: recettePeriod === p ? '#FFF' : (isDark ? '#888888' : '#94A3B8'), fontSize: 11, fontWeight: '900' }}>{p === 'all' ? 'TOUT' : p.toUpperCase()}</Text>
                                 </TouchableOpacity>
                              ))}
                           </View>

                           {history.length === 0 ? (
                              renderEmptyState(
                                 "file-chart-outline",
                                 "Aucun rapport",
                                 "Il n'y a aucune activité enregistrée pour générer un rapport sur cette période."
                              )
                           ) : (() => {
                              const totalRev = history.reduce((acc, h) => acc + Number(h.amount), 0);
                              const todayStr = new Date().toDateString();
                              const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
                              const yesterdayStr = yesterday.toDateString();

                              const todayTotal = history.filter(h => new Date(h.created_at).toDateString() === todayStr).reduce((acc, h) => acc + Number(h.amount), 0);
                              const yesterdayTotal = history.filter(h => new Date(h.created_at).toDateString() === yesterdayStr).reduce((acc, h) => acc + Number(h.amount), 0);
                              const trend = yesterdayTotal > 0 ? Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100) : (todayTotal > 0 ? 100 : 0);

                              return (
                                 <>
                                    <LinearGradient colors={isDark ? ['#1A1A1A', '#0A0A0A'] : ['#FFF', '#F8FAFC']} style={{ padding: 24, borderRadius: 32, marginBottom: 32, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9', elevation: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20 }}>
                                       <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                          <View>
                                             <Text style={{ color: isDark ? '#888888' : '#94A3B8', fontSize: 10, fontWeight: '900', letterSpacing: 2 }}>{"PERFORMANCE GLOBALE"</Text>
                                             <Text style={{ fontSize: 36, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A', marginTop: 8 }}>{totalRev.toLocaleString()} <Text style={{ fontSize: 16, color: brandColor }}>FC</Text></Text>

                                             <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: trend >= 0 ? '#22C55E15' : '#EF444415', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' }}>
                                                <MaterialIcons name={trend >= 0 ? "trending-up" : "trending-down"} size={14} color={trend >= 0 ? "#22C55E" : "#EF4444"} />
                                                <Text style={{ fontSize: 11, fontWeight: '900', color: trend >= 0 ? "#22C55E" : "#EF4444", marginLeft: 4 }}>{trend > 0 ? '+' : ''}{trend}% vs hier</Text>
                                             </View>
                                          </View>
                                          <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: brandColor + '10', alignItems: 'center', justifyContent: 'center' }}>
                                             <MaterialCommunityIcons name="finance" size={32} color={brandColor} />
                                          </View>
                                       </View>

                                       <View style={{ height: 1, backgroundColor: isDark ? '#2E2E2E' : '#F1F5F9', marginVertical: 24 }} />

                                       <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                          <View style={{ flex: 1 }}>
                                             <Text style={{ color: isDark ? '#555555' : '#94A3B8', fontSize: 10, fontWeight: '900' }}>{"TOTAL ACTES"</Text>
                                             <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#E2E8F0' : '#1A1A1A', marginTop: 4 }}>{history.length}</Text>
                                          </View>
                                          <View style={{ width: 1, backgroundColor: isDark ? '#2E2E2E' : '#F1F5F9', marginHorizontal: 20 }} />
                                          <View style={{ flex: 1 }}>
                                             <Text style={{ color: isDark ? '#555555' : '#94A3B8', fontSize: 10, fontWeight: '900' }}>PANIER MOYEN</Text>
                                             <Text style={{ fontSize: 20, fontWeight: '900', color: '#22C55E', marginTop: 4 }}>{history.length > 0 ? Math.round(totalRev / history.length).toLocaleString() : 0} <Text style={{ fontSize: 10 }}>{"FC"</Text></Text>
                                          </View>
                                       </View>
                                    </LinearGradient>

                                    <Text style={{ fontSize: 14, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', marginBottom: 20, letterSpacing: 1, marginLeft: 4 }}>HISTORIQUE QUOTIDIEN</Text>

                                    {Object.entries(history.reduce((acc, h) => {
                                       const d = new Date(h.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                                       if (!acc[d]) acc[d] = { paid: 0, count: 0, services: {} };
                                       acc[d].paid += Number(h.amount);
                                       acc[d].count++;
                                       const s = h.service || 'Autre';
                                       acc[d].services[s] = (acc[d].services[s] || 0) + Number(h.amount);
                                       return acc;
                                    }, {})).map(([date, data], i) => (
                                       <View key={i} style={{ backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 32, marginBottom: 20, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9', elevation: 4, overflow: 'hidden' }}>
                                          <View style={{ padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#F8FAFC', borderBottomWidth: 1, borderBottomColor: isDark ? '#2E2E2E' : '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                             <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: brandColor + '10', alignItems: 'center', justifyContent: 'center', marginRight: 15 }}>
                                                   <MaterialCommunityIcons name="calendar-month" size={24} color={brandColor} />
                                                </View>
                                                <View>
                                                   <Text style={{ fontWeight: '900', color: isDark ? '#F1F5F9' : '#1A1A1A', fontSize: 16 }}>{date}</Text>
                                                   <Text style={{ fontSize: 11, color: '#22C55E', fontWeight: '700' }}>{data.count} Actes réalisés</Text>
                                                </View>
                                             </View>
                                             <Text style={{ fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A', fontSize: 18 }}>{data.paid.toLocaleString()} <Text style={{ fontSize: 11 }}>{"FC"</Text></Text>
                                          </View>

                                          <View style={{ padding: 20 }}>
                                             <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', marginBottom: 16, letterSpacing: 1.5 }}>RÉPARTITION PAR SERVICE :</Text>
                                             {Object.entries(data.services).map(([srv, val], idx) => {
                                                const percentage = Math.round((val / data.paid) * 100);
                                                return (
                                                   <View key={idx} style={{ marginBottom: 16 }}>
                                                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                                                         <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: brandColor, marginRight: 10 }} />
                                                            <Text style={{ fontSize: 13, color: isDark ? '#E2E8F0' : '#475569', fontWeight: '700' }}>{srv.toUpperCase()}</Text>
                                                         </View>
                                                         <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{val.toLocaleString()} <Text style={{ fontSize: 9 }}>{"FC"</Text></Text>
                                                      </View>
                                                      <View style={{ height: 6, backgroundColor: isDark ? '#0A0A0A' : '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                                                         <View style={{ width: `${percentage}%`, height: '100%', backgroundColor: brandColor, borderRadius: 3 }} />
                                                      </View>
                                                   </View>
                                                );
                                             })}
                                          </View>
                                       </View>
                                    ))}
                                 </>
                              );
                           })()}
                        </FadeInView>
                     </ScrollView>
                  )}
               </>
            )}
         </View>

         {/* BOTTOM SLIDE PANEL (SUMMARY) */}
         {activeBottomTab === 'summary' && (
            <Animated.View style={[
               { position: 'absolute', bottom: 85, left: 12, right: 12, maxHeight: height * 0.7, backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF', borderRadius: 40, borderWidth: 1, borderColor: isDark ? '#1A1A1A' : '#F1F5F9', elevation: 30, shadowColor: '#000', shadowOffset: { width: 0, height: -15 }, shadowOpacity: 0.3, shadowRadius: 25 },
               { transform: [{ translateY: bottomPanelAnim.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }
            ]}>
               <View style={{ width: 40, height: 5, backgroundColor: isDark ? '#2E2E2E' : '#E2E8F0', alignSelf: 'center', borderRadius: 3, marginTop: 12 }} />
               <View style={{ padding: 24, borderBottomWidth: 1, borderBottomColor: isDark ? '#1A1A1A' : '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                     <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#F1F5F9' : '#0A0A0A', letterSpacing: -0.8 }}>RÉSUMÉ ANALYTIQUE</Text>
                     <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#555555' : '#94A3B8' }}>{"Performance et flux de trésorerie"</Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleBottomTab('summary')} style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: isDark ? '#1A1A1A' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                     <MaterialIcons name="help-circle" size={24} color={brandColor} />
                  </TouchableOpacity>
               </View>
               <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 60 + insets.bottom }}>
                  {bottomLoading ? (
                     <ActivityIndicator size="large" color={brandColor} style={{ marginTop: 40 }} />
                  ) : summary && (
                     <View>
                        {/* MAIN CARD */}
                        <LinearGradient colors={Theme.colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 28, borderRadius: 32, marginBottom: 30, elevation: 8, shadowColor: brandColor, shadowOpacity: 0.4, shadowRadius: 15 }}>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <View>
                                 <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', letterSpacing: 2 }}>{"RECETTE AUJOURD'HUI"</Text>
                                 <Text style={{ fontSize: 38, fontWeight: '900', color: '#FFF', marginTop: 8 }}>{Number(summary.today?.total || 0).toLocaleString()} <Text style={{ fontSize: 16 }}>FC</Text></Text>
                              </View>
                              <View style={{ width: 50, height: 50, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                 <MaterialCommunityIcons name="wallet" size={28} color="#FFF" />
                              </View>
                           </View>
                           <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 20 }} />
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }}>{summary.today?.count || 0} Transactions réglées</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
                                 <MaterialIcons name={summary.today?.growth >= 0 ? "trending-up" : "trending-down"} size={16} color="#FFF" />
                                 <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900', marginLeft: 4 }}>{summary.today?.growth > 0 ? '+' : ''}{summary.today?.growth}%</Text>
                              </View>
                           </View>
                        </LinearGradient>

                        {/* SECONDARY STATS ROW */}
                        <View style={{ flexDirection: 'row', gap: 15, marginBottom: 30 }}>
                           <View style={{ flex: 1, backgroundColor: isDark ? '#1A1A1A' : '#F8FAFC', padding: 20, borderRadius: 28, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                              <Text style={{ fontSize: 9, fontWeight: '900', color: isDark ? '#AAAAAA' : '#64748B', marginBottom: 10 }}>{"SITUATION HEBDO"</Text>
                              <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>{Number(summary.week?.total || 0).toLocaleString()} FC</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                                 <Text style={{ fontSize: 11, fontWeight: '900', color: summary.week?.growth >= 0 ? '#22C55E' : '#EF4444' }}>{summary.week?.growth > 0 ? '+' : ''}{summary.week?.growth}%</Text>
                                 <Text style={{ fontSize: 10, color: isDark ? '#555555' : '#94A3B8', marginLeft: 6 }}>vs sem-1</Text>
                              </View>
                           </View>
                           <View style={{ flex: 1, backgroundColor: isDark ? '#1A1A1A' : '#F8FAFC', padding: 20, borderRadius: 28, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                              <Text style={{ fontSize: 9, fontWeight: '900', color: isDark ? '#AAAAAA' : '#64748B', marginBottom: 10 }}>{"PANIER MOYEN"</Text>
                              <Text style={{ fontSize: 18, fontWeight: '900', color: brandColor }}>{summary.today?.count > 0 ? Math.round(summary.today.total / summary.today.count).toLocaleString() : 0} FC</Text>
                              <Text style={{ fontSize: 10, color: isDark ? '#555555' : '#94A3B8', marginTop: 10, fontWeight: '700' }}>PAR TRANSACTION</Text>
                           </View>
                        </View>

                        {/* PROGRESS TO GOAL */}
                        <View style={{ marginBottom: 35, paddingHorizontal: 10 }}>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                              <Text style={{ fontSize: 12, fontWeight: '900', color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{"OBJECTIF DU MOIS"</Text>
                              <Text style={{ fontSize: 12, fontWeight: '900', color: brandColor }}>65%</Text>
                           </View>
                           <View style={{ height: 10, backgroundColor: isDark ? '#1A1A1A' : '#F1F5F9', borderRadius: 5, overflow: 'hidden' }}>
                              <View style={{ width: '65%', height: '100%', backgroundColor: brandColor, borderRadius: 5 }} />
                           </View>
                        </View>

                        {/* BY SERVICE BREAKDOWN */}
                        <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A', marginBottom: 20, letterSpacing: 1 }}>RÉPARTITION ANALYTIQUE</Text>
                        {summary.by_service?.map((s, i) => {
                           const percentage = Math.round((s.total / summary.today?.total) * 100) || 0;
                           return (
                              <View key={i} style={{ padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 28, marginBottom: 15, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                 <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginRight: 15 }}>
                                       <MaterialCommunityIcons name="tag-outline" size={20} color={brandColor} />
                                    </View>
                                    <View>
                                       <Text style={{ fontWeight: '900', color: isDark ? '#F1F5F9' : '#1A1A1A', fontSize: 14 }}>{s.service.toUpperCase()}</Text>
                                       <Text style={{ fontSize: 11, color: isDark ? '#888888' : '#94A3B8', marginTop: 2 }}>{percentage}% de la recette</Text>
                                    </View>
                                 </View>
                                 <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A', fontSize: 15 }}>{s.total.toLocaleString()}</Text>
                                    <Text style={{ fontSize: 10, color: brandColor, fontWeight: '800' }}>{"FC"</Text>
                                 </View>
                              </View>
                           );
                        })}
                     </View>
                  )}
               </ScrollView>
            </Animated.View>
         )}

         <PremiumFooter
            tabs={[
               { id: 'pending', icon: 'cash-multiple', label: bt.invoices },
               { id: 'history', icon: 'history', label: bt.history },
               { id: 'summary', icon: 'chart-pie', label: bt.summary },
            ]}
            activeTab={activeBottomTab === 'summary' ? 'summary' : activeTab}
            onTabPress={(tabId) => {
               if (tabId === 'summary') toggleBottomTab('summary');
               else {
                  setActiveTab(tabId);
                  if (tabId === 'history') fetchHistory();
                  else fetchInvoices();
                  if (activeBottomTab) toggleBottomTab('summary');
                  if (activeView !== 'dashboard') setActiveView('dashboard');
               }
            }}
         />

         <PremiumLeftDrawer
            isOpen={isLeftOpen}
            anim={leftAnim}
            onClose={() => toggleLeft(false)}
            navigation={navigation}
            activeView={activeView}
            setActiveView={setActiveView}
            menuItems={menuItems}
            roleName={t.roles.caisse}
            isDark={isDark}
            t={t}
         />

         {/* PAYMENT MODAL (Simplified for design brief) */}
         <Modal visible={showPaymentModal} animationType="" transparent>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
               <View style={{ backgroundColor: isDark ? '#0A0A0A' : '#FFF', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 24, paddingBottom: 40 + insets.bottom }}>
                  <View style={{ width: 40, height: 4, backgroundColor: isDark ? '#2E2E2E' : '#E2E8F0', alignSelf: 'center', borderRadius: 2, marginBottom: 20 }} />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                     <View>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>{"RÈGLEMENT FACTURE"</Text>
                        <Text style={{ color: brandColor, fontWeight: '900', fontSize: 18 }}>{activeInvoice?.amount.toLocaleString()} FC</Text>
                     </View>
                     <TouchableOpacity onPress={() => setShowPaymentModal(false)}><MaterialIcons name='close' size={28} color={isDark ? '#FFF' : '#0A0A0A'} /></TouchableOpacity>
                  </View>

                  {paymentMethod === 'insurance' ? (
                     <FadeInView style={{ backgroundColor: insuranceError ? '#EF444410' : (isInsuranceVerified ? '#22C55E10' : brandColor + '10'), padding: 24, borderRadius: 32, borderWidth: 1, borderColor: insuranceError ? '#EF444430' : (isInsuranceVerified ? '#22C55E30' : brandColor + '30'), marginBottom: 28 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                           <View style={{ width: 50, height: 50, borderRadius: 18, backgroundColor: insuranceError ? '#EF4444' : (isInsuranceVerified ? '#22C55E' : brandColor), alignItems: 'center', justifyContent: 'center', elevation: 4 }}>
                              <MaterialCommunityIcons name={insuranceError ? "" : (isInsuranceVerified ? "shield-check" : "shield-search")} size={28} color="#FFF" />
                           </View>
                           <View style={{ marginLeft: 16, flex: 1 }}>
                              <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>
                                 {insuranceError ? "CONTRAT INACTIF" : (isInsuranceVerified ? "STATUT CONFIRMÉ" : "VÉRIFICATION CONTRAT")}
                              </Text>
                              <Text style={{ fontSize: 13, color: insuranceError ? '#EF4444' : (isInsuranceVerified ? '#22C55E' : brandColor), fontWeight: '900' }}>
                                 {activeInvoice?.patient?.insurance?.name || 'ASSURANCE'}
                              </Text>
                           </View>
                        </View>

                        <View style={{ height: 1, backgroundColor: (insuranceError ? '#EF4444' : (isInsuranceVerified ? '#22C55E' : brandColor)) + '20', marginVertical: 15 }} />

                        <Text style={{ fontSize: 13, color: isDark ? '#AAAAAA' : '#64748B', lineHeight: 22, fontWeight: '600' }}>
                           {insuranceError ? insuranceError : (isInsuranceVerified ? "Le contrat est actif. Vous pouvez valider la prise en charge pour cette société." : "Veuillez vérifier l'état du contrat de l'assurance avant de valider la prestation.")}
                        </Text>

                        {insuranceError && (
                           <TouchableOpacity onPress={switchToPrivate} style={{ marginTop: 20, paddingVertical: 12, backgroundColor: '#EF444415', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#EF444430' }}>
                              <Text style={{ color: '#EF4444', fontWeight: '900', fontSize: 11 }}>{"PASSER EN MODE PRIVÉ (CASH)"</Text>
                           </TouchableOpacity>
                        )}
                     </FadeInView>
                  ) : (
                     <>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                           <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#AAAAAA' : '#64748B', letterSpacing: 1.5 }}>MODE DE PAIEMENT :</Text>
                           {activeInvoice?.patient?.is_insured && (
                              <TouchableOpacity onPress={() => { setPaymentMethod('insurance'); setIsInsuranceVerified(false); setInsuranceError(null); }}>
                                 <Text style={{ color: brandColor, fontWeight: '900', fontSize: 10 }}>{"RETOURNER À L'ASSURANCE"</Text>
                              </TouchableOpacity>
                           )}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                           {paymentMethods.map(m => (
                              <TouchableOpacity
                                 key={m.id}
                                 onPress={() => setPaymentMethod(m.id)}
                                 style={{ flex: 1, paddingVertical: 16, borderRadius: 20, backgroundColor: paymentMethod === m.id ? m.color + '15' : (isDark ? '#1A1A1A' : '#F1F5F9'), borderWidth: 2, borderColor: paymentMethod === m.id ? m.color : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                              >
                                 {m.type === 'icon' ? (
                                    <MaterialCommunityIcons name={m.icon} size={32} color={paymentMethod === m.id ? m.color : (isDark ? '#555555' : '#94A3B8')} />
                                 ) : (
                                    <View style={{ width: 54, height: 36, marginBottom: 4, borderRadius: 8, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                                       <Image source={m.logo} style={{ width: '100%', height: '100%' }} resizeMode="" />
                                    </View>
                                 )}
                                 <Text style={{ fontSize: 9, fontWeight: '900', color: paymentMethod === m.id ? m.color : (isDark ? '#555555' : '#94A3B8'), marginTop: 6 }}>{m.label}</Text>
                              </TouchableOpacity>
                           ))}
                        </View>
                     </>
                  )}

                  {paymentMethod !== 'cash' && paymentMethod !== 'insurance' && (
                     <FadeInView style={{ marginBottom: 24 }}>
                        <TextInput
                           style={{ height: 64, borderRadius: 24, backgroundColor: isDark ? '#1A1A1A' : '#F8FAFC', color: isDark ? '#FFF' : '#0A0A0A', paddingHorizontal: 24, fontSize: 20, fontWeight: '900', borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}
                           placeholder={"Entrez le numéro mobile...'
                           keyboardType=""
                           value={paymentPhone}
                           onChangeText={setPaymentPhone}
                        />
                        
                        {(paymentPhone || '').length >= 2 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -10, marginBottom: 10, marginLeft: 5 }}>
                            {detectOperator(paymentPhone).valid ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: operatorColor(detectOperator(paymentPhone).operator) + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                <MaterialCommunityIcons name="check-circle" size={10} color={operatorColor(detectOperator(paymentPhone).operator)} />
                                <Text style={{ fontSize: 9, fontWeight: '800', color: operatorColor(detectOperator(paymentPhone).operator), marginLeft: 4 }}>
                                  {detectOperator(paymentPhone).operator.toUpperCase()}
                                </Text>
                              </View>
                            ) : paymentPhone.length >= 9 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF444415', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                <MaterialCommunityIcons name="alert-circle" size={10} color="#EF4444" />
                                <Text style={{ fontSize: 9, fontWeight: '800', color: '#EF4444', marginLeft: 4 }}>{"NUMÉRO INVALIDE"</Text>
                              </View>
                            )}
                          </View>
                        )}
                     </FadeInView>
                  )}

                  <TouchableOpacity
                     onPress={paymentMethod === 'insurance' && !isInsuranceVerified ? handleVerifyInsurance : handleProcessPayment}
                     disabled={paymentMethod === 'insurance' && insuranceError}
                     style={{ height: 70, borderRadius: 35, overflow: 'hidden', opacity: (paymentMethod === 'insurance' && insuranceError) ? 0.5 : 1 }}
                  >
                     <LinearGradient colors={insuranceError ? ['#94A3B8', '#64748B'] : Theme.colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        {isSimulating || verifyingInsurance ? <ActivityIndicator color="" /> : (
                           <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 1 }}>
                              {paymentMethod === 'insurance'
                                 ? (isInsuranceVerified ? 'VALIDER LA PRISE EN CHARGE' : 'VÉRIFIER LE STATUT CONTRAT')
                                 : (paymentMethod === 'cash' ? 'VALIDER L\'ENCAISSEMENT' : 'LANCER LA TRANSACTION')}
                           </Text>
                        )}
                     </LinearGradient>
                  </TouchableOpacity>
               </View>
            </View>
         </Modal>

         <PremiumRightPanel
            isOpen={isRightOpen}
            anim={rightAnim}
            onClose={() => toggleRight(false)}
            isDark={isDark}
            isOnline={isOnline}
            lang={lang}
            toggleLang={toggleLang}
            toggleTheme={toggleTheme}
            roleName={t.roles.caisse}
            roleIcon="cash-register"
            onLogout={handleLogout}
            t={t}
            menuItems={menuItems}
            activeView={activeView}
            setActiveView={setActiveView}
         />
         {/* AUTO JOURNAL SETTINGS MODAL */}
         <Modal visible={showAutoModal} animationType="fade" transparent>
            <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.9)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
               <View style={{ width: '100%', backgroundColor: isDark ? '#0A0A0A' : '#FFF', borderRadius: 40, padding: 30, borderWidth: 1, borderColor: isDark ? '#1A1A1A' : '#E2E8F0', elevation: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
                     <View>
                        <Text style={{ fontSize: 22, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>{"JOURNAL AUTO"</Text>
                        <Text style={{ fontSize: 12, color: brandColor, fontWeight: '800' }}>AUTOMATISATION DES CYCLES</Text>
                     </View>
                     <TouchableOpacity onPress={() => setShowAutoModal(false)}><MaterialIcons name="close" size={28} color={isDark ? '#FFF' : '#0A0A0A'} /></TouchableOpacity>
                  </View>

                  <Text style={{ fontSize: 13, color: isDark ? '#AAAAAA' : '#64748B', fontWeight: '600', marginBottom: 25, lineHeight: 20 }}>{"Activez l'ouverture et la clôture automatique des journaux selon la durée souhaitée."</Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30, backgroundColor: isDark ? '#1A1A1A' : '#F8FAFC', padding: 20, borderRadius: 24 }}>
                     <Text style={{ fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>{autoJournalEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}</Text>
                     <Switch value={autoJournalEnabled} onValueChange={setAutoJournalEnabled} trackColor={{ false: '#767577', true: brandColor }} thumbColor={autoJournalEnabled ? '#FFF' : '#f4f3f4'} />
                  </View>

                  <Text style={[styles.label, { marginBottom: 15 }]}>DURÉE DE L'EXERCICE</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 30 }}>
                     {[
                        { id: 'day', label: 'JOUR' },
                        { id: 'week', label: 'SEMAINE' },
                        { id: 'month', label: 'MOIS' },
                        { id: 'quarter', label: 'TRIMESTRE' },
                        { id: 'semester', label: 'SEMESTRE' },
                        { id: 'year', label: 'ANNUEL' }
                     ].map(f => (
                        <TouchableOpacity
                           key={f.id}
                           onPress={() => setAutoJournalFreq(f.id)}
                           style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: autoJournalFreq === f.id ? brandColor : (isDark ? '#1A1A1A' : '#F1F5F9'), borderWidth: 1, borderColor: autoJournalFreq === f.id ? brandColor : 'transparent' }}
                        >
                           <Text style={{ color: autoJournalFreq === f.id ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B'), fontSize: 10, fontWeight: '900' }}>{f.label}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>

                  <TouchableOpacity onPress={handleSaveAutoSettings} disabled={isSubmitting} style={{ height: 60, borderRadius: 30, overflow: 'hidden', elevation: 4 }}>
                     <LinearGradient colors={Theme.colors.brandGradient} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '900', letterSpacing: 1 }}>{"ENREGISTRER"</Text>}
                     </LinearGradient>
                  </TouchableOpacity>
               </View>
            </View>
         </Modal>

         {/* JOURNAL DETAILS MODAL */}
         <Modal visible={showJournalDetails} animationType="" transparent>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
               <View style={{ height: height * 0.9, backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden' }}>
                  <View style={{ padding: 24, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderBottomWidth: 1, borderBottomColor: isDark ? '#2E2E2E' : '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                     <View>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>{"DÉTAILS JOURNAL"</Text>
                        <Text style={{ fontSize: 12, color: brandColor, fontWeight: '800' }}>{selectedJournal?.reference || 'CHARGEMENT...'}</Text>
                     </View>
                     <TouchableOpacity onPress={() => setShowJournalDetails(false)} style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: isDark ? '#2E2E2E' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                        <MaterialIcons name="help-circle" size={24} color={brandColor} />
                     </TouchableOpacity>
                  </View>

                  <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 + insets.bottom }}>
                     {journalLoading ? (
                        <View style={{ marginTop: 100, alignItems: 'center' }}>
                           <ActivityIndicator size="large" color={brandColor} />
                           <Text style={{ color: isDark ? '#AAAAAA' : '#64748B', fontWeight: '900', marginTop: 20, fontSize: 12 }}>{"RÉCUPÉRATION DES OPÉRATIONS..."</Text>
                        </View>
                     ) : selectedJournal && (
                        <FadeInView>
                           {/* SUMMARY BAR */}
                           <View style={{ flexDirection: 'row', gap: 15, marginBottom: 30 }}>
                              <View style={{ flex: 1, backgroundColor: brandColor + '10', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: brandColor + '20' }}>
                                 <Text style={{ fontSize: 9, fontWeight: '900', color: brandColor, marginBottom: 8 }}>TOTAL RECETTE</Text>
                                 <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>{Number(selectedJournal.closing_amount).toLocaleString()} FC</Text>
                              </View>
                              <View style={{ flex: 1, backgroundColor: '#22C55E10', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#22C55E20' }}>
                                 <Text style={{ fontSize: 9, fontWeight: '900', color: '#22C55E', marginBottom: 8 }}>{"ACTES TOTAL"</Text>
                                 <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>{selectedJournal.invoices_count}</Text>
                              </View>
                           </View>

                           <View style={{ backgroundColor: isDark ? '#1A1A1A' : '#FFF', padding: 20, borderRadius: 24, marginBottom: 30, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                                 <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8' }}>OUVERT LE</Text>
                                 <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>{new Date(selectedJournal.opened_at).toLocaleString()}</Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                                 <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8' }}>{"CLÔTURÉ LE"</Text>
                                 <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>{selectedJournal.closed_at ? new Date(selectedJournal.closed_at).toLocaleString() : 'EN COURS'}</Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                 <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8' }}>CAISSIER</Text>
                                 <Text style={{ fontSize: 11, fontWeight: '900', color: brandColor }}>{selectedJournal.user?.name || 'ADMIN'}</Text>
                              </View>
                           </View>

                           <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', marginBottom: 20, letterSpacing: 1.5 }}>{"LISTE DES OPÉRATIONS"</Text>
                           {selectedJournal.invoices?.length === 0 ? (
                              <Text style={{ textAlign: 'center', color: '#64748B', marginTop: 20 }}>Aucune opération trouvée.</Text>
                           ) : selectedJournal.invoices.map((inv, idx) => (
                              <View key={inv.id} style={{ padding: 18, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 24, marginBottom: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flex: 1 }}>
                                       <Text style={{ fontSize: 14, fontWeight: '800', color: isDark ? '#FFF' : '#0A0A0A' }}>{inv.patient?.first_name} {inv.patient?.last_name}</Text>
                                       <Text style={{ fontSize: 10, color: isDark ? '#888888' : '#94A3B8', marginTop: 2 }}>{(inv.service || 'SERVICE').toUpperCase()} • {(inv.payment_method || 'CASH').toUpperCase()}</Text>
                                    </View>
                                    <Text style={{ fontSize: 16, fontWeight: '900', color: inv.payment_method === 'insurance' ? brandColor : '#22C55E' }}>{Number(inv.amount).toLocaleString()} FC</Text>
                                 </View>
                              </View>
                           ))}
                        </FadeInView>
                     )}
                  </ScrollView>
               </View>
            </View>
         </Modal>
         {/* INSURANCE REPORT MODAL */}
         <Modal visible={!!selectedInsurance} animationType="slide" transparent>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
               <View style={{ height: height * 0.9, backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden' }}>
                  <View style={{ padding: 24, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderBottomWidth: 1, borderBottomColor: isDark ? '#2E2E2E' : '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                     <View>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>{"RELEVÉ MENSUEL"</Text>
                        <Text style={{ fontSize: 12, color: brandColor, fontWeight: '800' }}>{selectedInsurance?.name}</Text>
                     </View>
                     <TouchableOpacity onPress={() => { setSelectedInsurance(null); setInsuranceReport(null); }} style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: isDark ? '#2E2E2E' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                        <MaterialIcons name="help-circle" size={24} color={brandColor} />
                     </TouchableOpacity>
                  </View>

                  <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 + insets.bottom }}>
                     {reportLoading ? (
                        <View style={{ marginTop: 100, alignItems: 'center' }}>
                           <ActivityIndicator size="large" color={brandColor} />
                           <Text style={{ color: isDark ? '#AAAAAA' : '#64748B', fontWeight: '900', marginTop: 20, fontSize: 12 }}>{"GÉNÉRATION DU RAPPORT..."</Text>
                        </View>
                     ) : insuranceReport && (
                        <FadeInView>
                           {/* STATS CARDS */}
                           <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                              <View style={{ flex: 1, backgroundColor: brandColor, padding: 20, borderRadius: 24 }}>
                                 <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '900' }}>TOTAL BRUT</Text>
                                 <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900', marginTop: 4 }}>{insuranceReport.summary.total_amount.toLocaleString()} FC</Text>
                              </View>
                              <View style={{ flex: 1, backgroundColor: '#22C55E', padding: 20, borderRadius: 24 }}>
                                 <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '900' }}>{"RÉGLÉ"</Text>
                                 <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900', marginTop: 4 }}>{insuranceReport.summary.settled_amount.toLocaleString()} FC</Text>
                              </View>
                           </View>

                           <View style={{ padding: 24, backgroundColor: '#F9AB00', borderRadius: 24, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <View>
                                 <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '900' }}>SOLDE À RECOUVRER</Text>
                                 <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 4 }}>{insuranceReport.summary.pending_amount.toLocaleString()} FC</Text>
                              </View>
                              <TouchableOpacity onPress={() => setShowSettleModal(true)} style={{ backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}>
                                 <Text style={{ color: '#F9AB00', fontWeight: '900', fontSize: 11 }}>{"RÉGLER"</Text>
                              </TouchableOpacity>
                           </View>

                           <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', marginBottom: 16, letterSpacing: 1.5 }}>DÉTAIL DES PRESTATIONS</Text>
                           {insuranceReport.invoices.map((inv, idx) => (
                              <View key={inv.id} style={{ padding: 16, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <View style={{ flex: 1 }}>
                                       <Text style={{ fontSize: 14, fontWeight: '800', color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{inv.patient?.first_name} {inv.patient?.last_name}</Text>
                                       <Text style={{ fontSize: 10, color: isDark ? '#888888' : '#94A3B8', marginTop: 2 }}>{inv.service.toUpperCase()} • {new Date(inv.created_at).toLocaleDateString()}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                       <Text style={{ fontSize: 15, fontWeight: '900', color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{inv.amount.toLocaleString()} FC</Text>
                                       <Text style={{ fontSize: 9, fontWeight: '900', color: inv.status === 'settled' ? '#22C55E' : '#F9AB00' }}>{inv.status === 'settled' ? 'ENCAISSÉ' : 'À PAYER'}</Text>
                                    </View>
                                 </View>
                              </View>
                           ))}

                           <TouchableOpacity style={{ marginTop: 20, height: 60, borderRadius: 20, backgroundColor: brandColor + '10', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: brandColor + '20' }}>
                              <Text style={{ color: brandColor, fontWeight: '900' }}>{"ENVOYER LE RELEVÉ PAR EMAIL"</Text>
                           </TouchableOpacity>
                        </FadeInView>
                     )}
                  </ScrollView>
               </View>
            </View>
         </Modal>

         {/* SETTLE MODAL */}
         <Modal visible={showSettleModal} transparent animationType="">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
               <View style={{ width: '100%', backgroundColor: isDark ? '#0A0A0A' : '#FFF', borderRadius: 32, padding: 24 }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A', marginBottom: 12 }}>{"VALIDER RÈGLEMENT"</Text>
                  <Text style={{ color: isDark ? '#AAAAAA' : '#64748B', marginBottom: 20 }}>Veuillez entrer la référence du paiement (Bordereau ou Chèque).</Text>
                  <TextInput
                     style={{ height: 60, backgroundColor: isDark ? '#1A1A1A' : '#F1F5F9', borderRadius: 16, paddingHorizontal: 20, color: isDark ? '#FFF' : '#0A0A0A', fontWeight: '900', marginBottom: 20 }}
                     placeholder={"Référence paiement..." placeholderTextColor=""
                     value={paymentRef}
                     onChangeText={setPaymentRef}
                  />
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                     <TouchableOpacity onPress={() => setShowSettleModal(false)} style={{ flex: 1, height: 54, borderRadius: 16, backgroundColor: isDark ? '#2E2E2E' : '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontWeight: '900', color: isDark ? '#AAAAAA' : '#64748B' }}>{"ANNULER"</Text>
                     </TouchableOpacity>
                     <TouchableOpacity onPress={handleSettleInvoices} disabled={isSubmitting} style={{ flex: 1, height: 54, borderRadius: 16, backgroundColor: brandColor, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontWeight: '900', color: '#FFF' }}>VALIDER</Text>
                     </TouchableOpacity>
                  </View>
               </View>
            </View>
         </Modal>
      </View>
   );
}

const createStyles = (C, S, brandColor) => StyleSheet.create({
   mainContainer: {
      flex: 1,
      backgroundColor: C.bg
   },
   label: {
      fontSize: 11,
      fontWeight: '900',
      color: C.sub,
      letterSpacing: 1.5
   },
   card: {
      backgroundColor: C.surface,
      borderRadius: 28,
      padding: 20,
      borderWidth: 1,
      borderColor: C.border,
      elevation: 4
   },
   input: {
      height: 56,
      backgroundColor: C.bg,
      borderRadius: 16,
      paddingHorizontal: 20,
      color: C.text,
      fontWeight: '900',
      borderWidth: 1,
      borderColor: C.border
   },
   modalSheet: {
      width: '100%',
      backgroundColor: C.bg,
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
      overflow: 'hidden'
   },
   modalHeader: {
      padding: 24,
      backgroundColor: C.surface,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
   }
});
