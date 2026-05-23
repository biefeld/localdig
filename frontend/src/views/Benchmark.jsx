import { useState } from 'react'
import { apiUrl } from '../api.js'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-panel)', border: '1px solid var(--border-hi)',
      borderRadius: 'var(--radius)', padding: '8px 12px',
      fontFamily: 'var(--mono)', fontSize: 11,
    }}>
      <div style={{ color: 'var(--text-dim)', marginBottom: 4 }}>{label} queries</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {p.value.toFixed(2)} ms/query
        </div>
      ))}
    </div>
  )
}

export default function Benchmark({ infra }) {
  const [masterConf, setMasterConf] = useState('./master.conf')
  const [running, setRunning]   = useState(false)
  const [results, setResults]   = useState(null)
  const [error, setError]       = useState(null)

  const run = async () => {
    setRunning(true)
    setError(null)
    setResults(null)
    try {
      const r = await fetch(apiUrl('/api/benchmark/run'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ master_conf: masterConf }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail)
      setResults(d.results)
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  const chartData = results?.map(r => ({
    queries: r.queries,
    'no cache': parseFloat(r.without_cache_ms_per?.toFixed(3) ?? 0),
    'with cache': parseFloat(r.with_cache_ms_per?.toFixed(3) ?? 0),
  }))

  const maxSpeedup = results ? Math.max(...results.map(r => r.speedup || 1)) : null

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>benchmark</h1>
        <p style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 11 }}>
          caching vs. non-caching lookup performance across query volumes
        </p>
      </div>

      <div className="panel" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
            master.conf path
          </label>
          <input type="text" value={masterConf} onChange={e => setMasterConf(e.target.value)}
            placeholder="./master.conf" style={{ width: '100%' }} />
        </div>
        <button className="btn btn-green" onClick={run}
          disabled={running || !masterConf}>
          {running ? <><span className="spinning">↻</span> running...</> : '▶ run benchmark'}
        </button>
        {running && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
            this may take ~30s
          </span>
        )}
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', marginBottom: 16,
          background: 'var(--red-bg)', border: '1px solid #5c1e1e',
          borderRadius: 'var(--radius)',
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--red)',
        }}>{error}</div>
      )}

      {results && (
        <>
          {/* summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'query volumes tested', value: results.length },
              { label: 'max queries tested', value: results.at(-1)?.queries?.toLocaleString() },
              { label: 'peak speedup', value: maxSpeedup ? `${maxSpeedup.toFixed(2)}x` : '—' },
            ].map(c => (
              <div key={c.label} className="panel" style={{ padding: '14px 16px' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  {c.label}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 500, color: 'var(--green)', lineHeight: 1 }}>
                  {c.value}
                </div>
              </div>
            ))}
          </div>

          {/* chart */}
          <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
            <h2 style={{ marginBottom: 16 }}>ms / query vs. query volume</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="queries"
                  tick={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: 'var(--text-dim)' }}
                  label={{ value: 'queries', position: 'insideBottom', offset: -2, fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'IBM Plex Mono' }} />
                <YAxis
                  tick={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: 'var(--text-dim)' }}
                  label={{ value: 'ms/query', angle: -90, position: 'insideLeft', fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'IBM Plex Mono' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-dim)' }} />
                <Line type="monotone" dataKey="no cache" stroke="var(--red)" strokeWidth={1.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="with cache" stroke="var(--green)" strokeWidth={1.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* results table */}
          <div className="panel">
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <h2>raw results</h2>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['queries', 'no cache (ms/q)', 'with cache (ms/q)', 'speedup'].map(h => (
                    <th key={h} style={{
                      padding: '8px 14px', textAlign: 'left',
                      fontFamily: 'var(--mono)', fontSize: 10,
                      color: 'var(--text-dim)', textTransform: 'uppercase',
                      letterSpacing: '0.06em', fontWeight: 400,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 12 }}>{r.queries?.toLocaleString()}</td>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--red)' }}>{r.without_cache_ms_per?.toFixed(3)}</td>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--green)' }}>{r.with_cache_ms_per?.toFixed(3)}</td>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: r.speedup > 2 ? 'var(--amber)' : 'var(--text)' }}>
                      {r.speedup?.toFixed(2)}x
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}