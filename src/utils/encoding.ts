export const SCHEMES = {
  Unipolar:      ['Unipolar NRZ'] as const,
  Polar:         ['NRZ-L', 'NRZ-I', 'RZ', 'Manchester', 'Differential Manchester'] as const,
  Bipolar:       ['Bipolar AMI', 'Pseudoternary'] as const,
  Scrambling:    ['B8ZS', 'HDB3'] as const,
  Multilevel:    ['2B1Q', '8B/6T', '4D-PAM5'] as const,
  Multitransition: ['MLT-3'] as const,
} as const;

export type EncodingCategory = keyof typeof SCHEMES;
export type EncodingScheme =
  | typeof SCHEMES.Unipolar[number]
  | typeof SCHEMES.Polar[number]
  | typeof SCHEMES.Bipolar[number]
  | typeof SCHEMES.Scrambling[number]
  | typeof SCHEMES.Multilevel[number]
  | typeof SCHEMES.Multitransition[number];

export interface Point {
  x: number;
  y: number; // +3, +1, 0, -1, -3
  isViolation?: boolean;
  label?: string;
}

export const generateWaveform = (bits: string, scheme: EncodingScheme): Point[] => {
  const points: Point[] = [];
  if (!bits) return points;

  let currentLevel = -1;
  let lastAMIPolarity = -1;
  let mltLevel = 0;
  let lastMltNonZero = -1;

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const seg = (startX: number, endX: number, y: number, isViolation = false, label?: string) => {
    points.push({ x: startX, y, isViolation, label }, { x: endX, y, isViolation, label });
  };

  switch (scheme) {
    // ── Unipolar NRZ ────────────────────────────────────────────────────────
    case 'Unipolar NRZ':
      bits.split('').forEach((b, i) => {
        seg(i, i + 1, b === '1' ? 1 : 0);
      });
      break;

    // ── Polar NRZ-L ─────────────────────────────────────────────────────────
    case 'NRZ-L':
      bits.split('').forEach((b, i) => {
        seg(i, i + 1, b === '0' ? 1 : -1);
      });
      break;

    // ── Polar NRZ-I ─────────────────────────────────────────────────────────
    case 'NRZ-I':
      bits.split('').forEach((b, i) => {
        if (b === '1') currentLevel = currentLevel === 1 ? -1 : 1;
        seg(i, i + 1, currentLevel);
      });
      break;

    // ── Polar RZ (Return to Zero) ────────────────────────────────────────────
    case 'RZ':
      bits.split('').forEach((b, i) => {
        if (b === '1') {
          seg(i, i + 0.5, 1);   // first half: +V
          seg(i + 0.5, i + 1, 0); // second half: 0V
        } else {
          seg(i, i + 1, -1);     // 0 bit: -V throughout
        }
      });
      break;

    // ── Polar Manchester ────────────────────────────────────────────────────
    case 'Manchester':
      bits.split('').forEach((b, i) => {
        if (b === '0') { seg(i, i + 0.5, 1); seg(i + 0.5, i + 1, -1); }
        else            { seg(i, i + 0.5, -1); seg(i + 0.5, i + 1, 1); }
      });
      break;

    // ── Polar Differential Manchester ───────────────────────────────────────
    case 'Differential Manchester':
      bits.split('').forEach((b, i) => {
        if (b === '0') currentLevel = currentLevel === 1 ? -1 : 1;
        seg(i, i + 0.5, currentLevel);
        currentLevel = currentLevel === 1 ? -1 : 1;
        seg(i + 0.5, i + 1, currentLevel);
      });
      break;

    // ── Bipolar AMI ─────────────────────────────────────────────────────────
    case 'Bipolar AMI':
      bits.split('').forEach((b, i) => {
        if (b === '0') { seg(i, i + 1, 0); }
        else { lastAMIPolarity = lastAMIPolarity === 1 ? -1 : 1; seg(i, i + 1, lastAMIPolarity); }
      });
      break;

    // ── Pseudoternary (opposite of AMI: 1→0V, 0→alternate ±V) ──────────────
    case 'Pseudoternary':
      bits.split('').forEach((b, i) => {
        if (b === '1') { seg(i, i + 1, 0); }
        else { lastAMIPolarity = lastAMIPolarity === 1 ? -1 : 1; seg(i, i + 1, lastAMIPolarity); }
      });
      break;

    // ── B8ZS Scrambling ─────────────────────────────────────────────────────
    case 'B8ZS': {
      let bi = 0;
      while (bi < bits.length) {
        if (bi + 8 <= bits.length && bits.substring(bi, bi + 8) === '00000000') {
          // 000VB0VB
          for (let j = 0; j < 8; j++) {
            const s = bi + j, e = bi + j + 1;
            if (j === 3 || j === 6) {
              points.push({ x: s, y: lastAMIPolarity, isViolation: true }, { x: e, y: lastAMIPolarity, isViolation: true });
            } else if (j === 4 || j === 7) {
              lastAMIPolarity = lastAMIPolarity === 1 ? -1 : 1;
              points.push({ x: s, y: lastAMIPolarity, isViolation: true }, { x: e, y: lastAMIPolarity, isViolation: true });
            } else { seg(s, e, 0); }
          }
          bi += 8;
        } else {
          const b = parseInt(bits[bi], 10);
          if (b === 0) { seg(bi, bi + 1, 0); }
          else { lastAMIPolarity = lastAMIPolarity === 1 ? -1 : 1; seg(bi, bi + 1, lastAMIPolarity); }
          bi++;
        }
      }
      break;
    }

    // ── HDB3 Scrambling ─────────────────────────────────────────────────────
    case 'HDB3': {
      let hi = 0, nonZeroCount = 0;
      while (hi < bits.length) {
        if (hi + 4 <= bits.length && bits.substring(hi, hi + 4) === '0000') {
          const isEven = nonZeroCount % 2 === 0;
          if (isEven) {
            lastAMIPolarity = lastAMIPolarity === 1 ? -1 : 1;
            points.push({ x: hi, y: lastAMIPolarity, isViolation: true }, { x: hi + 1, y: lastAMIPolarity, isViolation: true });
            seg(hi + 1, hi + 2, 0); seg(hi + 2, hi + 3, 0);
            points.push({ x: hi + 3, y: lastAMIPolarity, isViolation: true }, { x: hi + 4, y: lastAMIPolarity, isViolation: true });
          } else {
            seg(hi, hi + 1, 0); seg(hi + 1, hi + 2, 0); seg(hi + 2, hi + 3, 0);
            points.push({ x: hi + 3, y: lastAMIPolarity, isViolation: true }, { x: hi + 4, y: lastAMIPolarity, isViolation: true });
          }
          hi += 4; nonZeroCount = 0;
        } else {
          const b = parseInt(bits[hi], 10);
          if (b === 0) { seg(hi, hi + 1, 0); }
          else { lastAMIPolarity = lastAMIPolarity === 1 ? -1 : 1; seg(hi, hi + 1, lastAMIPolarity); nonZeroCount++; }
          hi++;
        }
      }
      break;
    }

    // ── MLT-3 Multitransition ────────────────────────────────────────────────
    case 'MLT-3':
      bits.split('').forEach((b, i) => {
        if (b === '1') {
          if (mltLevel !== 0) { mltLevel = 0; }
          else { mltLevel = -lastMltNonZero; lastMltNonZero = mltLevel; }
        }
        seg(i, i + 1, mltLevel);
      });
      break;

    // ── 2B1Q Multilevel ─────────────────────────────────────────────────────
    case '2B1Q': {
      const padded = bits.length % 2 !== 0 ? bits + '0' : bits;
      for (let i = 0; i < padded.length; i += 2) {
        const pair = padded.substring(i, i + 2);
        const map: Record<string, number> = { '10': 3, '11': 1, '01': -1, '00': -3 };
        seg(i, i + 2, map[pair] ?? 0, false, pair);
      }
      break;
    }

    // ── 8B/6T Multilevel (8 binary → 6 ternary symbols: -1, 0, +1) ──────────
    // Simplified: encode groups of 4 bits into 3 ternary symbols
    case '8B/6T': {
      // Simplified representative implementation:
      // Map every 4-bit nibble to 3 ternary levels (-1, 0, +1)
      const nibbleMap: Record<string, number[]> = {
        '0000': [-1, -1, -1], '0001': [-1, -1,  0], '0010': [-1, -1,  1],
        '0011': [-1,  0, -1], '0100': [-1,  0,  0], '0101': [-1,  0,  1],
        '0110': [-1,  1, -1], '0111': [-1,  1,  0], '1000': [-1,  1,  1],
        '1001': [ 0, -1, -1], '1010': [ 0, -1,  0], '1011': [ 0, -1,  1],
        '1100': [ 0,  0, -1], '1101': [ 0,  0,  1], '1110': [ 0,  1,  0],
        '1111': [ 1,  1,  1],
      };
      const padded8 = bits.length % 4 !== 0 ? bits + '0'.repeat(4 - bits.length % 4) : bits;
      let outX = 0;
      for (let i = 0; i < padded8.length; i += 4) {
        const nibble = padded8.substring(i, i + 4);
        const ternary = nibbleMap[nibble] ?? [0, 0, 0];
        for (const tv of ternary) {
          seg(outX, outX + 1, tv, false, nibble);
          outX++;
        }
      }
      break;
    }

    // ── 4D-PAM5 Multilevel (5 levels: -2, -1, 0, +1, +2) ─────────────────
    // Each pair of bits maps to one of 4 levels; 0 level used for error
    case '4D-PAM5': {
      const pam5Map: Record<string, number> = { '00': -2, '01': -1, '10': 1, '11': 2 };
      const padded5 = bits.length % 2 !== 0 ? bits + '0' : bits;
      for (let i = 0; i < padded5.length; i += 2) {
        const pair = padded5.substring(i, i + 2);
        seg(i, i + 2, pam5Map[pair] ?? 0, false, pair);
      }
      break;
    }
  }

  return points;
};

// ─── Encoding descriptions ───────────────────────────────────────────────────
export const schemeDescriptions: Record<EncodingScheme, string> = {
  'Unipolar NRZ':          'Unipolar Non-Return to Zero: Uses only positive voltages. Bit 1 = +V, Bit 0 = 0V. Simple but has DC component and no self-clocking.',
  'NRZ-L':                 'Non-Return to Zero Level: Positive voltage for 0, negative voltage for 1. No transition to zero between bits.',
  'NRZ-I':                 'Non-Return to Zero Invert: Signal inverts on a binary 1; stays the same on binary 0. Better synchronization than NRZ-L.',
  'RZ':                    'Return to Zero: Signal returns to 0V in the middle of every bit period. 1 = +V then 0V; 0 = -V throughout. Self-clocking.',
  'Manchester':            'Manchester Encoding: Always a transition at mid-bit. 0 = High→Low; 1 = Low→High. Widely used in Ethernet.',
  'Differential Manchester':'Differential Manchester: Mandatory mid-bit transition. No transition at start = 1; transition at start = 0. Used in Token Ring.',
  'Bipolar AMI':           'Alternate Mark Inversion: 0 = 0V; 1 = alternating +V and -V. No DC component, easy error detection.',
  'Pseudoternary':         'Pseudoternary: Opposite of AMI. 1 = 0V; 0 = alternating +V and -V. Same properties as AMI with inverted bit assignment.',
  'B8ZS':                  'Bipolar 8-Zero Substitution: Like AMI but replaces 8 consecutive zeros with 000VB0VB to maintain synchronization.',
  'HDB3':                  'High-Density Bipolar 3 Zeros: Replaces 4 consecutive zeros with B00V or 000V depending on previous pulse count. Used in Europe.',
  'MLT-3':                 'Multi-Level Transmit 3: Three voltage levels (0, +V, -V). Cycles state on bit 1; stays same on bit 0. Used in FDDI/Fast Ethernet.',
  '2B1Q':                  '2 Binary 1 Quaternary: Pairs of bits map to four voltage levels (+3, +1, -1, -3). Used in ISDN BRI.',
  '8B/6T':                 '8 Binary 6 Ternary: Every 8 bits are encoded as 6 ternary symbols (-1, 0, +1). Reduces bandwidth compared to binary encoding.',
  '4D-PAM5':               '4-Dimensional 5-level PAM: Uses 5 voltage levels (-2, -1, 0, +1, +2) across 4 wire-pairs simultaneously. Used in Gigabit Ethernet (1000BASE-T).',
};
