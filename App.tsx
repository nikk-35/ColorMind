import React, { useState, useEffect, useCallback } from 'react';
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
  Clipboard,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// ============================================================================
// TYPES
// ============================================================================

interface HSBColor {
  h: number;
  s: number;
  b: number;
}

type GameMode = 'solo' | 'daily' | 'multiplayer';
type GamePhase = 'menu' | 'multiplayer-menu' | 'create-room' | 'join-room' | 'memorize' | 'recall' | 'results';

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

// Seeded random number generator
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
  const random = () => Math.random();
  return Array.from({ length: count }, () => randomColor(random));
};

const getDailySeed = (): number => {
  const today = new Date();
  return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
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

// Rainbow colors for HUE slider
const HUE_COLORS = [
  '#ff0000', '#ff8000', '#ffff00', '#80ff00',
  '#00ff00', '#00ff80', '#00ffff', '#0080ff',
  '#0000ff', '#8000ff', '#ff00ff', '#ff0080', '#ff0000',
];

// ============================================================================
// GRADIENT SLIDER
// ============================================================================

interface GradientSliderProps {
  label: string;
  value: number;
  max: number;
  gradientColors: string[];
  onChange: (value: number) => void;
}

const GradientSlider: React.FC<GradientSliderProps> = ({ 
  label, value, max, gradientColors, onChange 
}) => {
  const step = max === 360 ? 15 : 5;
  const percentage = (value / max) * 100;
  
  const handleTrackPress = (e: any) => {
    const x = e.nativeEvent.locationX;
    const trackWidth = width - 120;
    const newVal = Math.round((x / trackWidth) * max);
    onChange(Math.max(0, Math.min(max, newVal)));
  };

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{value}{max === 360 ? '°' : '%'}</Text>
      </View>
      
      <View style={styles.sliderRow}>
        <TouchableOpacity 
          style={styles.sliderBtn} 
          onPress={() => onChange(Math.max(0, value - step))}
        >
          <Text style={styles.sliderBtnText}>−</Text>
        </TouchableOpacity>
        
        <View 
          style={styles.sliderTrackContainer}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleTrackPress}
          onResponderMove={handleTrackPress}
        >
          <LinearGradient
            colors={gradientColors as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sliderTrack}
          />
          <View style={[styles.sliderThumb, { left: `${percentage}%` }]}>
            <View style={styles.sliderThumbInner} />
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.sliderBtn} 
          onPress={() => onChange(Math.min(max, value + step))}
        >
          <Text style={styles.sliderBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ============================================================================
// COLOR PICKER
// ============================================================================

const ColorPicker: React.FC<{
  value: HSBColor;
  onChange: (color: HSBColor) => void;
}> = ({ value, onChange }) => {
  const satColors = [
    hsbToHex(value.h, 0, value.b),
    hsbToHex(value.h, 100, value.b),
  ];
  const briColors = [
    hsbToHex(value.h, value.s, 0),
    hsbToHex(value.h, value.s, 100),
  ];

  return (
    <View style={styles.pickerContainer}>
      <View style={styles.previewContainer}>
        <View 
          style={[styles.colorPreview, { backgroundColor: hsbToHex(value.h, value.s, value.b) }]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.3)', 'transparent']}
            style={styles.previewShine}
          />
        </View>
      </View>

      <View style={styles.slidersCard}>
        <GradientSlider
          label="Farbton"
          value={value.h}
          max={360}
          gradientColors={HUE_COLORS}
          onChange={(h) => onChange({ ...value, h })}
        />
        <GradientSlider
          label="Sättigung"
          value={value.s}
          max={100}
          gradientColors={satColors}
          onChange={(s) => onChange({ ...value, s })}
        />
        <GradientSlider
          label="Helligkeit"
          value={value.b}
          max={100}
          gradientColors={briColors}
          onChange={(b) => onChange({ ...value, b })}
        />
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
  colors: string[];
  onPress: () => void;
  disabled?: boolean;
}> = ({ icon, title, subtitle, colors, onPress, disabled }) => (
  <TouchableOpacity 
    onPress={onPress} 
    activeOpacity={0.8} 
    disabled={disabled}
    style={disabled && styles.disabledButton}
  >
    <LinearGradient
      colors={colors as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.modeButton}
    >
      <Text style={styles.modeIcon}>{icon}</Text>
      <View style={styles.modeText}>
        <Text style={styles.modeTitle}>{title}</Text>
        <Text style={styles.modeSubtitle}>{subtitle}</Text>
      </View>
    </LinearGradient>
  </TouchableOpacity>
);

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [mode, setMode] = useState<GameMode>('solo');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [targets, setTargets] = useState<HSBColor[]>([]);
  const [guesses, setGuesses] = useState<HSBColor[]>([]);
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState<HSBColor>({ h: 180, s: 50, b: 75 });
  const [timer, setTimer] = useState(3);
  const [scores, setScores] = useState<number[]>([]);
  const [dailyPlayed, setDailyPlayed] = useState(false);
  const [dailyScore, setDailyScore] = useState<number | null>(null);

  const N = 5;

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
    setGuess({ h: 180, s: 50, b: 75 });
    setScores([]);
    setTimer(3);
    setPhase('memorize');
  }, []);

  const createRoom = useCallback(() => {
    const code = generateRoomCode();
    setRoomCode(code);
    setPhase('create-room');
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

  const copyCode = useCallback(() => {
    Clipboard.setString(roomCode);
    Alert.alert('Kopiert!', `Code ${roomCode} wurde kopiert`);
  }, [roomCode]);

  useEffect(() => {
    if (phase !== 'memorize') return;
    if (timer <= 0) {
      setPhase('recall');
      return;
    }
    const t = setTimeout(() => setTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timer]);

  const submitGuess = useCallback(() => {
    const newGuesses = [...guesses, guess];
    setGuesses(newGuesses);

    if (idx < N - 1) {
      setIdx((i) => i + 1);
      setGuess({ h: 180, s: 50, b: 75 });
      setTimer(3);
      setPhase('memorize');
    } else {
      const sc = targets.map((t, i) => calculateScore(t, newGuesses[i]));
      setScores(sc);
      
      if (mode === 'daily') {
        setDailyPlayed(true);
        setDailyScore(sc.reduce((a, b) => a + b, 0));
      }
      
      setPhase('results');
    }
  }, [guess, guesses, idx, targets, mode]);

  const totalScore = scores.reduce((a, b) => a + b, 0);
  const percentile = getPercentile(totalScore);

  const shareResults = async () => {
    const emoji = getEmoji(percentile);
    let text = '';
    
    if (mode === 'multiplayer') {
      text = `ColorMind Duell ${emoji}\nCode: ${roomCode}\nMein Score: ${totalScore.toFixed(1)}/50\n\nKannst du das schlagen?\ncolormind.app`;
    } else if (mode === 'daily') {
      text = `ColorMind Daily ${emoji}\n${totalScore.toFixed(1)}/50 • Top ${percentile}%\n\ncolormind.app`;
    } else {
      text = `ColorMind ${emoji}\n${totalScore.toFixed(1)}/50 • Top ${percentile}%\n\ncolormind.app`;
    }
    
    try { await Share.share({ message: text }); } catch {}
  };

  const goToMenu = () => {
    setPhase('menu');
    setRoomCode('');
    setInputCode('');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient
        colors={['#0a0a1a', '#1a1030', '#0a0a1a']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>
          Color<Text style={styles.logoAccent}>Mind</Text>
        </Text>
        {phase !== 'menu' && (
          <TouchableOpacity onPress={goToMenu} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* MAIN MENU */}
        {phase === 'menu' && (
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>
              Wie gut ist dein{'\n'}Farbgedächtnis?
            </Text>
            
            <View style={styles.modesContainer}>
              <ModeButton
                icon="🎯"
                title="Solo"
                subtitle="Übe alleine"
                colors={['#2997ff', '#af52de']}
                onPress={() => startGame('solo')}
              />
              
              <ModeButton
                icon="📅"
                title="Daily Challenge"
                subtitle={dailyPlayed ? `Heute: ${dailyScore?.toFixed(1)}/50` : "Gleiche Farben für alle"}
                colors={dailyPlayed ? ['#444', '#555'] : ['#00d4aa', '#00a67d']}
                onPress={() => startGame('daily')}
                disabled={dailyPlayed}
              />
              
              <ModeButton
                icon="👥"
                title="Multiplayer"
                subtitle="Fordere Freunde heraus"
                colors={['#ff6b35', '#f7931e']}
                onPress={() => setPhase('multiplayer-menu')}
              />
            </View>
          </View>
        )}

        {/* MULTIPLAYER MENU */}
        {phase === 'multiplayer-menu' && (
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>Multiplayer</Text>
            <Text style={styles.menuSubtitle}>
              Spielt die gleichen Farben und vergleicht eure Scores!
            </Text>
            
            <View style={styles.modesContainer}>
              <ModeButton
                icon="➕"
                title="Raum erstellen"
                subtitle="Erstelle einen Code für Freunde"
                colors={['#2997ff', '#af52de']}
                onPress={createRoom}
              />
              
              <ModeButton
                icon="🔗"
                title="Raum beitreten"
                subtitle="Gib einen Code ein"
                colors={['#00d4aa', '#00a67d']}
                onPress={() => setPhase('join-room')}
              />
            </View>
          </View>
        )}

        {/* CREATE ROOM */}
        {phase === 'create-room' && (
          <View style={styles.roomContainer}>
            <Text style={styles.roomTitle}>Dein Raum-Code</Text>
            
            <View style={styles.codeDisplay}>
              <Text style={styles.codeText}>{roomCode}</Text>
            </View>
            
            <Text style={styles.roomHint}>
              Teile diesen Code mit deinen Freunden.{'\n'}
              Ihr spielt die gleichen Farben!
            </Text>
            
            <TouchableOpacity style={styles.copyButton} onPress={copyCode}>
              <Text style={styles.copyButtonText}>📋 Code kopieren</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={startMultiplayerGame} activeOpacity={0.8}>
              <LinearGradient
                colors={['#2997ff', '#af52de']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startButton}
              >
                <Text style={styles.startButtonText}>🎮 Spiel starten</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* JOIN ROOM */}
        {phase === 'join-room' && (
          <View style={styles.roomContainer}>
            <Text style={styles.roomTitle}>Code eingeben</Text>
            
            <TextInput
              style={styles.codeInput}
              value={inputCode}
              onChangeText={(text) => setInputCode(text.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="0000"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="number-pad"
              maxLength={4}
              textAlign="center"
            />
            
            <Text style={styles.roomHint}>
              Gib den 4-stelligen Code ein,{'\n'}
              den du von deinem Freund bekommen hast.
            </Text>
            
            <TouchableOpacity onPress={joinRoom} activeOpacity={0.8}>
              <LinearGradient
                colors={inputCode.length === 4 ? ['#2997ff', '#af52de'] : ['#444', '#555']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startButton}
              >
                <Text style={styles.startButtonText}>🎮 Beitreten & Spielen</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* MEMORIZE */}
        {phase === 'memorize' && targets[idx] && (
          <View style={styles.gameContainer}>
            {mode === 'multiplayer' && (
              <View style={styles.roomBadge}>
                <Text style={styles.roomBadgeText}>Code: {roomCode}</Text>
              </View>
            )}
            
            <View style={styles.progressRow}>
              {Array.from({ length: N }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    i < idx && styles.progressDotDone,
                    i === idx && styles.progressDotActive,
                  ]}
                />
              ))}
            </View>
            
            <Text style={styles.phaseTitle}>Farbe {idx + 1} merken</Text>
            <Text style={styles.timer}>{timer}</Text>
            
            <View style={styles.memorizeColorContainer}>
              <View 
                style={[
                  styles.memorizeColor, 
                  { backgroundColor: hsbToHex(targets[idx].h, targets[idx].s, targets[idx].b) }
                ]}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.2)', 'transparent']}
                  style={styles.colorShine}
                />
              </View>
            </View>
            
            <Text style={styles.hint}>Präge dir diese Farbe ein!</Text>
          </View>
        )}

        {/* RECALL */}
        {phase === 'recall' && (
          <View style={styles.gameContainer}>
            {mode === 'multiplayer' && (
              <View style={styles.roomBadge}>
                <Text style={styles.roomBadgeText}>Code: {roomCode}</Text>
              </View>
            )}
            
            <View style={styles.progressRow}>
              {Array.from({ length: N }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    i < idx && styles.progressDotDone,
                    i === idx && styles.progressDotActive,
                  ]}
                />
              ))}
            </View>
            
            <Text style={styles.phaseTitle}>Farbe {idx + 1} nachbauen</Text>
            
            <ColorPicker value={guess} onChange={setGuess} />

            <TouchableOpacity onPress={submitGuess} activeOpacity={0.8}>
              <LinearGradient
                colors={['#2997ff', '#af52de']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButton}
              >
                <Text style={styles.submitButtonText}>
                  {idx < N - 1 ? 'Weiter →' : 'Ergebnis'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* RESULTS */}
        {phase === 'results' && (
          <View style={styles.resultsContainer}>
            {mode === 'multiplayer' && (
              <View style={styles.roomBadge}>
                <Text style={styles.roomBadgeText}>Duell • Code: {roomCode}</Text>
              </View>
            )}
            {mode === 'daily' && (
              <View style={styles.roomBadge}>
                <Text style={styles.roomBadgeText}>📅 Daily Challenge</Text>
              </View>
            )}
            
            <Text style={styles.resultsEmoji}>{getEmoji(percentile)}</Text>
            <Text style={styles.totalScore}>{totalScore.toFixed(1)}</Text>
            <Text style={styles.totalScoreLabel}>von 50 Punkten</Text>
            
            <LinearGradient
              colors={['rgba(41,151,255,0.2)', 'rgba(175,82,222,0.2)']}
              style={styles.percentileBadge}
            >
              <Text style={styles.percentileText}>Top {percentile}%</Text>
            </LinearGradient>

            <View style={styles.resultsCard}>
              {targets.map((target, i) => (
                <View key={i} style={styles.resultRow}>
                  <View 
                    style={[styles.resultColor, { backgroundColor: hsbToHex(target.h, target.s, target.b) }]} 
                  />
                  <Text style={styles.resultArrow}>→</Text>
                  <View 
                    style={[styles.resultColor, { backgroundColor: hsbToHex(guesses[i]?.h || 0, guesses[i]?.s || 0, guesses[i]?.b || 0) }]} 
                  />
                  <Text style={styles.resultScore}>{scores[i]?.toFixed(1)}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.shareButton} onPress={shareResults}>
              <Text style={styles.shareButtonText}>
                {mode === 'multiplayer' ? '📤 Score an Freund senden' : '📤 Teilen'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={goToMenu} activeOpacity={0.8}>
              <LinearGradient
                colors={['#2997ff', '#af52de']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButton}
              >
                <Text style={styles.submitButtonText}>Zurück zum Menü</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  logo: { fontSize: 28, fontWeight: '800', color: '#fff' },
  logoAccent: { color: '#2997ff' },
  closeBtn: { padding: 8 },
  closeBtnText: { fontSize: 24, color: 'rgba(255,255,255,0.5)' },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 24, paddingBottom: 50 },

  // Menu
  menuContainer: { alignItems: 'center', paddingTop: 30 },
  menuTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 40,
  },
  menuSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  modesContainer: { width: '100%', marginTop: 30, gap: 12 },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
  },
  modeIcon: { fontSize: 28, marginRight: 16 },
  modeText: { flex: 1 },
  modeTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  modeSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  disabledButton: { opacity: 0.6 },

  // Room
  roomContainer: { alignItems: 'center', paddingTop: 40 },
  roomTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 24 },
  codeDisplay: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 48,
    borderWidth: 2,
    borderColor: '#2997ff',
    marginBottom: 16,
  },
  codeText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#2997ff',
    letterSpacing: 12,
  },
  codeInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 40,
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 12,
    marginBottom: 16,
    minWidth: 200,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  roomHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  copyButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    marginBottom: 16,
  },
  copyButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  startButton: {
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 8,
  },
  startButtonText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  roomBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  roomBadgeText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },

  // Game
  gameContainer: { alignItems: 'center', paddingTop: 10 },
  progressRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressDotDone: { backgroundColor: '#00d4aa' },
  progressDotActive: { backgroundColor: '#2997ff', width: 24 },
  phaseTitle: { fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 8 },
  timer: { fontSize: 80, fontWeight: '800', color: '#2997ff' },
  memorizeColorContainer: { marginVertical: 30 },
  memorizeColor: {
    width: width * 0.55,
    height: width * 0.55,
    borderRadius: 30,
    overflow: 'hidden',
  },
  colorShine: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%' },
  hint: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },

  // Color Picker
  pickerContainer: { width: '100%', marginVertical: 16 },
  previewContainer: { alignItems: 'center', marginBottom: 20 },
  colorPreview: { width: 100, height: 100, borderRadius: 24, overflow: 'hidden' },
  previewShine: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%' },
  slidersCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sliderContainer: { marginBottom: 20 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sliderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sliderValue: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sliderBtn: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderBtnText: { fontSize: 20, color: '#fff', fontWeight: '300' },
  sliderTrackContainer: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  sliderTrack: { flex: 1 },
  sliderThumb: {
    position: 'absolute',
    top: 4,
    width: 28,
    height: 28,
    marginLeft: -14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderThumbInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButton: {
    width: width - 48,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: { fontSize: 18, fontWeight: '700', color: '#fff' },

  // Results
  resultsContainer: { alignItems: 'center', paddingTop: 10 },
  resultsEmoji: { fontSize: 64 },
  totalScore: { fontSize: 72, fontWeight: '800', color: '#fff' },
  totalScoreLabel: { fontSize: 16, color: 'rgba(255,255,255,0.4)' },
  percentileBadge: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30, marginVertical: 16 },
  percentileText: { fontSize: 16, fontWeight: '600', color: '#2997ff' },
  resultsCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  resultColor: { width: 40, height: 40, borderRadius: 12 },
  resultArrow: { fontSize: 16, color: 'rgba(255,255,255,0.3)' },
  resultScore: { fontSize: 18, fontWeight: '700', color: '#2997ff', width: 45, textAlign: 'right' },
  shareButton: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 8,
  },
  shareButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
