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

const randomColor = (): HSBColor => ({
  h: Math.floor(Math.random() * 360),
  s: Math.floor(Math.random() * 60) + 40,
  b: Math.floor(Math.random() * 50) + 50,
});

const generateColors = (count: number): HSBColor[] => 
  Array.from({ length: count }, () => randomColor());

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
    {children}
  </View>
);

// ============================================================================
// COLOR SWATCH COMPONENT
// ============================================================================

const ColorSwatch: React.FC<{ color: HSBColor; size?: number }> = ({ color, size = 60 }) => {
  const hex = hsbToHex(color.h, color.s, color.b);
  return (
    <View style={[styles.swatch, { width: size, height: size, backgroundColor: hex }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.2)', 'transparent']}
        style={styles.swatchShine}
      />
    </View>
  );
};

// ============================================================================
// SLIDER COMPONENT
// ============================================================================

const ColorSlider: React.FC<{
  label: string;
  value: number;
  max: number;
  colors: string[];
  onChange: (value: number) => void;
}> = ({ label, value, max, colors, onChange }) => {
  const step = max === 360 ? 15 : 5;
  
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
        
        <View style={styles.sliderTrackContainer}>
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
      <Text style={styles.sliderValue}>{value}</Text>
    </View>
  );
};

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [targetColors, setTargetColors] = useState<HSBColor[]>([]);
  const [guessColors, setGuessColors] = useState<HSBColor[]>([]);
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  const [currentGuess, setCurrentGuess] = useState<HSBColor>({ h: 180, s: 50, b: 75 });
  const [memorizeTime, setMemorizeTime] = useState(3);
  const [scores, setScores] = useState<number[]>([]);

  const NUM_COLORS = 5;

  const startGame = useCallback(() => {
    const colors = generateColors(NUM_COLORS);
    setTargetColors(colors);
    setGuessColors([]);
    setCurrentColorIndex(0);
    setCurrentGuess({ h: 180, s: 50, b: 75 });
    setScores([]);
    setMemorizeTime(3);
    setPhase('memorize');
  }, []);

  useEffect(() => {
    if (phase !== 'memorize') return;
    if (memorizeTime <= 0) {
      setPhase('recall');
      return;
    }
    const timer = setTimeout(() => setMemorizeTime((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, memorizeTime]);

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
      setPhase('results');
    }
  }, [currentGuess, guessColors, currentColorIndex, targetColors]);

  const totalScore = scores.reduce((a, b) => a + b, 0);
  const percentile = getPercentile(totalScore);

  const shareResults = async () => {
    const emoji = getPercentileEmoji(percentile);
    const text = `ColorMind ${emoji}\n${totalScore.toFixed(1)}/50 • Top ${percentile}%\n\nTry it: colormind.app`;
    try {
      await Share.share({ message: text });
    } catch (e) {}
  };

  // Hue gradient colors
  const hueColors = Array.from({ length: 7 }, (_, i) => hsbToHex(i * 60, 100, 100));
  const satColors = [hsbToHex(currentGuess.h, 0, currentGuess.b), hsbToHex(currentGuess.h, 100, currentGuess.b)];
  const briColors = [hsbToHex(currentGuess.h, currentGuess.s, 0), hsbToHex(currentGuess.h, currentGuess.s, 100)];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0a0a1a', '#1a0a2e', '#0f1a2a']}
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
          <TouchableOpacity onPress={() => setPhase('menu')}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        
        {/* MENU */}
        {phase === 'menu' && (
          <>
            <Text style={styles.tagline}>How well can you{'\n'}remember colors?</Text>
            
            <GlassCard style={styles.infoCard}>
              <Text style={styles.infoText}>
                We'll show you {NUM_COLORS} colors for 3 seconds each.{'\n'}
                Recreate them from memory!
              </Text>
            </GlassCard>

            <TouchableOpacity onPress={startGame} activeOpacity={0.8}>
              <LinearGradient
                colors={['#2997ff', '#af52de']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>🎯 Play Solo</Text>
              </LinearGradient>
            </TouchableOpacity>
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
              <ColorSwatch color={targetColors[currentColorIndex]} size={width * 0.6} />
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
            
            <View style={styles.colorDisplayContainer}>
              <ColorSwatch color={currentGuess} size={width * 0.4} />
            </View>

            <GlassCard>
              <ColorSlider
                label="Hue"
                value={currentGuess.h}
                max={360}
                colors={hueColors}
                onChange={(v) => setCurrentGuess({ ...currentGuess, h: v })}
              />
              <ColorSlider
                label="Saturation"
                value={currentGuess.s}
                max={100}
                colors={satColors}
                onChange={(v) => setCurrentGuess({ ...currentGuess, s: v })}
              />
              <ColorSlider
                label="Brightness"
                value={currentGuess.b}
                max={100}
                colors={briColors}
                onChange={(v) => setCurrentGuess({ ...currentGuess, b: v })}
              />
            </GlassCard>

            <TouchableOpacity onPress={submitGuess} activeOpacity={0.8}>
              <LinearGradient
                colors={['#2997ff', '#af52de']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  {currentColorIndex < NUM_COLORS - 1 ? 'Next →' : 'See Results'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {/* RESULTS */}
        {phase === 'results' && (
          <>
            <Text style={styles.resultsEmoji}>{getPercentileEmoji(percentile)}</Text>
            <Text style={styles.totalScore}>{totalScore.toFixed(1)}</Text>
            <Text style={styles.totalScoreLabel}>out of 50</Text>
            
            <View style={styles.percentileBadge}>
              <Text style={styles.percentileText}>Top {percentile}%</Text>
            </View>

            <GlassCard style={styles.resultsCard}>
              {targetColors.map((target, i) => (
                <View key={i} style={styles.resultRow}>
                  <ColorSwatch color={target} size={36} />
                  <Text style={styles.resultArrow}>→</Text>
                  <ColorSwatch color={guessColors[i] || { h: 0, s: 0, b: 0 }} size={36} />
                  <Text style={styles.resultScore}>{scores[i]?.toFixed(1)}</Text>
                </View>
              ))}
            </GlassCard>

            <TouchableOpacity style={styles.shareButton} onPress={shareResults}>
              <Text style={styles.shareButtonText}>📤 Share Results</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={startGame} activeOpacity={0.8}>
              <LinearGradient
                colors={['#2997ff', '#af52de']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Play Again</Text>
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
    opacity: 0.3,
  },
  orb1: {
    width: 200,
    height: 200,
    backgroundColor: '#2997ff',
    top: -50,
    right: -50,
    filter: 'blur(60px)',
  },
  orb2: {
    width: 150,
    height: 150,
    backgroundColor: '#af52de',
    bottom: 100,
    left: -30,
    filter: 'blur(50px)',
  },
  orb3: {
    width: 100,
    height: 100,
    backgroundColor: '#00d4aa',
    top: '40%',
    right: -20,
    filter: 'blur(40px)',
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
    marginVertical: 30,
    lineHeight: 42,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    marginBottom: 20,
  },
  infoCard: {
    alignItems: 'center',
  },
  infoText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 24,
  },
  primaryButton: {
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 10,
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
    marginBottom: 10,
  },
  timer: {
    fontSize: 72,
    fontWeight: '800',
    color: '#2997ff',
    textAlign: 'center',
  },
  colorDisplayContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  swatch: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
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
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  sliderContainer: {
    marginBottom: 20,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 10,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderBtn: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderBtnText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '300',
  },
  sliderTrackContainer: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  sliderTrack: {
    flex: 1,
    borderRadius: 16,
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
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 8,
  },
  resultsEmoji: {
    fontSize: 64,
    textAlign: 'center',
    marginTop: 20,
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
    backgroundColor: 'rgba(41, 151, 255, 0.15)',
    borderRadius: 100,
    paddingVertical: 10,
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
    marginBottom: 20,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  resultArrow: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.3)',
  },
  resultScore: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2997ff',
    width: 45,
    textAlign: 'right',
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
