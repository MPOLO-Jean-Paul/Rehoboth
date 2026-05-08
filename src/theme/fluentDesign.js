export const fluentTheme = {
  // Using Google Material Design 3 (Material You) color palette concepts
  colors: {
    light: {
      background: '#FFFFFF',      // Air, clean white
      surface: '#F8F9FA',         // Google's classic off-white surface
      surfaceVariant: '#E8EAED',  // Slightly darker surface
      primary: '#1A73E8',         // Classic Google Blue
      primaryContainer: '#D2E3FC',// Soft primary background
      text: '#202124',            // Google dark text
      secondaryText: '#5F6368',   // Google gray text
      border: '#DADCE0',          // Google classic gray border
      danger: '#D93025',          // Google Red
      success: '#1E8E3E',         // Google Green
      warning: '#F9AB00',         // Google Yellow
    },
    dark: {
      background: '#202124',
      surface: '#303134',
      surfaceVariant: '#3C4043',
      primary: '#8AB4F8',
      primaryContainer: '#4285F4',
      text: '#E8EAED',
      secondaryText: '#9AA0A6',
      border: '#5F6368',
      danger: '#F28B82',
      success: '#81C995',
      warning: '#FDE293',
    }
  },
  typography: {
    fontFamily: 'System', 
    titleSize: 22,
    bodySize: 14,
    labelSize: 12,
  },
  geometry: {
    borderRadius: 24,             // Material 3 uses large border radii
    cardRadius: 16,
    buttonHeight: 48,             // Touch target optimal size
    inputHeight: 48,
  },
  shadows: {
    // Google Material elevation (subtle diffuse shadows)
    elevation: 3,
    shadowColor: '#202124',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  }
};
