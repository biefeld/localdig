import { useState } from 'react'
import { apiUrl } from '../api.js'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'


const DEMO_STRESS_RESULTS = {
  results: [
    { hostname: 'www.anthropic.com',    status: 'resolved', port: 23001, ms: 3.1 },
    { hostname: 'api.github.com',        status: 'resolved', port: 9443,  ms: 2.9 },
    { hostname: 'www.discord.com',       status: 'resolved', port: 13001, ms: 3.4 },
    { hostname: 'www.spotify.com',       status: 'resolved', port: 14001, ms: 3.2 },
    { hostname: 'www.openai.com',        status: 'resolved', port: 22001, ms: 2.8 },
    { hostname: 'api.stripe.com',        status: 'resolved', port: 21002, ms: 3.5 },
    { hostname: 'www.vercel.com',        status: 'resolved', port: 18001, ms: 2.7 },
    { hostname: 'www.cloudflare.com',    status: 'resolved', port: 11500, ms: 3.0 },
    { hostname: 'www.notion.so',         status: 'resolved', port: 16001, ms: 3.3 },
    { hostname: 'www.twitch.tv',         status: 'resolved', port: 12001, ms: 2.6 },
    { hostname: 'api.netlify.com',       status: 'resolved', port: 19002, ms: 3.1 },
    { hostname: 'www.heroku.com',        status: 'resolved', port: 20001, ms: 2.9 },
    { hostname: 'www.reddit.com',        status: 'resolved', port: 10240, ms: 3.2 },
    { hostname: 'www.stackoverflow.com', status: 'resolved', port: 11300, ms: 3.0 },
    { hostname: 'api.figma.com',         status: 'resolved', port: 15002, ms: 2.8 },
    { hostname: 'www.linear.app',        status: 'resolved', port: 17001, ms: 3.4 },
    { hostname: 'www.huggingface.co',    status: 'resolved', port: 24001, ms: 2.7 },
    { hostname: 'api.openai.com',        status: 'resolved', port: 22002, ms: 3.1 },
    { hostname: 'www.minecraft.net',     status: 'resolved', port: 6391,  ms: 2.9 },
    { hostname: 'www.battle.net',        status: 'resolved', port: 12839, ms: 3.3 },
  ],
  summary: {
    total: 20, resolved: 20, nxdomain: 0, errors: 0,
    parallel_ms: 18.4,
    sequential_estimate_ms: 61.6,
    speedup: 3.35,
    avg_ms_per_lookup: 3.08,
  }
}


const StressTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-hi)', borderRadius: 'var(--radius)', padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 11 }}>
      <div style={{ color: 'var(--text-dim)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.value.toFixed(1)} ms</div>)}
    </div>
  )
}


export default function StressTab({ demoMode }) {
  const [count, setCount] = useState(20)
  const [running, setRunning] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const run = async () => {
    setRunning(true); setError(null); setData(null)
    if (demoMode) {
      await new Promise(r => setTimeout(r, 900))
      setData(DEMO_STRESS_RESULTS)
      setRunning(false)
      return
    }
    try {
      const r = await fetch(apiUrl('/api/stress/run'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: parseInt(count) }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail)
      setData(d)
    } catch (e) { setError(e.message) }
    finally { setRunning(false) }
  }

  const barData = data?.results.map(r => ({
    name: r.hostname.split('.').slice(-2).join('.'),
    ms: r.ms,
    status: r.status,
  }))

  const s = data?.summary

  return (
    <>
      <div style={{ marginBottom: 12, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7 }}>
        Fires <strong style={{ color: 'var(--text)' }}>N concurrent lookups</strong> via{' '}
        <code style={{ color: 'var(--teal)' }}>asyncio.gather</code> — all resolve in parallel
        across the multithreaded server infrastructure. Compare parallel wall time vs. estimated
        sequential time to see the threading speedup.
      </div>

      <div className="panel" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>concurrent lookups</label>
          <input type="number" value={count} onChange={e => setCount(e.target.value)}
            min="1" max="50" style={{ width: 80 }} />
        </div>
        <button className="btn btn-green" onClick={run} disabled={running || !count}>
          {running ? <><span className="spinning">↻</span> running...</> : '▶ run stress test'}
        </button>
      </div>

      {error && <div style={{ padding: '10px 14px', marginBottom: 16, background: 'var(--red-bg)', border: '1px solid #5c1e1e', borderRadius: 'var(--radius)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--red)' }}>{error}</div>}

      {s && (
        <>
          {/* summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'parallel time', value: `${s.parallel_ms} ms`, color: 'var(--green)' },
              { label: 'sequential est.', value: `${s.sequential_estimate_ms} ms`, color: 'var(--red)' },
              { label: 'speedup', value: `${s.speedup}x`, color: 'var(--amber)' },
              { label: 'resolved', value: `${s.resolved}/${s.total}`, color: 'var(--text)' },
            ].map(c => (
              <div key={c.label} className="panel" style={{ padding: '14px 16px' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 500, color: c.color, lineHeight: 1 }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* parallel vs sequential visual */}
          <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
            <h2 style={{ marginBottom: 12 }}>parallel vs. sequential</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'parallel (actual)', ms: s.parallel_ms, color: 'var(--green)', max: s.sequential_estimate_ms },
                { label: 'sequential (estimated)', ms: s.sequential_estimate_ms, color: 'var(--red)', max: s.sequential_estimate_ms },
              ].map(b => (
                <div key={b.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{b.label}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: b.color }}>{b.ms} ms</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border-hi)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${Math.round((b.ms / b.max) * 100)}%`,
                      background: b.color, borderRadius: 3,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* per-lookup bar chart */}
          <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
            <h2 style={{ marginBottom: 16 }}>per-lookup latency</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 40, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontFamily: 'IBM Plex Mono', fontSize: 9, fill: 'var(--text-dim)' }} angle={-45} textAnchor="end" interval={0} />
                <YAxis tick={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: 'var(--text-dim)' }} unit=" ms" />
                <Tooltip content={<StressTooltip />} />
                <Bar dataKey="ms" radius={[2, 2, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.status === 'resolved' ? 'var(--green)' : 'var(--red)'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* results table */}
          <div className="panel">
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}><h2>results</h2></div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['hostname', 'status', 'port', 'ms'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.results.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 11 }}>{r.hostname}</td>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: r.status === 'resolved' ? 'var(--green)' : 'var(--red)' }}>{r.status}</td>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{r.port ? `:${r.port}` : '—'}</td>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 11 }}>{r.ms > 0 ? `${r.ms} ms` : '—'}</td>
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