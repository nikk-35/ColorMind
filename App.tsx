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

// ============================================================================
// SIMPLE SLIDER COMPONENT
// ============================================================================

const SimpleSlider: React.FC<{
  label: string;
  value: number;
  max: number;
  color: string;
  onChange: (value: number) => void;
}> = ({ label, value, max, color, onChange }) => {
  return (
    <View style={styles.sliderContainer}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <View style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { width: `${(value / max) * 100}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.sliderButtons}>
        <TouchableOpacity style={styles.sliderBtn} onPress={() => onChange(Math.max(0, value - 10))}>
          <Text style={styles.sliderBtnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.sliderValue}>{value}</Text>
        <TouchableOpacity style={styles.sliderBtn} onPress={() => onChange(Math.min(max, value + 10))}>
          <Text style={styles.sliderBtnText}>+</Text>
        </TouchableOpacity>
      </View>
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

  const shareResults = async () => {
    const percentile = getPercentile(totalScore);
    const text = `ColorMind 🎨\n${totalScore.toFixed(1)}/50 • Top ${percentile}%\n\nTry it: colormind.app`;
    try {
      await Share.share({ message: text });
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Color<Text style={styles.logoAccent}>Mind</Text></Text>
        {phase !== 'menu' && (
          <TouchableOpacity onPress={() => setPhase('menu')}>
            <Text style={styles.backButton}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        
        {/* MENU */}
        {phase === 'menu' && (
          <>
            <Text style={styles.tagline}>How well can you{'\n'}remember colors?</Text>
            
            <View style={styles.card}>
              <Text style={styles.cardText}>
                We'll show you {NUM_COLORS} colors.{'\n'}
                Memorize each one, then recreate it!
              </Text>
            </View>

            <TouchableOpacity style={styles.playButton} onPress={startGame}>
              <Text style={styles.playButtonText}>Play Solo 🎯</Text>
            </TouchableOpacity>
          </>
        )}

        {/* MEMORIZE */}
        {phase === 'memorize' && targetColors[currentColorIndex] && (
          <>
            <Text style={styles.phaseTitle}>Memorize Color {currentColorIndex + 1}</Text>
            <Text style={styles.timer}>{memorizeTime}</Text>
            
            <View style={[
              styles.colorDisplay,
              { backgroundColor: hsbToHex(
                targetColors[currentColorIndex].h,
                targetColors[currentColorIndex].s,
                targetColors[currentColorIndex].b
              )}
            ]} />

            <Text style={styles.hint}>Remember this color!</Text>
          </>
        )}

        {/* RECALL */}
        {phase === 'recall' && (
          <>
            <Text style={styles.phaseTitle}>Recreate Color {currentColorIndex + 1}</Text>
            
            <View style={[
              styles.colorDisplay,
              { backgroundColor: hsbToHex(currentGuess.h, currentGuess.s, currentGuess.b) }
            ]} />

            <SimpleSlider
              label="Hue"
              value={currentGuess.h}
              max={360}
              color="#ff6b6b"
              onChange={(v) => setCurrentGuess({ ...currentGuess, h: v })}
            />
            <SimpleSlider
              label="Saturation"
              value={currentGuess.s}
              max={100}
              color="#4ecdc4"
              onChange={(v) => setCurrentGuess({ ...currentGuess, s: v })}
            />
            <SimpleSlider
              label="Brightness"
              value={currentGuess.b}
              max={100}
              color="#ffe66d"
              onChange={(v) => setCurrentGuess({ ...currentGuess, b: v })}
            />

            <TouchableOpacity style={styles.playButton} onPress={submitGuess}>
              <Text style={styles.playButtonText}>
                {currentColorIndex < NUM_COLORS - 1 ? 'Next →' : 'See Results'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* RESULTS */}
        {phase === 'results' && (
          <>
            <Text style={styles.resultsTitle}>Your Score</Text>
            <Text style={styles.totalScore}>{totalScore.toFixed(1)}</Text>
            <Text style={styles.totalScoreLabel}>out of 50</Text>
            
            <View style={styles.percentileBadge}>
              <Text style={styles.percentileText}>Top {getPercentile(totalScore)}%</Text>
            </View>

            <View style={styles.resultsGrid}>
              {targetColors.map((target, i) => (
                <View key={i} style={styles.resultRow}>
                  <View style={[styles.resultColor, { backgroundColor: hsbToHex(target.h, target.s, target.b) }]} />
                  <Text style={styles.resultArrow}>→</Text>
                  <View style={[styles.resultColor, { backgroundColor: hsbToHex(guessColors[i]?.h || 0, guessColors[i]?.s || 0, guessColors[i]?.b || 0) }]} />
                  <Text style={styles.resultScore}>{scores[i]?.toFixed(1)}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.shareButton} onPress={shareResults}>
              <Text style={styles.shareButtonText}>📤 Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.playButton} onPress={startGame}>
              <Text style={styles.playButtonText}>Play Again</Text>
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
  tagline: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginVertical: 24,
    lineHeight: 40,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  cardText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 24,
  },
  playButton: {
    backgroundColor: '#2997ff',
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 16,
  },
  playButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  phaseTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 20,
  },
  timer: {
    fontSize: 80,
    fontWeight: '800',
    color: '#2997ff',
    textAlign: 'center',
    marginBottom: 24,
  },
  colorDisplay: {
    width: width - 80,
    height: width - 80,
    borderRadius: 24,
    alignSelf: 'center',
    marginVertical: 20,
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
    marginBottom: 8,
  },
  sliderTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    marginBottom: 8,
  },
  sliderFill: {
    height: '100%',
    borderRadius: 4,
  },
  sliderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
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
    fontWeight: '600',
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    width: 50,
    textAlign: 'center',
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
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
    marginBottom: 16,
  },
  percentileBadge: {
    backgroundColor: 'rgba(41, 151, 255, 0.2)',
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 24,
  },
  percentileText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2997ff',
  },
  resultsGrid: {
    marginBottom: 24,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  resultColor: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  resultArrow: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.3)',
  },
  resultScore: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2997ff',
    width: 50,
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
});
