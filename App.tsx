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
  if (score >= 40) return 10;
  if (score >= 34) return 30;
  if (score >= 26) return 60;
  return 85;
};

const getEmoji = (p: number): string => {
  if (p <= 5) return '🏆';
  if (p <= 10) return '🥇';
  if (p <= 30) return '🥈';
  return '⭐';
};

// ============================================================================
// SIMPLE SLIDER
// ============================================================================

const Slider: React.FC<{
  label: string;
  value: number;
  max: number;
  color: string;
  onChange: (v: number) => void;
}> = ({ label, value, max, color, onChange }) => {
  const step = max === 360 ? 18 : 5;
  
  const handleTrackPress = (e: any) => {
    const x = e.nativeEvent.locationX;
    const trackW = width - 140;
    const newVal = Math.round((x / trackW) * max);
    onChange(Math.max(0, Math.min(max, newVal)));
  };

  return (
    <View style={styles.sliderBox}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <View style={styles.sliderRow}>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => onChange(Math.max(0, value - step))}
        >
          <Text style={styles.btnTxt}>−</Text>
        </TouchableOpacity>

        <View
          style={styles.track}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleTrackPress}
          onResponderMove={handleTrackPress}
        >
          <View style={[styles.trackFill, { width: `${(value / max) * 100}%`, backgroundColor: color }]} />
          <View style={[styles.thumb, { left: `${(value / max) * 100}%` }]} />
        </View>

        <TouchableOpacity
          style={styles.btn}
          onPress={() => onChange(Math.min(max, value + step))}
        >
          <Text style={styles.btnTxt}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sliderVal}>{value}</Text>
    </View>
  );
};

// ============================================================================
// APP
// ============================================================================

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [targets, setTargets] = useState<HSBColor[]>([]);
  const [guesses, setGuesses] = useState<HSBColor[]>([]);
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState<HSBColor>({ h: 180, s: 50, b: 70 });
  const [timer, setTimer] = useState(3);
  const [scores, setScores] = useState<number[]>([]);

  const N = 5;

  const start = useCallback(() => {
    setTargets(generateColors(N));
    setGuesses([]);
    setIdx(0);
    setGuess({ h: 180, s: 50, b: 70 });
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

  const submit = useCallback(() => {
    const newGuesses = [...guesses, guess];
    setGuesses(newGuesses);

    if (idx < N - 1) {
      setIdx((i) => i + 1);
      setGuess({ h: 180, s: 50, b: 70 });
      setTimer(3);
      setPhase('memorize');
    } else {
      const sc = targets.map((t, i) => calculateScore(t, newGuesses[i]));
      setScores(sc);
      setPhase('results');
    }
  }, [guess, guesses, idx, targets]);

  const total = scores.reduce((a, b) => a + b, 0);
  const pct = getPercentile(total);

  const shareResult = async () => {
    const txt = `ColorMind ${getEmoji(pct)}\n${total.toFixed(1)}/50 • Top ${pct}%\n\ncolormind.app`;
    try { await Share.share({ message: txt }); } catch {}
  };

  const guessHex = hsbToHex(guess.h, guess.s, guess.b);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.logo}>Color<Text style={styles.accent}>Mind</Text></Text>
        {phase !== 'menu' && (
          <TouchableOpacity onPress={() => setPhase('menu')}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* MENU */}
        {phase === 'menu' && (
          <>
            <Text style={styles.title}>How well can you{'\n'}remember colors?</Text>
            <Text style={styles.sub}>5 colors. 3 seconds each. Go!</Text>
            <TouchableOpacity style={styles.playBtn} onPress={start}>
              <Text style={styles.playBtnTxt}>🎯 Play</Text>
            </TouchableOpacity>
          </>
        )}

        {/* MEMORIZE */}
        {phase === 'memorize' && targets[idx] && (
          <>
            <View style={styles.dots}>
              {Array.from({ length: N }).map((_, i) => (
                <View key={i} style={[styles.dot, i < idx && styles.dotDone, i === idx && styles.dotNow]} />
              ))}
            </View>
            <Text style={styles.phase}>Memorize #{idx + 1}</Text>
            <Text style={styles.timer}>{timer}</Text>
            <View style={[styles.colorBox, { backgroundColor: hsbToHex(targets[idx].h, targets[idx].s, targets[idx].b) }]} />
            <Text style={styles.hint}>Remember this color!</Text>
          </>
        )}

        {/* RECALL */}
        {phase === 'recall' && (
          <>
            <View style={styles.dots}>
              {Array.from({ length: N }).map((_, i) => (
                <View key={i} style={[styles.dot, i < idx && styles.dotDone, i === idx && styles.dotNow]} />
              ))}
            </View>
            <Text style={styles.phase}>Recreate #{idx + 1}</Text>

            <View style={[styles.previewBox, { backgroundColor: guessHex }]} />

            <View style={styles.card}>
              <Slider label="Hue" value={guess.h} max={360} color="#2997ff" onChange={(v) => setGuess({ ...guess, h: v })} />
              <Slider label="Saturation" value={guess.s} max={100} color="#af52de" onChange={(v) => setGuess({ ...guess, s: v })} />
              <Slider label="Brightness" value={guess.b} max={100} color="#00d4aa" onChange={(v) => setGuess({ ...guess, b: v })} />
            </View>

            <TouchableOpacity style={styles.playBtn} onPress={submit}>
              <Text style={styles.playBtnTxt}>{idx < N - 1 ? 'Next →' : 'Results'}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* RESULTS */}
        {phase === 'results' && (
          <>
            <Text style={styles.emoji}>{getEmoji(pct)}</Text>
            <Text style={styles.score}>{total.toFixed(1)}</Text>
            <Text style={styles.scoreLabel}>out of 50</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>Top {pct}%</Text>
            </View>

            <View style={styles.card}>
              {targets.map((t, i) => (
                <View key={i} style={styles.resultRow}>
                  <View style={[styles.miniBox, { backgroundColor: hsbToHex(t.h, t.s, t.b) }]} />
                  <Text style={styles.arrow}>→</Text>
                  <View style={[styles.miniBox, { backgroundColor: hsbToHex(guesses[i]?.h || 0, guesses[i]?.s || 0, guesses[i]?.b || 0) }]} />
                  <Text style={styles.rowScore}>{scores[i]?.toFixed(1)}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.shareBtn} onPress={shareResult}>
              <Text style={styles.shareTxt}>📤 Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.playBtn} onPress={start}>
              <Text style={styles.playBtnTxt}>Play Again</Text>
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
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, paddingBottom: 16 },
  logo: { fontSize: 26, fontWeight: '800', color: '#fff' },
  accent: { color: '#2997ff' },
  close: { fontSize: 22, color: '#888', padding: 8 },
  content: { paddingHorizontal: 24, paddingBottom: 60 },

  title: { fontSize: 32, fontWeight: '800', color: '#fff', textAlign: 'center', marginTop: 40, lineHeight: 40 },
  sub: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 12, marginBottom: 40 },

  playBtn: { backgroundColor: '#2997ff', borderRadius: 50, paddingVertical: 18, alignItems: 'center', marginTop: 16 },
  playBtnTxt: { fontSize: 18, fontWeight: '700', color: '#fff' },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#333' },
  dotDone: { backgroundColor: '#00d4aa' },
  dotNow: { backgroundColor: '#2997ff', width: 20 },

  phase: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 12 },
  timer: { fontSize: 72, fontWeight: '800', color: '#2997ff', textAlign: 'center' },
  hint: { fontSize: 14, color: '#555', textAlign: 'center', marginTop: 8 },

  colorBox: { width: width * 0.6, height: width * 0.6, borderRadius: 24, alignSelf: 'center', marginVertical: 32 },
  previewBox: { width: 100, height: 100, borderRadius: 20, alignSelf: 'center', marginVertical: 20 },

  card: { backgroundColor: '#1a1a2e', borderRadius: 20, padding: 20, marginBottom: 16 },

  sliderBox: { marginBottom: 16 },
  sliderLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: { width: 40, height: 40, backgroundColor: '#2a2a3e', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { fontSize: 22, color: '#fff' },
  track: { flex: 1, height: 36, backgroundColor: '#2a2a3e', borderRadius: 18, overflow: 'hidden', justifyContent: 'center' },
  trackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 18 },
  thumb: { position: 'absolute', width: 24, height: 24, backgroundColor: '#fff', borderRadius: 12, marginLeft: -12, top: 6 },
  sliderVal: { fontSize: 12, color: '#555', textAlign: 'center', marginTop: 6 },

  emoji: { fontSize: 56, textAlign: 'center', marginTop: 20 },
  score: { fontSize: 64, fontWeight: '800', color: '#fff', textAlign: 'center' },
  scoreLabel: { fontSize: 16, color: '#666', textAlign: 'center' },
  badge: { backgroundColor: 'rgba(41,151,255,0.15)', borderRadius: 50, paddingVertical: 10, paddingHorizontal: 24, alignSelf: 'center', marginVertical: 16 },
  badgeTxt: { fontSize: 14, fontWeight: '600', color: '#2997ff' },

  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 12 },
  miniBox: { width: 36, height: 36, borderRadius: 10 },
  arrow: { fontSize: 16, color: '#444' },
  rowScore: { fontSize: 18, fontWeight: '700', color: '#2997ff', width: 45, textAlign: 'right' },

  shareBtn: { backgroundColor: '#1a1a2e', borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  shareTxt: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
