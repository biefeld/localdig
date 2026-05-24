import { useState } from 'react'
import { apiUrl } from '../api.js'
import BenchmarkTab from '../components/BenchmarkTab.jsx'
import StressTab from '../components/StressTab.jsx'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'

export default function Benchmark({ infra, demoMode }) {
  const [tab, setTab] = useState('benchmark')

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 4 }}>benchmark</h1>
        <p style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 11 }}>
          performance analysis tools
        </p>
      </div>

      {/* tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'benchmark', label: 'cache benchmark' },
          { id: 'stress',    label: 'stress test' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px',
            background: 'transparent', border: 'none',
            borderBottom: tab === t.id ? '2px solid var(--green)' : '2px solid transparent',
            marginBottom: -1,
            color: tab === t.id ? 'var(--text)' : 'var(--text-dim)',
            fontFamily: 'var(--mono)', fontSize: 12,
            cursor: 'pointer', transition: 'color 0.1s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'benchmark' && <BenchmarkTab demoMode={demoMode} />}
      {tab === 'stress'    && <StressTab demoMode={demoMode} />}
    </div>
  )
}