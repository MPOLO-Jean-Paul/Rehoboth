import React, { useEffect, useState, useRef, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, TextInput, Animated, Switch, StatusBar, Modal, FlatList, AppState } from 'react-native';
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
import PremiumFooter from '../components/PremiumFooter';
import ProfileView from '../components/ProfileView';
import { Theme } from '../constants/theme';
import Storage from '../services/Storage';
import { useTheme } from '../hooks/useTheme';

const { width, height } = Theme.layout;

export default function PharmacyScreen({ navigation, route }) {
   const { isDark, C, S, brandColor, themeMode, toggleTheme, lang, toggleLang, isOnline } = useTheme();
   const styles = createStyles(C, S, brandColor);
   const insets = useSafeAreaInsets();
   const { showToast } = useContext(ToastContext);
   const t = translations[lang] || translations.fr;
   const bt = t.bottomTabs || {};

   const [activeTab, setActiveTab] = useState('dispense');
   const [activeView, setActiveView] = useState('dispense'); // dispense, stock, history, prices
   const [activeBottomTab, setActiveBottomTab] = useState(null);
   const [deliveryHistory, setDeliveryHistory] = useState([]);
   const [visits, setVisits] = useState([]);
   const [medicines, setMedicines] = useState([]);
   const [expiring, setExpiring] = useState({ expiring: [], expired: [] });
   const [loading, setLoading] = useState(true);
   const [bottomLoading, setBottomLoading] = useState(false);
   const [selectedVisitForDispense, setSelectedVisitForDispense] = useState(null);
   const [showDispenseModal, setShowDispenseModal] = useState(false);
   const [selectedDispenseMed, setSelectedDispenseMed] = useState(null);
   const [dispenseQty, setDispenseQty] = useState('1');
   const [dispenseItems, setDispenseItems] = useState([]);
   const [paymentMode, setPaymentMode] = useState('cash');
   const [insights, setInsights] = useState({ fast_movers: [], slow_movers: [], to_renew: [], all: [] });

   // Sales States
   const [salesData, setSalesData] = useState({ total_revenue: 0, items_sold: [] });
   const [salesPeriod, setSalesPeriod] = useState('day'); // day, week, month

   // Modal States
   const [showAddModal, setShowAddModal] = useState(false);
   const [showNewModal, setShowNewModal] = useState(false);
   const [selectedMed, setSelectedMed] = useState(null);
   const [formQty, setFormQty] = useState('');
   const [formThreshold, setFormThreshold] = useState('');
   const [formExpiry, setFormExpiry] = useState('');
   const [newMed, setNewMed] = useState({ name: '', dosage: '', price: '', low_stock_threshold: '10' });
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [stockAddStep, setStockAddStep] = useState(1); // 1: Select Med, 2: Enter Details

   const [searchQuery, setSearchQuery] = useState('');
   const [stockSearch, setStockSearch] = useState('');
   const [modalSearch, setModalSearch] = useState('');

   // Panel States
   const [isRightOpen, setIsRightOpen] = useState(false);
   const [isLeftOpen, setIsLeftOpen] = useState(false);
   const rightAnim = useRef(new Animated.Value(width)).current;
   const leftAnim = useRef(new Animated.Value(-width)).current;
   const [showProblemModal, setShowProblemModal] = useState(false);
   const [problemData, setProblemData] = useState({ type: 'rupture', medicine_id: null, message: '' });
   const bottomPanelAnim = useRef(new Animated.Value(0)).current;

   useEffect(() => {
      loadCachedData();
      fetchData();
      if (activeView === 'sales') fetchSales();

      const startInterval = () => {
         return setInterval(() => {
            fetchData(true);
            if (activeView === 'history') fetchDeliveryHistory(true);
            if (activeView === 'sales') fetchSales(true);
         }, 10000);
      };

      let interval = startInterval();

      const subscription = AppState.addEventListener('change', nextAppState => {
         if (nextAppState === 'active') {
            fetchData(true);
            interval = startInterval();
         } else {
            clearInterval(interval);
         }
      });

      return () => {
         clearInterval(interval);
         subscription.remove();
      };
   }, [activeView, salesPeriod]);

   useEffect(() => {
      const timer = setTimeout(() => {
         fetchData(true);
      }, 500);
      return () => clearTimeout(timer);
   }, [searchQuery, stockSearch]);

   useEffect(() => {
      const requestedTab = route.params?.tab;
      if (requestedTab && ['dispense', 'stock', 'history', 'prices', 'sales'].includes(requestedTab)) {
         setActiveView(requestedTab);
         setActiveTab(requestedTab);
         navigation.setParams({ tab: null });
      }

      if (route.params?.visitId && visits.length > 0) {
         const visit = visits.find(v => String(v.id) === String(route.params.visitId));
         if (visit) {
            setSelectedVisitForDispense(visit);
            setShowDispenseModal(true);
            setActiveView('dispense');
            setActiveTab('dispense');
            navigation.setParams({ visitId: null });
         }
      }
   }, [route.params?.visitId, route.params?.tab, visits]);

   const loadCachedData = async () => {
      const cached = await Storage.get('pharmacy_data');
      if (cached) {
         setVisits(cached.visits || []);
         setMedicines(cached.medicines || []);
         setInsights(cached.insights || { fast_movers: [], slow_movers: [], to_renew: [], all: [] });
         setLoading(false);
      }
   };

   const fetchData = async (isBg = false) => {
      if (!isBg && !visits.length) setLoading(true);
      try {
         const [prescResp, medsResp, insightsResp] = await Promise.all([
            api.get('/pharmacy/prescriptions', { params: { search: searchQuery } }),
            api.get('/pharmacy/medicines', { params: { search: stockSearch } }),
            api.get('/pharmacy/inventory-insights')
         ]);
         
         const data = {
            visits: prescResp.data.data || prescResp.data,
            medicines: medsResp.data.data || medsResp.data,
            insights: insightsResp.data
         };

         setVisits(data.visits);
         setMedicines(data.medicines);
         setInsights(data.insights);

         // Sync to local storage
         Storage.save('pharmacy_data', data);
      } catch (e) { if (!isBg) showToast(parseError(e), 'error'); }
      finally { if (!isBg) setLoading(false); }
   };

   const fetchDeliveryHistory = async (isBg = false) => {
      if (!isBg) setLoading(true);
      try {
         const resp = await api.get('/pharmacy/dispensed-today');
         setDeliveryHistory(resp.data.data || resp.data);
      } catch (e) {
         if (!isBg) showToast("Erreur historique", "error");
      } finally {
         if (!isBg) setLoading(false);
      }
   };

   const fetchSales = async (isBg = false) => {
      if (!isBg) setLoading(true);
      try {
         const resp = await api.get('/pharmacy/sales', { params: { period: salesPeriod } });
         setSalesData(resp.data);
      } catch (e) {
         if (!isBg) showToast("Erreur ventes", "error");
      } finally {
         if (!isBg) setLoading(false);
      }
   };

   const fetchExpiry = async () => {
      setBottomLoading(true);
      try {
         const resp = await api.get('/pharmacy/expiry');
         setExpiring(resp.data);
      } catch (e) {
         setExpiring({ expiring: [], expired: [] });
      } finally { setBottomLoading(false); }
   };

   const handleAddStock = async () => {
      if (!selectedMed || !formQty) return showToast("Informations manquantes", "error");
      setIsSubmitting(true);
      try {
         await api.post('/pharmacy/stock', {
            medicine_id: selectedMed.id,
            quantity: parseInt(formQty),
            expiry_date: formExpiry,
            low_stock_threshold: formThreshold ? parseInt(formThreshold) : undefined,
            reason: 'Réapprovisionnement'
         });
         showToast("Stock mis à jour", "success");
         setShowAddModal(false);
         setFormQty('');
         setFormExpiry('');
         setFormThreshold('');
         setStockAddStep(1);
         fetchData();
      } catch (e) { showToast(parseError(e), 'error'); }
      finally { setIsSubmitting(false); }
   };

   const handleCreateMed = async () => {
      if (!newMed.name || !newMed.price) return showToast("Nom et prix requis", "error");
      setIsSubmitting(true);
      try {
         await api.post('/pharmacy/medicines', {
            ...newMed,
            price: parseFloat(newMed.price),
            low_stock_threshold: parseInt(newMed.low_stock_threshold) || 10
         });
         showToast("Produit ajouté au catalogue", "success");
         setShowNewModal(false);
         setNewMed({ name: '', dosage: '', price: '', low_stock_threshold: '10' });
         fetchData();
      } catch (e) { showToast(parseError(e), 'error'); }
      finally { setIsSubmitting(false); }
   };

   const handleCancelPrescription = async (visitId) => {
      setIsSubmitting(true);
      try {
         await api.post(`/pharmacy/cancel/${visitId}`);
         showToast("Ordonnance annulée et stock restitué", "success");
         fetchData();
      } catch (e) {
         showToast(e.response?.data?.message || t.error, 'error');
      } finally {
         setIsSubmitting(false);
      }
   };

   const handleSendDailyReport = async () => {
      setIsSubmitting(true);
      try {
         const resp = await api.post('/pharmacy/report/daily');
         showToast(resp.data.message, 'success');
      } catch (e) {
         showToast(parseError(e), 'error');
      } finally {
         setIsSubmitting(false);
      }
   };

   const openDispenseModal = (visit) => {
      setSelectedVisitForDispense(visit);

      let initialItems = [];
      let notFoundItems = [];
      // Utilisation de visit.items (format structuré renvoyé par le nouveau PrescriptionController)
      const itemsToProcess = visit.items || visit.prescription_items || [];

      if (Array.isArray(itemsToProcess)) {
         itemsToProcess.forEach(pItem => {
            if (!pItem) return;

            // Support pour format legacy (chaîne de caractères) ou objet
            const itemName = typeof pItem === 'string' ? pItem : (pItem.name || '');
            const itemQty = typeof pItem === 'string' ? 1 : (pItem.quantity || 1);
            const itemDosage = typeof pItem === 'string' ? '' : (pItem.dosage || '');
            const itemInstructions = typeof pItem === 'string' ? '' : (pItem.instructions || '');
            const itemMedId = typeof pItem === 'string' ? null : pItem.medicine_id;
            const itemStatus = typeof pItem === 'string' ? 'pending' : (pItem.status || 'pending');
            const itemPrice = typeof pItem === 'string' ? 0 : (pItem.price || 0);

            // Match par ID ou par nom dans le catalogue local
            let matchedMed = medicines.find(m => m.id === itemMedId);
            if (!matchedMed && itemName) {
               matchedMed = medicines.find(m => m.name && m.name.toLowerCase() === itemName.toLowerCase());
            }

            if (itemStatus === 'billed' || itemStatus === 'dispensed') {
               // Item already processed
               initialItems.push({
                  medicine_id: itemMedId || (matchedMed ? matchedMed.id : null),
                  name: itemName || (matchedMed ? matchedMed.name : 'Produit inconnu'),
                  dosage: itemDosage || (matchedMed ? matchedMed.dosage : ''),
                  instructions: itemInstructions,
                  quantity: itemQty,
                  price: itemPrice || (matchedMed ? matchedMed.price : 0),
                  prescribed: true,
                  isBilled: true,
                  max_available: (matchedMed ? matchedMed.stock_quantity : 0) + itemQty
               });
            } else if (matchedMed) {
               const available = matchedMed.stock_quantity || 0;
               if (available > 0) {
                  // On propose la quantité prescrite, plafonnée par le stock disponible
                  const qtyToDispense = Math.min(pItem.quantity || 1, available);

                  initialItems.push({
                     medicine_id: matchedMed.id,
                     name: matchedMed.name,
                     dosage: pItem.dosage || matchedMed.dosage || '',
                     instructions: pItem.instructions || '',
                     quantity: qtyToDispense,
                     price: pItem.price || matchedMed.price,
                     prescribed: true,
                     isBilled: false,
                     max_available: available
                  });

                  if (available < (pItem.quantity || 1)) {
                     notFoundItems.push(`${pItem.name} (Stock partiel: ${available}/${pItem.quantity})`);
                  }
               } else {
                  notFoundItems.push(`${pItem.name} (RUPTURE DE STOCK)`);
               }
            } else if (pItem.name) {
               notFoundItems.push(`${pItem.name} (Non répertorié)`);
            }
         });
      }

      setDispenseItems(initialItems);

      // Alerter le pharmacien sur les produits indisponibles ou non trouvés
      if (notFoundItems.length > 0) {
         setTimeout(() => {
            showToast(`Attention: ${notFoundItems.join(', ')}`, 'warning');
         }, 500);
      }

      setSelectedDispenseMed(null);
      setDispenseQty('1');
      setPaymentMode(visit?.is_insured ? 'insurance' : 'cash');
      setShowDispenseModal(true);
   };

   const addDispenseItem = () => {
      if (!selectedDispenseMed) return;
      const quantity = parseInt(dispenseQty, 10);
      if (!quantity || quantity < 1) return;
      setDispenseItems((current) => {
         const existing = current.find((item) => item.medicine_id === selectedDispenseMed.id);
         if (existing) {
            return current.map((item) => item.medicine_id === selectedDispenseMed.id ? { ...item, quantity: item.quantity + quantity } : item);
         }
         return [...current, {
            medicine_id: selectedDispenseMed.id,
            quantity,
            name: selectedDispenseMed.name,
            price: selectedDispenseMed.price,
            dosage: selectedDispenseMed.dosage || '',
            instructions: '',
            prescribed: false
         }];
      });
      setDispenseQty('1');
   };

   const handleDispense = async () => {
      if (!selectedVisitForDispense || dispenseItems.length === 0) return showToast(t.error, 'error');
      setIsSubmitting(true);
      try {
         await api.post(`/pharmacy/dispense/${selectedVisitForDispense.id}`, { items: dispenseItems, payment_mode: paymentMode });
         showToast(t.success, 'success'); setShowDispenseModal(false); setSelectedVisitForDispense(null); setDispenseItems([]); fetchData();
      } catch (e) { showToast(parseError(e), 'error'); }
      finally { setIsSubmitting(false); }
   };

   const toggleBottomTab = (tab) => {
      if (activeBottomTab === tab) {
         setActiveBottomTab(null);
         Animated.spring(bottomPanelAnim, { toValue: 0, friction: 8, useNativeDriver: true }).start();
         return;
      }
      setActiveBottomTab(tab);
      Animated.spring(bottomPanelAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
      if (tab === 'expiry') fetchExpiry();
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

   const pharmacyMenu = [
      { id: 'dispense', label: 'Délivrance', icon: 'pill' },
      { id: 'stock', label: 'Stock', icon: 'package-variant-closed' },
      { id: 'history', label: 'Historique', icon: 'history' },
      { id: 'prices', label: 'État Produits', icon: 'clipboard-list-outline' },
      { id: 'sales', label: 'Ventes', icon: 'chart-line' },
      { id: 'analytics', label: 'Analyses', icon: 'google-analytics' },
   ];

   const lowStockMeds = medicines.filter(m => m.stock_quantity <= m.low_stock_threshold);
   const dispenseTotal = dispenseItems.reduce((sum, item) => {
      // Use item.price directly (set when pre-filling from prescription or adding manually)
      // Fallback: look up from medicines catalog if price not set
      const price = Number(item.price) || Number(medicines.find(m => m.id === item.medicine_id)?.price) || 0;
      return sum + (price * (item.quantity || 1));
   }, 0);

   const renderEmptyState = (icon, title, message) => (
      <FadeInView style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 }}>
         <View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: isDark ? '#1A1A1A' : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
            <MaterialCommunityIcons name={icon} size={48} color={brandColor} />
         </View>
         <Text style={{ fontSize: 22, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A', marginBottom: 12, textAlign: 'center' }}>{title}</Text>
         <Text style={{ fontSize: 14, color: isDark ? '#888888' : '#64748B', textAlign: 'center', lineHeight: 24, fontWeight: '600' }}>{message}</Text>
         <TouchableOpacity onPress={() => fetchData()} style={{ marginTop: 32, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 20, backgroundColor: brandColor }}>
            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 13 }}>ACTUALISER</Text>
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
            subtitle={pharmacyMenu.find(m => m.id === activeView)?.label || 'PHARMACIE'}
            icon=""
            isDark={isDark}
            navigation={navigation}
         />

         <FloatingActionDock
            title={activeView === 'stock' ? 'Stock pharmacie' : activeView === 'dispense' ? 'Ordonnances' : 'Actions pharmacie'}
            actions={[
               activeView !== 'dispense' && { key: 'back-dispense', icon: 'arrow-back', onPress: () => { setActiveView('dispense'); setActiveTab('dispense'); if (activeBottomTab) toggleBottomTab('expiry'); } },
               activeView === 'stock' && { key: 'stock-add', icon: 'add', onPress: () => { setSelectedMed(null); setStockAddStep(1); setShowAddModal(true); }, active: true },
               activeView === 'stock' && { key: 'new-med', icon: 'library-add', onPress: () => setShowNewModal(true), color: '#3498DB' },
               { key: 'refresh', icon: 'refresh', onPress: fetchData },
            ]}
         />

         <ScrollView
            contentContainerStyle={{ paddingTop: 110 + insets.top, paddingBottom: 130 + insets.bottom }}
            showsVerticalScrollIndicator={false}
         >
            <View style={{ paddingHorizontal: 20, paddingTop: insets.top > 40 ? 10 : 0 }}>
               {activeView === 'profile' ? (
                  <FadeInView>
                     <ProfileView onBack={() => setActiveView('dispense')} />
                  </FadeInView>
               ) : (
                  <>
                     <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                        <View style={{ flex: 1.2, backgroundColor: brandColor, padding: 18, borderRadius: 28, elevation: 6 }}>
                           <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>RECETTE DU JOUR</Text>
                           <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '900', marginTop: 6 }}>{deliveryHistory.reduce((acc, h) => acc + Number(h.total || 0), 0).toLocaleString()} <Text style={{ fontSize: 10 }}>FC</Text></Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: isDark ? '#1A1A1A' : '#FFF', padding: 18, borderRadius: 28, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9' }}>
                           <Text style={{ color: isDark ? '#888888' : '#94A3B8', fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>EN ATTENTE</Text>
                           <Text style={{ color: isDark ? '#FFF' : '#0A0A0A', fontSize: 20, fontWeight: '900', marginTop: 6 }}>{visits.length}</Text>
                        </View>
                     </View>

                     {activeView === 'dispense' && (
                        <FadeInView>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                              <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1 }}>ORDONNANCES À TRAITER</Text>
                              <TouchableOpacity onPress={() => fetchData(false)}><MaterialIcons name="refresh" size={24} color={brandColor} /></TouchableOpacity>
                           </View>

                           <View style={{ marginBottom: 20 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 20, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9' }}>
                                 <MaterialIcons name="search" size={22} color={brandColor} />
                                 <TextInput
                                    style={{ flex: 1, marginLeft: 10, color: isDark ? '#FFF' : '#0A0A0A', fontWeight: '600' }}
                                    placeholder="Rechercher une ordonnance..." placeholderTextColor={isDark ? "#555555" : '#94A3B8'}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                 />
                              </View>
                           </View>

                           {loading ? (
                              <View>{[1, 2, 3].map(i => <SkeletonItem key={i} height={100} style={{ marginBottom: 16, borderRadius: 28 }} />)}</View>
                           ) : (
                              visits.length > 0 ? visits.map((item, index) => (
                                 <FadeInView key={item.id} delay={index * 50}>
                                    <PressableScale
                                       style={{ flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 32, marginBottom: 16, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9' }}
                                       onPress={() => openDispenseModal(item)}
                                    >
                                       <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                                          <MaterialCommunityIcons name="account-circle" size={30} color={brandColor} />
                                       </View>
                                       <View style={{ flex: 1, marginLeft: 18 }}>
                                          <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{item.patient?.first_name} {item.patient?.last_name}</Text>
                                          <Text style={{ color: isDark ? '#AAAAAA' : '#64748B', fontSize: 12, fontWeight: '700', marginTop: 6 }}>
                                             {item.items?.length || item.prescription_items?.length || 0} Médicaments • {item.patient?.is_insured ? 'Assurance' : 'Cash'}
                                          </Text>
                                       </View>
                                       <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                          <TouchableOpacity 
                                             onPress={() => handleCancelPrescription(item.id)}
                                             style={{ marginRight: 15, padding: 8, borderRadius: 12, backgroundColor: '#EF444415' }}
                                          >
                                             <MaterialIcons name="cancel" size={22} color="#EF4444" />
                                          </TouchableOpacity>
                                          <MaterialIcons name="chevron-right" size={24} color={brandColor} />
                                       </View>
                                    </PressableScale>
                                 </FadeInView>
                              )) : renderEmptyState("pill-off", "Aucune ordonnance", "Toutes les ordonnances ont été traitées.")
                           )}
                        </FadeInView>
                     )}

                     {activeView === 'stock' && (
                        <FadeInView>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                              <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1 }}>GESTION DU STOCK</Text>
                              <View style={{ flexDirection: 'row' }}>
                                 <TouchableOpacity onPress={() => { setSelectedMed(null); setStockAddStep(1); setShowAddModal(true); }} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: brandColor, alignItems: 'center', justifyContent: 'center' }}>
                                    <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
                                 </TouchableOpacity>
                                 <TouchableOpacity onPress={() => setShowNewModal(true)} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#3498DB', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
                                    <MaterialIcons name="library-add" size={20} color="#FFF" />
                                 </TouchableOpacity>
                              </View>
                           </View>

                           {lowStockMeds.length > 0 && (
                              <View style={{ marginBottom: 24 }}>
                                 <Text style={{ fontSize: 10, fontWeight: '900', color: '#EF4444', letterSpacing: 1, marginBottom: 12 }}>ALERTES STOCKS FAIBLES ({lowStockMeds.length})</Text>
                                 <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
                                    {lowStockMeds.map(m => (
                                       <TouchableOpacity key={m.id} onPress={() => { setSelectedMed(m); setStockAddStep(2); setFormThreshold(String(m.low_stock_threshold || '')); setShowAddModal(true); }} style={{ width: 160, padding: 16, backgroundColor: '#EF444415', borderRadius: 24, marginRight: 12, borderWidth: 1, borderColor: '#EF444430' }}>
                                          <Text style={{ fontWeight: '800', color: isDark ? '#F1F5F9' : '#1A1A1A', fontSize: 13 }} numberOfLines={1}>{m.name}</Text>
                                          <Text style={{ fontSize: 18, fontWeight: '900', color: '#EF4444', marginTop: 8 }}>{m.stock_quantity} <Text style={{ fontSize: 9 }}>RESTANTS</Text></Text>
                                       </TouchableOpacity>
                                    ))}
                                 </ScrollView>
                              </View>
                           )}

                           <View style={{ marginBottom: 20 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 20, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9' }}>
                                 <MaterialIcons name="search" size={22} color={brandColor} />
                                 <TextInput
                                    style={{ flex: 1, marginLeft: 10, color: isDark ? '#FFF' : '#0A0A0A', fontWeight: '600' }}
                                    placeholder="Rechercher un produit..." placeholderTextColor={isDark ? "#555555" : '#94A3B8'}
                                    value={stockSearch}
                                    onChangeText={setStockSearch}
                                 />
                              </View>
                           </View>

                           {loading ? (
                              <View>{[1, 2, 3].map(i => <SkeletonItem key={i} height={80} style={{ marginBottom: 12, borderRadius: 24 }} />)}</View>
                           ) : (
                               medicines.map((m, i) => {

                                 const isLow = m.stock_quantity <= (m.low_stock_threshold || 10);
                                 const isCritical = m.stock_quantity <= 2;
                                 const statusColor = isCritical ? '#EF4444' : (isLow ? '#F59E0B' : '#10B981');
                                 const statusBg = statusColor + '15';

                                 return (
                                    <FadeInView key={m.id} delay={i * 30}>
                                       <PressableScale
                                          style={{ flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 28, marginBottom: 15, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9', elevation: 2 }}
                                          onPress={() => { setSelectedMed(m); setStockAddStep(2); setFormThreshold(String(m.low_stock_threshold || '')); setShowAddModal(true); }}
                                       >
                                          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                                             <MaterialCommunityIcons name="pill" size={28} color={statusColor} />
                                          </View>
                                          <View style={{ flex: 1 }}>
                                             <Text style={{ fontSize: 16, fontWeight: '900', color: isDark ? '#F1F5F9' : '#1A1A1A', marginBottom: 2 }}>{m.name}</Text>
                                             <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: statusBg, marginRight: 8 }}>
                                                   <Text style={{ fontSize: 9, fontWeight: '900', color: statusColor }}>{isCritical ? 'CRITIQUE' : (isLow ? 'BAS' : 'OPTIMAL')}</Text>
                                                </View>
                                                {insights.all?.find(i => i.id === m.id)?.status === 'fast_moving' && (
                                                   <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: '#3B82F615', marginRight: 8 }}>
                                                      <Text style={{ fontSize: 9, fontWeight: '900', color: '#3B82F6' }}>FAST MOVING</Text>
                                                   </View>
                                                )}
                                                {insights.all?.find(i => i.id === m.id)?.status === 'slow_moving' && (
                                                   <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: '#64748B15', marginRight: 8 }}>
                                                      <Text style={{ fontSize: 9, fontWeight: '900', color: '#64748B' }}>SLOW MOVING</Text>
                                                   </View>
                                                )}
                                                <Text style={{ color: isDark ? '#888888' : '#94A3B8', fontSize: 11, fontWeight: '800' }}>{m.dosage}</Text>
                                             </View>
                                             {m.expiry_date && <Text style={{ fontSize: 9, color: new Date(m.expiry_date) < new Date() ? '#EF4444' : '#64748B', fontWeight: '900', marginTop: 4 }}>EXP: {m.expiry_date}</Text>}
                                          </View>
                                          <View style={{ alignItems: 'flex-end' }}>
                                             <Text style={{ fontSize: 24, fontWeight: '900', color: statusColor }}>{m.stock_quantity}</Text>
                                             <Text style={{ fontSize: 9, fontWeight: '900', color: isDark ? '#555555' : '#94A3B8', letterSpacing: 0.5 }}>UNITÉS</Text>
                                          </View>
                                       </PressableScale>
                                    </FadeInView>
                                 );
                              })
                           )}
                        </FadeInView>
                     )}

                     {activeView === 'history' && (
                        <FadeInView>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                              <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1 }}>DÉLIVRANCES DU JOUR</Text>
                              <TouchableOpacity onPress={fetchDeliveryHistory}><MaterialIcons name="refresh" size={24} color={brandColor} /></TouchableOpacity>
                           </View>
                           {deliveryHistory.length > 0 ? deliveryHistory.map((item, idx) => (
                              <View key={idx} style={{ padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 28, marginBottom: 16, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9', borderLeftWidth: 6, borderLeftColor: '#22C55E' }}>
                                 <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ flex: 1 }}>
                                       <Text style={{ fontWeight: '900', fontSize: 16, color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{item.patient?.first_name} {item.patient?.last_name}</Text>
                                       <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '900', marginTop: 4 }}>DÉLIVRANCE COMPLÈTE</Text>
                                    </View>
                                    <Text style={{ fontWeight: '900', color: brandColor, fontSize: 18 }}>{Number(item.total || 0).toLocaleString()} <Text style={{ fontSize: 10 }}>FC</Text></Text>
                                 </View>
                              </View>
                           )) : renderEmptyState("history", "Aucune délivrance", "L'historique est vide.")}
                        </FadeInView>
                     )}

                     {activeView === 'prices' && (
                        <FadeInView>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                              <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1 }}>ÉTAT DES PRODUITS</Text>
                              <TouchableOpacity onPress={fetchData}><MaterialCommunityIcons name="refresh" size={24} color={brandColor} /></TouchableOpacity>
                           </View>
                           {medicines.map((m, i) => (
                              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 24, marginBottom: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9' }}>
                                 <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: m.stock_quantity > 0 ? brandColor + '10' : '#EF444410', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                                    <MaterialCommunityIcons name={m.stock_quantity > 0 ? "check-circle-outline" : "close-circle-outline"} size={24} color={m.stock_quantity > 0 ? brandColor : "#EF4444"} />
                                 </View>
                                 <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: '900', fontSize: 16, color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{m.name}</Text>
                                    <Text style={{ fontSize: 11, color: isDark ? '#AAAAAA' : '#64748B', fontWeight: '800', marginTop: 2 }}>{m.dosage} • {m.stock_quantity} EN STOCK</Text>
                                 </View>
                                 <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontWeight: '900', fontSize: 18, color: brandColor }}>{Number(m.price || 0).toLocaleString()}</Text>
                                    <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8' }}>PRIX UNITÉ</Text>
                                 </View>
                              </View>
                           ))}
                        </FadeInView>
                     )}

                     {activeView === 'sales' && (
                        <FadeInView>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                              <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1 }}>RAPPORT DES VENTES</Text>
                              <TouchableOpacity onPress={() => fetchSales(false)}><MaterialIcons name="refresh" size={24} color={brandColor} /></TouchableOpacity>
                           </View>
                           <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1A1A1A' : '#FFF', padding: 6, borderRadius: 20, marginBottom: 24, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9' }}>
                              {['day', 'week', 'month'].map(p => (
                                 <TouchableOpacity key={p} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: salesPeriod === p ? brandColor : 'transparent', borderRadius: 16 }} onPress={() => setSalesPeriod(p)}>
                                    <Text style={{ fontWeight: '900', fontSize: 12, color: salesPeriod === p ? '#FFF' : (isDark ? '#AAAAAA' : '#64748B') }}>{p.toUpperCase()}</Text>
                                 </TouchableOpacity>
                              ))}
                           </View>
                           <View style={{ padding: 24, borderRadius: 30, backgroundColor: brandColor, marginBottom: 24 }}>
                              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '900' }}>CHIFFRE D'AFFAIRES</Text>
                              <Text style={{ color: '#FFF', fontSize: 32, fontWeight: '900', marginTop: 8 }}>{Number(salesData.total_revenue || 0).toLocaleString()} FC</Text>
                           </View>

                           {salesPeriod === 'day' && (
                              <TouchableOpacity 
                                 onPress={handleSendDailyReport}
                                 disabled={isSubmitting}
                                 style={{ padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 28, marginBottom: 24, borderWidth: 1, borderColor: brandColor, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                              >
                                 {isSubmitting ? <ActivityIndicator size="small" color={brandColor} /> : (
                                    <>
                                       <MaterialCommunityIcons name="send-check" size={24} color={brandColor} style={{ marginRight: 12 }} />
                                       <Text style={{ color: brandColor, fontWeight: '900', fontSize: 13 }}>CLÔTURER & ENVOYER RAPPORT À L'ADMIN</Text>
                                    </>
                                 )}
                              </TouchableOpacity>
                           )}

                           {salesData.items_sold?.map((item, idx) => (
                              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 24, marginBottom: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9' }}>
                                 <Text style={{ color: brandColor, fontWeight: '900', fontSize: 18, marginRight: 16 }}>x{item.quantity}</Text>
                                 <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: '900', fontSize: 16, color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{item.name}</Text>
                                 </View>
                                 <Text style={{ fontWeight: '900', fontSize: 16, color: brandColor }}>{Number(item.revenue || 0).toLocaleString()} FC</Text>
                              </View>
                           ))}
                        </FadeInView>
                     )}

                     {activeView === 'analytics' && (
                        <FadeInView>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                              <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#888888' : '#94A3B8', letterSpacing: 1 }}>ANALYSE DES STOCKS</Text>
                              <TouchableOpacity onPress={fetchData}><MaterialIcons name="refresh" size={24} color={brandColor} /></TouchableOpacity>
                           </View>
                           
                           <View style={{ marginBottom: 24 }}>
                              <Text style={{ fontSize: 10, fontWeight: '900', color: brandColor, letterSpacing: 1, marginBottom: 12 }}>À RENOUVELER PRIORITAIREMENT</Text>
                              {insights.to_renew?.length > 0 ? insights.to_renew.map((item, idx) => (
                                 <View key={idx} style={{ padding: 18, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 24, marginBottom: 12, borderWidth: 1, borderColor: item.is_critical ? '#EF4444' : brandColor, borderLeftWidth: 6, borderLeftColor: item.is_critical ? '#EF4444' : brandColor }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                       <View style={{ flex: 1 }}>
                                          <Text style={{ fontWeight: '900', fontSize: 15, color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{item.name}</Text>
                                          <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Demande: {item.volume_30d} unités / 30j</Text>
                                       </View>
                                       <View style={{ alignItems: 'flex-end' }}>
                                          <Text style={{ fontWeight: '900', fontSize: 18, color: item.is_critical ? '#EF4444' : brandColor }}>{item.stock}</Text>
                                          <Text style={{ fontSize: 8, fontWeight: '900', color: '#64748B' }}>RESTANTS</Text>
                                       </View>
                                    </View>
                                 </View>
                              )) : <Text style={{ color: '#64748B', fontStyle: 'italic', fontSize: 12 }}>Aucun produit en seuil critique.</Text>}
                           </View>

                           <View style={{ marginBottom: 24 }}>
                              <Text style={{ fontSize: 10, fontWeight: '900', color: '#64748B', letterSpacing: 1, marginBottom: 12 }}>PRODUITS À FAIBLE ROTATION (SLOW MOVING)</Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                 {insights.slow_movers?.length > 0 ? insights.slow_movers.map((item, idx) => (
                                    <View key={idx} style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: isDark ? '#1A1A1A' : '#F1F5F9', borderRadius: 16, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                                       <Text style={{ fontWeight: '800', fontSize: 12, color: isDark ? '#E2E8F0' : '#1A1A1A' }}>{item.name}</Text>
                                       <Text style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>{item.volume_30d} ventes / 30j</Text>
                                    </View>
                                 )) : <Text style={{ color: '#64748B', fontStyle: 'italic', fontSize: 12 }}>Tous vos produits circulent bien.</Text>}
                              </View>
                           </View>

                           <View style={{ padding: 20, backgroundColor: '#3B82F610', borderRadius: 24, borderWidth: 1, borderColor: '#3B82F630' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                 <MaterialCommunityIcons name="information-outline" size={18} color="#3B82F6" />
                                 <Text style={{ fontWeight: '900', fontSize: 13, color: '#3B82F6', marginLeft: 8 }}>CONSEIL DE GESTION</Text>
                              </View>
                              <Text style={{ fontSize: 12, color: isDark ? '#E2E8F0' : '#1E293B', lineHeight: 18 }}>
                                 Les produits "" avec un stock faible doivent être commandés immédiatement. 
                                 Évitez de sur-stocker les produits "Slow Moving" pour optimiser votre trésorerie.
                              </Text>
                           </View>
                        </FadeInView>
                     )}
                  </>
               )}
            </View>
         </ScrollView>

         {activeBottomTab === 'expiry' && (
            <Animated.View style={[{ position: 'absolute', bottom: 85, left: 16, right: 16, maxHeight: height * 0.5, backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF', borderRadius: 28, borderWidth: 1, borderColor: isDark ? '#1A1A1A' : '#F1F5F9', elevation: 20 }, { transform: [{ translateY: bottomPanelAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }]}>
               <View style={{ padding: 24, borderBottomWidth: 1, borderBottomColor: isDark ? '#1A1A1A' : '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#F1F5F9' : '#0A0A0A' }}>PÉREMPTION</Text>
                  <TouchableOpacity onPress={() => toggleBottomTab('expiry')}><MaterialCommunityIcons name="alert-circle-outline" size={24} color={brandColor} /></TouchableOpacity>
               </View>
               <ScrollView style={{ padding: 24 }}>
                  {expiring.expired.length > 0 && <Text style={{ color: '#EF4444', fontWeight: '900', marginBottom: 12 }}>DÉJÀ EXPIRÉS</Text>}
                  {expiring.expired.map(m => (
                     <View key={m.id} style={{ padding: 18, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#EF444430', borderLeftWidth: 4, borderLeftColor: '#EF4444' }}>
                        <Text style={{ fontWeight: '900', fontSize: 15, color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{m.name}</Text>
                        <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '900', marginTop: 4 }}>Périmé le : {m.expiry_date}</Text>
                     </View>
                  ))}
                  {expiring.expiring.length > 0 && <Text style={{ color: '#F9AB00', fontWeight: '900', marginBottom: 12, marginTop: 12 }}>BIENTÔT EXPIRÉS</Text>}
                  {expiring.expiring.map(m => (
                     <View key={m.id} style={{ padding: 18, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#F9AB0030', borderLeftWidth: 4, borderLeftColor: '#F9AB00' }}>
                        <Text style={{ fontWeight: '900', fontSize: 15, color: isDark ? '#F1F5F9' : '#1A1A1A' }}>{m.name}</Text>
                        <Text style={{ fontSize: 11, color: '#F9AB00', fontWeight: '900', marginTop: 4 }}>Expire le : {m.expiry_date}</Text>
                     </View>
                  ))}
               </ScrollView>
            </Animated.View>
         )}

         <PremiumFooter
            isDark={isDark}
            activeTab={activeBottomTab === 'expiry' ? 'expiry' : activeTab}
            tabs={[
               { id: 'dispense', icon: 'clipboard-pulse-outline', activeIcon: 'clipboard-pulse', label: 'Délivrer' },
               { id: 'stock', icon: 'package-variant', activeIcon: 'package-variant-closed', label: 'Stock' },
               { id: 'sales', icon: 'chart-box-outline', activeIcon: 'chart-box', label: 'Ventes' },
               { id: 'expiry', icon: 'alert-decagram-outline', activeIcon: 'alert-decagram', label: 'Alertes' },
            ]}
            onTabPress={(tabId) => {
               if (tabId === 'expiry') toggleBottomTab('expiry');
               else { setActiveTab(tabId); setActiveView(tabId); if (activeBottomTab) toggleBottomTab('expiry'); }
            }}
         />

         <PremiumLeftDrawer
            isOpen={isLeftOpen}
            anim={leftAnim}
            onClose={() => toggleLeft(false)}
            activeView={activeView}
            setActiveView={(v) => { setActiveView(v); if (v === 'history') fetchDeliveryHistory(); }}
            menuItems={pharmacyMenu}
            roleName={t.roles.pharmacie}
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
            roleName={t.roles.pharmacie}
            roleIcon="pill"
            onLogout={handleLogout}
            t={t}
            setActiveView={(v) => { toggleRight(false); setActiveView(v); }}
         />

         {/* ADD STOCK MODAL */}
         <Modal visible={showAddModal} transparent animationType="slide">
            <View style={styles.modalOverlay}>
               <View style={[styles.modalSheet, { backgroundColor: isDark ? '#0A0A0A' : '#FFF', maxHeight: '80%', paddingBottom: 20 + insets.bottom }]}>
                  <View style={styles.sheetHeader}>
                     <Text style={{ fontSize: 14, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>{stockAddStep === 1 ? 'CHOISIR UN PRODUIT' : 'APPROVISIONNER'}</Text>
                     <TouchableOpacity onPress={() => setShowAddModal(false)}><MaterialIcons name="close" size={24} color={brandColor} /></TouchableOpacity>
                  </View>
                  <ScrollView style={{ padding: 24 }}>
                     {stockAddStep === 1 ? (
                        <View>
                           <TextInput
                              style={[styles.modalInput, { color: isDark ? '#FFF' : '#0A0A0A', marginBottom: 15 }]}
                              placeholder="Rechercher un produit..." placeholderTextColor={C.placeholder}
                              onChangeText={(text) => setModalSearch(text)}
                              value={modalSearch}
                           />
                           {medicines.filter(m => !modalSearch || m.name.toLowerCase().includes(modalSearch.toLowerCase())).length > 0 ? (
                              medicines.filter(m => !modalSearch || m.name.toLowerCase().includes(modalSearch.toLowerCase())).map(m => (
                                 <TouchableOpacity key={m.id} onPress={() => { setSelectedMed(m); setStockAddStep(2); setFormThreshold(String(m.low_stock_threshold || '')); setModalSearch(''); }} style={{ padding: 20, borderRadius: 20, backgroundColor: isDark ? '#1A1A1A' : '#F8FAFC', marginBottom: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                                    <Text style={{ fontWeight: '900', color: isDark ? '#FFF' : '#1A1A1A' }}>{m.name}</Text>
                                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>{m.dosage} • Actuel: {m.stock_quantity}</Text>
                                 </TouchableOpacity>
                              ))
                           ) : (
                              <Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 20 }}>Aucun produit trouvé</Text>
                           )}
                        </View>
                     ) : (
                        <View>
                           <Text style={{ fontSize: 22, fontWeight: '900', color: brandColor, marginBottom: 20 }}>{selectedMed?.name}</Text>
                           <Text style={styles.modalLabel}>QUANTITÉ À AJOUTER</Text>
                           <TextInput style={[styles.modalInput, { color: isDark ? '#FFF' : '#0A0A0A' }]} placeholder="Qté" keyboardType="numeric" value={formQty} onChangeText={setFormQty} />
                           <Text style={styles.modalLabel}>DATE DE PÉREMPTION</Text>
                           <TextInput style={[styles.modalInput, { color: isDark ? '#FFF' : '#0A0A0A' }]} placeholder="YYYY-MM-DD" value={formExpiry} onChangeText={setFormExpiry} />
                           <Text style={styles.modalLabel}>SEUIL D'ALERTE</Text>
                           <TextInput style={[styles.modalInput, { color: isDark ? '#FFF' : '#0A0A0A' }]} placeholder="Seuil" keyboardType="numeric" value={formThreshold} onChangeText={setFormThreshold} />
                           <TouchableOpacity style={styles.modalSubmit} onPress={handleAddStock} disabled={isSubmitting}>
                              <LinearGradient colors={Theme.colors.brandGradient} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 30 }}>
                                 <Text style={{ color: '#FFF', fontWeight: '900' }}>VALIDER</Text>
                              </LinearGradient>
                           </TouchableOpacity>
                        </View>
                     )}
                  </ScrollView>
               </View>
            </View>
         </Modal>

         {/* NEW MEDICINE MODAL */}
         <Modal visible={showNewModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
               <View style={[styles.modalSheet, { backgroundColor: isDark ? '#0A0A0A' : '#FFF', paddingBottom: 20 + insets.bottom }]}>
                  <View style={styles.sheetHeader}>
                     <Text style={{ fontSize: 14, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>NOUVEAU PRODUIT</Text>
                     <TouchableOpacity onPress={() => setShowNewModal(false)}><MaterialCommunityIcons name="close" size={24} color={brandColor} /></TouchableOpacity>
                  </View>
                  <View style={{ padding: 24 }}>
                     <TextInput style={[styles.modalInput, { color: isDark ? '#FFF' : '#0A0A0A' }]} placeholder="Nom" value={newMed.name} onChangeText={v => setNewMed({ ...newMed, name: v })} />
                     <TextInput style={[styles.modalInput, { color: isDark ? '#FFF' : '#0A0A0A' }]} placeholder="Dosage" value={newMed.dosage} onChangeText={v => setNewMed({ ...newMed, dosage: v })} />
                     <TextInput style={[styles.modalInput, { color: isDark ? '#FFF' : '#0A0A0A' }]} placeholder="Prix" keyboardType="numeric" value={newMed.price} onChangeText={v => setNewMed({ ...newMed, price: v })} />
                     <TouchableOpacity style={styles.modalSubmit} onPress={handleCreateMed} disabled={isSubmitting}>
                        <LinearGradient colors={Theme.colors.brandGradient} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 30 }}>
                           <Text style={{ color: '#FFF', fontWeight: '900' }}>AJOUTER AU CATALOGUE</Text>
                        </LinearGradient>
                     </TouchableOpacity>
                  </View>
               </View>
            </View>
         </Modal>

         {/* DISPENSE MODAL */}
         <Modal visible={showDispenseModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
               <View style={[styles.modalSheet, { backgroundColor: isDark ? '#0A0A0A' : '#FFF', maxHeight: '90%', paddingBottom: 20 + insets.bottom }]}>
                  <View style={styles.sheetHeader}>
                     <Text style={{ fontSize: 14, fontWeight: '900', color: isDark ? '#FFF' : '#0A0A0A' }}>DÉLIVRANCE</Text>
                     <TouchableOpacity onPress={() => setShowDispenseModal(false)}><MaterialCommunityIcons name="close" size={24} color={brandColor} /></TouchableOpacity>
                  </View>
                  <ScrollView style={{ padding: 20 }} contentContainerStyle={{ paddingBottom: 60 + insets.bottom }} showsVerticalScrollIndicator={false}>
                      <View style={{ marginBottom: 24, padding: 12, borderLeftWidth: 4, borderLeftColor: brandColor, backgroundColor: isDark ? '#111827' : '#F8FAFC' }}>
                         <Text style={{ fontSize: 22, fontWeight: '900', color: isDark ? '#FFF' : '#1A1A1A' }}>{selectedVisitForDispense?.patient?.first_name} {selectedVisitForDispense?.patient?.last_name}</Text>
                         <Text style={{ color: brandColor, fontSize: 12, fontWeight: '900', marginTop: 2 }}>{selectedVisitForDispense?.patient?.gender === 'M' ? 'HOMME' : 'FEMME'} • {selectedVisitForDispense?.patient?.age} ANS</Text>
                         <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '800', marginTop: 4 }}>Dossier Médical N° {selectedVisitForDispense?.id}</Text>
                      </View>

                      {/* Prescription document-like card */}
                      <View style={{ borderRadius: 24, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', overflow: 'hidden', marginBottom: 24, elevation: 3 }}>
                         <LinearGradient colors={['#3498DB15', '#3498DB05']} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                            <MaterialCommunityIcons name="clipboard-text-outline" size={18} color="#3498DB" />
                            <Text style={{ marginLeft: 10, fontSize: 11, fontWeight: '900', color: '#3498DB', letterSpacing: 1 }}>ORDONNANCE MÉDICALE</Text>
                         </LinearGradient>

                         <View style={{ padding: 16 }}>
                            {selectedVisitForDispense?.prescription_items?.length > 0 ? (
                               selectedVisitForDispense.prescription_items.map((pItem, i) => (
                                  <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: i < selectedVisitForDispense.prescription_items.length - 1 ? 1 : 0, borderBottomColor: isDark ? '#2E2E2E' : '#F1F5F9' }}>
                                     <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                                        <MaterialCommunityIcons name="pill" size={20} color={brandColor} />
                                     </View>
                                     <View style={{ flex: 1 }}>
                                        <Text style={{ color: isDark ? '#F1F5F9' : '#1A1A1A', fontWeight: '900', fontSize: 15 }}>{pItem.name || '—'}</Text>
                                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                           <View style={{ backgroundColor: brandColor + '10', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                              <Text style={{ color: brandColor, fontSize: 9, fontWeight: '900' }}>POSOLOGIE: {pItem.dosage || 'N/A'}</Text>
                                           </View>
                                           <View style={{ backgroundColor: '#10B98110', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                              <Text style={{ color: '#10B981', fontSize: 9, fontWeight: '900' }}>{pItem.instructions || 'Pas d\'instructions'}</Text>
                                           </View>
                                        </View>
                                        <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '700', marginTop: 2 }}>Quantité prescrite : {pItem.quantity || 1}</Text>
                                     </View>
                                  </View>
                               ))
                            ) : (
                               <Text style={{ color: isDark ? '#E2E8F0' : '#1A1A1A', fontStyle: 'italic' }}>{selectedVisitForDispense?.prescription_notes || 'Aucune prescription structurée.'}</Text>
                            )}
                         </View>
                      </View>

                      {/* Basket section */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                         <Text style={{ fontSize: 11, fontWeight: '900', color: '#64748B', letterSpacing: 1 }}>PANIER DE DÉLIVRANCE</Text>
                         <View style={{ backgroundColor: brandColor + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                            <Text style={{ color: brandColor, fontSize: 10, fontWeight: '900' }}>{dispenseItems.length} PRODUITS</Text>
                         </View>
                      </View>

                      {dispenseItems.length === 0 ? (
                         <View style={{ padding: 40, alignItems: 'center', borderRadius: 24, borderWidth: 2, borderStyle: 'dashed', borderColor: isDark ? '#2E2E2E' : '#CBD5E1', marginBottom: 20 }}>
                            <MaterialCommunityIcons name="cart-variant" size={40} color={isDark ? "#2E2E2E" : '#CBD5E1'} />
                            <Text style={{ color: isDark ? '#555' : '#94A3B8', fontWeight: '800', marginTop: 12, fontSize: 13 }}>Le panier est vide</Text>
                         </View>
                      ) : (
                          <View style={{ marginBottom: 20 }}>
                             {dispenseItems.map((item, idx) => (
                                <View key={`${item.medicine_id}_${idx}`} style={{ marginBottom: 12, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderRadius: 24, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#F1F5F9', elevation: 2, overflow: 'hidden' }}>
                                   <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15 }}>
                                      <LinearGradient colors={item.prescribed ? ['#3498DB20', '#3498DB05'] : ['#10B98120', '#10B98105']} style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 15 }}>
                                         <MaterialCommunityIcons name={item.prescribed ? "" : "plus-circle-outline"} size={22} color={item.prescribed ? "#3498DB" : "#10B981"} />
                                      </LinearGradient>
                                      <View style={{ flex: 1 }}>
                                         <Text style={{ color: isDark ? '#FFF' : '#1A1A1A', fontWeight: '900', fontSize: 15 }}>{item.name}</Text>
                                         <Text style={{ color: brandColor, fontWeight: '900', fontSize: 13, marginTop: 4 }}>
                                            {Number(item.price || 0).toLocaleString()} <Text style={{ fontSize: 9 }}>FC</Text> × {item.quantity} = {Number((item.price || 0) * item.quantity).toLocaleString()} FC
                                         </Text>
                                      </View>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0' }}>
                                         <TouchableOpacity onPress={() => { if (item.quantity > 1) setDispenseItems(prev => prev.map(i => i.medicine_id === item.medicine_id ? { ...i, quantity: i.quantity - 1 } : i)); }} style={{ padding: 8 }}>
                                            <MaterialCommunityIcons name="minus" size={18} color={brandColor} />
                                         </TouchableOpacity>
                                         <Text style={{ color: isDark ? '#FFF' : '#1A1A1A', fontWeight: '900', minWidth: 30, textAlign: 'center', fontSize: 15 }}>{item.quantity}</Text>
                                         <TouchableOpacity onPress={() => setDispenseItems(prev => prev.map(i => i.medicine_id === item.medicine_id ? { ...i, quantity: i.quantity + 1 } : i))} style={{ padding: 8 }}>
                                            <MaterialIcons name="add" size={18} color={brandColor} />
                                         </TouchableOpacity>
                                      </View>
                                      <TouchableOpacity onPress={() => setDispenseItems(prev => prev.filter(i => i.medicine_id !== item.medicine_id))} style={{ marginLeft: 12, padding: 10, backgroundColor: '#EF444415', borderRadius: 12 }}>
                                         <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                                      </TouchableOpacity>
                                   </View>
                                </View>
                             ))}
                          </View>
                      )}

                      <View style={{ height: 1, backgroundColor: isDark ? '#2E2E2E' : '#E2E8F0', marginVertical: 20 }} />
                      
                      <Text style={{ fontSize: 11, fontWeight: '900', color: '#64748B', letterSpacing: 1, marginBottom: 12 }}>COMPLÉTER LA DÉLIVRANCE</Text>
                      <FlatList 
                         horizontal 
                         data={medicines} 
                         showsHorizontalScrollIndicator={false} 
                         contentContainerStyle={{ gap: 10, paddingBottom: 10 }}
                         renderItem={({ item }) => (
                            <TouchableOpacity 
                               onPress={() => setSelectedDispenseMed(item)} 
                               style={{ padding: 12, backgroundColor: selectedDispenseMed?.id === item.id ? brandColor : (isDark ? '#1A1A1A' : '#FFF'), borderRadius: 16, borderWidth: 1, borderColor: selectedDispenseMed?.id === item.id ? brandColor : (isDark ? '#2E2E2E' : '#E2E8F0'), elevation: 2 }}
                            >
                               <Text style={{ color: selectedDispenseMed?.id === item.id ? '#FFF' : (isDark ? '#F1F5F9' : '#1A1A1A'), fontWeight: '900', fontSize: 13 }}>{item.name}</Text>
                               <Text style={{ color: selectedDispenseMed?.id === item.id ? 'rgba(255,255,255,0.7)' : '#64748B', fontSize: 10, fontWeight: '800', marginTop: 4 }}>{Number(item.price || 0).toLocaleString()} FC</Text>
                            </TouchableOpacity>
                         )} 
                      />
                      
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                         <View style={{ flex: 1, height: 56, borderRadius: 18, backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderWidth: 1, borderColor: isDark ? '#2E2E2E' : '#E2E8F0', paddingHorizontal: 16, justifyContent: 'center' }}>
                            <TextInput style={{ color: isDark ? '#FFF' : '#0A0A0A', fontWeight: '900', fontSize: 16 }} placeholder="Qté" keyboardType="numeric" value={dispenseQty} onChangeText={setDispenseQty} />
                         </View>
                         <TouchableOpacity onPress={addDispenseItem} style={{ width: 100, height: 56, borderRadius: 18, backgroundColor: brandColor + '20', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: brandColor, fontWeight: '900', fontSize: 14 }}>AJOUTER</Text>
                         </TouchableOpacity>
                      </View>

                      {/* Total Summary */}
                      <LinearGradient colors={[brandColor, '#805AD5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 24, borderRadius: 28, marginTop: 32, elevation: 8 }}>
                         <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                               <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '900', fontSize: 10, letterSpacing: 1 }}>TOTAL À FACTURER</Text>
                               <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 32, marginTop: 4 }}>{Number(dispenseTotal).toLocaleString()} <Text style={{ fontSize: 14 }}>FC</Text></Text>
                            </View>
                            <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                               <MaterialCommunityIcons name="pill" size={28} color="#FFF" />
                            </View>
                         </View>
                         <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 16 }} />
                         <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700' }}>Mode: {paymentMode === 'insurance' ? 'Assurance' : 'Cash'}</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700' }}>{dispenseItems.length} Produit(s)</Text>
                         </View>
                      </LinearGradient>
                     <TouchableOpacity style={styles.modalSubmit} onPress={handleDispense} disabled={isSubmitting}>
                        <LinearGradient colors={Theme.colors.brandGradient} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 30 }}>
                           <Text style={{ color: '#FFF', fontWeight: '900' }}>DÉLIVRER</Text>
                        </LinearGradient>
                     </TouchableOpacity>
                  </ScrollView>
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
   modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.8)',
      justifyContent: 'flex-end'
   },
   modalSheet: {
      width: '100%',
      backgroundColor: C.bg,
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
      overflow: 'hidden'
   },
   sheetHeader: {
      padding: 24,
      backgroundColor: C.surface,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
   },
   modalLabel: {
      fontSize: 10,
      fontWeight: '900',
      color: C.sub,
      letterSpacing: 1,
      marginBottom: 8
   },
   modalInput: {
      height: 60,
      backgroundColor: C.input,
      borderRadius: 16,
      paddingHorizontal: 20,
      color: C.text,
      fontWeight: '900',
      borderWidth: 1,
      borderColor: C.border
   },
   modalSubmit: {
      height: 60,
      borderRadius: 30,
      overflow: 'hidden',
      marginTop: 20,
      elevation: 4
   }
});
