import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Settings2, Info } from 'lucide-react';
import { generateWaveform, schemeDescriptions, SCHEMES } from './utils/encoding';
import type { EncodingScheme, EncodingCategory, Point } from './utils/encoding';

function App() {
  const [sequence, setSequence] = useState('10110000000010');
  const [scheme, setScheme] = useState<EncodingScheme>('B8ZS');
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSequenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^01]/g, '');
    setSequence(val);
  };

  const is2B1Q = scheme === '2B1Q';

  const points = useMemo(() => {
    if (!sequence) return [];
    return generateWaveform(sequence, scheme);
  }, [sequence, scheme]);

  // Determine drawing path
  const scaleX = 80; // pixels per bit
  const scaleY = is2B1Q ? 20 : 60; // amplitude
  const offsetX = 40;
  const offsetY = 120; // center of graph

  const pathData = useMemo(() => {
    if (points.length === 0) return '';
    let d = `M ${points[0].x * scaleX + offsetX} ${points[0].y * scaleY + offsetY} `;
    for (let i = 1; i < points.length; i++) {
        d += `L ${points[i].x * scaleX + offsetX} ${points[i].y * scaleY + offsetY} `;
    }
    return d;
  }, [points, scaleX, scaleY]);

  // Extract separate path for violations
  const violationPathData = useMemo(() => {
    if (points.length === 0) return '';
    let d = '';
    let trackingViolation = false;
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (p.isViolation) {
            if (!trackingViolation) {
                // start subpath
                d += `M ${p.x * scaleX + offsetX} ${p.y * scaleY + offsetY} `;
                trackingViolation = true;
            } else {
                d += `L ${p.x * scaleX + offsetX} ${p.y * scaleY + offsetY} `;
            }
        } else {
            trackingViolation = false;
        }
    }
    return d;
  }, [points, scaleX, scaleY]);

  // Labels for 2B1Q pairs
  const groupLabels = useMemo(() => {
    const labels: {x: number, text: string}[] = [];
    if (!is2B1Q || points.length === 0) return labels;
    for (let i = 0; i < points.length; i+=2) {
      if (points[i] && points[i].label) {
        labels.push({ x: (points[i].x + Math.min(sequence.length, points[i].x + 2)) / 2 * scaleX + offsetX, text: points[i].label! });
      }
    }
    return labels;
  }, [points, is2B1Q, sequence.length]);

  return (
    <div className="min-h-screen bg-background text-white p-6 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neon-purple/20 rounded-full blur-[120px] animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neon-blue/20 rounded-full blur-[120px] animate-blob" style={{ animationDelay: '2s' }} />
      </div>

      <header className="mb-10 text-center relative z-10 pt-8">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-sans font-bold mb-4 tracking-tight text-white"
        >
          Line Encoding <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple">Simulator</span>
        </motion.h1>
        <p className="text-gray-400 max-w-2xl mx-auto">Visualize digital signals, including B8ZS scrambling and 2B1Q multilevel.</p>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* Sidebar Controls */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-4 space-y-6"
        >
          <div className="glass-panel p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-neon-blue" /> Controls
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Binary Sequence</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={sequence}
                    onChange={handleSequenceChange}
                    className="w-full bg-surface/50 border border-border rounded-xl px-4 py-3 font-mono text-lg text-white focus:outline-none focus:border-neon-blue transition-colors"
                    placeholder="e.g. 1011001"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neon-purple font-mono bg-neon-purple/10 px-2 py-1 rounded">
                    {sequence.length} bits
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-3">Encoding Scheme</label>
                <div className="flex flex-col gap-4 overflow-y-auto max-h-[300px] pr-2">
                  {Object.entries(SCHEMES).map(([category, schemesArray]) => (
                    <div key={category}>
                      <h3 className="text-xs font-bold uppercase text-gray-500 mb-2">{category}</h3>
                      <div className="flex flex-col gap-2">
                        {schemesArray.map(s => (
                          <button
                            key={s}
                            onClick={() => setScheme(s as EncodingScheme)}
                            className={`px-4 py-2 rounded-xl text-left transition-all duration-300 relative overflow-hidden group border ${scheme === s ? 'bg-white/10 border-white/20' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                          >
                            {scheme === s && (
                              <motion.div layoutId="activeTab" className="absolute left-0 top-0 bottom-0 w-1 bg-neon-blue" />
                            )}
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

          <div className="glass-panel p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
              <Info className="w-5 h-5 text-neon-purple" /> {scheme}
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              {schemeDescriptions[scheme]}
            </p>
          </div>
        </motion.div>

        {/* Graph Area */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-8 glass-panel p-6 flex flex-col h-[600px]"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">Signal Waveform</h2>
            <div className="flex items-center gap-4">
              {violationPathData && <div className="text-xs text-orange-400 flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(255,165,0,0.8)]"></span> Violation Pulse</div>}
              {is2B1Q && <div className="text-xs text-gray-400">Values: +3V, +1V, -1V, -3V</div>}
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-neon-blue text-background hover:bg-white transition-colors shadow-neon-blue"
              >
                {isPlaying ? <Pause className="w-5 h-5 text-background" fill="currentColor"/> : <Play className="w-5 h-5 text-background" fill="currentColor"/>}
              </button>
            </div>
          </div>

          <div className="flex-1 relative border border-border/50 rounded-xl overflow-x-auto overflow-y-hidden bg-black/20" style={{ transform: "translateZ(0)" }}>
            {sequence && (
              <svg 
                className="min-w-full h-full pb-8"
                style={{ width: `${Math.max(100, (sequence.length * 80) + 80)}px` }}
              >
                <defs>
                  <linearGradient id="neonGradient" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00f3ff" />
                    <stop offset="1" stopColor="#b535fa" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <filter id="violationGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                {/* Grid lines and labels */}
                <g className="text-gray-500/30 text-xs font-mono">
                  {/* Amplitude Lines */}
                  {is2B1Q ? (
                    <>
                      <line x1="0" y1={120 - 3 * scaleY} x2="100%" y2={120 - 3 * scaleY} stroke="currentColor" strokeWidth="1" strokeDasharray="4" />
                      <text x="10" y={120 - 3 * scaleY - 5} fill="#9ca3af" className="text-gray-400">+3V</text>
                      <line x1="0" y1={120 - 1 * scaleY} x2="100%" y2={120 - 1 * scaleY} stroke="currentColor" strokeWidth="1" strokeDasharray="4" />
                      <text x="10" y={120 - 1 * scaleY - 5} fill="#9ca3af" className="text-gray-400">+1V</text>
                      <line x1="0" y1="120" x2="100%" y2="120" stroke="currentColor" strokeWidth="2" />
                      <text x="10" y="115" fill="#9ca3af" className="text-gray-400">0V</text>
                      <line x1="0" y1={120 + 1 * scaleY} x2="100%" y2={120 + 1 * scaleY} stroke="currentColor" strokeWidth="1" strokeDasharray="4" />
                      <text x="10" y={120 + 1 * scaleY - 5} fill="#9ca3af" className="text-gray-400">-1V</text>
                      <line x1="0" y1={120 + 3 * scaleY} x2="100%" y2={120 + 3 * scaleY} stroke="currentColor" strokeWidth="1" strokeDasharray="4" />
                      <text x="10" y={120 + 3 * scaleY - 5} fill="#9ca3af" className="text-gray-400">-3V</text>
                    </>
                  ) : (
                    <>
                      <line x1="0" y1={120 - scaleY} x2="100%" y2={120 - scaleY} stroke="currentColor" strokeWidth="1" strokeDasharray="4" />
                      <text x="10" y={120 - scaleY - 5} fill="#9ca3af" className="text-gray-400">+V</text>
                      
                      <line x1="0" y1="120" x2="100%" y2="120" stroke="currentColor" strokeWidth="2" />
                      <text x="10" y="115" fill="#9ca3af" className="text-gray-400">0V</text>
                      
                      <line x1="0" y1={120 + scaleY} x2="100%" y2={120 + scaleY} stroke="currentColor" strokeWidth="1" strokeDasharray="4" />
                      <text x="10" y={120 + scaleY - 5} fill="#9ca3af" className="text-gray-400">-V</text>
                    </>
                  )}

                  {/* Bit Separators */}
                  {is2B1Q ? (
                    <>
                      {groupLabels.map((lbl, i) => (
                        <g key={'group'+i}>
                           <line 
                              x1={i * 160 + 40} 
                              y1="20" 
                              x2={i * 160 + 40} 
                              y2="220" 
                              stroke="currentColor" 
                              strokeWidth="1" 
                              strokeDasharray="2" 
                            />
                           <text x={i * 160 + 120} y="30" fill="#cd9eff" className="font-bold text-center" textAnchor="middle">
                            {lbl.text}
                          </text>
                        </g>
                      ))}
                      <line 
                          x1={groupLabels.length * 160 + 40} 
                          y1="20" 
                          x2={groupLabels.length * 160 + 40} 
                          y2="220" 
                          stroke="currentColor" 
                          strokeWidth="1" 
                          strokeDasharray="2" 
                        />
                    </>
                  ) : (
                    <>
                      {sequence.split('').map((bit, i) => (
                        <g key={i}>
                          <line 
                            x1={i * 80 + 40} 
                            y1="20" 
                            x2={i * 80 + 40} 
                            y2="220" 
                            stroke="currentColor" 
                            strokeWidth="1" 
                            strokeDasharray="2" 
                          />
                          <text x={i * 80 + 80} y="30" fill="#9ca3af" className="font-bold text-center" textAnchor="middle">
                            {bit}
                          </text>
                        </g>
                      ))}
                      {/* Ending line for the last bit */}
                      <line 
                        x1={sequence.length * 80 + 40} 
                        y1="20" 
                        x2={sequence.length * 80 + 40} 
                        y2="220" 
                        stroke="currentColor" 
                        strokeWidth="1" 
                        strokeDasharray="2" 
                      />
                    </>
                  )}
                </g>

                {/* Animated Signal Path */}
                <motion.path
                  key={`base-${scheme}-${sequence}`}
                  d={pathData}
                  fill="none"
                  stroke="url(#neonGradient)"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  style={{ filter: "url(#glow)" }}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ 
                    duration: isPlaying ? sequence.length * 0.4 : 0.8, 
                    ease: "easeInOut" 
                  }}
                />

                {/* Overlaid Violation Path */}
                {violationPathData && (
                   <motion.path
                    key={`violation-${scheme}-${sequence}`}
                    d={violationPathData}
                    fill="none"
                    stroke="#FF8C00"
                    strokeWidth="5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{ filter: "url(#violationGlow)" }}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ 
                      duration: isPlaying ? sequence.length * 0.4 : 0.8, 
                      ease: "easeInOut" 
                    }}
                  />
                )}
              </svg>
            )}
            
            {!sequence && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 flex-col gap-4">
                <div className="w-16 h-16 rounded-full border-t-2 border-neon-blue animate-spin" />
                <p>Waiting for data stream...</p>
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default App;
