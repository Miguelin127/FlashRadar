/**
 * Price history sparkline for the deal detail screen.
 *
 * Reads deal_price_history/{dealId}, written server-side on every real
 * price change. Renders nothing at all below two points: a single dot is
 * not a history, and an empty chart frame reads as a broken chart.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { db } from '../firebaseConfig';

const USD = '\u0024';
const CHART_H = 56;
const PAD = 8;

type Point = { t: number; p: number };

export default function PriceHistoryChart({
  dealId,
  darkMode,
}: {
  dealId: string;
  darkMode: boolean;
}) {
  const [points, setPoints] = useState<Point[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // firebaseConfig exports a firebase/compat instance, so the
        // modular doc()/getDoc() helpers cannot take it.
        const snap = await db.collection('deal_price_history').doc(dealId).get();
        const raw = snap.exists ? (snap.data() || {}).points : null;
        const clean: Point[] = Array.isArray(raw)
          ? raw
              .filter((x: any) => x && isFinite(Number(x.p)) && Number(x.p) > 0)
              .map((x: any) => ({ t: Number(x.t), p: Number(x.p) }))
          : [];
        if (!cancelled) setPoints(clean);
      } catch (err) {
        if (!cancelled) setPoints([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  if (!points || points.length < 2) return null;

  const width = Dimensions.get('window').width - 72;
  const prices = points.map((x) => x.p);
  const min = Math.min.apply(null, prices);
  const max = Math.max.apply(null, prices);
  const span = max - min;
  const first = prices[0];
  const last = prices[prices.length - 1];

  const xAt = (i: number) =>
    PAD + (points.length === 1 ? 0 : (i / (points.length - 1)) * (width - PAD * 2));
  // A flat series has no range to scale into, so it sits on the midline
  // rather than collapsing onto the floor and looking like a crash.
  const yAt = (p: number) =>
    span <= 0
      ? CHART_H / 2
      : PAD + (1 - (p - min) / span) * (CHART_H - PAD * 2);

  let line = '';
  for (let i = 0; i < points.length; i++) {
    line += (i === 0 ? 'M' : ' L') + xAt(i).toFixed(1) + ' ' + yAt(prices[i]).toFixed(1);
  }
  const area =
    line +
    ' L' + xAt(points.length - 1).toFixed(1) + ' ' + (CHART_H - PAD).toFixed(1) +
    ' L' + xAt(0).toFixed(1) + ' ' + (CHART_H - PAD).toFixed(1) + ' Z';

  const fell = last < first;
  const stroke = fell ? '#22C55E' : last > first ? '#EF4444' : darkMode ? '#94A3B8' : '#64748B';
  const fill = fell ? 'rgba(34,197,94,0.14)' : last > first ? 'rgba(239,68,68,0.12)' : 'rgba(100,116,139,0.10)';
  const atLow = last <= min + 0.01;

  const days = Math.max(1, Math.round((points[points.length - 1].t - points[0].t) / 86400000));
  const sub = days === 1 ? 'past day' : 'past ' + days + ' days';

  return (
    <View style={[styles.card, darkMode ? styles.cardDark : styles.cardLight]}>
      <View style={styles.header}>
        <Text style={[styles.title, darkMode ? styles.textDark : styles.textLight]}>
          Price history
        </Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>

      <Svg width={width} height={CHART_H}>
        <Path d={area} fill={fill} />
        <Path d={line} stroke={stroke} strokeWidth={2} fill="none" />
        <Circle cx={xAt(points.length - 1)} cy={yAt(last)} r={3.5} fill={stroke} />
      </Svg>

      <View style={styles.footer}>
        <Text style={styles.range}>
          Low {USD}{min.toFixed(2)}  ·  High {USD}{max.toFixed(2)}
        </Text>
        {atLow && span > 0 ? <Text style={styles.lowBadge}>Lowest seen</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, marginTop: 14, borderWidth: 1 },
  cardDark: { backgroundColor: '#111827', borderColor: '#1F2937' },
  cardLight: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontSize: 14, fontWeight: '700' },
  textDark: { color: '#F9FAFB' },
  textLight: { color: '#111827' },
  sub: { fontSize: 11, color: '#9CA3AF' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  range: { fontSize: 11, color: '#9CA3AF' },
  lowBadge: { fontSize: 11, fontWeight: '700', color: '#22C55E' },
});
