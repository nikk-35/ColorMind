import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ScrollView,
  Share,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase, Profile, Score } from './src/supabase';
import { initializeAds, loadInterstitial, showInterstitial, BannerAd, BannerAdSize, AD_IDS } from './src/ads';

const { width } = Dimensions.get('window');
const TRACK_WIDTH = width - 80;

// ============================================================================
// TYPES
// ============================================================================

interface HSBColor {
  h: number;
  s: number;
  b: number;
}

type GameMode = 'solo' | 'daily' | 'multiplayer';
type Screen = 'loading' | 'auth' | 'username' | 'menu' | 'multiplayer-menu' | 'create-room' | 'join-room' | 'memorize' | 'recall' | 'results' | 'leaderboard';

// ============================================================================
// COLOR UTILITIES
// ============================================================================

const hsbToHex = (h: number, s: number, b: number): string => {
  s /= 100;
  b /= 100;
  const k = (n: number) => (n + h / 60) % 6;
  const f = (n: number) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`;
};

const seededRandom = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
};

const randomColor = (random: () => number): HSBColor => ({
  h: Math.floor(random() * 360),
  s: Math.floor(random() * 60) + 40,
  b: Math.floor(random() * 50) + 50,
});

const generateColorsWithSeed = (count: number, seed: number): HSBColor[] => {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => randomColor(random));
};

const generateColors = (count: number): HSBColor[] => {
  return Array.from({ length: count }, () => randomColor(Math.random));
};

const getDailySeed = (): number => {
  const today = new Date();
  return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
};

const getTodayString = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const generateRoomCode = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

const colorDistance = (c1: HSBColor, c2: HSBColor): number => {
  const hDiff = Math.min(Math.abs(c1.h - c2.h), 360 - Math.abs(c1.h - c2.h)) / 180;
  const sDiff = Math.abs(c1.s - c2.s) / 100;
  const bDiff = Math.abs(c1.b - c2.b) / 100;
  return Math.sqrt(hDiff * hDiff + sDiff * sDiff + bDiff * bDiff);
};

const calculateScore = (original: HSBColor, guess: HSBColor): number => {
  const distance = colorDistance(original, guess);
  return Math.max(0, Math.round((1 - distance) * 10 * 10) / 10);
};

const getPercentile = (score: number): number => {
  if (score >= 47) return 1;
  if (score >= 45) return 3;
  if (score >= 43) return 5;
  if (score >= 40) return 10;
  if (score >= 37) return 20;
  if (score >= 34) return 30;
  if (score >= 30) return 45;
  if (score >= 26) return 60;
  return 75;
};

const getEmoji = (p: number): string => {
  if (p <= 5) return '🏆';
  if (p <= 10) return '🥇';
  if (p <= 20) return '🥈';
  if (p <= 35) return '🥉';
  return '⭐';
};

const HUE_GRADIENT: readonly string[] = [
  '#ff0000', '#ff8000', '#ffff00', '#80ff00',
  '#00ff00', '#00ff80', '#00ffff', '#0080ff',
  '#0000ff', '#8000ff', '#ff00ff', '#ff0080', '#ff0000'
] as const;

// ============================================================================
// SLIDER COMPONENT
// ============================================================================

interface SliderProps {
  label: string;
  value: number;
  max: number;
  colors: string[];
  onChange: (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({ label, value, max, colors, onChange }) => {
  const trackRef = useRef<View>(null);
  const trackX = useRef(0);

  const updateValue = (pageX: number) => {
    const x = pageX - trackX.current;
    const percentage = Math.max(0, Math.min(1, x / TRACK_WIDTH));
    onChange(Math.round(percentage * max));
  };

  const handleLayout = () => {
    trackRef.current?.measureInWindow((x) => {
      trackX.current = x;
    });
  };

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{value}{max === 360 ? '°' : '%'}</Text>
      </View>
      <View
        ref={trackRef}
        style={styles.sliderTrack}
        onLayout={handleLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => updateValue(e.nativeEvent.pageX)}
        onResponderMove={(e) => updateValue(e.nativeEvent.pageX)}
      >
        <LinearGradient
          colors={colors as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        />
        <View style={[styles.thumb, { left: (value / max) * TRACK_WIDTH - 14 }]} />
      </View>
    </View>
  );
};

// ============================================================================
// COLOR PICKER
// ============================================================================

interface ColorPickerProps {
  hue: number;
  saturation: number;
  brightness: number;
  onHueChange: (v: number) => void;
  onSatChange: (v: number) => void;
  onBriChange: (v: number) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  hue, saturation, brightness,
  onHueChange, onSatChange, onBriChange
}) => {
  const satStart = hsbToHex(hue, 0, brightness);
  const satEnd = hsbToHex(hue, 100, brightness);
  const briStart = hsbToHex(hue, saturation, 0);
  const briEnd = hsbToHex(hue, saturation, 100);

  return (
    <View style={styles.pickerContainer}>
      <View style={styles.previewContainer}>
        <View style={[styles.colorPreview, { backgroundColor: hsbToHex(hue, saturation, brightness) }]} />
      </View>

      <View style={styles.slidersCard}>
        <Slider label="Farbton" value={hue} max={360} colors={HUE_GRADIENT as unknown as string[]} onChange={onHueChange} />
        <Slider label="Sättigung" value={saturation} max={100} colors={[satStart, satEnd]} onChange={onSatChange} />
        <Slider label="Helligkeit" value={brightness} max={100} colors={[briStart, briEnd]} onChange={onBriChange} />
      </View>
    </View>
  );
};

// ============================================================================
// MODE BUTTON
// ============================================================================

const ModeButton: React.FC<{
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}> = ({ icon, title, subtitle, color, onPress, disabled }) => (
  <TouchableOpacity 
    onPress={onPress} 
    activeOpacity={0.8} 
    disabled={disabled}
    style={[styles.modeButton, { backgroundColor: color }, disabled && styles.disabledButton]}
  >
    <Text style={styles.modeIcon}>{icon}</Text>
    <View style={styles.modeText}>
      <Text style={styles.modeTitle}>{title}</Text>
      <Text style={styles.modeSubtitle}>{subtitle}</Text>
    </View>
  </TouchableOpacity>
);

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  // Auth state
  const [screen, setScreen] = useState<Screen>('loading');
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Auth form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  
  // Game state
  const [mode, setMode] = useState<GameMode>('solo');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [targets, setTargets] = useState<HSBColor[]>([]);
  const [guesses, setGuesses] = useState<HSBColor[]>([]);
  const [idx, setIdx] = useState(0);
  const [guessH, setGuessH] = useState(180);
  const [guessS, setGuessS] = useState(50);
  const [guessB, setGuessB] = useState(75);
  const [timer, setTimer] = useState(3);
  const [scores, setScores] = useState<number[]>([]);
  const [dailyPlayed, setDailyPlayed] = useState(false);
  const [dailyScore, setDailyScore] = useState<number | null>(null);
  
  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<Score[]>([]);
  const [leaderboardMode, setLeaderboardMode] = useState<'daily' | 'alltime'>('daily');
  
  // Ads
  const [isPremium, setIsPremium] = useState(false);
  const [adsReady, setAdsReady] = useState(false);

  const N = 5;

  // ============================================================================
  // AUTH FUNCTIONS
  // ============================================================================

  useEffect(() => {
    checkSession();
    initAds();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initialize ads
  const initAds = async () => {
    try {
      const success = await initializeAds();
      if (success) {
        setAdsReady(true);
        loadInterstitial();
      }
    } catch (error) {
      console.log('Ads init error:', error);
    }
  };

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id);
      } else {
        setScreen('auth');
      }
    } catch (error) {
      setScreen('auth');
    }
  };

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (data) {
        setProfile(data);
        await checkDailyPlayed(data.username);
        setScreen('menu');
      } else {
        setScreen('username');
      }
    } catch (error) {
      setScreen('username');
    }
  };

  const checkDailyPlayed = async (uname: string) => {
    try {
      const { data } = await supabase
        .from('scores')
        .select('score')
        .eq('username', uname)
        .eq('mode', 'daily')
        .eq('date', getTodayString())
        .single();
      
      if (data) {
        setDailyPlayed(true);
        setDailyScore(data.score);
      }
    } catch {}
  };

  const signInWithEmail = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) Alert.alert('Fehler', error.message);
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    }
    setLoading(false);
  };

  const signUpWithEmail = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        Alert.alert('Fehler', error.message);
      } else {
        Alert.alert('Erfolg', 'Check deine E-Mail für den Bestätigungslink!');
      }
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    }
    setLoading(false);
  };

  const signInWithApple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) Alert.alert('Fehler', error.message);
      }
    } catch (error: any) {
      if (error.code !== 'ERR_CANCELED') {
        Alert.alert('Fehler', error.message);
      }
    }
  };

  const saveUsername = async () => {
    if (username.length < 3) {
      Alert.alert('Fehler', 'Username muss mindestens 3 Zeichen haben');
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').insert({
        id: user.id,
        username: username.toLowerCase(),
      });
      
      if (error) {
        if (error.code === '23505') {
          Alert.alert('Fehler', 'Username bereits vergeben');
        } else {
          Alert.alert('Fehler', error.message);
        }
      } else {
        setProfile({ id: user.id, username: username.toLowerCase(), created_at: new Date().toISOString() });
        setScreen('menu');
      }
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    }
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setScreen('auth');
  };

  // ============================================================================
  // GAME FUNCTIONS
  // ============================================================================

  const startGame = useCallback((gameMode: GameMode, seed?: number) => {
    let colors: HSBColor[];
    
    if (seed !== undefined) {
      colors = generateColorsWithSeed(N, seed);
    } else if (gameMode === 'daily') {
      colors = generateColorsWithSeed(N, getDailySeed());
    } else {
      colors = generateColors(N);
    }
    
    setMode(gameMode);
    setTargets(colors);
    setGuesses([]);
    setIdx(0);
    setGuessH(180);
    setGuessS(50);
    setGuessB(75);
    setScores([]);
    setTimer(3);
    setScreen('memorize');
  }, []);

  const createRoom = useCallback(() => {
    const code = generateRoomCode();
    setRoomCode(code);
    setScreen('create-room');
  }, []);

  const joinRoom = useCallback(() => {
    if (inputCode.length !== 4) {
      Alert.alert('Fehler', 'Bitte gib einen 4-stelligen Code ein');
      return;
    }
    const seed = parseInt(inputCode, 10);
    setRoomCode(inputCode);
    startGame('multiplayer', seed);
  }, [inputCode, startGame]);

  const startMultiplayerGame = useCallback(() => {
    const seed = parseInt(roomCode, 10);
    startGame('multiplayer', seed);
  }, [roomCode, startGame]);

  useEffect(() => {
    if (screen !== 'memorize') return;
    if (timer <= 0) {
      setScreen('recall');
      return;
    }
    const t = setTimeout(() => setTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [screen, timer]);

  const submitGuess = useCallback(async () => {
    const currentGuess: HSBColor = { h: guessH, s: guessS, b: guessB };
    const newGuesses = [...guesses, currentGuess];
    setGuesses(newGuesses);

    if (idx < N - 1) {
      setIdx((i) => i + 1);
      setGuessH(180);
      setGuessS(50);
      setGuessB(75);
      setTimer(3);
      setScreen('memorize');
    } else {
      const sc = targets.map((t, i) => calculateScore(t, newGuesses[i]));
      setScores(sc);
      const total = sc.reduce((a, b) => a + b, 0);
      
      // Save score to database
      if (profile) {
        try {
          await supabase.from('scores').insert({
            user_id: user.id,
            username: profile.username,
            score: total,
            mode: mode,
            date: mode === 'daily' ? getTodayString() : null,
          });
        } catch {}
      }
      
      if (mode === 'daily') {
        setDailyPlayed(true);
        setDailyScore(total);
      }
      
      setScreen('results');
      
      // Show interstitial ad (if not premium)
      if (!isPremium && adsReady) {
        setTimeout(() => {
          showInterstitial();
        }, 1500);
      }
    }
  }, [guessH, guessS, guessB, guesses, idx, targets, mode, profile, user, isPremium, adsReady]);

  const totalScore = scores.reduce((a, b) => a + b, 0);
  const percentile = getPercentile(totalScore);

  const shareResults = async () => {
    const emoji = getEmoji(percentile);
    let text = `ColorMind ${emoji}\n${totalScore.toFixed(1)}/50 • Top ${percentile}%\n\n@${profile?.username}`;
    try { await Share.share({ message: text }); } catch {}
  };

  const goToMenu = () => {
    setScreen('menu');
    setRoomCode('');
    setInputCode('');
  };

  // ============================================================================
  // LEADERBOARD
  // ============================================================================

  const loadLeaderboard = async (lbMode: 'daily' | 'alltime') => {
    setLeaderboardMode(lbMode);
    setScreen('leaderboard');
    
    try {
      let query = supabase
        .from('scores')
        .select('*')
        .order('score', { ascending: false })
        .limit(50);
      
      if (lbMode === 'daily') {
        query = query.eq('mode', 'daily').eq('date', getTodayString());
      }
      
      const { data } = await query;
      setLeaderboard(data || []);
    } catch {}
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />

      {/* LOADING */}
      {screen === 'loading' && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2997ff" />
        </View>
      )}

      {/* AUTH SCREEN */}
      {screen === 'auth' && (
        <ScrollView style={styles.content} contentContainerStyle={styles.authContainer}>
          <Text style={styles.logoLarge}>Color<Text style={styles.logoAccent}>Mind</Text></Text>
          <Text style={styles.authSubtitle}>Teste dein Farbgedächtnis!</Text>
          
          <View style={styles.authCard}>
            <TextInput
              style={styles.input}
              placeholder="E-Mail"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Passwort"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={isLogin ? signInWithEmail : signUpWithEmail}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? '...' : isLogin ? 'Anmelden' : 'Registrieren'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
              <Text style={styles.switchText}>
                {isLogin ? 'Noch kein Konto? Registrieren' : 'Schon ein Konto? Anmelden'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={24}
              style={styles.appleButton}
              onPress={signInWithApple}
            />
          )}
        </ScrollView>
      )}

      {/* USERNAME SCREEN */}
      {screen === 'username' && (
        <View style={styles.centerContainer}>
          <Text style={styles.menuTitle}>Wähle deinen Username</Text>
          <TextInput
            style={[styles.input, { width: width - 80 }]}
            placeholder="username"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={username}
            onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 15))}
            autoCapitalize="none"
            maxLength={15}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={saveUsername} disabled={loading}>
            <Text style={styles.primaryButtonText}>{loading ? '...' : 'Speichern'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* HEADER (for game screens) */}
      {!['loading', 'auth', 'username'].includes(screen) && (
        <View style={styles.header}>
          <Text style={styles.logo}>Color<Text style={styles.logoAccent}>Mind</Text></Text>
          {screen !== 'menu' ? (
            <TouchableOpacity onPress={goToMenu} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={signOut}>
              <Text style={styles.usernameText}>@{profile?.username}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* MAIN MENU */}
      {screen === 'menu' && (
        <>
          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
            <View style={styles.menuContainer}>
              <Text style={styles.menuTitle}>Wie gut ist dein{'\n'}Farbgedächtnis?</Text>
              
              <View style={styles.modesContainer}>
                <ModeButton icon="🎯" title="Solo" subtitle="Übe alleine" color="#2997ff" onPress={() => startGame('solo')} />
                <ModeButton 
                  icon="📅" 
                  title="Daily Challenge" 
                  subtitle={dailyPlayed ? `Heute: ${dailyScore?.toFixed(1)}/50` : "Gleiche Farben für alle"} 
                  color={dailyPlayed ? '#444' : '#00a67d'} 
                  onPress={() => startGame('daily')} 
                  disabled={dailyPlayed} 
                />
                <ModeButton icon="👥" title="Multiplayer" subtitle="Fordere Freunde heraus" color="#ff6b35" onPress={() => setScreen('multiplayer-menu')} />
                <ModeButton icon="🏆" title="Leaderboard" subtitle="Top Spieler" color="#8b5cf6" onPress={() => loadLeaderboard('daily')} />
              </View>
              
              {!isPremium && (
                <TouchableOpacity style={styles.premiumButton} onPress={() => Alert.alert('Premium', 'Werbung entfernen für €2.99\n\nKommt bald!')}>
                  <Text style={styles.premiumButtonText}>✨ Werbung entfernen</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
          
          {/* Banner Ad */}
          {!isPremium && adsReady && Platform.OS !== 'web' && (
            <View style={styles.bannerContainer}>
              <BannerAd
                unitId={AD_IDS.banner}
                size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                requestOptions={{ requestNonPersonalizedAdsOnly: true }}
              />
            </View>
          )}
        </>
      )}

      {/* MULTIPLAYER MENU */}
      {screen === 'multiplayer-menu' && (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>Multiplayer</Text>
            <Text style={styles.menuSubtitle}>Spielt die gleichen Farben!</Text>
            <View style={styles.modesContainer}>
              <ModeButton icon="➕" title="Raum erstellen" subtitle="Code für Freunde" color="#2997ff" onPress={createRoom} />
              <ModeButton icon="🔗" title="Raum beitreten" subtitle="Code eingeben" color="#00a67d" onPress={() => setScreen('join-room')} />
            </View>
          </View>
        </ScrollView>
      )}

      {/* CREATE ROOM */}
      {screen === 'create-room' && (
        <View style={styles.centerContainer}>
          <Text style={styles.roomTitle}>Dein Code</Text>
          <View style={styles.codeDisplay}><Text style={styles.codeText}>{roomCode}</Text></View>
          <Text style={styles.roomHint}>Teile den Code mit Freunden!</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={startMultiplayerGame}>
            <Text style={styles.primaryButtonText}>🎮 Starten</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* JOIN ROOM */}
      {screen === 'join-room' && (
        <View style={styles.centerContainer}>
          <Text style={styles.roomTitle}>Code eingeben</Text>
          <TextInput
            style={styles.codeInput}
            value={inputCode}
            onChangeText={(t) => setInputCode(t.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="0000"
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="number-pad"
            maxLength={4}
            textAlign="center"
          />
          <TouchableOpacity 
            style={[styles.primaryButton, inputCode.length !== 4 && styles.disabledButton]} 
            onPress={joinRoom} 
            disabled={inputCode.length !== 4}
          >
            <Text style={styles.primaryButtonText}>🎮 Beitreten</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MEMORIZE */}
      {screen === 'memorize' && targets[idx] && (
        <View style={styles.gameContainer}>
          <View style={styles.progressRow}>
            {Array.from({ length: N }).map((_, i) => (
              <View key={i} style={[styles.progressDot, i < idx && styles.progressDotDone, i === idx && styles.progressDotActive]} />
            ))}
          </View>
          <Text style={styles.phaseTitle}>Farbe {idx + 1} merken</Text>
          <Text style={styles.timer}>{timer}</Text>
          <View style={[styles.memorizeColor, { backgroundColor: hsbToHex(targets[idx].h, targets[idx].s, targets[idx].b) }]} />
          <Text style={styles.hint}>Präge dir diese Farbe ein!</Text>
        </View>
      )}

      {/* RECALL */}
      {screen === 'recall' && (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} scrollEnabled={false}>
          <View style={styles.gameContainer}>
            <View style={styles.progressRow}>
              {Array.from({ length: N }).map((_, i) => (
                <View key={i} style={[styles.progressDot, i < idx && styles.progressDotDone, i === idx && styles.progressDotActive]} />
              ))}
            </View>
            <Text style={styles.phaseTitle}>Farbe {idx + 1} nachbauen</Text>
            <ColorPicker hue={guessH} saturation={guessS} brightness={guessB} onHueChange={setGuessH} onSatChange={setGuessS} onBriChange={setGuessB} />
            <TouchableOpacity style={styles.primaryButton} onPress={submitGuess}>
              <Text style={styles.primaryButtonText}>{idx < N - 1 ? 'Weiter →' : 'Ergebnis'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* RESULTS */}
      {screen === 'results' && (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsEmoji}>{getEmoji(percentile)}</Text>
            <Text style={styles.totalScore}>{totalScore.toFixed(1)}</Text>
            <Text style={styles.totalScoreLabel}>von 50 Punkten</Text>
            <View style={styles.percentileBadge}><Text style={styles.percentileText}>Top {percentile}%</Text></View>
            
            <View style={styles.resultsCard}>
              {targets.map((target, i) => (
                <View key={i} style={styles.resultRow}>
                  <View style={[styles.resultColor, { backgroundColor: hsbToHex(target.h, target.s, target.b) }]} />
                  <Text style={styles.resultArrow}>→</Text>
                  <View style={[styles.resultColor, { backgroundColor: hsbToHex(guesses[i]?.h || 0, guesses[i]?.s || 0, guesses[i]?.b || 0) }]} />
                  <Text style={styles.resultScore}>{scores[i]?.toFixed(1)}</Text>
                </View>
              ))}
            </View>
            
            <TouchableOpacity style={styles.secondaryButton} onPress={shareResults}>
              <Text style={styles.secondaryButtonText}>📤 Teilen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={goToMenu}>
              <Text style={styles.primaryButtonText}>Zurück</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* LEADERBOARD */}
      {screen === 'leaderboard' && (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.lbHeader}>
            <TouchableOpacity 
              style={[styles.lbTab, leaderboardMode === 'daily' && styles.lbTabActive]} 
              onPress={() => loadLeaderboard('daily')}
            >
              <Text style={styles.lbTabText}>📅 Heute</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.lbTab, leaderboardMode === 'alltime' && styles.lbTabActive]} 
              onPress={() => loadLeaderboard('alltime')}
            >
              <Text style={styles.lbTabText}>🏆 Alle</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.lbList}>
            {leaderboard.map((entry, i) => (
              <View key={entry.id} style={[styles.lbRow, entry.username === profile?.username && styles.lbRowMe]}>
                <Text style={styles.lbRank}>{i + 1}</Text>
                <Text style={styles.lbName}>@{entry.username}</Text>
                <Text style={styles.lbScore}>{entry.score.toFixed(1)}</Text>
              </View>
            ))}
            {leaderboard.length === 0 && (
              <Text style={styles.lbEmpty}>Noch keine Scores heute!</Text>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 24, paddingBottom: 50 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, paddingBottom: 16 },
  logo: { fontSize: 28, fontWeight: '800', color: '#fff' },
  logoLarge: { fontSize: 42, fontWeight: '800', color: '#fff', marginBottom: 8 },
  logoAccent: { color: '#2997ff' },
  closeBtn: { padding: 8 },
  closeBtnText: { fontSize: 24, color: 'rgba(255,255,255,0.5)' },
  usernameText: { fontSize: 14, color: '#2997ff', fontWeight: '600' },

  // Auth
  authContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  authSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.5)', marginBottom: 40 },
  authCard: { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 20 },
  input: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, fontSize: 16, color: '#fff', marginBottom: 12 },
  switchText: { color: '#2997ff', textAlign: 'center', marginTop: 16, fontSize: 14 },
  appleButton: { width: width - 48, height: 50, marginTop: 20 },

  // Menu
  menuContainer: { alignItems: 'center', paddingTop: 30 },
  menuTitle: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 36 },
  menuSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 8 },
  modesContainer: { width: '100%', marginTop: 30, gap: 12 },
  modeButton: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 16 },
  modeIcon: { fontSize: 28, marginRight: 16 },
  modeText: { flex: 1 },
  modeTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  modeSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  disabledButton: { opacity: 0.5 },

  // Room
  roomTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 24 },
  codeDisplay: { backgroundColor: 'rgba(41,151,255,0.2)', borderRadius: 16, paddingVertical: 20, paddingHorizontal: 40, marginBottom: 16 },
  codeText: { fontSize: 40, fontWeight: '800', color: '#2997ff', letterSpacing: 8 },
  codeInput: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32, fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: 8, marginBottom: 16, minWidth: 180 },
  roomHint: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24 },

  // Buttons
  primaryButton: { backgroundColor: '#2997ff', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 24, marginTop: 8, minWidth: 200, alignItems: 'center' },
  primaryButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  secondaryButton: { backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 24, marginBottom: 8, width: '100%', alignItems: 'center' },
  secondaryButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  // Game
  gameContainer: { flex: 1, alignItems: 'center', paddingTop: 80 },
  progressRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressDotDone: { backgroundColor: '#00d4aa' },
  progressDotActive: { backgroundColor: '#2997ff', width: 20 },
  phaseTitle: { fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 8 },
  timer: { fontSize: 72, fontWeight: '800', color: '#2997ff' },
  memorizeColor: { width: width * 0.5, height: width * 0.5, borderRadius: 24, marginVertical: 24 },
  hint: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },

  // Picker
  pickerContainer: { width: '100%', marginVertical: 12 },
  previewContainer: { alignItems: 'center', marginBottom: 16 },
  colorPreview: { width: 80, height: 80, borderRadius: 20 },
  slidersCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 16 },
  sliderContainer: { marginBottom: 20 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sliderLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
  sliderValue: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  sliderTrack: { height: 36, borderRadius: 18, position: 'relative', overflow: 'hidden' },
  gradient: { flex: 1, borderRadius: 18 },
  thumb: { position: 'absolute', top: 4, width: 28, height: 28, backgroundColor: '#fff', borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },

  // Results
  resultsContainer: { alignItems: 'center', paddingTop: 30 },
  resultsEmoji: { fontSize: 56 },
  totalScore: { fontSize: 64, fontWeight: '800', color: '#fff' },
  totalScoreLabel: { fontSize: 16, color: 'rgba(255,255,255,0.4)' },
  percentileBadge: { backgroundColor: 'rgba(41,151,255,0.2)', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, marginVertical: 12 },
  percentileText: { fontSize: 15, fontWeight: '600', color: '#2997ff' },
  resultsCard: { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 12, marginBottom: 12 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 10 },
  resultColor: { width: 36, height: 36, borderRadius: 10 },
  resultArrow: { fontSize: 14, color: 'rgba(255,255,255,0.3)' },
  resultScore: { fontSize: 16, fontWeight: '700', color: '#2997ff', width: 40, textAlign: 'right' },

  // Leaderboard
  lbHeader: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  lbTab: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  lbTabActive: { backgroundColor: '#2997ff' },
  lbTabText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  lbList: { gap: 8 },
  lbRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12 },
  lbRowMe: { backgroundColor: 'rgba(41,151,255,0.2)' },
  lbRank: { fontSize: 18, fontWeight: '800', color: '#2997ff', width: 40 },
  lbName: { flex: 1, fontSize: 16, color: '#fff', fontWeight: '500' },
  lbScore: { fontSize: 18, fontWeight: '700', color: '#2997ff' },
  lbEmpty: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 40 },

  // Ads & Premium
  bannerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', backgroundColor: '#0a0a1a' },
  premiumButton: { marginTop: 24, backgroundColor: 'rgba(255,215,0,0.2)', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,215,0,0.5)' },
  premiumButtonText: { color: '#ffd700', fontSize: 15, fontWeight: '600' },
});
