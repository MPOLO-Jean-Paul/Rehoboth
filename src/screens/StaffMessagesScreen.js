import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';
import { Theme } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import PremiumHeader from '../components/PremiumHeader';
import FloatingActionDock from '../components/FloatingActionDock';
import { FadeInView } from '../components/AnimatedComponents';

export default function StaffMessagesScreen({ navigation }) {
  const { C, S, brandColor } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(S);
  const headerOffset = insets.top + Math.max(S.vs(104), 112);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMessages = async () => {
    try {
      const response = await api.get('/messages', {
        params: { per_page: 50, unread: unreadOnly ? 1 : 0 },
      });
      const payload = response.data;
      setMessages(Array.isArray(payload) ? payload : payload.data || []);
      setUnreadCount(Array.isArray(payload) ? 0 : payload.meta?.unread_count || 0);
    } catch (error) {
      // silent - api interceptor keeps technical details away from the interface
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchMessages();
  }, [unreadOnly]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  const markMessageAsRead = async (message) => {
    if (message.is_read_by_me) return;

    setMessages((current) => current.map((item) => (
      item.id === message.id ? { ...item, is_read_by_me: true } : item
    )));
    setUnreadCount((count) => Math.max(count - 1, 0));

    try {
      await api.post(`/messages/${message.id}/read`);
    } catch (error) {
      fetchMessages();
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;

    const previousMessages = messages;
    const previousUnreadCount = unreadCount;
    setMessages((current) => current.map((item) => ({ ...item, is_read_by_me: true })));
    setUnreadCount(0);

    try {
      await api.post('/messages/read-all');
      if (unreadOnly) fetchMessages();
    } catch (error) {
      setMessages(previousMessages);
      setUnreadCount(previousUnreadCount);
    }
  };

  const deleteMessage = (messageId) => {
    Alert.alert(
      'Supprimer le message',
      'Ce message sera retiré de votre boîte de réception. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'SUPPRIMER',
          style: 'destructive',
          onPress: async () => {
            const previousMessages = messages;
            // Optimistic UI update
            setMessages((current) => current.filter((msg) => msg.id !== messageId));
            try {
              await api.delete(`/messages/${messageId}`);
            } catch (error) {
              // Revert if the request failed
              setMessages(previousMessages);
              Alert.alert('Erreur', 'Impossible de supprimer le message. Réessayez.');
            }
          },
        },
      ]
    );
  };

  const getPriorityMeta = (priority) => {
    if (priority === 'urgent') return { label: 'URGENT', color: '#EF4444', icon: 'alert-octagon' };
    if (priority === 'important') return { label: 'IMPORTANT', color: '#F59E0B', icon: 'alert-circle' };
    return { label: 'INFO', color: brandColor, icon: 'information-outline' };
  };

  const renderMessage = ({ item, index }) => {
    const priority = getPriorityMeta(item.priority);
    const isUnread = !item.is_read_by_me;

    return (
    <FadeInView delay={index * 100} style={styles.messageCard}>
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={() => markMessageAsRead(item)}
        style={[
          styles.cardInner,
          {
            backgroundColor: isUnread ? brandColor + '08' : C.surface,
            borderColor: isUnread ? brandColor + '55' : C.border,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: brandColor + '20' }]}>
            <Text style={[styles.avatarText, { color: brandColor }]}>{item.sender?.name?.[0] || 'A'}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.senderName, { color: C.text }]} numberOfLines={1}>{item.sender?.name || 'Administrateur'}</Text>
            <Text style={[styles.senderRole, { color: brandColor }]}>{item.sender?.role?.toUpperCase() || 'ADMIN'}</Text>
          </View>
          <Text style={[styles.dateText, { color: C.sub }]}>
            {new Date(item.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
          </Text>
          <TouchableOpacity 
            onPress={() => deleteMessage(item.id)} 
            style={styles.deleteButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={C.sub} />
          </TouchableOpacity>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.priorityPill, { backgroundColor: priority.color + '15' }]}>
            <MaterialCommunityIcons name={priority.icon} size={13} color={priority.color} style={{ marginRight: 5 }} />
            <Text style={[styles.priorityText, { color: priority.color }]}>{priority.label}</Text>
          </View>
          {item.target_role ? (
            <Text style={[styles.targetText, { color: C.sub }]}>{item.target_role.toUpperCase()}</Text>
          ) : (
            <Text style={[styles.targetText, { color: C.sub }]}>{"TOUS LES SERVICES"</Text>
          )}
          {isUnread && <View style={[styles.unreadDot, { backgroundColor: brandColor }]} />}
        </View>
        
        <View style={styles.cardBody}>
          <Text style={[styles.subject, { color: C.text }]}>{item.subject || 'Sans objet'}</Text>
          <Text style={[styles.messageContent, { color: C.sub }]}>{item.message}</Text>
        </View>

        <View style={[styles.cardFooter, { borderTopColor: C.divider }]}>
           <MaterialCommunityIcons name="help-circle" size={16} color={C.sub} style={{ marginRight: 6 }} />
           <Text style={[styles.footerText, { color: C.sub }]}>
             {isUnread ? 'Touchez pour marquer comme lu' : 'Message lu'}
           </Text>
        </View>
      </TouchableOpacity>
    </FadeInView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <PremiumHeader 
        navigation={navigation}
        title="COMMUNICATIONS"
        subtitle="MESSAGES DU PERSONNEL"
        icon="email-multiple"
        onLeftPress={() => navigation.goBack()}
      />

      <FloatingActionDock
        title="Messages du personnel"
        actions={[
          { key: 'back', icon: 'arrow-back', onPress: () => navigation.goBack() },
          { key: 'unread', icon: unreadOnly ? 'mark-email-read' : 'mark-email-unread', onPress: () => setUnreadOnly(prev => !prev), active: unreadOnly },
          { key: 'read-all', icon: 'done-all', onPress: markAllAsRead },
          { key: 'refresh', icon: 'refresh', onPress: onRefresh },
        ]}
        bottomOffset={24}
      />

      <View style={[styles.content, { paddingTop: headerOffset }]}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={brandColor} />
            <Text style={[styles.loadingText, { color: C.sub }]}>{"Chargement des messages..."</Text>
          </View>
        ) : (
            <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + S.vs(28) }]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brandColor} />
            }
            ListHeaderComponent={
              <FadeInView style={styles.summaryWrap}>
                <LinearGradient colors={Theme.colors.brandGradient} style={styles.summaryCard}>
                  <View style={styles.summaryIcon}>
                    <MaterialCommunityIcons name="help-circle" size={28} color="#FFF" />
                  </View>
                  <View style={styles.summaryTextWrap}>
                    <Text style={styles.summaryLabel}>{"BOÎTE DE RÉCEPTION"</Text>
                    <Text style={styles.summaryTitle}>
                      {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={markAllAsRead} disabled={unreadCount === 0} style={styles.summaryAction}>
                    <MaterialCommunityIcons name="help-circle" size={22} color="#FFF" />
                  </TouchableOpacity>
                </LinearGradient>
                <View style={[styles.filterBar, { backgroundColor: C.surface, borderColor: C.border }]}>
                  {[
                    { key: false, label: 'Tous' },
                    { key: true, label: 'Non lus' },
                  ].map((filter) => (
                    <TouchableOpacity
                      key={filter.label}
                      onPress={() => setUnreadOnly(filter.key)}
                      style={[styles.filterButton, unreadOnly === filter.key && { backgroundColor: brandColor }]}
                    >
                      <Text style={[styles.filterText, { color: unreadOnly === filter.key ? '#FFF' : C.sub }]}>
                        {filter.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </FadeInView>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="email-open-outline" size={64} color={C.divider} />
                <Text style={[styles.emptyTitle, { color: C.text }]}>{"Aucun message"</Text>
                <Text style={[styles.emptyText, { color: C.sub }]}>Les communications de l'administration apparaîtront ici.</Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const createStyles = (S) => StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: S.s(24) },
  loadingText: { marginTop: S.vs(12), fontSize: S.fs(12), fontWeight: '700' },
  listContainer: { paddingHorizontal: S.s(16), paddingTop: S.vs(4) },
  summaryWrap: { marginBottom: S.vs(18) },
  summaryCard: {
    minHeight: S.vs(92),
    borderRadius: S.ms(24),
    padding: S.ms(18),
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
  },
  summaryIcon: {
    width: S.ms(52),
    height: S.ms(52),
    borderRadius: S.ms(18),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.s(14),
  },
  summaryTextWrap: { flex: 1 },
  summaryLabel: { color: 'rgba(255,255,255,0.72)', fontSize: S.fs(9), fontWeight: '900', letterSpacing: 1 },
  summaryTitle: { color: '#FFF', fontSize: S.fs(22), fontWeight: '900', marginTop: S.vs(4) },
  summaryAction: {
    width: S.ms(44),
    height: S.ms(44),
    borderRadius: S.ms(15),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBar: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: S.ms(16),
    padding: S.ms(4),
    marginTop: S.vs(12),
  },
  filterButton: {
    flex: 1,
    height: S.vs(38),
    borderRadius: S.ms(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: { fontSize: S.fs(11), fontWeight: '900' },
  messageCard: { marginBottom: S.vs(14) },
  cardInner: {
    borderRadius: S.ms(20),
    borderWidth: 1,
    padding: S.ms(18),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: S.vs(14),
  },
  avatar: {
    width: S.ms(44),
    height: S.ms(44),
    borderRadius: S.ms(15),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.s(12),
  },
  avatarText: { fontSize: S.fs(18), fontWeight: '900' },
  headerInfo: { flex: 1, minWidth: 0, paddingRight: S.s(8) },
  senderName: { fontSize: S.fs(15), fontWeight: '900' },
  senderRole: { fontSize: S.fs(9), fontWeight: '800', letterSpacing: 1, marginTop: S.vs(2) },
  dateText: { fontSize: S.fs(11), fontWeight: '700', marginRight: S.s(8) },
  deleteButton: { padding: S.ms(4) },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: S.vs(12),
  },
  priorityPill: {
    minHeight: S.vs(24),
    borderRadius: S.ms(9),
    paddingHorizontal: S.s(8),
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: S.s(8),
  },
  priorityText: { fontSize: S.fs(8), fontWeight: '900', letterSpacing: 0.6 },
  targetText: { flex: 1, fontSize: S.fs(8), fontWeight: '900', letterSpacing: 0.6 },
  unreadDot: { width: S.ms(8), height: S.ms(8), borderRadius: S.ms(4) },
  cardBody: {
    marginBottom: S.vs(16),
  },
  subject: { fontSize: S.fs(16), fontWeight: '900', marginBottom: S.vs(8), lineHeight: S.vs(22) },
  messageContent: { fontSize: S.fs(14), lineHeight: S.vs(21), fontWeight: '500' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: S.vs(12),
  },
  footerText: { flex: 1, fontSize: S.fs(10), fontWeight: '700', fontStyle: 'italic' },
  emptyContainer: {
    marginTop: S.vs(72),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: S.s(28),
  },
  emptyTitle: {
    marginTop: S.vs(16),
    fontSize: S.fs(18),
    fontWeight: '900',
  },
  emptyText: {
    marginTop: S.vs(6),
    fontSize: S.fs(13),
    lineHeight: S.vs(19),
    fontWeight: '700',
    textAlign: 'center',
  }
});
