import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { AppContext } from '../../App';
import { useTheme } from '../hooks/useTheme';
import { ToastContext } from './ToastManager';
import api from '../services/api';
import { Theme } from '../constants/theme';
import { withCacheBust } from '../utils/media';

export default function ProfileView({ onBack }) {
  const { user, setUser, lang } = useContext(AppContext);
  const { C, S, brandColor, isDark } = useTheme();
  const styles = createStyles(C, S, isDark, brandColor);
  const { showToast } = useContext(ToastContext);
  const [uploading, setUploading] = useState(false);
  // Local URI with cache-buster timestamp, updated after each successful upload
  const [photoUri, setPhotoUri] = useState(
    user?.profile_photo ? withCacheBust(user.profile_photo) : null
  );

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        lang === 'fr' ? 'Permission requise' : 'Permission required',
        lang === 'fr' ? 'Nous avons besoin de votre permission pour accéder à vos photos.' : 'We need your permission to access your photos.'
      );
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      uploadProfilePicture(result.assets[0].uri);
    }
  };

  const uploadProfilePicture = async (uri) => {
    setUploading(true);
    const formData = new FormData();
    const filename = uri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename);
    const rawType = match ? match[1].toLowerCase() : 'jpeg';
    const mimeType = rawType === 'jpg' ? 'image/jpeg' : `image/${rawType}`;

    formData.append('image', { uri, name: filename, type: mimeType });

    try {
      const response = await api.post('/user/profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updatedUser = response.data.user;
      // Build full URL with timestamp to force refresh
      const freshUrl = updatedUser.profile_photo
        ? withCacheBust(updatedUser.profile_photo)
        : `${uri}?t=${Date.now()}`;
      
      setPhotoUri(freshUrl);
      setUser(updatedUser);
      showToast(lang === 'fr' ? 'Photo de profil mise à jour' : 'Profile picture updated', 'success');
    } catch (error) {
      console.error('[ProfileView] Upload error:', error?.response?.data || error.message);
      showToast(lang === 'fr' ? 'Erreur lors de l\'envoi' : 'Error uploading photo', 'error');
    } finally {
      setUploading(false);
    }
  };

  if (!user) return null;

  const roleDisplay = {
    'admin': 'Administrateur',
    'reception': 'Réceptionniste',
    'medecin': 'Médecin',
    'infirmier': 'Infirmier',
    'soins': 'Infirmier / Soins',
    'maternite': 'Maternité',
    'labo': 'Laborantin',
    'pharmacie': 'Pharmacien',
    'caisse': 'Caissier'
  }[user.role?.toLowerCase()] || user.role;

  const joinDate = user.created_at ? new Date(user.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Inconnu';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { backgroundColor: C.surface, borderColor: C.divider, borderWidth: 1 }]}>
          <MaterialIcons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.text }]}>{lang === 'fr' ? 'Mon Compte' : 'My Account'}</Text>
      </View>

      <View style={styles.content}>
        {/* Avatar Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: C.surface, borderColor: brandColor + '30' }]}>
           <LinearGradient colors={[brandColor + '15', 'transparent']} style={StyleSheet.absoluteFillObject} />
           
           <View style={styles.avatarWrapper}>
             <View style={[styles.avatarBorder, { borderColor: brandColor }]}>
               {photoUri ? (
                 <Image
                   key={photoUri}
                   source={{ uri: photoUri }}
                   style={styles.avatar}
                   resizeMode="cover"
                   onError={() => setPhotoUri(null)}
                 />
               ) : (
                 <LinearGradient colors={Theme.colors.brandGradient} style={styles.avatarPlaceholder}>
                   <Text style={styles.avatarText}>{user.name?.charAt(0).toUpperCase()}</Text>
                 </LinearGradient>
               )}
             </View>
             <TouchableOpacity 
               style={[styles.editBadge, { backgroundColor: brandColor, borderColor: C.surface }]} 
               onPress={handlePickImage}
               disabled={uploading}
             >
               {uploading ? (
                 <ActivityIndicator size="small" color="#FFF" />
               ) : (
                 <MaterialIcons name="camera-alt" size={18} color="#FFF" />
               )}
             </TouchableOpacity>
           </View>

           <Text style={[styles.userName, { color: C.text }]}>{user.name}</Text>
           <View style={[styles.roleBadge, { backgroundColor: brandColor + '15', borderColor: brandColor + '30', borderWidth: 1 }]}>
             <Text style={[styles.roleText, { color: brandColor }]}>{roleDisplay?.toUpperCase()}</Text>
           </View>
        </View>

        <Text style={{ fontSize: 12, fontWeight: '900', color: C.sub, letterSpacing: 1.5, marginBottom: 12, marginTop: 10 }}>INFORMATIONS DU PROFIL</Text>
        
        <View style={[styles.infoCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
          <InfoRow 
            icon="" 
            label={lang === 'fr' ? 'Email Professionnel' : 'Work Email'} 
            value={user.email} 
            C={C}
            brandColor={brandColor}
            styles={styles}
          />
          <View style={[styles.divider, { backgroundColor: C.divider }]} />
          <InfoRow 
            icon="shield-check-outline" 
            label={lang === 'fr' ? 'Statut du Compte' : 'Account Status'} 
            value={lang === 'fr' ? 'Actif & Vérifié' : 'Active & Verified'} 
            C={C}
            brandColor="#10B981"
            styles={styles}
            valueColor="#10B981"
          />
          <View style={[styles.divider, { backgroundColor: C.divider }]} />
          <InfoRow 
            icon="calendar-account" 
            label={lang === 'fr' ? 'Membre depuis le' : 'Member since'} 
            value={joinDate} 
            C={C}
            brandColor={brandColor}
            styles={styles}
          />
        </View>

        <Text style={{ fontSize: 12, fontWeight: '900', color: C.sub, letterSpacing: 1.5, marginBottom: 12, marginTop: 10 }}>SÉCURITÉ & CONNEXION</Text>
        <View style={[styles.infoCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
          <TouchableOpacity onPress={() => showToast("", "info")} style={styles.infoRow}>
            <View style={[styles.infoIconBox, { backgroundColor: '#F59E0B' + '15' }]}>
              <MaterialCommunityIcons name="lock-outline" size={20} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: C.sub }]}>Mot de passe</Text>
              <Text style={[styles.infoValue, { color: C.text }]}>••••••••</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.warningBox, { backgroundColor: isDark ? '#1A1A1A' : '#F8FAFC', borderColor: C.divider, borderWidth: 1 }]}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.divider, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
             <MaterialIcons name="admin-panel-settings" size={20} color={C.sub} />
          </View>
          <Text style={[styles.warningText, { color: C.sub }]}>
            {lang === 'fr' 
              ? 'Certaines informations sensibles sont verrouillées par la direction. Contactez le support informatique pour tout changement.' 
              : 'Account information is managed by the administration. Contact IT support for changes.'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const InfoRow = ({ icon, label, value, C, brandColor, styles, valueColor }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconBox}>
      <MaterialCommunityIcons name={icon} size={20} color={brandColor} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.infoLabel, { color: C.sub }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: valueColor || C.text }]}>{value}</Text>
    </View>
  </View>
);

const createStyles = (C, S, isDark, brandColor) => StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 20, 
    paddingBottom: 10 
  },
  backBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: '900', 
    marginLeft: 16 
  },
  content: { padding: 24 },
  heroCard: {
    alignItems: 'center', 
    marginBottom: 24,
    paddingVertical: 32,
    borderRadius: 32,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  avatarWrapper: { 
    position: 'relative', 
    marginBottom: 20 
  },
  avatarBorder: { 
    width: 120, 
    height: 120, 
    borderRadius: 44, 
    borderWidth: 3, 
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg
  },
  avatar: { 
    width: '100%', 
    height: '100%', 
    borderRadius: 38 
  },
  avatarPlaceholder: { 
    width: '100%', 
    height: '100%', 
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: { 
    color: '#FFF', 
    fontSize: 48, 
    fontWeight: '900' 
  },
  editBadge: { 
    position: 'absolute', 
    bottom: -5, 
    right: -5, 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    borderWidth: 4, 
    borderColor: isDark ? '#0A0A0A' : '#FFF', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  userName: { 
    fontSize: 24, 
    fontWeight: '900', 
    marginBottom: 8 
  },
  roleBadge: { 
    paddingHorizontal: 14, 
    paddingVertical: 6, 
    borderRadius: 12 
  },
  roleText: { 
    fontSize: 12, 
    fontWeight: '900', 
    letterSpacing: 1 
  },
  infoCard: { 
    borderRadius: 28, 
    borderWidth: 1, 
    overflow: 'hidden', 
    marginBottom: 24 
  },
  infoRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20 
  },
  infoIconBox: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    backgroundColor: brandColor + '15', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 16 
  },
  infoLabel: { 
    fontSize: 10, 
    fontWeight: '800', 
    marginBottom: 4, 
    letterSpacing: 0.5 
  },
  infoValue: { 
    fontSize: 15, 
    fontWeight: '700' 
  },
  divider: { 
    height: 1, 
    marginHorizontal: 20 
  },
  warningBox: { 
    flexDirection: 'row', 
    padding: 20, 
    borderRadius: 20, 
    alignItems: 'center' 
  },
  warningText: { 
    flex: 1, 
    fontSize: 12, 
    fontWeight: '600', 
    marginLeft: 12, 
    lineHeight: 18 
  }
});
