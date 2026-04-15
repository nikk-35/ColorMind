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
} from 'react-native';

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

// ============================================================================
// COLOR PICKER - Direct state management, no closures
// ============================================================================

interface ColorPickerProps {
  hue: number;
  saturation: number;
  brightness: number;
  onHueChange: (v: number) => void;
  onSatChange: (v: number) => void;
  onBriChange: (v: number) => void;
}

const TRACK_WIDTH = width - 80;

// Generate smooth gradient with many steps
const generateHueGradient = (): string[] => {
  const colors: string[] = [];
  for (let i = 0; i <= 36; i++) {
    colors.push(hsbToHex(i * 10, 100, 100));
  }
  return colors;
};

const generateSatGradient = (h: number, b: number): string[] => {
  const colors: string[] = [];
  for (let i = 0; i <= 20; i++) {
    colors.push(hsbToHex(h, i * 5, b));
  }
  return colors;
};

const generateBriGradient = (h: number, s: number): string[] => {
  const colors: string[] = [];
  for (let i = 0; i <= 20; i++) {
    colors.push(hsbToHex(h, s, i * 5));
  }
  return colors;
};

const ColorPicker: React.FC<ColorPickerProps> = ({
  hue, saturation, brightness,
  onHueChange, onSatChange, onBriChange
}) => {
  const hueColors = generateHueGradient();
  const satColors = generateSatGradient(hue, brightness);
  const briColors = generateBriGradient(hue, saturation);

  const handleSliderTouch = (e: any, max: number, setter: (v: number) => void) => {
    const x = e.nativeEvent.locationX;
    const percentage = Math.max(0, Math.min(1, x / TRACK_WIDTH));
    setter(Math.round(percentage * max));
  };

  return (
    <View style={styles.pickerContainer}>
      <View style={styles.previewContainer}>
        <View 
          style={[styles.colorPreview, { backgroundColor: hsbToHex(hue, saturation, brightness) }]}
        />
      </View>

      <View style={styles.slidersCard}>
        {/* HUE */}
        <View style={styles.sliderContainer}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Farbton</Text>
            <Text style={styles.sliderValue}>{hue}°</Text>
          </View>
          <View 
            style={styles.sliderTrack}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => handleSliderTouch(e, 360, onHueChange)}
            onResponderMove={(e) => handleSliderTouch(e, 360, onHueChange)}
          >
            <View style={styles.gradientContainer}>
              {hueColors.map((c, i) => <View key={i} style={[styles.gradientSegment, { backgroundColor: c }]} />)}
            </View>
            <View style={[styles.thumb, { left: (hue / 360) * TRACK_WIDTH - 14 }]} />
          </View>
        </View>

        {/* SATURATION */}
        <View style={styles.sliderContainer}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Sättigung</Text>
            <Text style={styles.sliderValue}>{saturation}%</Text>
          </View>
          <View 
            style={styles.sliderTrack}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => handleSliderTouch(e, 100, onSatChange)}
            onResponderMove={(e) => handleSliderTouch(e, 100, onSatChange)}
          >
            <View style={styles.gradientContainer}>
              {satColors.map((c, i) => <View key={i} style={[styles.gradientSegment, { backgroundColor: c }]} />)}
            </View>
            <View style={[styles.thumb, { left: (saturation / 100) * TRACK_WIDTH - 14 }]} />
          </View>
        </View>

        {/* BRIGHTNESS */}
        <View style={styles.sliderContainer}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Helligkeit</Text>
            <Text style={styles.sliderValue}>{brightness}%</Text>
          </View>
          <View 
            style={styles.sliderTrack}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => handleSliderTouch(e, 100, onBriChange)}
            onResponderMove={(e) => handleSliderTouch(e, 100, onBriChange)}
          >
            <View style={styles.gradientContainer}>
              {briColors.map((c, i) => <View key={i} style={[styles.gradientSegment, { backgroundColor: c }]} />)}
            </View>
            <View style={[styles.thumb, { left: (brightness / 100) * TRACK_WIDTH - 14 }]} />
          </View>
        </View>
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
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [mode, setMode] = useState<GameMode>('solo');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [targets, setTargets] = useState<HSBColor[]>([]);
  const [guesses, setGuesses] = useState<HSBColor[]>([]);
  const [idx, setIdx] = useState(0);
  
  // Separate state for each slider value
  const [guessH, setGuessH] = useState(180);
  const [guessS, setGuessS] = useState(50);
  const [guessB, setGuessB] = useState(75);
  
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
    setGuessH(180);
    setGuessS(50);
    setGuessB(75);
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
    Alert.alert('Code', `Dein Code: ${roomCode}\n\nTeile ihn mit deinen Freunden!`);
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
    const currentGuess: HSBColor = { h: guessH, s: guessS, b: guessB };
    const newGuesses = [...guesses, currentGuess];
    setGuesses(newGuesses);

    if (idx < N - 1) {
      setIdx((i) => i + 1);
      setGuessH(180);
      setGuessS(50);
      setGuessB(75);
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
  }, [guessH, guessS, guessB, guesses, idx, targets, mode]);

  const totalScore = scores.reduce((a, b) => a + b, 0);
  const percentile = getPercentile(totalScore);

  const shareResults = async () => {
    const emoji = getEmoji(percentile);
    let text = '';
    
    if (mode === 'multiplayer') {
      text = `ColorMind Duell ${emoji}\nCode: ${roomCode}\nMein Score: ${totalScore.toFixed(1)}/50\n\nKannst du das schlagen?`;
    } else if (mode === 'daily') {
      text = `ColorMind Daily ${emoji}\n${totalScore.toFixed(1)}/50 • Top ${percentile}%`;
    } else {
      text = `ColorMind ${emoji}\n${totalScore.toFixed(1)}/50 • Top ${percentile}%`;
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
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />

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
        keyboardShouldPersistTaps="handled"
        scrollEnabled={phase !== 'recall'}
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
                color="#2997ff"
                onPress={() => startGame('solo')}
              />
              
              <ModeButton
                icon="📅"
                title="Daily Challenge"
                subtitle={dailyPlayed ? `Heute: ${dailyScore?.toFixed(1)}/50` : "Gleiche Farben für alle"}
                color={dailyPlayed ? '#444' : '#00a67d'}
                onPress={() => startGame('daily')}
                disabled={dailyPlayed}
              />
              
              <ModeButton
                icon="👥"
                title="Multiplayer"
                subtitle="Fordere Freunde heraus"
                color="#ff6b35"
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
                color="#2997ff"
                onPress={createRoom}
              />
              
              <ModeButton
                icon="🔗"
                title="Raum beitreten"
                subtitle="Gib einen Code ein"
                color="#00a67d"
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
            
            <TouchableOpacity style={styles.secondaryButton} onPress={copyCode}>
              <Text style={styles.secondaryButtonText}>📋 Code anzeigen</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.primaryButton} onPress={startMultiplayerGame}>
              <Text style={styles.primaryButtonText}>🎮 Spiel starten</Text>
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
        {phase === 'memorize' && targets.length > 0 && targets[idx] && (
          <View style={styles.gameContainer}>
            {mode === 'multiplayer' && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Code: {roomCode}</Text>
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
            
            <View 
              style={[
                styles.memorizeColor, 
                { backgroundColor: hsbToHex(targets[idx].h, targets[idx].s, targets[idx].b) }
              ]}
            />
            
            <Text style={styles.hint}>Präge dir diese Farbe ein!</Text>
          </View>
        )}

        {/* RECALL */}
        {phase === 'recall' && (
          <View style={styles.gameContainer}>
            {mode === 'multiplayer' && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Code: {roomCode}</Text>
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
            
            <ColorPicker
              hue={guessH}
              saturation={guessS}
              brightness={guessB}
              onHueChange={setGuessH}
              onSatChange={setGuessS}
              onBriChange={setGuessB}
            />

            <TouchableOpacity style={styles.primaryButton} onPress={submitGuess}>
              <Text style={styles.primaryButtonText}>
                {idx < N - 1 ? 'Weiter →' : 'Ergebnis'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* RESULTS */}
        {phase === 'results' && (
          <View style={styles.resultsContainer}>
            {mode === 'multiplayer' && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Duell • Code: {roomCode}</Text>
              </View>
            )}
            {mode === 'daily' && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>📅 Daily Challenge</Text>
              </View>
            )}
            
            <Text style={styles.resultsEmoji}>{getEmoji(percentile)}</Text>
            <Text style={styles.totalScore}>{totalScore.toFixed(1)}</Text>
            <Text style={styles.totalScoreLabel}>von 50 Punkten</Text>
            
            <View style={styles.percentileBadge}>
              <Text style={styles.percentileText}>Top {percentile}%</Text>
            </View>

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

            <TouchableOpacity style={styles.secondaryButton} onPress={shareResults}>
              <Text style={styles.secondaryButtonText}>📤 Teilen</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={goToMenu}>
              <Text style={styles.primaryButtonText}>Zurück zum Menü</Text>
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
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 36,
  },
  menuSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 8,
  },
  modesContainer: { width: '100%', marginTop: 30, gap: 12 },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
  },
  modeIcon: { fontSize: 28, marginRight: 16 },
  modeText: { flex: 1 },
  modeTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  modeSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  disabledButton: { opacity: 0.5 },

  // Room
  roomContainer: { alignItems: 'center', paddingTop: 40 },
  roomTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 24 },
  codeDisplay: {
    backgroundColor: 'rgba(41,151,255,0.2)',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 40,
    marginBottom: 16,
  },
  codeText: { fontSize: 40, fontWeight: '800', color: '#2997ff', letterSpacing: 8 },
  codeInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 8,
    marginBottom: 16,
    minWidth: 180,
  },
  roomHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },

  // Buttons
  primaryButton: {
    backgroundColor: '#2997ff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
    marginTop: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginBottom: 8,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  // Badge
  badge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  badgeText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },

  // Game
  gameContainer: { alignItems: 'center', paddingTop: 10 },
  progressRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressDotDone: { backgroundColor: '#00d4aa' },
  progressDotActive: { backgroundColor: '#2997ff', width: 20 },
  phaseTitle: { fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 8 },
  timer: { fontSize: 72, fontWeight: '800', color: '#2997ff' },
  memorizeColor: {
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: 24,
    marginVertical: 24,
  },
  hint: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },

  // Color Picker
  pickerContainer: { width: '100%', marginVertical: 12 },
  previewContainer: { alignItems: 'center', marginBottom: 16 },
  colorPreview: { width: 80, height: 80, borderRadius: 20 },
  slidersCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 16,
  },

  // Slider
  sliderContainer: { marginBottom: 20 },
  sliderHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 12,
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
  },
  sliderValue: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: 'rgba(255,255,255,0.7)' 
  },
  sliderTrack: {
    height: 36,
    borderRadius: 18,
    position: 'relative',
  },
  gradientContainer: {
    flexDirection: 'row',
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  gradientSegment: {
    flex: 1,
    height: '100%',
  },
  thumb: {
    position: 'absolute',
    top: 4,
    width: 28,
    height: 28,
    backgroundColor: '#fff',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  // Results
  resultsContainer: { alignItems: 'center', paddingTop: 10 },
  resultsEmoji: { fontSize: 56 },
  totalScore: { fontSize: 64, fontWeight: '800', color: '#fff' },
  totalScoreLabel: { fontSize: 16, color: 'rgba(255,255,255,0.4)' },
  percentileBadge: { 
    backgroundColor: 'rgba(41,151,255,0.2)',
    paddingVertical: 10, 
    paddingHorizontal: 20, 
    borderRadius: 20, 
    marginVertical: 12,
  },
  percentileText: { fontSize: 15, fontWeight: '600', color: '#2997ff' },
  resultsCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  resultColor: { width: 36, height: 36, borderRadius: 10 },
  resultArrow: { fontSize: 14, color: 'rgba(255,255,255,0.3)' },
  resultScore: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#2997ff', 
    width: 40, 
    textAlign: 'right' 
  },
});
