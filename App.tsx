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

const hsbToRgb = (h: number, s: number, b: number): string => {
  s /= 100;
  b /= 100;
  const k = (n: number) => (n + h / 60) % 6;
  const f = (n: number) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
  return `rgb(${Math.round(f(5) * 255)}, ${Math.round(f(3) * 255)}, ${Math.round(f(1) * 255)})`;
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

const getEmoji = (p: number): string => {
  if (p <= 5) return '🏆';
  if (p <= 10) return '🥇';
  if (p <= 20) return '🥈';
  if (p <= 35) return '🥉';
  return '⭐';
};

// Rainbow colors for HUE slider
const HUE_COLORS = [
  '#ff0000', // 0° Red
  '#ff8000', // 30° Orange
  '#ffff00', // 60° Yellow
  '#80ff00', // 90° Lime
  '#00ff00', // 120° Green
  '#00ff80', // 150° Spring
  '#00ffff', // 180° Cyan
  '#0080ff', // 210° Azure
  '#0000ff', // 240° Blue
  '#8000ff', // 270° Violet
  '#ff00ff', // 300° Magenta
  '#ff0080', // 330° Rose
  '#ff0000', // 360° Red (loop)
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
  label, 
  value, 
  max, 
  gradientColors,
  onChange 
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
          activeOpacity={0.7}
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
          activeOpacity={0.7}
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

interface ColorPickerProps {
  value: HSBColor;
  onChange: (color: HSBColor) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange }) => {
  // Generate saturation gradient based on current hue
  const satColors = [
    hsbToHex(value.h, 0, value.b),
    hsbToHex(value.h, 100, value.b),
  ];
  
  // Generate brightness gradient based on current hue and saturation
  const briColors = [
    hsbToHex(value.h, value.s, 0),
    hsbToHex(value.h, value.s, 100),
  ];

  return (
    <View style={styles.pickerContainer}>
      {/* Color Preview */}
      <View style={styles.previewContainer}>
        <View 
          style={[
            styles.colorPreview, 
            { backgroundColor: hsbToHex(value.h, value.s, value.b) }
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.3)', 'transparent']}
            style={styles.previewShine}
          />
        </View>
      </View>

      {/* Sliders */}
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
// MAIN APP
// ============================================================================

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [targets, setTargets] = useState<HSBColor[]>([]);
  const [guesses, setGuesses] = useState<HSBColor[]>([]);
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState<HSBColor>({ h: 180, s: 50, b: 75 });
  const [timer, setTimer] = useState(3);
  const [scores, setScores] = useState<number[]>([]);

  const N = 5;

  const startGame = useCallback(() => {
    setTargets(generateColors(N));
    setGuesses([]);
    setIdx(0);
    setGuess({ h: 180, s: 50, b: 75 });
    setScores([]);
    setTimer(3);
    setPhase('memorize');
  }, []);

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
      setPhase('results');
    }
  }, [guess, guesses, idx, targets]);

  const totalScore = scores.reduce((a, b) => a + b, 0);
  const percentile = getPercentile(totalScore);

  const shareResults = async () => {
    const emoji = getEmoji(percentile);
    const text = `ColorMind ${emoji}\n${totalScore.toFixed(1)}/50 • Top ${percentile}%\n\nKannst du das schlagen?\ncolormind.app`;
    try { await Share.share({ message: text }); } catch {}
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Background Gradient */}
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
          <TouchableOpacity onPress={() => setPhase('menu')} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* MENU */}
        {phase === 'menu' && (
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>
              Wie gut ist dein{'\n'}Farbgedächtnis?
            </Text>
            <Text style={styles.menuSubtitle}>
              5 Farben. 3 Sekunden. Los!
            </Text>
            
            <TouchableOpacity onPress={startGame} activeOpacity={0.8}>
              <LinearGradient
                colors={['#2997ff', '#af52de']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.playButton}
              >
                <Text style={styles.playButtonText}>🎯 Spielen</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Stats */}
            <View style={styles.statsRow}>
              {[
                { value: '5', label: 'Farben' },
                { value: '3s', label: 'Zeit' },
                { value: '50', label: 'Punkte' },
              ].map((stat, i) => (
                <View key={i} style={styles.statItem}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* MEMORIZE */}
        {phase === 'memorize' && targets[idx] && (
          <View style={styles.gameContainer}>
            {/* Progress Dots */}
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
            {/* Progress Dots */}
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
            <Text style={styles.resultsEmoji}>{getEmoji(percentile)}</Text>
            <Text style={styles.totalScore}>{totalScore.toFixed(1)}</Text>
            <Text style={styles.totalScoreLabel}>von 50 Punkten</Text>
            
            <LinearGradient
              colors={['rgba(41,151,255,0.2)', 'rgba(175,82,222,0.2)']}
              style={styles.percentileBadge}
            >
              <Text style={styles.percentileText}>Top {percentile}%</Text>
            </LinearGradient>

            {/* Results Grid */}
            <View style={styles.resultsCard}>
              {targets.map((target, i) => (
                <View key={i} style={styles.resultRow}>
                  <View 
                    style={[
                      styles.resultColor, 
                      { backgroundColor: hsbToHex(target.h, target.s, target.b) }
                    ]} 
                  />
                  <Text style={styles.resultArrow}>→</Text>
                  <View 
                    style={[
                      styles.resultColor, 
                      { backgroundColor: hsbToHex(guesses[i]?.h || 0, guesses[i]?.s || 0, guesses[i]?.b || 0) }
                    ]} 
                  />
                  <Text style={styles.resultScore}>{scores[i]?.toFixed(1)}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.shareButton} onPress={shareResults}>
              <Text style={styles.shareButtonText}>📤 Teilen</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={startGame} activeOpacity={0.8}>
              <LinearGradient
                colors={['#2997ff', '#af52de']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButton}
              >
                <Text style={styles.submitButtonText}>Nochmal spielen</Text>
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
    paddingBottom: 16,
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
    padding: 8,
  },
  closeBtnText: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.5)',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 24,
    paddingBottom: 50,
  },

  // Menu
  menuContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  menuTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 42,
  },
  menuSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
    marginBottom: 40,
  },
  playButton: {
    paddingVertical: 18,
    paddingHorizontal: 60,
    borderRadius: 30,
  },
  playButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 50,
    gap: 30,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2997ff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },

  // Game
  gameContainer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
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
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  timer: {
    fontSize: 80,
    fontWeight: '800',
    color: '#2997ff',
  },
  memorizeColorContainer: {
    marginVertical: 30,
  },
  memorizeColor: {
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: 30,
    overflow: 'hidden',
  },
  colorShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  hint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },

  // Color Picker
  pickerContainer: {
    width: '100%',
    marginVertical: 20,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  colorPreview: {
    width: 120,
    height: 120,
    borderRadius: 24,
    overflow: 'hidden',
  },
  previewShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  slidersCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // Slider
  sliderContainer: {
    marginBottom: 20,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderBtn: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderBtnText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '300',
  },
  sliderTrackContainer: {
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

  // Submit Button
  submitButton: {
    width: width - 48,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },

  // Results
  resultsContainer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  resultsEmoji: {
    fontSize: 64,
  },
  totalScore: {
    fontSize: 72,
    fontWeight: '800',
    color: '#fff',
  },
  totalScoreLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.4)',
  },
  percentileBadge: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    marginVertical: 16,
  },
  percentileText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2997ff',
  },
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
  resultColor: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  resultArrow: {
    fontSize: 16,
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
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 8,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
