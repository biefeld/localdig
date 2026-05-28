import { useState } from 'react'
import { wsUrl } from '../api.js'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const DEMO_BENCHMARK_RESULTS = [
  { repeat: 1,  queries: 10,  without_cache_ms_per: 1.78, with_cache_ms_per: 1.87, speedup: 0.95 },
  { repeat: 5,  queries: 50,  without_cache_ms_per: 1.87, with_cache_ms_per: 0.47, speedup: 3.96 },
  { repeat: 10, queries: 100, without_cache_ms_per: 1.71, with_cache_ms_per: 0.28, speedup: 6.20 },
  { repeat: 15, queries: 150, without_cache_ms_per: 1.87, with_cache_ms_per: 0.20, speedup: 9.55 },
]

const BenchTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-hi)', borderRadius: 'var(--radius)', padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 11 }}>
      <div style={{ color: 'var(--text-dim)', marginBottom: 4 }}>{label} lookups/hostname</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: {p.value.toFixed(2)} ms/q</div>)}
    </div>
  )
}

export default function BenchmarkTab({ demoMode, onBenchmarkStart, onBenchmarkEnd }) {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState(null)
  const [currentPhase, setCurrentPhase] = useState(null)
  const [error, setError] = useState(null)

  const run = async () => {
    setRunning(true); setError(null); setResults(null); setCurrentPhase(null)

    if (demoMode) {
      for (const r of DEMO_BENCHMARK_RESULTS) {
        setCurrentPhase(r.repeat)
        await new Promise(res => setTimeout(res, 900))
        setResults(prev => [...(prev || []), r])
      }
      setCurrentPhase(null)
      setRunning(false)
      return
    }

    onBenchmarkStart?.()
    const collected = []
    try {
      const ws = new WebSocket(wsUrl('/ws/benchmark'))
      await new Promise((resolve, reject) => {
        ws.onopen = () => ws.send(JSON.stringify({ action: 'start' }))
        ws.onmessage = e => {
          const msg = JSON.parse(e.data)
          if (msg.event === 'phase_start') {
            setCurrentPhase(msg.repeat)
          } else if (msg.event === 'phase_done') {
            collected.push(msg.result)
            setResults([...collected])
            setCurrentPhase(null)
          } else if (msg.event === 'complete') {
            ws.close()
            resolve()
          } else if (msg.event === 'error') {
            ws.close()
            reject(new Error(msg.message))
          }
        }
        ws.onerror = () => reject(new Error('WebSocket connection failed'))
        ws.onclose = e => { if (e.code !== 1000) resolve() }
      })
    } catch (e) { setError(e.message) }
    finally { setRunning(false); setCurrentPhase(null); onBenchmarkEnd?.() }
  }

  const chartData = results?.map(r => ({
    queries: r.repeat,
    'no cache': parseFloat(r.without_cache_ms_per?.toFixed(3) ?? 0),
    'with cache': parseFloat(r.with_cache_ms_per?.toFixed(3) ?? 0),
  }))
  const maxSpeedup = results ? Math.max(...results.map(r => r.speedup || 1)) : null

  return (
    <>
      <div className="panel" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn btn-green" onClick={run} disabled={running}>
          {running ? <><span className="spinning">↻</span> running...</> : '▶ run benchmark'}
        </button>
        {running && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
            {currentPhase ? `running ${currentPhase} lookups/hostname...` : 'starting...'}
          </span>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 16, background: 'var(--red-bg)', border: '1px solid #5c1e1e', borderRadius: 'var(--radius)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {results && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'volumes tested', value: results.length },
              { label: 'max lookups/hostname', value: results.at(-1)?.repeat },
              { label: 'peak speedup', value: maxSpeedup ? `${maxSpeedup.toFixed(2)}x` : '—' },
            ].map(c => (
              <div key={c.label} className="panel" style={{ padding: '14px 16px' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 500, color: 'var(--green)', lineHeight: 1 }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
            <h2 style={{ marginBottom: 16 }}>ms / query vs. lookups per hostname</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="queries" tick={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: 'var(--text-dim)' }} />
                <YAxis tick={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: 'var(--text-dim)' }} />
                <Tooltip content={<BenchTooltip />} />
                <Legend wrapperStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }} />
                <Line type="monotone" dataKey="no cache" stroke="var(--red)" strokeWidth={1.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="with cache" stroke="var(--green)" strokeWidth={1.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="panel">
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}><h2>raw results</h2></div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['lookups/hostname', 'no cache (ms/q)', 'with cache (ms/q)', 'speedup'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 12 }}>{r.repeat}</td>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--red)' }}>{r.without_cache_ms_per?.toFixed(3)}</td>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--green)' }}>{r.with_cache_ms_per?.toFixed(3)}</td>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: r.speedup > 2 ? 'var(--amber)' : 'var(--text)' }}>{r.speedup?.toFixed(2)}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}