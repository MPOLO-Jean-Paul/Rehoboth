import React, { useContext, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { AppContext } from '../../App';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const RoleGuard = ({ children, allowedRoles }) => {
  const { user, lang, colors } = useContext(AppContext);
  const navigation = useNavigation();

  useEffect(() => {
    if (user && !allowedRoles.includes(user.role)) {
      console.log(`[RoleGuard] Access denied for ${user.role}. Allowed: ${allowedRoles}`);
      navigation.replace('Home');
    }
  }, [user, allowedRoles]);

  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 40 }}>
        <MaterialCommunityIcons name="shield-lock" size={80} color="#EF4444" />
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 24, textAlign: 'center' }}>
          {lang === 'fr' ? 'ACCÈS REFUSÉ' : 'ACCESS DENIED'}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 12, textAlign: 'center', lineHeight: 22 }}>
          {lang === 'fr' 
            ? "Vous n'avez pas les permissions nécessaires pour accéder à ce service." 
            : "You do not have the required permissions to access this service."}
        </Text>
      </View>
    );
  }

  return children;
};

export default RoleGuard;
