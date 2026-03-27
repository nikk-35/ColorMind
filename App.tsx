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
  GestureResponderEvent,
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

type GameMode = 'solo' | 'daily';
type GamePhase = 'menu' | 'memorize' | 'recall' | 'results';

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

const getPercentile = (score: number): number => {
  if (score >= 47) return 1;
  if (score >= 45) return 3;
  if (score >= 43) return 5;
  if (score >= 40) return 10;
  if (score >= 37) return 20;
  if (score >= 34) return 30;
  if (score >= 30) return 45;
  if (score >= 26) return 60;
  if (score >= 22) return 75;
  return 85;
};

const getPercentileEmoji = (p: number): string => {
  if (p <= 5) return '🏆';
  if (p <= 10) return '🥇';
  if (p <= 20) return '🥈';
  if (p <= 35) return '🥉';
  return '⭐';
};

// ============================================================================
// GLASS CARD COMPONENT
// ============================================================================

const GlassCard: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => (
  <View style={[styles.glassCard, style]}>
    <View style={[StyleSheet.absoluteFill, styles.glassCardBg]} />
    <View style={styles.glassCardContent}>{children}</View>
  </View>
);

// ============================================================================
// COLOR SWATCH COMPONENT
// ============================================================================

const ColorSwatch: React.FC<{ color: HSBColor; size?: number; glow?: boolean }> = ({ 
  color, 
  size = 60,
  glow = false 
}) => {
  const hex = hsbToHex(color.h, color.s, color.b);
  return (
    <View style={[
      styles.swatch, 
      { 
        width: size, 
        height: size, 
        backgroundColor: hex,
        shadowColor: glow ? hex : '#000',
        shadowOpacity: glow ? 0.6 : 0.3,
        shadowRadius: glow ? 25 : 15,
      }
    ]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.25)', 'transparent']}
        style={styles.swatchShine}
      />
    </View>
  );
};

// ============================================================================
// DRAGGABLE SLIDER COMPONENT
// ============================================================================

const DraggableSlider: React.FC<{
  label: string;
  value: number;
  max: number;
  colors: string[];
  onChange: (value: number) => void;
}> = ({ label, value, max, colors, onChange }) => {
  const trackRef = useRef<View>(null);
  const trackWidth = width - 140;
  const step = max === 360 ? 15 : 5;
  
  const handleTouch = (event: GestureResponderEvent) => {
    const { locationX } = event.nativeEvent;
    const newValue = Math.round((Math.max(0, Math.min(trackWidth, locationX)) / trackWidth) * max);
    onChange(Math.max(0, Math.min(max, newValue)));
  };

  return (
    <View style={styles.sliderContainer}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <View style={styles.sliderRow}>
        <TouchableOpacity 
          style={styles.sliderBtn} 
          onPress={() => onChange(Math.max(0, value - step))}
        >
          <Text style={styles.sliderBtnText}>−</Text>
        </TouchableOpacity>
        
        <View 
          ref={trackRef}
          style={styles.sliderTrackWrapper}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleTouch}
          onResponderMove={handleTouch}
        >
          <LinearGradient
            colors={colors as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sliderTrack}
          />
          <View style={[styles.sliderThumb, { left: `${(value / max) * 100}%` }]} />
        </View>
        
        <TouchableOpacity 
          style={styles.sliderBtn} 
          onPress={() => onChange(Math.min(max, value + step))}
        >
          <Text style={styles.sliderBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sliderValue}>{value}{max === 360 ? '°' : '%'}</Text>
    </View>
  );
};

// ============================================================================
// HSB PICKER
// ============================================================================

const HSBPicker: React.FC<{
  value: HSBColor;
  onChange: (color: HSBColor) => void;
}> = ({ value, onChange }) => {
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
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.3)', 'transparent']}
            style={styles.previewShine}
          />
        </View>
      </View>
      <DraggableSlider
        label="HUE"
        value={value.h}
        max={360}
        colors={hueGradient}
        onChange={(v) => onChange({ ...value, h: v })}
      />
      <DraggableSlider
        label="SATURATION"
        value={value.s}
        max={100}
        colors={satGradient}
        onChange={(v) => onChange({ ...value, s: v })}
      />
      <DraggableSlider
        label="BRIGHTNESS"
        value={value.b}
        max={100}
        colors={briGradient}
        onChange={(v) => onChange({ ...value, b: v })}
      />
    </GlassCard>
  );
};

// ============================================================================
// MODE BUTTON COMPONENT
// ============================================================================

const ModeButton: React.FC<{
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
  colors?: string[];
}> = ({ title, subtitle, icon, onPress, colors = ['#2997ff', '#af52de'] }) => (
  <TouchableOpacity style={styles.modeButton} onPress={onPress} activeOpacity={0.8}>
    <LinearGradient
      colors={colors as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.modeButtonGradient}
    >
      <Text style={styles.modeButtonIcon}>{icon}</Text>
      <View style={styles.modeButtonText}>
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
  const [targetColors, setTargetColors] = useState<HSBColor[]>([]);
  const [guessColors, setGuessColors] = useState<HSBColor[]>([]);
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  const [currentGuess, setCurrentGuess] = useState<HSBColor>({ h: 180, s: 50, b: 75 });
  const [memorizeTime, setMemorizeTime] = useState(3);
  const [scores, setScores] = useState<number[]>([]);
  const [dailyPlayed, setDailyPlayed] = useState(false);
  const [dailyScore, setDailyScore] = useState<number | null>(null);

  const NUM_COLORS = 5;

  const startSoloGame = useCallback(() => {
    const colors = generateColors(NUM_COLORS);
    setTargetColors(colors);
    setGuessColors([]);
    setCurrentColorIndex(0);
    setCurrentGuess({ h: 180, s: 50, b: 75 });
    setScores([]);
    setMemorizeTime(3);
    setMode('solo');
    setPhase('memorize');
  }, []);

  const startDailyGame = useCallback(() => {
    if (dailyPlayed) return;
    const seed = getDailySeed();
    const colors = generateColors(NUM_COLORS, seed);
    setTargetColors(colors);
    setGuessColors([]);
    setCurrentColorIndex(0);
    setCurrentGuess({ h: 180, s: 50, b: 75 });
    setScores([]);
    setMemorizeTime(3);
    setMode('daily');
    setPhase('memorize');
  }, [dailyPlayed]);

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
      setMemorizeTime(3);
      setPhase('memorize');
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
    const percentile = getPercentile(total);
    const emoji = getPercentileEmoji(percentile);
    const text = mode === 'daily' 
      ? `ColorMind Daily ${emoji}\n${total.toFixed(1)}/50 • Top ${percentile}%\n\nCan you beat me?\ncolormind.app`
      : `ColorMind ${emoji}\n${total.toFixed(1)}/50 • Top ${percentile}%\n\nTry it: colormind.app`;
    
    try {
      await Share.share({ message: text });
    } catch (e) {}
  };

  const totalScore = scores.reduce((a, b) => a + b, 0);
  const percentile = getPercentile(totalScore);

  const goToMenu = () => setPhase('menu');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0a0a1a', '#1a0a2e', '#0a1a2e']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Floating Orbs */}
      <View style={[styles.orb, styles.orb1]} />
      <View style={[styles.orb, styles.orb2]} />
      <View style={[styles.orb, styles.orb3]} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Color<Text style={styles.logoAccent}>Mind</Text></Text>
        {phase !== 'menu' && (
          <TouchableOpacity onPress={goToMenu}>
            <Text style={styles.closeBtn}>✕</Text>
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
                We'll show you {NUM_COLORS} colors for 3 seconds each.{'\n'}
                Then recreate them from memory!
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
              colors={dailyPlayed ? ['#444', '#555'] : ['#00d4aa', '#2997ff']}
            />
          </>
        )}

        {/* MEMORIZE */}
        {phase === 'memorize' && targetColors[currentColorIndex] && (
          <>
            <View style={styles.progressRow}>
              {Array.from({ length: NUM_COLORS }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    i < currentColorIndex && styles.progressDotDone,
                    i === currentColorIndex && styles.progressDotActive,
                  ]}
                />
              ))}
            </View>
            
            <Text style={styles.phaseTitle}>Memorize Color {currentColorIndex + 1}</Text>
            <Text style={styles.timer}>{memorizeTime}</Text>
            
            <View style={styles.colorDisplayContainer}>
              <ColorSwatch 
                color={targetColors[currentColorIndex]} 
                size={width * 0.55} 
                glow 
              />
            </View>

            <Text style={styles.hint}>Remember this color!</Text>
          </>
        )}

        {/* RECALL */}
        {phase === 'recall' && (
          <>
            <View style={styles.progressRow}>
              {Array.from({ length: NUM_COLORS }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    i < currentColorIndex && styles.progressDotDone,
                    i === currentColorIndex && styles.progressDotActive,
                  ]}
                />
              ))}
            </View>
            
            <Text style={styles.phaseTitle}>Recreate Color {currentColorIndex + 1}</Text>
            
            <HSBPicker value={currentGuess} onChange={setCurrentGuess} />

            <TouchableOpacity onPress={submitGuess} activeOpacity={0.8}>
              <LinearGradient
                colors={['#2997ff', '#af52de']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButton}
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
              {mode === 'daily' ? '📅 Daily Challenge' : '🎯 Solo'}
            </Text>
            
            <Text style={styles.resultsEmoji}>{getPercentileEmoji(percentile)}</Text>
            <Text style={styles.totalScore}>{totalScore.toFixed(1)}</Text>
            <Text style={styles.totalScoreLabel}>out of 50</Text>
            
            <View style={styles.percentileBadge}>
              <Text style={styles.percentileText}>Top {percentile}% of players</Text>
            </View>

            <GlassCard style={styles.resultsCard}>
              {targetColors.map((target, i) => (
                <View key={i} style={styles.resultRow}>
                  <View style={styles.resultColors}>
                    <View style={styles.resultColorWrapper}>
                      <ColorSwatch color={target} size={40} />
                      <Text style={styles.resultLabel}>Original</Text>
                    </View>
                    <Text style={styles.resultArrow}>→</Text>
                    <View style={styles.resultColorWrapper}>
                      <ColorSwatch color={guessColors[i] || {h:0,s:0,b:0}} size={40} />
                      <Text style={styles.resultLabel}>Yours</Text>
                    </View>
                  </View>
                  <Text style={styles.resultScore}>{scores[i]?.toFixed(1)}</Text>
                </View>
              ))}
            </GlassCard>

            <TouchableOpacity style={styles.shareButton} onPress={shareResults}>
              <Text style={styles.shareButtonText}>📤 Share Results</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={mode === 'daily' ? goToMenu : startSoloGame} activeOpacity={0.8}>
              <LinearGradient
                colors={['#2997ff', '#af52de']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButton}
              >
                <Text style={styles.submitButtonText}>
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
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb1: {
    width: 250,
    height: 250,
    backgroundColor: 'rgba(41, 151, 255, 0.15)',
    top: -80,
    right: -80,
  },
  orb2: {
    width: 200,
    height: 200,
    backgroundColor: 'rgba(175, 82, 222, 0.12)',
    bottom: 150,
    left: -60,
  },
  orb3: {
    width: 150,
    height: 150,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    top: '45%',
    right: -40,
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
  closeBtn: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.5)',
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 50,
  },
  tagline: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginVertical: 24,
    lineHeight: 42,
  },
  glassCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
  },
  glassCardBg: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
  },
  glassCardContent: {
    padding: 20,
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
  },
  modeButtonIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  modeButtonText: {
    flex: 1,
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
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressDotDone: {
    backgroundColor: '#00d4aa',
  },
  progressDotActive: {
    backgroundColor: '#2997ff',
    width: 24,
  },
  phaseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 8,
  },
  timer: {
    fontSize: 80,
    fontWeight: '800',
    color: '#2997ff',
    textAlign: 'center',
  },
  colorDisplayContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  swatch: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  swatchShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  hint: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  pickerCard: {
    marginBottom: 20,
  },
  pickerPreview: {
    alignItems: 'center',
    marginBottom: 20,
  },
  pickerPreviewColor: {
    width: 100,
    height: 100,
    borderRadius: 20,
    overflow: 'hidden',
  },
  previewShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  sliderContainer: {
    marginBottom: 16,
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderBtn: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderBtnText: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '300',
  },
  sliderTrackWrapper: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  sliderTrack: {
    flex: 1,
  },
  sliderThumb: {
    position: 'absolute',
    top: 6,
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
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 8,
  },
  submitButton: {
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 16,
  },
  resultsEmoji: {
    fontSize: 56,
    textAlign: 'center',
    marginTop: 8,
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
  },
  percentileBadge: {
    backgroundColor: 'rgba(41, 151, 255, 0.12)',
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'center',
    marginVertical: 16,
  },
  percentileText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2997ff',
  },
  resultsCard: {
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#2997ff',
  },
  shareButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
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
});
