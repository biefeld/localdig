import { useState, useRef, useEffect } from 'react'
import { apiUrl, wsUrl } from '../api.js'

const STEP_META = {
  root:      { tag: 'root',  label: 'root server',          color: '#a78bfa' },
  tld:       { tag: 'tld',   label: 'tld server',           color: 'var(--green)' },
  auth:      { tag: 'auth',  label: 'authoritative server', color: 'var(--amber)' },
  resolved:  { tag: null,    label: 'resolved',             color: 'var(--green)' },
  cache_hit: { tag: 'cache', label: 'cache hit',            color: 'var(--teal)' },
  nxdomain:  { tag: 'error', label: 'nxdomain',             color: 'var(--red)' },
  error:     { tag: 'error', label: 'error',                color: 'var(--red)' },
}

const TTL = 5

function CachePanel({ onSelect, refreshTick }) {
  const [entries, setEntries] = useState([])
  const [ttl, setTtl] = useState(30)

  const fetchEntries = () => {
    fetch(apiUrl('/api/cache/entries'))
      .then(r => r.json())
      .then(d => { setEntries(d.entries || []); setTtl(d.ttl || 30) })
      .catch(() => {})
  }

  // poll every second + re-fetch whenever a new lookup completes (refreshTick)
  useEffect(() => {
    fetchEntries()
    const id = setInterval(fetchEntries, 1000)
    return () => clearInterval(id)
  }, [refreshTick])

  const evict = async (hostname, e) => {
    e.stopPropagation()
    await fetch(apiUrl(`/api/cache/entries/${encodeURIComponent(hostname)}`), { method: 'DELETE' })
    fetchEntries()
  }

  const clearAll = async () => {
    await fetch(apiUrl('/api/cache/entries'), { method: 'DELETE' })
    fetchEntries()
  }

  return (
    <div className="panel" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2>cache</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-hint)' }}>
            ttl {ttl}s
          </span>
          {entries.length > 0 && (
            <button className="btn" onClick={clearAll}
              style={{ fontSize: 10, padding: '2px 7px', color: 'var(--text-dim)' }}>
              clear
            </button>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div style={{ color: 'var(--text-hint)', fontFamily: 'var(--mono)', fontSize: 11 }}>
          no entries
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[...entries].sort((a, b) => a.remaining_s - b.remaining_s).map((e, i) => {
            const pct = Math.max(0, e.remaining_s / ttl)
            const barColor = pct > 0.5 ? 'var(--green)' : pct > 0.2 ? 'var(--amber)' : 'var(--red)'
            return (
              <div key={e.hostname} className="animate-in" style={{
                padding: '7px 0',
                borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                opacity: e.remaining_s < 1 ? 0.4 : 1,
                transition: 'opacity 0.3s',
              }} onClick={() => onSelect(e.hostname)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)' }}>
                    {e.hostname}
                  </span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--green)' }}>
                      :{e.port}
                    </span>
                    <span onClick={ev => evict(e.hostname, ev)}
                      style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-hint)', cursor: 'pointer' }}
                      onMouseEnter={ev => ev.target.style.color='var(--red)'}
                      onMouseLeave={ev => ev.target.style.color='var(--text-hint)'}>
                      ✕
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 2, background: 'var(--border-hi)', borderRadius: 1, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.round(pct * 100)}%`,
                      background: barColor,
                      transition: 'width 1s linear, background 0.3s',
                      borderRadius: 1,
                    }} />
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', minWidth: 28, textAlign: 'right' }}>
                    {e.remaining_s.toFixed(1)}s
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Lookup({ infra, history, setHistory, initialHostname, clearInitialHostname }) {
  const [hostname, setHostname] = useState('')
  const [steps, setSteps] = useState([])
  const [resolving, setResolving] = useState(false)
  const [cacheRefreshTick, setCacheRefreshTick] = useState(0)
  const wsRef = useRef(null)
  const pendingRef = useRef(null)

  // keep pendingRef in sync with initialHostname
  useEffect(() => {
    if (initialHostname) pendingRef.current = initialHostname
  }, [initialHostname])

  const fireResolve = (ws, h) => {
    setHostname(h)
    setSteps([])
    setResolving(true)
    ws.send(JSON.stringify({ hostname: h }))
    clearInitialHostname?.()
    pendingRef.current = null
  }

  useEffect(() => {
    const ws = new WebSocket(wsUrl('/ws/lookup'))
    ws.onopen = () => {
      if (pendingRef.current) fireResolve(ws, pendingRef.current)
    }
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      setSteps(prev => [...prev, { ...msg, ts: Date.now() }])
      if (msg.step === 'resolved' || msg.step === 'cache_hit' || msg.step === 'nxdomain' || msg.step === 'error') {
        setResolving(false)
        if (msg.step === 'resolved' || msg.step === 'cache_hit') {
          setCacheRefreshTick(t => t + 1)
          const ms = msg.step === 'cache_hit' ? null : msg.total_ms
          setHistory(h => [{ hostname: msg.hostname, port: msg.port, ms, cached: msg.step === 'cache_hit', ts: Date.now() }, ...h.filter(e => e.hostname !== msg.hostname).slice(0, 18)])
        }
      }
    }
    wsRef.current = ws
    return () => ws.close()
  }, [])

  const resolve = () => {
    if (!hostname.trim() || resolving || !infra.running) return
    setSteps([])
    setResolving(true)
    wsRef.current?.send(JSON.stringify({ hostname: hostname.trim() }))
  }

  const onKey = (e) => { if (e.key === 'Enter') resolve() }

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>dns lookup</h1>
        <p style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 11 }}>
          real-time resolution trace over tcp
        </p>
      </div>

      {!infra.running && (
        <div style={{
          padding: '10px 14px', marginBottom: 16,
          background: 'var(--amber-bg)', border: '1px solid #78400a',
          borderRadius: 'var(--radius)',
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--amber)',
        }}>
          ⚠ infrastructure not running — launch from dashboard
        </div>
      )}

      {/* input */}
      <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-dim)', fontSize: 13 }}>$</span>
          <input
            type="text"
            value={hostname}
            onChange={e => setHostname(e.target.value)}
            onKeyDown={onKey}
            placeholder="www.minecraft.net"
            disabled={!infra.running}
            style={{ flex: 1 }}
          />
          <button className="btn btn-green" onClick={resolve}
            disabled={!infra.running || resolving || !hostname.trim()}>
            {resolving ? <><span className="spinning">↻</span> resolving</> : 'resolve →'}
          </button>
        </div>
      </div>

      {/* three column layout: trace | cache | history */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 200px', gap: 16 }}>

        {/* trace */}
        <div className="panel" style={{ padding: 16, minHeight: 240 }}>
          <h2 style={{ marginBottom: 14 }}>resolution trace</h2>

          {steps.length === 0 && !resolving && (
            <div style={{ color: 'var(--text-hint)', fontFamily: 'var(--mono)', fontSize: 12, paddingTop: 8 }}>
              waiting for query...
            </div>
          )}

          {steps.map((s, i) => {
            const meta = STEP_META[s.step] || STEP_META.error
            return (
              <div key={i} className="animate-in" style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                paddingBottom: 12, marginBottom: 12,
                borderBottom: i < steps.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: meta.color, flexShrink: 0,
                    boxShadow: `0 0 6px ${meta.color}`,
                  }} />
                  {i < steps.length - 1 && (
                    <div style={{ width: 1, flex: 1, minHeight: 20, background: 'var(--border)', marginTop: 3 }} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    {meta.tag && <span className={`tag tag-${meta.tag}`}>{meta.tag}</span>}
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: meta.color }}>
                      {meta.label}
                    </span>
                    {s.port && (
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                        :{s.port}
                      </span>
                    )}
                    {s.ms != null
                      ? <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)' }}>{s.ms} ms</span>
                      : s.step === 'cache_hit' && <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--teal)' }}>cached</span>
                    }
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                    {s.step === 'root' && <>query: <span style={{ color: 'var(--text)' }}>{s.query}</span> → :{s.result_port}</>}
                    {s.step === 'tld'  && <>query: <span style={{ color: 'var(--text)' }}>{s.query}</span> → :{s.result_port}</>}
                    {s.step === 'auth' && <>query: <span style={{ color: 'var(--text)' }}>{s.query}</span> → :{s.result_port}</>}
                    {s.step === 'resolved' && (
                      <span style={{ color: 'var(--green)' }}>
                        ✓ {s.hostname} → port {s.port} ({s.total_ms} ms total)
                      </span>
                    )}
                    {s.step === 'nxdomain' && (
                      <span style={{ color: 'var(--red)' }}>
                        NXDOMAIN at {s.stage} — {s.query}
                      </span>
                    )}
                    {s.step === 'error' && <span style={{ color: 'var(--red)' }}>{s.message}</span>}
                    {s.step === 'cache_hit' && (
                      <span style={{ color: 'var(--teal)' }}>
                        ✓ {s.hostname} → port {s.port} · expires {s.expires}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {resolving && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 11 }}>
              <span className="spinning pulsing">↻</span> querying...
            </div>
          )}
        </div>

        {/* cache */}
        <CachePanel onSelect={setHostname} refreshTick={cacheRefreshTick} />

        {/* history */}
        <div className="panel" style={{ padding: 16 }}>
          <h2 style={{ marginBottom: 12 }}>history</h2>
          {history.length === 0 ? (
            <div style={{ color: 'var(--text-hint)', fontFamily: 'var(--mono)', fontSize: 11 }}>
              no lookups yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {history.map((h, i) => (
                <div key={i} style={{
                  padding: '7px 0',
                  borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                }} onClick={() => setHostname(h.hostname)}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)', marginBottom: 2 }}>
                    {h.hostname}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--green)' }}>:{h.port}</span>
                    {h.cached
                      ? <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--teal)' }}>cached</span>
                      : <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)' }}>{h.ms} ms</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}