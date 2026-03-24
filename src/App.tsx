import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Settings2, Info, Table, Zap, BookOpen } from 'lucide-react';
import { generateWaveform, schemeDescriptions, SCHEMES } from './utils/encoding';
import type { EncodingScheme } from './utils/encoding';

// ─── Encoding Rules Tables ─────────────────────────────────────────────────────
const ENCODING_RULES: Record<EncodingScheme, { columns: string[]; rows: string[][] }> = {
  'Unipolar NRZ': {
    columns: ['Input Bit', 'Signal Level', 'Voltage'],
    rows: [
      ['0', 'Zero', '0V'],
      ['1', 'High', '+V'],
    ],
  },
  'NRZ-L': {
    columns: ['Input Bit', 'Signal Level', 'Voltage'],
    rows: [
      ['0', 'High', '+V'],
      ['1', 'Low', '-V'],
    ],
  },
  'NRZ-I': {
    columns: ['Input Bit', 'Rule', 'Signal Change'],
    rows: [
      ['0', 'No transition', 'Stay same'],
      ['1', 'Transition at start', 'Invert signal'],
    ],
  },
  'RZ': {
    columns: ['Input Bit', 'Condition', 'Voltage Trace'],
    rows: [
      ['0', 'Zero', '-V (Full Bit)'],
      ['1', 'Transitions', '+V (1st Half) → 0V (2nd Half)'],
    ],
  },
  'Manchester': {
    columns: ['Input Bit', 'First Half', 'Second Half'],
    rows: [
      ['0', '+V (High)', '-V (Low)'],
      ['1', '-V (Low)', '+V (High)'],
    ],
  },
  'Differential Manchester': {
    columns: ['Input Bit', 'Transition at Start?', 'Mid-bit Transition?'],
    rows: [
      ['0', 'Yes (invert)', 'Always Yes'],
      ['1', 'No (stay same)', 'Always Yes'],
    ],
  },
  'Bipolar AMI': {
    columns: ['Input Bit', 'Signal', 'Polarity'],
    rows: [
      ['0', '0V (Zero)', '—'],
      ['1 (first)', '+V', 'Positive'],
      ['1 (next)', '-V', 'Negative'],
      ['1 (next)', '+V', 'Alternates'],
    ],
  },
  'Pseudoternary': {
    columns: ['Input Bit', 'Signal', 'Polarity'],
    rows: [
      ['1', '0V (Zero)', '—'],
      ['0 (first)', '+V', 'Positive'],
      ['0 (next)', '-V', 'Negative'],
      ['0 (next)', '+V', 'Alternates'],
    ],
  },
  'B8ZS': {
    columns: ['Sequence', 'Replaced With', 'Purpose'],
    rows: [
      ['00000000', '000VB0VB', 'Break 8 zero run'],
      ['V pulse', 'Same polarity as last +/-', 'Violation (detectable)'],
      ['B pulse', 'Opposite of V', 'Balance bipolar rule'],
      ['0 (normal)', '0V', 'No change'],
      ['1 (normal)', 'Alternate +/-V', 'Standard AMI'],
    ],
  },
  'HDB3': {
    columns: ['Condition', 'Pattern', 'Substitution'],
    rows: [
      ['4 zeros, even 1s since last sub.', '0000', 'B00V'],
      ['4 zeros, odd 1s since last sub.', '0000', '000V'],
      ['V pulse', 'Same polarity as prev.', 'Violation pulse'],
      ['B pulse', 'Opposite of V', 'Balancing pulse'],
      ['Normal 0', '0V', 'No change'],
    ],
  },
  'MLT-3': {
    columns: ['Input Bit', 'Current State', 'Next State'],
    rows: [
      ['0', 'Any', 'Stay same'],
      ['1', '0', '+V or -V (alternate)'],
      ['1', '+V', '0'],
      ['1', '-V', '0'],
    ],
  },
  '2B1Q': {
    columns: ['Bit Pair', 'Quaternary Symbol', 'Voltage'],
    rows: [
      ['10', '+3', '+3V'],
      ['11', '+1', '+1V'],
      ['01', '-1', '-1V'],
      ['00', '-3', '-3V'],
    ],
  },
  '8B/6T': {
    columns: ['Binary Group', 'Ternary Symbols', 'Symbol Levels'],
    rows: [
      ['8 Bits', '6 Symbols', '+, -, 0'],
      ['DC Control', 'Combined Weight', 'Target weight = 0'],
    ],
  },
  '4D-PAM5': {
    columns: ['Bit Pair', 'Symbol', 'Voltage Level'],
    rows: [
      ['11', '+2', '+2V'],
      ['10', '+1', '+1V'],
      ['00', '-1', '-1V'],
      ['01', '-2', '-2V'],
      ['Error', '0', '0V'],
    ],
  },
};

// ─── Scheme Stats ────────────────────────────────────────────────────────────
const SCHEME_STATS: Record<EncodingScheme, { levels: string; bandwidth: string; dcBalance: string; selfSync: string }> = {
  'Unipolar NRZ':         { levels: '2', bandwidth: 'B = N/2', dcBalance: '❌ No', selfSync: '❌ No' },
  'NRZ-L':                { levels: '2', bandwidth: 'B = N/2', dcBalance: '❌ No', selfSync: '❌ No' },
  'NRZ-I':                { levels: '2', bandwidth: 'B = N/2', dcBalance: '❌ No', selfSync: '❌ No' },
  'RZ':                   { levels: '3', bandwidth: 'B = N',   dcBalance: '❌ No', selfSync: '✅ Yes' },
  'Manchester':           { levels: '2', bandwidth: 'B = N',   dcBalance: '✅ Yes', selfSync: '✅ Yes' },
  'Differential Manchester': { levels: '2', bandwidth: 'B = N', dcBalance: '✅ Yes', selfSync: '✅ Yes' },
  'Bipolar AMI':          { levels: '3', bandwidth: 'B = N/2', dcBalance: '✅ Yes', selfSync: '⚠️ Partial' },
  'Pseudoternary':        { levels: '3', bandwidth: 'B = N/2', dcBalance: '✅ Yes', selfSync: '⚠️ Partial' },
  'B8ZS':                 { levels: '3', bandwidth: 'B = N/2', dcBalance: '✅ Yes', selfSync: '✅ Yes' },
  'HDB3':                 { levels: '3', bandwidth: 'B = N/2', dcBalance: '✅ Yes', selfSync: '✅ Yes' },
  'MLT-3':                { levels: '3', bandwidth: 'B = N/3', dcBalance: '✅ Yes', selfSync: '⚠️ Partial' },
  '2B1Q':                 { levels: '4', bandwidth: 'B = N/4', dcBalance: '✅ Yes', selfSync: '⚠️ Partial' },
  '8B/6T':                { levels: '3', bandwidth: 'B = 3/4 N', dcBalance: '✅ Yes', selfSync: '✅ Yes' },
  '4D-PAM5':              { levels: '5', bandwidth: 'B = N/8', dcBalance: '✅ Yes', selfSync: '✅ Yes' },
};

function App() {
  const [sequence, setSequence] = useState('10110000000010');
  const [scheme, setScheme] = useState<EncodingScheme>('B8ZS');
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'breakdown'>('rules');

  const handleSequenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^01]/g, '');
    setSequence(val);
  };

  const is2B1Q = scheme === '2B1Q';
  const isMultilevel = ['2B1Q', '8B/6T', '4D-PAM5'].includes(scheme);

  const points = useMemo(() => {
    if (!sequence) return [];
    return generateWaveform(sequence, scheme);
  }, [sequence, scheme]);

  const scaleX = 80;
  const scaleY = isMultilevel ? 20 : 60;
  const offsetX = 40;
  const offsetY = 120;

  const pathData = useMemo(() => {
    if (points.length === 0) return '';
    let d = `M ${points[0].x * scaleX + offsetX} ${offsetY - points[0].y * scaleY} `;
    for (let i = 1; i < points.length; i++) {
      d += `L ${points[i].x * scaleX + offsetX} ${offsetY - points[i].y * scaleY} `;
    }
    return d;
  }, [points, scaleX, scaleY, offsetX, offsetY]);

  const violationPathData = useMemo(() => {
    if (points.length === 0) return '';
    let d = '';
    let tracking = false;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.isViolation) {
        if (!tracking) { d += `M ${p.x * scaleX + offsetX} ${offsetY - p.y * scaleY} `; tracking = true; }
        else d += `L ${p.x * scaleX + offsetX} ${offsetY - p.y * scaleY} `;
      } else { tracking = false; }
    }
    return d;
  }, [points, scaleX, scaleY, offsetX, offsetY]);

  const groupLabels = useMemo(() => {
    const labels: { x: number; text: string }[] = [];
    if (!isMultilevel || points.length === 0) return labels;
    for (let i = 0; i < points.length; i += (scheme === '8B/6T' ? 2 : 2)) {
      if (points[i]?.label) {
        labels.push({ x: (points[i].x + Math.min(sequence.length * 2, points[i].x + 2)) / 2 * scaleX + offsetX, text: points[i].label! });
      }
    }
    return labels;
  }, [points, isMultilevel, sequence.length, scaleX, scheme]);

  // Bit-by-bit breakdown
  const breakdown = useMemo(() => {
    if (!sequence) return [];
    const pts = generateWaveform(sequence, scheme);
    const rows: { bit: string; index: number; signal: string; isViolation?: boolean }[] = [];
    
    if (scheme === '2B1Q') {
      const padded = sequence.length % 2 === 0 ? sequence : sequence + '0';
      for (let i = 0; i < padded.length; i += 2) {
        const pair = padded.substring(i, i + 2);
        const map: Record<string, string> = { '10': '+3V', '11': '+1V', '01': '-1V', '00': '-3V' };
        rows.push({ bit: pair, index: i / 2 + 1, signal: map[pair] ?? '?' });
      }
    } else if (scheme === '4D-PAM5') {
        const padded = sequence.length % 2 === 0 ? sequence : sequence + '0';
        for (let i = 0; i < padded.length; i += 2) {
          const pair = padded.substring(i, i + 2);
          const map: Record<string, string> = { '00': '-2V', '01': '-1V', '10': '+1V', '11': '+2V' };
          rows.push({ bit: pair, index: i / 2 + 1, signal: map[pair] ?? '?' });
        }
    } else if (scheme === '8B/6T') {
        // Simplified breakdown for 8B/6T showing nibbles
        const padded = sequence.length % 4 !== 0 ? sequence + '0'.repeat(4 - sequence.length % 4) : sequence;
        for (let i = 0; i < padded.length; i += 4) {
          const nibble = padded.substring(i, i + 4);
          rows.push({ bit: nibble, index: i / 4 + 1, signal: 'Ternary' });
        }
    } else {
      // Find the signal level inside each bit period (offset slightly from start to avoid boundary points)
      sequence.split('').forEach((b, i) => {
        const periodPt = pts.find(p => p.x >= i && p.x < i + 1);
        if (periodPt) {
          const yMap: Record<number, string> = { 1: '+V', 0: '0V', '-1': '-V', 2: '+2V', '-2': '-2V', 3: '+3V', '-3': '-3V' };
          const v = periodPt.y;
          rows.push({ bit: b, index: i + 1, signal: yMap[v] ?? `${v > 0 ? '+' : ''}${v}V`, isViolation: periodPt.isViolation });
        }
      });
    }
    return rows;
  }, [sequence, scheme]);


  const rules = ENCODING_RULES[scheme];
  const stats = SCHEME_STATS[scheme];

  return (
    <div className="min-h-screen bg-background text-white p-4 lg:p-6 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neon-purple/20 rounded-full blur-[120px] animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neon-blue/20 rounded-full blur-[120px] animate-blob" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="mb-8 text-center relative z-10 pt-6">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-sans font-bold mb-3 tracking-tight"
        >
          Line Encoding <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple">Simulator</span>
        </motion.h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Interactive visualization of digital line encoding techniques — NRZ, Manchester, Scrambling &amp; Multilevel.
        </p>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">

        {/* ── Sidebar Controls ── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-4 space-y-5"
        >
          {/* Input + Scheme Selector */}
          <div className="glass-panel p-5">
            <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-neon-blue" /> Controls
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Binary Sequence</label>
                <div className="relative">
                  <input
                    type="text" value={sequence} onChange={handleSequenceChange}
                    className="w-full bg-surface/50 border border-border rounded-xl px-4 py-3 font-mono text-lg text-white focus:outline-none focus:border-neon-blue transition-colors"
                    placeholder="e.g. 10110010"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neon-purple font-mono bg-neon-purple/10 px-2 py-1 rounded">
                    {sequence.length} bits
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Encoding Scheme</label>
                <div className="flex flex-col gap-3 max-h-[280px] overflow-y-auto pr-1">
                  {Object.entries(SCHEMES).map(([category, schemesArr]) => (
                    <div key={category}>
                      <h3 className="text-xs font-bold uppercase text-gray-500 mb-1">{category}</h3>
                      <div className="flex flex-col gap-1">
                        {schemesArr.map(s => (
                          <button
                            key={s} onClick={() => setScheme(s as EncodingScheme)}
                            className={`px-3 py-2 rounded-xl text-left transition-all duration-300 relative overflow-hidden group border
                              ${scheme === s ? 'bg-white/10 border-white/20' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                          >
                            {scheme === s && <motion.div layoutId="activeTab" className="absolute left-0 top-0 bottom-0 w-1 bg-neon-blue" />}
                            <span className={`font-medium text-sm ${scheme === s ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>{s}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="glass-panel p-5">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-neon-purple" /> {scheme}
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">{schemeDescriptions[scheme]}</p>
          </div>

          {/* Stats Card */}
          <div className="glass-panel p-5">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-neon-green" /> Characteristics
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Signal Levels', value: stats.levels },
                { label: 'Bandwidth', value: stats.bandwidth },
                { label: 'DC Balance', value: stats.dcBalance },
                { label: 'Self-Clocking', value: stats.selfSync },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{label}</div>
                  <div className="text-sm font-semibold text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Right Column ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-8 space-y-5"
        >
          {/* Waveform Graph */}
          <div className="glass-panel p-5 flex flex-col" style={{ height: '340px' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Signal Waveform</h2>
              <div className="flex items-center gap-3">
                {violationPathData && (
                  <div className="text-xs text-orange-400 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(255,165,0,0.8)]" />
                    Violation Pulse
                  </div>
                )}
                {is2B1Q && <div className="text-xs text-gray-400 hidden sm:block">+3V / +1V / -1V / -3V</div>}
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-neon-blue hover:bg-white transition-colors shadow-neon-blue"
                >
                  {isPlaying ? <Pause className="w-4 h-4 text-background" fill="currentColor" /> : <Play className="w-4 h-4 text-background" fill="currentColor" />}
                </button>
              </div>
            </div>

            <div className="flex-1 relative border border-border/50 rounded-xl overflow-x-auto overflow-y-hidden bg-black/20">
              {sequence ? (
                <svg className="min-w-full h-full" style={{ width: `${Math.max(100, sequence.length * 80 + 80)}px` }}>
                  <defs>
                    <linearGradient id="neonGradient" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#00f3ff" /><stop offset="1" stopColor="#b535fa" />
                    </linearGradient>
                    <filter id="glow"><feGaussianBlur stdDeviation="4" result="coloredBlur" /><feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    <filter id="violationGlow"><feGaussianBlur stdDeviation="4" result="coloredBlur" /><feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                  </defs>

                  {/* Y-axis grid lines */}
                  <g className="text-gray-500/30 text-xs">
                    {scheme === '4D-PAM5' ? (
                      <>
                        {[2, 1, 0, -1, -2].map(v => (
                          <g key={v}>
                            <line x1="0" y1={offsetY - v * scaleY} x2="100%" y2={offsetY - v * scaleY} stroke="currentColor" strokeWidth={v === 0 ? 2 : 1} strokeDasharray={v === 0 ? '0' : '4'} />
                            <text x="8" y={offsetY - v * scaleY - 4} fill="#9ca3af" fontSize="11">{v > 0 ? `+${v}V` : v === 0 ? '0V' : `${v}V`}</text>
                          </g>
                        ))}
                      </>
                    ) : is2B1Q ? (
                      <>
                        {[3, 1, 0, -1, -3].map(v => (
                          <g key={v}>
                            <line x1="0" y1={offsetY - v * scaleY} x2="100%" y2={offsetY - v * scaleY} stroke="currentColor" strokeWidth={v === 0 ? 2 : 1} strokeDasharray={v === 0 ? '0' : '4'} />
                            <text x="8" y={offsetY - v * scaleY - 4} fill="#9ca3af" fontSize="11">{v > 0 ? `+${v}V` : v === 0 ? '0V' : `${v}V`}</text>
                          </g>
                        ))}
                      </>
                    ) : (
                      <>
                        <line x1="0" y1={offsetY - scaleY} x2="100%" y2={offsetY - scaleY} stroke="currentColor" strokeWidth="1" strokeDasharray="4" />
                        <text x="8" y={offsetY - scaleY - 4} fill="#9ca3af" fontSize="11">+V</text>
                        <line x1="0" y1={offsetY} x2="100%" y2={offsetY} stroke="currentColor" strokeWidth="2" />
                        <text x="8" y={offsetY - 4} fill="#9ca3af" fontSize="11">0V</text>
                        <line x1="0" y1={offsetY + scaleY} x2="100%" y2={offsetY + scaleY} stroke="currentColor" strokeWidth="1" strokeDasharray="4" />
                        <text x="8" y={offsetY + scaleY - 4} fill="#9ca3af" fontSize="11">-V</text>
                      </>
                    )}
                  </g>

                  {/* X-axis labels and separators */}
                  {is2B1Q ? (
                    groupLabels.map((lbl, i) => (
                      <g key={i}>
                        <line x1={i * 160 + 40} y1="15" x2={i * 160 + 40} y2="220" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2" />
                        <text x={i * 160 + 120} y="20" fill="#cd9eff" fontSize="12" fontWeight="bold" textAnchor="middle">{lbl.text}</text>
                      </g>
                    ))
                  ) : (
                    sequence.split('').map((bit, i) => (
                      <g key={i}>
                        <line x1={i * 80 + 40} y1="15" x2={i * 80 + 40} y2="220" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2" />
                        <text x={i * 80 + 80} y="20" fill="#9ca3af" fontSize="12" fontWeight="bold" textAnchor="middle">{bit}</text>
                      </g>
                    ))
                  )}
                  {/* End separator */}
                  <line x1={sequence.length * 80 + 40} y1="15" x2={sequence.length * 80 + 40} y2="220" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2" />

                  {/* Main waveform */}
                  <motion.path key={`${scheme}-${sequence}`} d={pathData} fill="none" stroke="url(#neonGradient)" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" style={{ filter: "url(#glow)" }} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: isPlaying ? sequence.length * 0.4 : 0.8, ease: "easeInOut" }} />
                  {/* Violation highlight */}
                  {violationPathData && (
                    <motion.path key={`v-${scheme}-${sequence}`} d={violationPathData} fill="none" stroke="#FF8C00" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" style={{ filter: "url(#violationGlow)" }} initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.8, ease: "easeInOut" }} />
                  )}
                </svg>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 flex-col gap-3">
                  <div className="w-12 h-12 rounded-full border-t-2 border-neon-blue animate-spin" />
                  <p>Enter binary sequence above...</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Tabs: Rules / Breakdown ── */}
          <div className="glass-panel p-5">
            <div className="flex gap-2 mb-5 border-b border-white/10 pb-4">
              <button
                onClick={() => setActiveTab('rules')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'rules' ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30' : 'text-gray-400 hover:text-white'}`}
              >
                <BookOpen className="w-4 h-4" /> Encoding Rules
              </button>
              <button
                onClick={() => setActiveTab('breakdown')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'breakdown' ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30' : 'text-gray-400 hover:text-white'}`}
              >
                <Table className="w-4 h-4" /> Bit-by-Bit Breakdown
              </button>
            </div>

            {activeTab === 'rules' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{scheme} — Encoding Rule Table</h3>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10">
                        {rules.columns.map(col => (
                          <th key={col} className="px-4 py-3 text-left text-xs font-bold uppercase text-neon-blue tracking-wider">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rules.rows.map((row, ri) => (
                        <tr key={ri} className={`border-b border-white/5 ${ri % 2 === 0 ? 'bg-white/[0.02]' : ''} hover:bg-white/5 transition-colors`}>
                          {row.map((cell, ci) => (
                            <td key={ci} className={`px-4 py-3 font-mono ${ci === 0 ? 'text-neon-purple font-bold' : 'text-gray-300'}`}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Quick tip */}
                <div className="mt-4 p-3 bg-neon-blue/5 border border-neon-blue/20 rounded-xl text-xs text-gray-400 leading-relaxed">
                  💡 <strong className="text-neon-blue">Try it:</strong> Enter <code className="bg-white/10 px-1 rounded">
                    {scheme === 'B8ZS' ? '10000000001' : scheme === 'HDB3' ? '100001' : scheme === '2B1Q' ? '10110001' : '101100'}
                  </code> above to see this scheme in action.
                </div>
              </motion.div>
            )}

            {activeTab === 'breakdown' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Sequence: <code className="text-neon-blue bg-white/5 px-2 py-0.5 rounded font-mono">{sequence || '—'}</code>
                </h3>
                <div className="overflow-x-auto rounded-xl border border-white/10 max-h-64">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className="bg-surface border-b border-white/10">
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-neon-purple tracking-wider">{is2B1Q ? 'Pair #' : 'Bit #'}</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-neon-purple tracking-wider">{is2B1Q ? 'Bit Pair' : 'Input Bit'}</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-neon-purple tracking-wider">Output Signal</th>
                        {(scheme === 'B8ZS' || scheme === 'HDB3') && <th className="px-4 py-3 text-left text-xs font-bold uppercase text-neon-purple tracking-wider">Flag</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown.map((row, ri) => (
                        <tr key={ri} className={`border-b border-white/5 ${ri % 2 === 0 ? 'bg-white/[0.02]' : ''} hover:bg-white/5 transition-colors ${row.isViolation ? 'bg-orange-500/10' : ''}`}>
                          <td className="px-4 py-2 text-gray-500 font-mono">{row.index}</td>
                          <td className="px-4 py-2 text-neon-blue font-mono font-bold">{row.bit}</td>
                          <td className="px-4 py-2 font-mono text-white">{row.signal}</td>
                          {(scheme === 'B8ZS' || scheme === 'HDB3') && (
                            <td className="px-4 py-2">
                              {row.isViolation && <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">⚡ Violation</span>}
                            </td>
                          )}
                        </tr>
                      ))}
                      {breakdown.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Enter a binary sequence to see the breakdown</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </div>

          {/* ── Footer Info Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Bits Entered', value: sequence.length, color: 'text-neon-blue' },
              { label: 'Ones Count', value: sequence.split('').filter(b => b === '1').length, color: 'text-neon-purple' },
              { label: 'Zeros Count', value: sequence.split('').filter(b => b === '0').length, color: 'text-neon-green' },
              { label: 'Signal Points', value: points.length, color: 'text-neon-pink' },
            ].map(({ label, value, color }) => (
              <div key={label} className="glass-panel p-4 text-center">
                <div className={`text-3xl font-bold font-mono ${color}`}>{value}</div>
                <div className="text-xs text-gray-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default App;
