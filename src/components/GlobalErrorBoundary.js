import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, StatusBar, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../constants/theme';

const { width, height } = Dimensions.get('window');

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console or external service
    console.error('REHOBOTH_CRITICAL_ERROR:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#0B1220" />
          <LinearGradient
            colors={['#0B1220', '#111827', '#020617']}
            style={StyleSheet.absoluteFill}
          />
          
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <LinearGradient
                colors={['#EF4444', '#B91C1C']}
                style={styles.iconGradient}
              >
                <MaterialCommunityIcons name="alert-decagram" size={60} color="#FFF" />
              </LinearGradient>
            </View>

            <Text style={styles.oopsText}>{"SYSTÈME INTERROMPU"</Text>
            <Text style={styles.title}>Une erreur critique est survenue</Text>
            <Text style={styles.description}>{"L'application a rencontré un problème technique inattendu. Vos données de session sont probablement en sécurité, mais l'interface doit être réinitialisée."</Text>

            <View style={styles.errorCard}>
              <View style={styles.errorHeader}>
                <MaterialCommunityIcons name="help-circle" size={16} color="#EF4444" />
                <Text style={styles.errorLabel}>{"DÉTAILS TECHNIQUES"</Text>
              </View>
              <ScrollView style={styles.errorScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.errorText}>
                  {this.state.error?.name}: {this.state.error?.message}
                </Text>
                {__DEV__ && (
                  <Text style={styles.stackText}>
                    {this.state.error?.stack}
                  </Text>
                )}
              </ScrollView>
            </View>

            <TouchableOpacity 
              style={styles.restartBtn} 
              onPress={this.handleRestart}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={Theme.colors.brandGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                <MaterialCommunityIcons name="help-circle" size={24} color="#FFF" />
                <Text style={styles.btnText}>{"REDÉMARRER L'APPLICATION"</Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.footerText}>REHOBOTH MEDICAL CENTER • V2.5.0</Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1220',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  iconGradient: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#EF4444',
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  oopsText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 8,
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    fontWeight: '500',
  },
  errorCard: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    marginBottom: 30,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  errorLabel: {
    color: '#EF4444',
    fontSize: 9,
    fontWeight: '900',
    marginLeft: 8,
    letterSpacing: 1,
  },
  errorScroll: {
    maxHeight: 120,
  },
  errorText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  stackText: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  restartBtn: {
    width: '100%',
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#0B5CAD',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    marginBottom: 40,
  },
  btnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 1,
    marginLeft: 12,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.15)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  }
});

export default GlobalErrorBoundary;
