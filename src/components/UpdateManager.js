import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Updates from 'expo-updates';

const { width, height } = Dimensions.get('window');

export default function UpdateManager({ lang = 'fr' }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isIgnored, setIsIgnored] = useState(false);
  const [totalBytes, setTotalBytes] = useState(0);
  const [writtenBytes, setWrittenBytes] = useState(0);
  const [error, setError] = useState(null);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const modalFadeAnim = useRef(new Animated.Value(0)).current;
  const modalScaleAnim = useRef(new Animated.Value(0.9)).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;
  const badgeBounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (__DEV__) return;

    const checkUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          setUpdateAvailable(true);
          setShowModal(true);
        }
      } catch (e) {
        console.log('[UpdateManager] Check error:', e);
      }
    };

    checkUpdates();

    let subscription;
    if (Updates.addListener) {
      subscription = Updates.addListener((event) => {
        if (event.type === Updates.UpdateEventType.UPDATE_AVAILABLE) {
          setUpdateAvailable(true);
          setShowModal(true);
        } else if (event.type === Updates.UpdateEventType.DOWNLOAD_PROGRESS) {
          const { totalBytesWritten, totalBytesExpectedToWrite } = event.payload || {};
          if (totalBytesExpectedToWrite) {
            setTotalBytes(totalBytesExpectedToWrite);
            setWrittenBytes(totalBytesWritten);
            setDownloadProgress(totalBytesWritten / totalBytesExpectedToWrite);
          }
        }
      });
    }

    return () => {
      if (subscription && subscription.remove) {
        subscription.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (showModal) {
      Animated.parallel([
        Animated.timing(modalFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(modalScaleAnim, {
          toValue: 1,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showModal]);

  useEffect(() => {
    if (updateAvailable && !showModal && !isFinished) {
      setIsIgnored(true);
      Animated.sequence([
        Animated.delay(500),
        Animated.parallel([
          Animated.spring(badgeAnim, { toValue: 1, useNativeDriver: true }),
          Animated.timing(badgeBounceAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
        ])
      ]).start(() => {
        // Start infinite subtle bounce
        Animated.loop(
          Animated.sequence([
            Animated.timing(badgeBounceAnim, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
            Animated.timing(badgeBounceAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          ])
        ).start();
      });
    } else {
      setIsIgnored(false);
    }
  }, [updateAvailable, showModal, isFinished]);

  const handleUpdate = async () => {
    setIsDownloading(true);
    setError(null);
    try {
      // Small initial animation if listener takes time to kick in
      Animated.timing(progressAnim, {
        toValue: 0.1,
        duration: 800,
        useNativeDriver: false,
      }).start();

      await Updates.fetchUpdateAsync();
      setIsFinished(true);
    } catch (e) {
      console.log('[UpdateManager] Download error:', e);
      setError(e.message);
      setIsDownloading(false);
    }
  };

  const handleRestart = async () => {
    try {
      await Updates.reloadAsync();
    } catch (e) {
      // Fallback si reloadAsync échoue
      Platform.OS === 'android' ? Updates.reloadAsync() : null;
    }
  };

  const handleLater = () => {
    setShowModal(false);
  };

  const handleOpenUpdate = () => {
    setShowModal(true);
  };

  if (!updateAvailable) return null;

  const t = {
    fr: {
      title: 'MISE À JOUR DISPONIBLE',
      subtitle: 'Une nouvelle version de Rehoboth Elite est prête. Améliorez votre expérience maintenant.',
      btn: 'METTRE À JOUR MAINTENANT',
      downloading: 'TÉLÉCHARGEMENT...',
      finished: 'TÉLÉCHARGEMENT TERMINÉ',
      restart: 'INSTALLER ET REDÉMARRER',
      later: 'Plus tard',
      readyToInstall: 'La mise à jour est prête à être installée.',
      error: 'Erreur lors du téléchargement'
    },
    en: {
      title: 'UPDATE AVAILABLE',
      subtitle: 'A new version of Rehoboth Elite is ready. Enhance your experience now.',
      btn: 'UPDATE NOW',
      downloading: 'DOWNLOADING...',
      finished: 'DOWNLOAD FINISHED',
      restart: 'INSTALL & RESTART',
      later: 'Later',
      readyToInstall: 'The update is ready to be installed.',
      error: 'Download error'
    }
  }[lang] || {
    title: 'MISE À JOUR DISPONIBLE',
    subtitle: 'Une nouvelle version est prête.',
    btn: 'METTRE À JOUR',
    downloading: 'CHARGEMENT...',
    finished: 'TERMINÉ',
    restart: 'REDÉMARRER',
    later: 'Plus tard',
    readyToInstall: 'Prêt à installer.',
    error: 'Erreur'
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <>
    <Modal transparent visible={showModal} animationType="none">
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              opacity: modalFadeAnim,
              transform: [{ scale: modalScaleAnim }]
            }
          ]}
        >
          <LinearGradient colors={['#1E293B', '#0F172A']} style={styles.gradient}>
            
            <View style={styles.iconContainer}>
              <View style={styles.iconBg}>
                <MaterialCommunityIcons 
                  name={isFinished ? "check-decagram" : "rocket-launch"} 
                  size={48} 
                  color="#38BDF8" 
                />
              </View>
              {isDownloading && !isFinished && (
                <ActivityIndicator 
                  size={90} 
                  color="#38BDF8" 
                  style={styles.loader} 
                />
              )}
            </View>

            <Text style={styles.title}>{isFinished ? t.finished : (error ? t.error : t.title)}</Text>
            <Text style={styles.subtitle}>{isFinished ? t.readyToInstall : (error || t.subtitle)}</Text>

            {isDownloading && !isFinished && (
              <View style={styles.progressWrapper}>
                <View style={styles.progressBg}>
                  <Animated.View 
                    style={[
                      styles.progressBar, 
                      { 
                        width: writtenBytes && totalBytes 
                          ? `${(writtenBytes / totalBytes) * 100}%`
                          : progressAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', '100%']
                            }) 
                      }
                    ]} 
                  />
                </View>
                <View style={styles.progressInfo}>
                  <Text style={styles.progressText}>{t.downloading}</Text>
                  {totalBytes > 0 && (
                    <Text style={styles.sizeText}>
                      {formatSize(writtenBytes)} / {formatSize(totalBytes)}
                    </Text>
                  )}
                </View>
              </View>
            )}

            <View style={styles.actionContainer}>
              {!isFinished ? (
                <>
                  <TouchableOpacity 
                    style={[styles.mainBtn, isDownloading && styles.disabledBtn]} 
                    onPress={handleUpdate}
                    disabled={isDownloading}
                  >
                    <Text style={styles.mainBtnText}>{isDownloading ? t.downloading : t.btn}</Text>
                  </TouchableOpacity>
                  
                  {!isDownloading && (
                    <TouchableOpacity style={styles.laterBtn} onPress={handleLater}>
                      <Text style={styles.laterBtnText}>{t.later}</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <TouchableOpacity style={styles.restartBtn} onPress={handleRestart}>
                  <LinearGradient 
                    colors={['#0EA5E9', '#2563EB']} 
                    style={styles.restartGradient}
                  >
                    <Text style={styles.restartBtnText}>{t.restart}</Text>
                    <MaterialCommunityIcons name="refresh" size={20} color="#FFF" style={{marginLeft: 8}} />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>

    {isIgnored && (
      <Animated.View 
        style={[
          styles.floatingBadge, 
          { 
            opacity: badgeAnim,
            transform: [
              { translateY: badgeAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 0] }) },
              { scale: badgeBounceAnim }
            ] 
          }
        ]}
      >
        <TouchableOpacity style={styles.badgePressable} onPress={handleOpenUpdate}>
          <LinearGradient colors={['#0EA5E9', '#2563EB']} style={styles.badgeGradient} start={{x:0, y:0}} end={{x:1, y:1}}>
            <MaterialCommunityIcons name="rocket-launch" size={16} color="#FFF" />
            <Text style={styles.badgeText}>{lang === 'fr' ? 'MISE À JOUR' : 'UPDATE'}</Text>
            <View style={styles.badgeDot} />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },
  gradient: {
    padding: 32,
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  loader: {
    position: 'absolute',
    zIndex: 1,
  },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 12,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  progressWrapper: {
    width: '100%',
    marginBottom: 32,
  },
  progressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#38BDF8',
  },
  progressText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sizeText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  actionContainer: {
    width: '100%',
  },
  mainBtn: {
    backgroundColor: '#38BDF8',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  mainBtnText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  laterBtn: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  laterBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  restartBtn: {
    width: '100%',
    height: 60,
    borderRadius: 16,
    overflow: 'hidden',
  },
  restartGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  restartBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  floatingBadge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    alignSelf: 'center',
    zIndex: 9999,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 15,
  },
  badgePressable: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginLeft: 8,
    marginRight: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
    shadowColor: '#FFF',
    shadowOpacity: 1,
    shadowRadius: 4,
  }
});

