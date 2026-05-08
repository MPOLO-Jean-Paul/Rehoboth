import React, { useContext, useState } from 'react';
import { View, Text, TouchableOpacity, Image, FlatList, Dimensions, StatusBar, ScrollView, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { Heart, User, Home, Calendar, LayoutGrid, Activity, Briefcase, Building2, Target, Crosshair } from 'lucide-react-native';
import { AppContext } from '../../App';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { PressableScale, FadeInView, EmptyState } from '../components/AnimatedComponents';
import { LinearGradient } from 'expo-linear-gradient';
import { translations } from '../i18n/translations';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SyncManager from '../services/SyncManager';

import { useTheme } from '../hooks/useTheme';

export default function HomeScreen({ navigation }) {
  const { C, S, isDark, themeMode, toggleTheme, lang, toggleLang, isOnline, brandColor } = useTheme();
  const insets = useSafeAreaInsets();

  // States pour la navigation interne et les filtres
  const [activeTab, setActiveTab] = useState('explorer'); // 'explorer', 'favoris', 'departements'
  const [activeCategory, setActiveCategory] = useState('tous');
  const [favorites, setFavorites] = useState([]);

  // Charger les favoris au démarrage (fonctionne hors-ligne)
  React.useEffect(() => {
    const loadFavs = async () => {
      try {
        const stored = await AsyncStorage.getItem('@mdcd_favorites');
        if (stored) setFavorites(JSON.parse(stored));
      } catch (e) {}
    };
    loadFavs();
  }, []);

  const t = translations[lang] || translations.fr;

  const CATEGORIES = [
    { id: 'tous', name: t.all || 'Tous', icon: LayoutGrid },
    { id: 'cliniques', name: lang === 'en' ? 'Clinical' : 'Cliniques', icon: Activity },
    { id: 'techniques', name: lang === 'en' ? 'Technical' : 'Techniques', icon: Briefcase },
  ];

  const ALL_SERVICES = [
    {
      id: 's1',
      name: lang === 'en' ? 'Emergencies' : 'Urgences',
      description: lang === 'en' ? '24/7 emergency service for any critical intervention.' : 'Service d\'urgence ouvert 24h/24 et 7j/7 pour toute intervention critique.',
      image: 'https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?q=80&w=600&auto=format&fit=crop',
      tag: lang === 'en' ? 'Immediate Access' : 'Accès Immédiat',
      type: 'clinique'
    },
    {
      id: 's2',
      name: lang === 'en' ? 'General Medicine' : 'Médecine Générale',
      description: lang === 'en' ? 'General consultations, health check-ups and regular follow-ups.' : 'Consultations générales, bilans de santé et suivis réguliers.',
      image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=600&auto=format&fit=crop',
      tag: lang === 'en' ? 'By Appointment' : 'Sur RDV',
      type: 'clinique'
    },
    {
      id: 's3',
      name: t.roles?.labo || 'Laboratoire',
      description: lang === 'en' ? 'Comprehensive medical testing, sampling and fast results.' : 'Analyses médicales complètes, prélèvements et résultats rapides.',
      image: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?q=80&w=600&auto=format&fit=crop',
      tag: lang === 'en' ? 'Results in 24h' : 'Résultats 24h',
      type: 'clinique'
    },
    {
      id: 's4',
      name: lang === 'en' ? 'Pharmacy' : 'Pharmacie',
      description: lang === 'en' ? 'Prescription drug dispensing and advice.' : 'Délivrance de médicaments sur ordonnance et conseils.',
      image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?q=80&w=600&auto=format&fit=crop',
      tag: lang === 'en' ? 'Open 24/7' : 'Ouvert 24/7',
      type: 'clinique'
    },
    {
      id: 's5',
      name: t.techServices?.hr || 'Ressources Humaines',
      description: lang === 'en' ? 'Personnel management, scheduling, and payroll.' : 'Gestion du personnel, plannings, et paie.',
      image: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=600&auto=format&fit=crop',
      tag: lang === 'en' ? 'Internal' : 'Interne',
      type: 'technique'
    },
    {
      id: 's6',
      name: t.techServices?.finance || 'Finances & Caisse',
      description: lang === 'en' ? 'Invoice tracking, payments and financial reports.' : 'Suivi des factures, paiements et rapports financiers.',
      image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=600&auto=format&fit=crop',
      tag: lang === 'en' ? 'Billing' : 'Facturation',
      type: 'technique'
    },
    {
      id: 's7',
      name: t.techServices?.inventory || 'Inventaire & Stock',
      description: lang === 'en' ? 'Management of medical equipment and supplies.' : 'Gestion des équipements médicaux et fournitures.',
      image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop',
      tag: lang === 'en' ? 'Logistics' : 'Logistique',
      type: 'technique'
    },
    {
      id: 's8',
      name: t.techServices?.archive || 'Archives & Données',
      description: lang === 'en' ? 'Secure storage of patient records and documents.' : 'Stockage sécurisé des dossiers patients et documents.',
      image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=600&auto=format&fit=crop',
      tag: lang === 'en' ? 'Secure' : 'Sécurisé',
      type: 'technique'
    },
  ];

  const DEPARTMENTS = [
    {
      id: 'dep1',
      name: lang === 'en' ? 'Cardiology Center' : 'Pôle de Cardiologie',
      mission: lang === 'en' ? 'Mission: Comprehensive cardiovascular care.' : 'Mission : Offrir des soins cardiovasculaires complets et préventifs.',
      goal: lang === 'en' ? 'Goal: Excellence in heart surgery.' : 'But : Atteindre l\'excellence en chirurgie cardiaque et suivi post-opératoire.',
      description: lang === 'en' ? 'Equipped with the latest imaging and surgical tech.' : 'Un département de pointe équipé des dernières technologies d\'imagerie, de blocs opératoires dédiés et d\'une unité de soins intensifs cardiaques.',
      image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=600&auto=format&fit=crop',
    },
    {
      id: 'dep2',
      name: lang === 'en' ? 'Maternity & Neonatology' : 'Maternité & Néonatalogie',
      mission: lang === 'en' ? 'Mission: Safe and comfortable birth experience.' : 'Mission : Garantir un environnement sûr et chaleureux pour la mère et l\'enfant.',
      goal: lang === 'en' ? 'Goal: Zero infant mortality.' : 'But : Accompagner chaque naissance avec le plus haut niveau de sécurité médicale.',
      description: lang === 'en' ? 'Features modern delivery rooms and NICU.' : 'Comprend des salles d\'accouchement modernes, des chambres de repos tout confort et une unité de soins intensifs néonatals 24h/24.',
      image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=600&auto=format&fit=crop',
    },
    {
      id: 'dep3',
      name: lang === 'en' ? 'Surgery & Trauma' : 'Chirurgie & Traumatologie',
      mission: lang === 'en' ? 'Mission: Advanced surgical interventions.' : 'Mission : Prendre en charge les interventions chirurgicales complexes et les traumatismes.',
      goal: lang === 'en' ? 'Goal: Rapid recovery and minimally invasive procedures.' : 'But : Promouvoir la chirurgie mini-invasive pour une récupération très rapide.',
      description: lang === 'en' ? 'State-of-the-art operating theaters with robotic assistance.' : 'Plateau technique de très haut niveau avec 5 blocs opératoires, assistance robotique et salle de réveil sous haute surveillance continue.',
      image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=600&auto=format&fit=crop',
    }
  ];

  const toggleFavorite = async (id) => {
    let newFavs;
    if (favorites.includes(id)) {
      newFavs = favorites.filter(fId => fId !== id);
    } else {
      newFavs = [...favorites, id];
    }

    // Mise à jour immédiate (Optimistic UI)
    setFavorites(newFavs);

    // Persistance locale pour accès hors-ligne
    await AsyncStorage.setItem('@mdcd_favorites', JSON.stringify(newFavs));

    // Si on est hors-ligne, on met l'action en file d'attente pour la synchronisation automatique
    if (!isOnline) {
      await SyncManager.enqueueAction({
        url: '/api/favorites/sync',
        method: 'POST',
        data: { favorites: newFavs }
      });
    } else {
      // Simuler l'envoi API normal si en ligne
      // await api.post('/api/favorites/sync', { favorites: newFavs });
    }
  };

  const getFilteredData = () => {
    if (activeTab === 'departements') {
      return DEPARTMENTS;
    }
    if (activeTab === 'favoris') {
      return ALL_SERVICES.filter(service => favorites.includes(service.id));
    }
    // activeTab === 'explorer'
    return ALL_SERVICES.filter(service => {
      if (activeCategory === 'tous') return true;
      if (activeCategory === 'cliniques') return service.type === 'clinique';
      if (activeCategory === 'techniques') return service.type === 'technique';
      return true;
    }).sort((a, b) => {
      const aFav = favorites.includes(a.id) ? 1 : 0;
      const bFav = favorites.includes(b.id) ? 1 : 0;
      return bFav - aFav;
    });
  };

  const renderServiceCard = ({ item, index }) => {
    const isFav = favorites.includes(item.id);
    return (
      <FadeInView delay={index * 100} duration={600}>
        <PressableScale
          style={[
            tw`mb-6 w-full overflow-hidden`,
            {
              backgroundColor: C.card,
              borderRadius: S.ms(24),
              elevation: 4,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: isDark ? 0.3 : 0.05,
              shadowRadius: 12,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
            }
          ]}
          onPress={() => navigation.navigate('Login')}
        >
          <View style={[tw`relative w-full`, { height: S.vs(200) }]}>
            <Image
              source={{ uri: item.image }}
              style={tw`w-full h-full`}
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.4)', 'transparent']}
              style={[tw`absolute top-0 left-0 right-0`, { height: S.vs(80) }]}
            />
            <LinearGradient
              colors={isDark ? ['#2E2E2E', '#1A1A1A'] : ['#FFFFFF', '#F8FAFC']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[tw`absolute top-4 left-4 px-3.5 py-1.5`, { borderRadius: S.ms(12), elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 }]}
            >
              <Text style={[tw`font-black tracking-widest`, { fontSize: S.fs(10), color: C.text }]}>{item.tag.toUpperCase()}</Text>
            </LinearGradient>
            <TouchableOpacity
              style={[tw`absolute top-4 right-4 p-2`]}
              onPress={() => toggleFavorite(item.id)}
            >
              <Heart size={S.ms(26)} color={isFav ? brandColor : '#FFF'} fill={isFav ? brandColor : 'rgba(0,0,0,0.2)'} strokeWidth={isFav ? 0 : 2} />
            </TouchableOpacity>
          </View>
          <View style={[tw`p-5`]}>
            <Text style={[tw`font-black tracking-tight`, { fontSize: S.fs(19), color: C.text, lineHeight: S.fs(24) }]}>{item.name}</Text>
            <Text style={[tw`mt-2 leading-5 font-medium`, { fontSize: S.fs(12.5), color: C.textSecondary, opacity: 0.8 }]} numberOfLines={2}>{item.description}</Text>
          </View>
        </PressableScale>
      </FadeInView>
    );
  };

  const renderDepartmentCard = ({ item, index }) => (
    <FadeInView delay={index * 100} duration={600}>
      <PressableScale
        style={[
          tw`mb-6 w-full overflow-hidden`,
          {
            backgroundColor: C.card,
            borderRadius: S.ms(24),
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: isDark ? 0.3 : 0.05,
            shadowRadius: 12,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
          }
        ]}
        onPress={() => navigation.navigate('Login')}
      >
        <View style={[tw`relative w-full`, { height: S.vs(240) }]}>
          <Image
            source={{ uri: item.image }}
            style={tw`w-full h-full`}
          />
          <LinearGradient
            colors={['transparent', C.card]}
            style={[tw`absolute bottom-0 w-full`, { height: S.vs(120) }]}
          />
          <View style={tw`absolute bottom-4 left-5 right-5`}>
            <Text style={[tw`font-black tracking-tight`, { fontSize: S.fs(28), color: C.text }]}>{item.name}</Text>
          </View>
        </View>

        <View style={tw`px-5 pb-5`}>
          <Text style={[tw`font-medium leading-6`, { fontSize: S.fs(14), color: C.textSecondary }]}>
            {item.description}
          </Text>

          <LinearGradient
            colors={isDark ? ['#2E2E2E', '#1A1A1A'] : ['#F8FAFC', '#F1F5F9']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[tw`mt-5 p-5 border`, { borderRadius: S.ms(24), borderColor: C.divider }]}
          >
            <View style={tw`flex-row items-center mb-4`}>
              <View style={[tw`rounded-full items-center justify-center mr-3`, { width: S.ms(32), height: S.ms(32), backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.1)' }]}>
                <Target size={S.ms(18)} color={isDark ? '#60A5FA' : '#3B82F6'} />
              </View>
              <Text style={[tw`flex-1 font-bold leading-5`, { fontSize: S.fs(13), color: isDark ? '#93C5FD' : '#2563EB' }]}>
                {item.mission}
              </Text>
            </View>
            <View style={tw`flex-row items-center`}>
              <View style={[tw`rounded-full items-center justify-center mr-3`, { width: S.ms(32), height: S.ms(32), backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                <Crosshair size={S.ms(18)} color={brandColor} />
              </View>
              <Text style={[tw`flex-1 font-bold leading-5`, { fontSize: S.fs(13), color: isDark ? '#FCA5A5' : '#DC2626' }]}>
                {item.goal}
              </Text>
            </View>
          </LinearGradient>
        </View>
      </PressableScale>
    </FadeInView>
  );

  return (
    <View style={[tw`flex-1`, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={C.statusBar} backgroundColor={C.bg} />

      {/* Header */}
      <View style={[tw`z-10 shadow-sm`, { backgroundColor: C.bg, paddingTop: insets.top + S.vs(8) }]}>
        <FadeInView duration={800}>
          <View style={[tw`flex-row items-center justify-between px-6 pb-4`]}>
            {/* Logo & Brand */}
            <View style={tw`flex-row items-center`}>
              <LinearGradient
                colors={isDark ? ['#2E2E2E', '#1A1A1A'] : ['#FFFFFF', '#F8FAFC']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[tw`items-center justify-center mr-4 border`, { width: S.ms(54), height: S.ms(54), borderRadius: S.ms(18), borderColor: C.border, elevation: 6, shadowColor: brandColor, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10 }]}
              >
                <Image source={require('../../assets/logo.png')} style={{ width: S.ms(34), height: S.ms(34) }} resizeMode="contain" />
              </LinearGradient>
              <View>
                <Text style={[tw`font-black mb-0.5`, { fontSize: S.fs(9), color: C.textSecondary, letterSpacing: 0 }]}>{lang === 'en' ? 'WELCOME TO' : 'BIENVENUE SUR'}</Text>
                <Text style={[tw`font-black leading-7`, { fontSize: S.fs(20), color: C.text, letterSpacing: 0 }]}>REHOBOTH</Text>
              </View>
            </View>

            {/* Controls (Theme & Lang) */}
            <View style={tw`flex-row items-center`}>
              <PressableScale
                style={[tw`flex-row items-center px-3 border ml-2`, { height: S.vs(38), borderRadius: S.ms(19), backgroundColor: C.headerBtn, borderColor: C.border, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 }]}
                onPress={toggleLang}
              >
                <MaterialIcons name="language" size={S.ms(18)} color={isDark ? '#FFF' : brandColor} />
                <Text style={[tw`font-bold ml-1.5`, { fontSize: S.fs(12), color: C.text }]}>{lang.toUpperCase()}</Text>
              </PressableScale>

              <PressableScale
                style={[tw`flex-row items-center px-3 border ml-2`, { height: S.vs(38), borderRadius: S.ms(19), backgroundColor: C.headerBtn, borderColor: C.border, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 }]}
                onPress={toggleTheme}
              >
                <MaterialCommunityIcons name={isDark ? 'brightness-6' : 'moon-waning-crescent'} size={S.ms(18)} color={isDark ? '#FFF' : brandColor} />
              </PressableScale>
            </View>
          </View>
        </FadeInView>

        {/* Categories (Airbnb Style) - ONLY shown in Explorer tab */}
        {activeTab === 'explorer' && (
          <View style={[tw`border-b mt-1 pb-3 px-4`, { borderColor: C.divider }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row items-center justify-between w-full`}>
              {CATEGORIES.map((cat, index) => {
                const isActive = activeCategory === cat.id;
                const IconComponent = cat.icon;
                return (
                  <FadeInView key={cat.id} delay={200 + (index * 100)} duration={500} style={tw`flex-1`}>
                    <PressableScale
                      style={tw`items-center justify-center`}
                      onPress={() => setActiveCategory(cat.id)}
                    >
                      <View style={[tw`rounded-full items-center justify-center mb-1.5`, { width: S.ms(42), height: S.ms(42), backgroundColor: isActive ? brandColor + '10' : 'transparent', borderWidth: 1, borderColor: isActive ? brandColor + '20' : 'transparent' }]}>
                        <IconComponent size={S.ms(20)} color={isActive ? brandColor : C.textSecondary} strokeWidth={isActive ? 2.5 : 2} />
                      </View>
                      <Text style={[
                        tw`font-black text-center`,
                        { fontSize: S.fs(9), color: isActive ? brandColor : C.subtext, letterSpacing: 0 }
                      ]} numberOfLines={1}>
                        {cat.name.toUpperCase()}
                      </Text>
                      {isActive && (
                        <View style={[tw`absolute -bottom-3 rounded-full`, { width: S.s(20), height: S.vs(2.5), backgroundColor: brandColor }]} />
                      )}
                    </PressableScale>
                  </FadeInView>
                );
              })}

              {/* Network Indicator */}
              <FadeInView delay={500} duration={600} style={tw`flex-1 items-center justify-center opacity-90`}>
                <View style={[tw`rounded-full items-center justify-center mb-1.5`, { width: S.ms(44), height: S.ms(44) }]}>
                  {isOnline ? (
                    <MaterialCommunityIcons name="wifi" size={S.ms(22)} color={isDark ? '#4ADE80' : '#16A34A'} />
                  ) : (
                    <MaterialCommunityIcons name="wifi-off" size={S.ms(22)} color="#EF4444" />
                  )}
                </View>
                <Text style={[tw`font-black text-center`, { fontSize: S.fs(9), color: isOnline ? (isDark ? '#4ADE80' : '#16A34A') : '#EF4444', letterSpacing: 0 }]} numberOfLines={1}>
                  {isOnline ? (lang === 'en' ? 'ONLINE' : 'EN LIGNE') : (lang === 'en' ? 'OFFLINE' : 'HORS-LIGNE')}
                </Text>
              </FadeInView>
            </ScrollView>
          </View>
        )}
      </View>

      {/* Main Content */}
      {activeTab === 'favoris' && getFilteredData().length === 0 ? (
        <FadeInView duration={600} style={tw`flex-1 justify-center px-6`}>
          <EmptyState
            C={C}
            S={S}
            icon="heart-outline"
            title={lang === 'en' ? 'No favorites yet' : 'Aucun favori'}
            message={lang === 'en' ? 'Mark the services you use often to find them faster.' : "Marquez les services les plus utilisés pour les retrouver plus vite."}
            actionLabel={lang === 'en' ? 'Explore services' : 'Explorer les services'}
            onAction={() => setActiveTab('explorer')}
          />
        </FadeInView>
      ) : (
        <FlatList
          key={activeTab}
          data={getFilteredData()}
          renderItem={activeTab === 'departements' ? renderDepartmentCard : renderServiceCard}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[tw`pt-6 px-6`, { paddingBottom: S.vs(120) + insets.bottom }]}
          style={tw`flex-1`}
          extraData={{ activeCategory, activeTab, favorites, isDark, lang }}
          removeClippedSubviews={true}
          initialNumToRender={6}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      )}

      {/* Bottom Navigation (Fixed at bottom) */}
      <FadeInView delay={400} duration={800} style={[
        tw`absolute bottom-0 w-full flex-row justify-around items-center px-4`,
        {
          height: S.vs(85) + insets.bottom,
          paddingBottom: insets.bottom + S.vs(5),
          backgroundColor: isDark ? '#0B1220' : 'rgba(255, 255, 255, 0.97)',
          borderTopWidth: 1,
          borderTopColor: C.borderSoft,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.3 : 0.05,
          shadowRadius: 15
        }
      ]}>
        <PressableScale style={tw`items-center justify-center flex-1 py-1`} onPress={() => setActiveTab('explorer')}>
          <Home size={S.ms(24)} color={activeTab === 'explorer' ? brandColor : C.textSecondary} strokeWidth={activeTab === 'explorer' ? 2.5 : 2} />
          <Text style={[tw`mt-1.5`, { fontSize: S.fs(8.5), color: activeTab === 'explorer' ? brandColor : C.subtext, fontWeight: activeTab === 'explorer' ? '900' : '700', letterSpacing: 0 }]}>{lang === 'en' ? 'EXPLORE' : 'EXPLORER'}</Text>
        </PressableScale>

        <PressableScale style={tw`items-center justify-center flex-1 py-1`} onPress={() => setActiveTab('favoris')}>
          <Heart size={S.ms(24)} color={activeTab === 'favoris' ? brandColor : C.textSecondary} strokeWidth={activeTab === 'favoris' ? 2.5 : 2} />
          <Text style={[tw`mt-1.5`, { fontSize: S.fs(8.5), color: activeTab === 'favoris' ? brandColor : C.subtext, fontWeight: activeTab === 'favoris' ? '900' : '700', letterSpacing: 0 }]}>{lang === 'en' ? 'FAVORITES' : 'FAVORIS'}</Text>
        </PressableScale>

        <PressableScale style={tw`items-center justify-center flex-1 py-1`} onPress={() => setActiveTab('departements')}>
          <Building2 size={S.ms(24)} color={activeTab === 'departements' ? brandColor : C.textSecondary} strokeWidth={activeTab === 'departements' ? 2.5 : 2} />
          <Text style={[tw`mt-1.5`, { fontSize: S.fs(8.5), color: activeTab === 'departements' ? brandColor : C.subtext, fontWeight: activeTab === 'departements' ? '900' : '700', letterSpacing: 0 }]} numberOfLines={1}>{lang === 'en' ? 'SERVICES' : 'SERVICES'}</Text>
        </PressableScale>

        <PressableScale style={tw`items-center justify-center flex-1 py-1`} onPress={() => navigation.navigate('Login')}>
          <User size={S.ms(24)} color={C.textSecondary} strokeWidth={2} />
          <Text style={[tw`mt-1.5 font-bold`, { fontSize: S.fs(8.5), color: C.subtext, letterSpacing: 0 }]}>{lang === 'en' ? 'LOGIN' : 'CONNEXION'}</Text>
        </PressableScale>
      </FadeInView>
    </View>
  );
}
