import React, { useState } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';

export default function App() {
  const [screen, setScreen] = useState('home'); // 'home' ou 'login'
  const [darkMode, setDarkMode] = useState(false);

  return (
    <PaperProvider>
      {screen === 'home' ? (
        <HomeScreen 
          darkMode={darkMode} 
          setDarkMode={setDarkMode} 
          onStart={() => setScreen('login')} 
        />
      ) : (
        <LoginScreen 
          darkMode={darkMode} 
          onBack={() => setScreen('home')} 
          onLoginSuccess={() => setScreen('home')} 
        />
      )}
    </PaperProvider>
  );
}