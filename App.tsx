import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Share,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { createClient } from '@supabase/supabase-js';

const { width, height } = Dimensions.get('window');

// ============================================================================
// SUPABASE CONFIG (Replace with your own!)
// ============================================================================

const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================================
// TYPES
// ============================================================================

interface HSBColor {
  h: number;
  s: number;
  b: number;
}

type GameMode = 'solo' | 'daily' | 'multiplayer';
type GamePhase = 'menu' | 'lobby' | 'waiting' | 'memorize' | 'recall' | 'results' | 'leaderboard';

interface Player {
  id: string;
  name: string;
  score?: number;
  ready?: boolean;
}

interface Lobby {
  id: string;
  code: string;
  host_id: string;
  players: Player[];
  colors?: HSBColor[];
  phase: string;
}

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

// Seeded random for daily challenge
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const randomColor = (seed?: number): HSBColor => {
  const rand = seed !== undefined ? () => seededRandom(seed++) : Math.random;
  return {
    h: Math.floor(rand() * 360),
    s: Math.floor(rand() * 60) + 40,
    b: Math.floor(rand() * 50) + 50,
  };
};

const getDailySeed = (): number => {
  const today = new Date();
  return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
};

const generateColors = (count: number, seed?: number): HSBColor[] => {
  let s = seed;
  return Array.from({ length: count }, () => {
    const color = randomColor(s);
    if (s !== undefined) s += 3;
    return color;
  });
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

// ============================================================================
// GLASS CARD COMPONENT
// ============================================================================

const GlassCard: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => (
  <View style={[styles.glassCard, style]}>
    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
    <View style={styles.glassCardInner}>{children}</View>
  </View>
);

// ============================================================================
// COLOR SWATCH COMPONENT
// ============================================================================

const ColorSwatch: React.FC<{
  color: HSBColor;
  size?: number;
  glow?: boolean;
}> = ({ color, size = 60, glow }) => {
  const hex = hsbToHex(color.h, color.s, color.b);
  
  return (
    <View
      style={[
        styles.swatch,
        {
          width: size,
          height: size,
          backgroundColor: hex,
          shadowColor: glow ? hex : '#000',
          shadowOpacity: glow ? 0.6 : 0.3,
          shadowRadius: glow ? 20 : 10,
        },
      ]}
    />
  );
};

// ============================================================================
// HSB PICKER COMPONENT
// ============================================================================

const HSBPicker: React.FC<{
  value: HSBColor;
  onChange: (color: HSBColor) => void;
}> = ({ value, onChange }) => {
  const createSlider = (
    label: string,
    currentValue: number,
    max: number,
    key: 'h' | 's' | 'b',
    gradient: string[]
  ) => {
    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.locationX;
        const newValue = Math.round((x / (width - 100)) * max);
        onChange({ ...value, [key]: Math.max(0, Math.min(max, newValue)) });
      },
      onPanResponderMove: (e) => {
        const x = e.nativeEvent.locationX;
        const newValue = Math.round((x / (width - 100)) * max);
        onChange({ ...value, [key]: Math.max(0, Math.min(max, newValue)) });
      },
    });

    return (
      <View style={styles.sliderContainer}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <View style={styles.sliderTrack} {...panResponder.panHandlers}>
          <LinearGradient
            colors={gradient as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sliderGradient}
          />
          <View
            style={[
              styles.sliderThumb,
              { left: `${(currentValue / max) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.sliderValue}>{currentValue}</Text>
      </View>
    );
  };

  const hueGradient = Array.from({ length: 7 }, (_, i) => hsbToHex(i * 60, 100, 100));
  const satGradient = [hsbToHex(value.h, 0, value.b), hsbToHex(value.h, 100, value.b)];
  const briGradient = [hsbToHex(value.h, value.s, 0), hsbToHex(value.h, value.s, 100)];

  return (
    <GlassCard style={styles.pickerCard}>
      <View style={styles.pickerPreview}>
        <View
          style={[
            styles.pickerPreviewColor,
            { backgroundColor: hsbToHex(value.h, value.s, value.b) },
          ]}
        />
      </View>
      {createSlider('H', value.h, 360, 'h', hueGradient)}
      {createSlider('S', value.s, 100, 's', satGradient)}
      {createSlider('B', value.b, 100, 'b', briGradient)}
    </GlassCard>
  );
};

// ============================================================================
// MODE BUTTON
// ============================================================================

const ModeButton: React.FC<{
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
  gradient?: string[];
}> = ({ title, subtitle, icon, onPress, gradient = ['#2997ff', '#af52de'] }) => (
  <TouchableOpacity style={styles.modeButton} onPress={onPress}>
    <LinearGradient
      colors={gradient as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.modeButtonGradient}
    >
      <Text style={styles.modeButtonIcon}>{icon}</Text>
      <View>
        <Text style={styles.modeButtonTitle}>{title}</Text>
        <Text style={styles.modeButtonSubtitle}>{subtitle}</Text>
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
  const [playerName, setPlayerName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  
  // Game state
  const [targetColors, setTargetColors] = useState<HSBColor[]>([]);
  const [guessColors, setGuessColors] = useState<HSBColor[]>([]);
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  const [currentGuess, setCurrentGuess] = useState<HSBColor>({ h: 180, s: 50, b: 75 });
  const [memorizeTime, setMemorizeTime] = useState(5);
  const [scores, setScores] = useState<number[]>([]);
  
  // Multiplayer state
  const [lobbyCode, setLobbyCode] = useState('');
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Daily state
  const [dailyPlayed, setDailyPlayed] = useState(false);
  const [dailyScore, setDailyScore] = useState<number | null>(null);

  const NUM_COLORS = 5;

  // Generate lobby code
  const generateLobbyCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  // Start solo game
  const startSoloGame = useCallback(() => {
    const colors = generateColors(NUM_COLORS);
    setTargetColors(colors);
    setGuessColors([]);
    setCurrentColorIndex(0);
    setCurrentGuess({ h: 180, s: 50, b: 75 });
    setScores([]);
    setMemorizeTime(5);
    setMode('solo');
    setPhase('memorize');
  }, []);

  // Start daily challenge
  const startDailyGame = useCallback(() => {
    if (dailyPlayed) {
      setPhase('leaderboard');
      return;
    }
    const seed = getDailySeed();
    const colors = generateColors(NUM_COLORS, seed);
    setTargetColors(colors);
    setGuessColors([]);
    setCurrentColorIndex(0);
    setCurrentGuess({ h: 180, s: 50, b: 75 });
    setScores([]);
    setMemorizeTime(5);
    setMode('daily');
    setPhase('memorize');
  }, [dailyPlayed]);

  // Create multiplayer lobby
  const createLobby = useCallback(async () => {
    if (!playerName.trim()) {
      setShowNameInput(true);
      return;
    }
    setLoading(true);
    const code = generateLobbyCode();
    const playerId = Math.random().toString(36).substring(7);
    
    // In real app, create lobby in Supabase
    setLobby({
      id: playerId,
      code,
      host_id: playerId,
      players: [{ id: playerId, name: playerName, ready: true }],
      phase: 'waiting',
    });
    setLobbyCode(code);
    setIsHost(true);
    setPlayers([{ id: playerId, name: playerName, ready: true }]);
    setMode('multiplayer');
    setPhase('lobby');
    setLoading(false);
  }, [playerName]);

  // Join multiplayer lobby
  const joinLobby = useCallback(async () => {
    if (!playerName.trim()) {
      setShowNameInput(true);
      return;
    }
    if (!lobbyCode.trim() || lobbyCode.length !== 4) {
      return;
    }
    setLoading(true);
    
    // In real app, join lobby in Supabase
    const playerId = Math.random().toString(36).substring(7);
    setPlayers([
      { id: 'host', name: 'Host', ready: true },
      { id: playerId, name: playerName, ready: true },
    ]);
    setIsHost(false);
    setMode('multiplayer');
    setPhase('lobby');
    setLoading(false);
  }, [playerName, lobbyCode]);

  // Start multiplayer game (host only)
  const startMultiplayerGame = useCallback(() => {
    const colors = generateColors(NUM_COLORS);
    setTargetColors(colors);
    setGuessColors([]);
    setCurrentColorIndex(0);
    setCurrentGuess({ h: 180, s: 50, b: 75 });
    setScores([]);
    setMemorizeTime(5);
    setPhase('memorize');
  }, []);

  // Memorize countdown
  useEffect(() => {
    if (phase !== 'memorize') return;
    if (memorizeTime <= 0) {
      setPhase('recall');
      return;
    }
    const timer = setTimeout(() => setMemorizeTime((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, memorizeTime]);

  // Submit guess
  const submitGuess = useCallback(() => {
    const newGuesses = [...guessColors, currentGuess];
    setGuessColors(newGuesses);

    if (currentColorIndex < NUM_COLORS - 1) {
      setCurrentColorIndex((i) => i + 1);
      setCurrentGuess({ h: 180, s: 50, b: 75 });
    } else {
      const newScores = targetColors.map((target, i) =>
        calculateScore(target, newGuesses[i])
      );
      setScores(newScores);
      
      if (mode === 'daily') {
        setDailyPlayed(true);
        setDailyScore(newScores.reduce((a, b) => a + b, 0));
      }
      
      setPhase('results');
    }
  }, [currentGuess, guessColors, currentColorIndex, targetColors, mode]);

  // Share results
  const shareResults = async () => {
    const total = scores.reduce((a, b) => a + b, 0);
    const emoji = total >= 40 ? '🏆' : total >= 30 ? '🎯' : total >= 20 ? '👍' : '🎨';
    const text = mode === 'daily' 
      ? `ColorMind Daily ${emoji}\n${total.toFixed(1)}/50\n\nCan you beat my score?\nhttps://colormind.app`
      : `ColorMind ${emoji}\n${total.toFixed(1)}/50\n\nTry it: https://colormind.app`;
    
    try {
      await Share.share({ message: text });
    } catch (e) {
      console.log(e);
    }
  };

  const totalScore = scores.reduce((a, b) => a + b, 0);

  const goToMenu = () => {
    setPhase('menu');
    setLobby(null);
    setPlayers([]);
    setLobbyCode('');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0a0a1a', '#1a0a2e', '#0a1a2e']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Color<Text style={styles.logoAccent}>Mind</Text></Text>
        {phase !== 'menu' && (
          <TouchableOpacity onPress={goToMenu}>
            <Text style={styles.backButton}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* MENU */}
        {phase === 'menu' && (
          <>
            <Text style={styles.tagline}>How well can you{'\n'}remember colors?</Text>
            
            <GlassCard style={styles.infoCard}>
              <Text style={styles.infoText}>
                We'll show you {NUM_COLORS} colors for 5 seconds.{'\n'}
                Then recreate them from memory.
              </Text>
            </GlassCard>

            <ModeButton
              icon="🎯"
              title="Solo"
              subtitle="Practice your skills"
              onPress={startSoloGame}
            />
            
            <ModeButton
              icon="📅"
              title="Daily Challenge"
              subtitle={dailyPlayed ? `Today: ${dailyScore?.toFixed(1)}/50` : "Same colors for everyone"}
              onPress={startDailyGame}
              gradient={['#00d4aa', '#2997ff']}
            />
            
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>MULTIPLAYER</Text>
              <View style={styles.dividerLine} />
            </View>

            {showNameInput && (
              <GlassCard style={styles.nameInputCard}>
                <Text style={styles.nameInputLabel}>Your Name</Text>
                <TextInput
                  style={styles.nameInput}
                  value={playerName}
                  onChangeText={setPlayerName}
                  placeholder="Enter your name"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  maxLength={12}
                />
              </GlassCard>
            )}

            <ModeButton
              icon="🎮"
              title="Create Lobby"
              subtitle="Play with friends"
              onPress={createLobby}
              gradient={['#af52de', '#ff6b6b']}
            />

            <GlassCard style={styles.joinCard}>
              <Text style={styles.joinLabel}>Join with code</Text>
              <View style={styles.joinRow}>
                <TextInput
                  style={styles.codeInput}
                  value={lobbyCode}
                  onChangeText={(t) => setLobbyCode(t.toUpperCase())}
                  placeholder="XXXX"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  maxLength={4}
                  autoCapitalize="characters"
                />
                <TouchableOpacity 
                  style={styles.joinButton} 
                  onPress={joinLobby}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.joinButtonText}>Join</Text>
                  )}
                </TouchableOpacity>
              </View>
            </GlassCard>
          </>
        )}

        {/* LOBBY */}
        {phase === 'lobby' && (
          <>
            <Text style={styles.lobbyTitle}>Lobby</Text>
            
            <GlassCard style={styles.codeCard}>
              <Text style={styles.codeLabel}>Share this code</Text>
              <Text style={styles.codeDisplay}>{lobbyCode || lobby?.code}</Text>
            </GlassCard>

            <GlassCard style={styles.playersCard}>
              <Text style={styles.playersTitle}>Players ({players.length})</Text>
              {players.map((player, i) => (
                <View key={player.id} style={styles.playerRow}>
                  <Text style={styles.playerName}>
                    {player.name} {player.id === lobby?.host_id && '👑'}
                  </Text>
                  <Text style={styles.playerReady}>
                    {player.ready ? '✓' : '...'}
                  </Text>
                </View>
              ))}
            </GlassCard>

            {isHost && (
              <TouchableOpacity style={styles.startButton} onPress={startMultiplayerGame}>
                <LinearGradient
                  colors={['#2997ff', '#af52de']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.startButtonGradient}
                >
                  <Text style={styles.startButtonText}>Start Game</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {!isHost && (
              <GlassCard style={styles.waitingCard}>
                <ActivityIndicator color="#2997ff" />
                <Text style={styles.waitingText}>Waiting for host...</Text>
              </GlassCard>
            )}
          </>
        )}

        {/* MEMORIZE */}
        {phase === 'memorize' && (
          <>
            <Text style={styles.phaseTitle}>Memorize these colors</Text>
            <Text style={styles.timer}>{memorizeTime}</Text>
            
            <View style={styles.colorGrid}>
              {targetColors.map((color, i) => (
                <ColorSwatch key={i} color={color} size={(width - 80) / 3} glow />
              ))}
            </View>

            <Text style={styles.hint}>
              Pay attention to hue, saturation, and brightness
            </Text>
          </>
        )}

        {/* RECALL */}
        {phase === 'recall' && (
          <>
            <View style={styles.progressContainer}>
              {Array.from({ length: NUM_COLORS }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    i < currentColorIndex && styles.progressDotComplete,
                    i === currentColorIndex && styles.progressDotActive,
                  ]}
                />
              ))}
            </View>
            
            <Text style={styles.phaseTitle}>
              Color {currentColorIndex + 1} of {NUM_COLORS}
            </Text>
            
            <HSBPicker value={currentGuess} onChange={setCurrentGuess} />

            <TouchableOpacity style={styles.submitButton} onPress={submitGuess}>
              <LinearGradient
                colors={['#2997ff', '#af52de']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButtonGradient}
              >
                <Text style={styles.submitButtonText}>
                  {currentColorIndex < NUM_COLORS - 1 ? 'Next →' : 'See Results'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {/* RESULTS */}
        {phase === 'results' && (
          <>
            <Text style={styles.resultsTitle}>
              {mode === 'daily' ? '📅 Daily Challenge' : mode === 'multiplayer' ? '🎮 Multiplayer' : '🎯 Solo'}
            </Text>
            
            <Text style={styles.totalScore}>{totalScore.toFixed(1)}</Text>
            <Text style={styles.totalScoreLabel}>out of 50</Text>
            
            <View style={styles.resultsGrid}>
              {targetColors.map((target, i) => (
                <View key={i} style={styles.resultRow}>
                  <View style={styles.resultColors}>
                    <View style={styles.resultColorWrapper}>
                      <ColorSwatch color={target} size={45} />
                      <Text style={styles.resultLabel}>Original</Text>
                    </View>
                    <Text style={styles.resultArrow}>→</Text>
                    <View style={styles.resultColorWrapper}>
                      <ColorSwatch color={guessColors[i]} size={45} />
                      <Text style={styles.resultLabel}>Yours</Text>
                    </View>
                  </View>
                  <Text style={styles.resultScore}>{scores[i].toFixed(1)}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.shareButton} onPress={shareResults}>
              <Text style={styles.shareButtonText}>📤 Share Results</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.playAgainButton} onPress={mode === 'daily' ? goToMenu : startSoloGame}>
              <LinearGradient
                colors={['#2997ff', '#af52de']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.playAgainButtonGradient}
              >
                <Text style={styles.playAgainButtonText}>
                  {mode === 'daily' ? 'Back to Menu' : 'Play Again'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  logoAccent: {
    color: '#2997ff',
  },
  backButton: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.6)',
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // Menu
  tagline: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginVertical: 24,
    lineHeight: 44,
  },
  infoCard: {
    marginBottom: 24,
  },
  infoText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 24,
  },
  modeButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
  },
  modeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 16,
  },
  modeButtonIcon: {
    fontSize: 32,
  },
  modeButtonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  modeButtonSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
  },
  nameInputCard: {
    marginBottom: 16,
  },
  nameInputLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  joinCard: {
    marginTop: 4,
  },
  joinLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
  },
  joinRow: {
    flexDirection: 'row',
    gap: 12,
  },
  codeInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
  },
  joinButton: {
    backgroundColor: '#af52de',
    borderRadius: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Glass Card
  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassCardInner: {
    padding: 20,
  },

  // Lobby
  lobbyTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginVertical: 16,
  },
  codeCard: {
    alignItems: 'center',
    marginBottom: 24,
  },
  codeLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  codeDisplay: {
    fontSize: 48,
    fontWeight: '800',
    color: '#2997ff',
    letterSpacing: 12,
  },
  playersCard: {
    marginBottom: 24,
  },
  playersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  playerName: {
    fontSize: 16,
    color: '#fff',
  },
  playerReady: {
    fontSize: 16,
    color: '#00d4aa',
  },
  startButton: {
    borderRadius: 100,
    overflow: 'hidden',
  },
  startButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  waitingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  waitingText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },

  // Game
  phaseTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 8,
  },
  timer: {
    fontSize: 80,
    fontWeight: '800',
    color: '#2997ff',
    textAlign: 'center',
    marginBottom: 24,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  hint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressDotComplete: {
    backgroundColor: '#00d4aa',
  },
  progressDotActive: {
    backgroundColor: '#2997ff',
    width: 24,
  },

  // Swatch
  swatch: {
    borderRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },

  // Picker
  pickerCard: {
    marginBottom: 24,
  },
  pickerPreview: {
    alignItems: 'center',
    marginBottom: 24,
  },
  pickerPreviewColor: {
    width: 120,
    height: 120,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sliderLabel: {
    width: 24,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  sliderTrack: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginHorizontal: 12,
  },
  sliderGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  sliderThumb: {
    position: 'absolute',
    top: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginLeft: -12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderValue: {
    width: 36,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
  },

  // Submit
  submitButton: {
    borderRadius: 100,
    overflow: 'hidden',
  },
  submitButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },

  // Results
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 16,
  },
  totalScore: {
    fontSize: 72,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  totalScoreLabel: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginBottom: 24,
  },
  resultsGrid: {
    marginBottom: 24,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  resultColors: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultColorWrapper: {
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  resultArrow: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.3)',
  },
  resultScore: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2997ff',
  },
  shareButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  playAgainButton: {
    borderRadius: 100,
    overflow: 'hidden',
  },
  playAgainButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  playAgainButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
});
