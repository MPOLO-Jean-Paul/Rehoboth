import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const Theme = {
  colors: {
    primary: '#0B5CAD',
    primaryDeep: '#083A73',
    secondary: '#00A6C8',
    teal: '#0F766E',
    success: '#15803D',
    danger: '#DC2626',
    warning: '#D97706',
    info: '#2563EB',
    
    // Gradients
    brandGradient: ['#0B5CAD', '#00A6C8'],
    blueGradient: ['#0B5CAD', '#083A73'],
    calmGradient: ['#F8FBFF', '#EEF7FB'],
    
    // Backgrounds
    dark: {
      bg: '#0B1220',
      surface: '#111827',
      card: '#162033',
      border: '#263244',
      text: '#F8FAFC',
      subtext: '#9CA3AF'
    },
    light: {
      bg: '#F5F9FC',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      border: '#D8E3EC',
      text: '#0F172A',
      subtext: '#64748B'
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  layout: {
    width,
    height,
    radius: 18,
    radiusLg: 22,
    radiusXl: 28,
    radiusFull: 999,
    radiusSm: 10
  },
  shadows: {
    xs: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 2,
      elevation: 1
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 6
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.15,
      shadowRadius: 40,
      elevation: 12
    },
    brand: {
      shadowColor: '#00529B',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 8
    }
  }
};
