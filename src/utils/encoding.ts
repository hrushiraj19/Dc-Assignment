export type EncodingCategory = 'Basic' | 'Scrambling' | 'Multilevel';

export const SCHEMES = {
  Basic: ['NRZ-L', 'NRZ-I', 'Manchester', 'Differential Manchester', 'Bipolar AMI'],
  Scrambling: ['B8ZS', 'HDB3'],
  Multilevel: ['MLT-3', '2B1Q']
} as const;

export type BasicScheme = typeof SCHEMES.Basic[number];
export type ScramblingScheme = typeof SCHEMES.Scrambling[number];
export type MultilevelScheme = typeof SCHEMES.Multilevel[number];

export type EncodingScheme = BasicScheme | ScramblingScheme | MultilevelScheme;

export interface Point {
  x: number;
  y: number; // For visualization, +3, +1, 0, -1, -3
  isViolation?: boolean; // Highlight scrambling violations
  label?: string; // Optional metadata like pairs for 2B1Q
}

export const generateWaveform = (bits: string, scheme: EncodingScheme): Point[] => {
  const points: Point[] = [];
  
  if (!bits) return points;

  // Trackers
  let currentLevel = -1; // General binary tracker for NRZ-I
  let lastAMIPolarity = -1; // AMI state

  // MLT-3 Trackers
  let mltLevel = 0;
  let lastMltNonZero = -1;

  switch (scheme) {
    case 'NRZ-L':
    case 'NRZ-I':
    case 'Manchester':
    case 'Differential Manchester':
    case 'Bipolar AMI':
      // Existing Basic Logic
      bits.split('').forEach((bitStr, i) => {
        const bit = parseInt(bitStr, 10);
        const startX = i;
        const midX = i + 0.5;
        const endX = i + 1;

        if (scheme === 'NRZ-L') {
          const y = bit === 0 ? 1 : -1;
          points.push({ x: startX, y }, { x: endX, y });
        } else if (scheme === 'NRZ-I') {
          if (bit === 1) currentLevel = currentLevel === 1 ? -1 : 1;
          points.push({ x: startX, y: currentLevel }, { x: endX, y: currentLevel });
        } else if (scheme === 'Manchester') {
          if (bit === 0) {
            points.push({ x: startX, y: 1 }, { x: midX, y: 1 });
            points.push({ x: midX, y: -1 }, { x: endX, y: -1 });
          } else {
            points.push({ x: startX, y: -1 }, { x: midX, y: -1 });
            points.push({ x: midX, y: 1 }, { x: endX, y: 1 });
          }
        } else if (scheme === 'Differential Manchester') {
          if (bit === 0) currentLevel = currentLevel === 1 ? -1 : 1;
          points.push({ x: startX, y: currentLevel }, { x: midX, y: currentLevel });
          currentLevel = currentLevel === 1 ? -1 : 1;
          points.push({ x: midX, y: currentLevel }, { x: endX, y: currentLevel });
        } else if (scheme === 'Bipolar AMI') {
          if (bit === 0) {
            points.push({ x: startX, y: 0 }, { x: endX, y: 0 });
          } else {
            lastAMIPolarity = lastAMIPolarity === 1 ? -1 : 1;
            points.push({ x: startX, y: lastAMIPolarity }, { x: endX, y: lastAMIPolarity });
          }
        }
      });
      break;

    case 'B8ZS':
      // Bipolar with 8-Zero Substitution
      let b8i = 0;
      while (b8i < bits.length) {
        // Look ahead for 8 zeros
        if (b8i + 8 <= bits.length && bits.substring(b8i, b8i + 8) === '00000000') {
          // Substitute with 000VB0VB
          // V = same polarity, B = opposite polarity
          for (let j = 0; j < 8; j++) {
            const startX = b8i + j;
            const endX = b8i + j + 1;
            
            if (j === 3 || j === 6) { // V pulses
              const y = lastAMIPolarity; // Same polarity violation
              points.push({ x: startX, y, isViolation: true }, { x: endX, y, isViolation: true });
            } else if (j === 4 || j === 7) { // B pulses
              lastAMIPolarity = lastAMIPolarity === 1 ? -1 : 1; // Standard bipolar
              const y = lastAMIPolarity;
              points.push({ x: startX, y, isViolation: true }, { x: endX, y, isViolation: true });
            } else { // Zeros
              points.push({ x: startX, y: 0 }, { x: endX, y: 0 });
            }
          }
          b8i += 8;
        } else {
          // Normal AMI
          const bit = parseInt(bits[b8i], 10);
          const startX = b8i;
          const endX = b8i + 1;
          
          if (bit === 0) {
            points.push({ x: startX, y: 0 }, { x: endX, y: 0 });
          } else {
            lastAMIPolarity = lastAMIPolarity === 1 ? -1 : 1;
            points.push({ x: startX, y: lastAMIPolarity }, { x: endX, y: lastAMIPolarity });
          }
          b8i++;
        }
      }
      break;

    case 'HDB3':
      // High-Density Bipolar 3 Zeros
      let hdBi = 0;
      let nonZeroCount = 0; // count since last substitution
      
      while (hdBi < bits.length) {
        if (hdBi + 4 <= bits.length && bits.substring(hdBi, hdBi + 4) === '0000') {
          // Substitute with 4 pulses
          // If nonZeroCount is odd: 000V. If even: B00V
          let isEven = nonZeroCount % 2 === 0;
          
          if (isEven) { // Insert B00V
            // B pulse
            lastAMIPolarity = lastAMIPolarity === 1 ? -1 : 1;
            points.push({ x: hdBi, y: lastAMIPolarity, isViolation: true }, { x: hdBi + 1, y: lastAMIPolarity, isViolation: true });
            // Two Zeros
            points.push({ x: hdBi + 1, y: 0 }, { x: hdBi + 2, y: 0 });
            points.push({ x: hdBi + 2, y: 0 }, { x: hdBi + 3, y: 0 });
            // V pulse (same polarity as last B)
            points.push({ x: hdBi + 3, y: lastAMIPolarity, isViolation: true }, { x: hdBi + 4, y: lastAMIPolarity, isViolation: true });
          } else { // Insert 000V
            // Three zeros
            points.push({ x: hdBi, y: 0 }, { x: hdBi + 1, y: 0 });
            points.push({ x: hdBi + 1, y: 0 }, { x: hdBi + 2, y: 0 });
            points.push({ x: hdBi + 2, y: 0 }, { x: hdBi + 3, y: 0 });
            // V pulse
            points.push({ x: hdBi + 3, y: lastAMIPolarity, isViolation: true }, { x: hdBi + 4, y: lastAMIPolarity, isViolation: true });
          }
          hdBi += 4;
          nonZeroCount = 0; // Reset after substitution
        } else {
          // Normal AMI
          const bit = parseInt(bits[hdBi], 10);
          const startX = hdBi;
          const endX = hdBi + 1;
          if (bit === 0) {
            points.push({ x: startX, y: 0 }, { x: endX, y: 0 });
          } else {
            lastAMIPolarity = lastAMIPolarity === 1 ? -1 : 1;
            points.push({ x: startX, y: lastAMIPolarity }, { x: endX, y: lastAMIPolarity });
            nonZeroCount++;
          }
          hdBi++;
        }
      }
      break;

    case 'MLT-3':
      // Multilevel Transmit (transitions on 1, 0 -> +V -> 0 -> -V)
      // States tracked above loop
      for (let i = 0; i < bits.length; i++) {
        const bit = parseInt(bits[i], 10);
        const startX = i;
        const endX = i + 1;
        
        if (bit === 1) {
          if (mltLevel !== 0) {
            mltLevel = 0;
          } else {
            mltLevel = -lastMltNonZero;
            lastMltNonZero = mltLevel;
          }
        }
        points.push({ x: startX, y: mltLevel }, { x: endX, y: mltLevel });
      }
      break;

    case '2B1Q':
      // Groups of 2 bits to 4 levels (-3, -1, 1, 3)
      let paddedBits = bits;
      if (paddedBits.length % 2 !== 0) paddedBits += '0'; // Pad if odd
      
      for (let i = 0; i < paddedBits.length; i += 2) {
        const pair = paddedBits.substring(i, i + 2);
        const startX = i;
        const endX = i + 2; // Stretches across two bit periods visually!
        
        let y = 0;
        if (pair === '10') y = 3;
        else if (pair === '11') y = 1;
        else if (pair === '01') y = -1;
        else if (pair === '00') y = -3;
        
        points.push({ x: startX, y, label: pair }, { x: endX, y, label: pair });
      }
      break;
  }

  return points;
};

export const schemeDescriptions: Record<EncodingScheme, string> = {
  'NRZ-L': 'Non-Return to Zero Level: Positive voltage representing 0 and negative voltage representing 1.',
  'NRZ-I': 'Non-Return to Zero Invert: Transition on bit interval represents 1, no transition represents 0.',
  'Manchester': 'Manchester Encoding: Transition at middle of interval. High-to-low is 0, low-to-high is 1.',
  'Differential Manchester': 'Differential Manchester: Middle transition always. Initial transition is 0, no initial transition is 1.',
  'Bipolar AMI': 'Alternate Mark Inversion: 0 is zero voltage. 1 alternates between positive and negative voltages.',
  'B8ZS': 'Bipolar with 8-Zero Substitution: Scrambling technique used to maintain synchronization. Sequences of eight 0s are replaced by 000VB0VB.',
  'HDB3': 'High-Density Bipolar 3 Zeros: Similar to B8ZS but used primarily in Europe. Replaces four consecutive zeros with B00V or 000V to ensure DC balance.',
  'MLT-3': 'Multi-Level Transmit: Uses three voltage levels. Transitions state on a 1 (0 -> +V -> 0 -> -V -> 0), stays same on a 0.',
  '2B1Q': '2 Binary 1 Quaternary: Encodes pairs of bits (2 Binary) into a single four-level (1 Quaternary) signal pulse (+3, +1, -1, -3).'
};
