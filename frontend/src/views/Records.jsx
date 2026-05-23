import { useState } from 'react'
import { apiUrl } from '../api.js'

export default function Records({ infra, onLookup, onNavigateServer }) {
  const [selectedPort, setSelectedPort] = useState('')
  const [hostname, setHostname]         = useState('')
  const [targetPort, setTargetPort]     = useState('')
  const [mode, setMode]                 = useState('add')   // 'add' | 'del'
  const [result, setResult]             = useState(null)
  const [loading, setLoading]           = useState(false)

  if (!infra.running) {
    return (
      <div style={{ maxWidth: 700 }}>
        <h1 style={{ marginBottom: 8 }}>records</h1>
        <div style={{ padding: '16px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>
          infrastructure not running — launch from dashboard
        </div>
      </div>
    )
  }

  const submit = async () => {
    if (!selectedPort || !hostname) return
    setLoading(true)
    setResult(null)
    try {
      const body = {
        port: parseInt(selectedPort),
        hostname: hostname.trim(),
        target_port: mode === 'add' ? parseInt(targetPort) : null,
      }
      const r = await fetch(apiUrl('/api/records/edit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail)
      setResult({ ok: true, msg: `${mode === 'add' ? '!ADD' : '!DEL'} sent — ${d.response || 'ok'}` })
      if (mode === 'add') { setHostname(''); setTargetPort('') }
      if (mode === 'del') { setHostname('') }
    } catch (e) {
      setResult({ ok: false, msg: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>records</h1>
        <p style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 11 }}>
          send !ADD / !DEL commands to a running server
        </p>
      </div>

      <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginBottom: 14 }}>edit record</h2>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {['add', 'del'].map(m => (
            <button key={m} className="btn" onClick={() => setMode(m)}
              style={{
                borderColor: mode === m ? (m === 'add' ? 'var(--green-dim)' : '#5c1e1e') : 'var(--border-hi)',
                color: mode === m ? (m === 'add' ? 'var(--green)' : 'var(--red)') : 'var(--text-dim)',
                background: mode === m ? (m === 'add' ? 'var(--green-bg)' : 'var(--red-bg)') : 'transparent',
              }}>
              !{m.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
              target server
            </label>
            <select value={selectedPort} onChange={e => setSelectedPort(e.target.value)}
              style={{
                background: 'var(--bg)', border: '1px solid var(--border-hi)',
                borderRadius: 'var(--radius)', color: 'var(--text)',
                fontFamily: 'var(--mono)', fontSize: 13, padding: '6px 10px',
                width: '100%', outline: 'none',
              }}>
              <option value="">-- select server --</option>
              {infra.servers.map((s, i) => (
                <option key={i} value={s.port}>:{s.port} ({s.name})</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
              hostname
            </label>
            <input type="text" value={hostname} onChange={e => setHostname(e.target.value)}
              placeholder="www.example.com" style={{ width: '100%' }} />
          </div>

          {mode === 'add' && (
            <div>
              <label style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                target port
              </label>
              <input type="number" value={targetPort} onChange={e => setTargetPort(e.target.value)}
                placeholder="8080" min="1024" max="65535" style={{ width: '100%' }} />
            </div>
          )}

          <button className={`btn ${mode === 'add' ? 'btn-green' : 'btn-red'}`}
            onClick={submit} disabled={loading || !selectedPort || !hostname || (mode === 'add' && !targetPort)}
            style={{ alignSelf: 'flex-start' }}>
            {loading ? <span className="spinning">↻</span> : null}
            send !{mode.toUpperCase()}
          </button>
        </div>

        {result && (
          <div className="animate-in" style={{
            marginTop: 12, padding: '8px 10px',
            background: result.ok ? 'var(--green-bg)' : 'var(--red-bg)',
            border: `1px solid ${result.ok ? 'var(--green-dim)' : '#5c1e1e'}`,
            borderRadius: 'var(--radius)',
            fontFamily: 'var(--mono)', fontSize: 11,
            color: result.ok ? 'var(--green)' : 'var(--red)',
          }}>
            {result.msg}
          </div>
        )}
      </div>

      {/* current records per server */}
      <div className="panel">
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <h2>current records</h2>
        </div>
        {infra.servers.map((s, i) => (
          <div key={i} style={{ borderBottom: i < infra.servers.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{
              padding: '8px 14px',
              display: 'flex', gap: 8, alignItems: 'center',
              background: 'var(--bg-hover)',
            }}>
              <span className={`tag tag-${s.kind}`}>{s.kind}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--green)' }}>:{s.port}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{s.name}</span>
            </div>
            {s.records.map((r, j) => {
                const isAuth = s.kind === 'auth'
                const isNavToServer = s.kind === 'root' || s.kind === 'tld'
                const targetName = isNavToServer
                  ? (infra.servers.find(sv => sv.port === r.port)?.name
                    ?? infra.servers.find(sv => sv.name === `auth-${r.hostname}`)?.name)
                  : null
                const clickable = isAuth || (isNavToServer && !!targetName)
                const handleClick = () => {
                  if (isAuth) onLookup?.(r.hostname)
                  else if (targetName) onNavigateServer?.(targetName)
                }
                return (
                  <div key={j} onClick={clickable ? handleClick : undefined}
                    style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '6px 14px 6px 28px',
                      borderTop: '1px solid var(--border)',
                      fontFamily: 'var(--mono)', fontSize: 11,
                      cursor: clickable ? 'pointer' : 'default',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (clickable) e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ color: clickable ? 'var(--text)' : 'var(--text-dim)' }}>{r.hostname}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--green)' }}>:{r.port}</span>
                      {isAuth && <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>resolve →</span>}
                      {isNavToServer && targetName && <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>view →</span>}
                    </div>
                  </div>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}