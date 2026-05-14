import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';
import { AppContext } from '../../App';
import { Theme } from '../constants/theme';
import { FadeInView, PressableScale } from '../components/AnimatedComponents';
import { loadAuthSession } from '../services/session';
import FloatingActionDock from '../components/FloatingActionDock';
import { navigateFromNotification } from '../services/notificationNavigation';

export default function NotificationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { themeMode, notificationsEnabled } = useContext(AppContext);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    loadAuthSession().then(s => setUserRole(s.role));
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data);
    } catch (error) {
      // silent - api interceptor handles technical details
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (item) => {
    let notificationToOpen = item;
    setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));

    try {
      const res = await api.post(`/notifications/${item.id}/read`);
      const itemData = typeof item.data === 'object' && item.data ? item.data : {};
      notificationToOpen = { ...item, data: { ...itemData, ...(res.data?.data || {}) } };
    } catch (error) {
      // silent - the notification still opens its destination
    } finally {
      navigateFromNotification(navigation, notificationToOpen, userRole);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      // silent
    }
  };

  const deleteNotification = (id) => {
    Alert.alert(
      'Supprimer la notification',
      'Cette notification sera définitivement supprimée. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'SUPPRIMER',
          style: 'destructive',
          onPress: async () => {
            const previous = notifications;
            setNotifications(prev => prev.filter(n => n.id !== id));
            try {
              await api.delete(`/notifications/${id}`);
            } catch (error) {
              setNotifications(previous);
            }
          },
        },
      ]
    );
  };

  const deleteAllNotifications = () => {
    if (notifications.length === 0) return;
    Alert.alert(
      'Tout supprimer',
      'Toutes les notifications seront supprimées définitivement. Confirmer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'TOUT SUPPRIMER',
          style: 'destructive',
          onPress: async () => {
            const previous = notifications;
            setNotifications([]);
            try {
              await api.delete('/notifications/all');
            } catch (error) {
              setNotifications(previous);
            }
          },
        },
      ]
    );
  };

  const getIcon = (type) => {
    switch (type) {
      case 'emergency': return { name: 'alert-decagram', color: '#EF4444' };
      case 'success': return { name: 'check-circle', color: '#22C55E' };
      case 'info': return { name: 'information', color: '#3B82F6' };
      default: return { name: 'bell', color: Theme.colors.primary };
    }
  };

  const renderItem = ({ item, index }) => {
    const icon = getIcon(item.type);
    return (
      <FadeInView delay={index * 50}>
        <View style={[
          styles.notificationCard,
          { backgroundColor: isDark ? '#1A1A1A' : '#FFF', borderColor: isDark ? '#2E2E2E' : '#F1F5F9' },
          !item.is_read && { borderLeftWidth: 4, borderLeftColor: Theme.colors.primary }
        ]}>
          {/* Main row: icon + content */}
          <PressableScale
            onPress={() => markAsRead(item)}
            style={styles.cardPressable}
          >
            <View style={[styles.iconContainer, { backgroundColor: icon.color + '15' }]}>
              <MaterialCommunityIcons name={icon.name} size={24} color={icon.color} />
            </View>
            <View style={styles.contentContainer}>
              <View style={styles.headerRow}>
                <Text style={[styles.title, { color: isDark ? '#F1F5F9' : '#1A1A1A' }]} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.time}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={[styles.body, { color: isDark ? '#AAAAAA' : '#64748B' }]} numberOfLines={2}>
                {item.body}
              </Text>
            </View>
          </PressableScale>

          {/* Delete button on the right */}
          <TouchableOpacity
            onPress={() => deleteNotification(item.id)}
            style={[styles.deleteBtn, { backgroundColor: isDark ? '#2A1A1A' : '#FEF2F2' }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </FadeInView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC' }]}>
      <View style={[styles.header, { backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF', borderBottomColor: isDark ? '#1A1A1A' : '#F1F5F9', paddingTop: insets.top + 14 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: isDark ? '#1A1A1A' : '#F1F5F9' }]}
        >
          <MaterialIcons name="arrow-back" size={22} color={isDark ? "#F1F5F9" : '#0A0A0A'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#F1F5F9' : '#0A0A0A' }]}>Notifications</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={markAllAsRead}
            disabled={!notificationsEnabled}
            style={[styles.headerActionBtn, { backgroundColor: Theme.colors.primary + (notificationsEnabled ? '15' : '05'), opacity: notificationsEnabled ? 1 : 0.5 }]}
          >
            <Text style={{ color: Theme.colors.primary, fontWeight: '800', fontSize: 11 }}>TOUT LIRE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={deleteAllNotifications}
            disabled={notifications.length === 0}
            style={[styles.headerActionBtn, { backgroundColor: '#EF444415', marginLeft: 6, opacity: notifications.length > 0 ? 1 : 0.4 }]}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <FloatingActionDock
        title="Notifications"
        actions={[
          { key: 'back', icon: 'arrow-back', onPress: () => navigation.goBack() },
          { key: 'read-all', icon: 'done-all', onPress: markAllAsRead },
          { key: 'delete-all', icon: 'delete-sweep', onPress: deleteAllNotifications },
          { key: 'refresh', icon: 'refresh', onPress: onRefresh },
        ]}
        bottomOffset={24}
      />

      {loading ? (
        <ActivityIndicator size="small" color={Theme.colors.primary} style={{ marginTop: 50 }} />
      ) : !notificationsEnabled ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="bell-cancel" size={64} color={isDark ? "#2E2E2E" : '#CBD5E1'} />
          <Text style={[styles.emptyText, { color: isDark ? '#F1F5F9' : '#1A1A1A' }]}>Notifications désactivées</Text>
          <Text style={{ color: isDark ? '#888888' : '#94A3B8', textAlign: 'center', paddingHorizontal: 40, marginTop: 10 }}>Activez les notifications dans votre profil pour recevoir des alertes en temps réel.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Theme.colors.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="bell-off-outline" size={64} color={isDark ? "#2E2E2E" : '#CBD5E1'} />
              <Text style={[styles.emptyText, { color: isDark ? '#888888' : '#94A3B8' }]}>"Aucune notification"</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', flex: 1, marginLeft: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerActionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16 },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    elevation: 2,
    overflow: 'hidden',
  },
  cardPressable: {
    flex: 1,
    flexDirection: 'row',
    padding: 14,
    alignItems: 'center',
  },
  iconContainer: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  contentContainer: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 14, fontWeight: '800', flex: 1, marginRight: 8 },
  time: { fontSize: 10, color: '#94A3B8', fontWeight: '700' },
  body: { fontSize: 13, lineHeight: 18 },
  deleteBtn: {
    width: 44,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(239,68,68,0.15)',
  },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { marginTop: 15, fontSize: 16, fontWeight: '700' }
});
