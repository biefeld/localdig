import { useState } from 'react'
import { apiUrl } from '../api.js'

export default function Dashboard({ infra, setInfra, setView, onNavigateServer }) {
  const [launching, setLaunching] = useState(false)
  const [tearing, setTearing] = useState(false)
  const [masterConf, setMasterConf] = useState('')
  const [singlesDir, setSinglesDir] = useState('')
  const [error, setError] = useState(null)

  const serverCounts = infra.servers.reduce((acc, s) => {
    acc[s.kind] = (acc[s.kind] || 0) + 1
    return acc
  }, {})

  const totalRecords = infra.servers.reduce((sum, s) => sum + s.records.length, 0)

  const launch = async () => {
    setLaunching(true)
    setError(null)
    try {
      const body = {}
      if (masterConf) body.master_conf = masterConf
      if (singlesDir) body.singles_dir = singlesDir
      const r = await fetch(apiUrl('/api/infrastructure/launch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || 'Launch failed')
      setInfra({ running: true, servers: d.servers, root_port: d.root_port })
    } catch (e) {
      setError(e.message)
    } finally {
      setLaunching(false)
    }
  }

  const teardown = async () => {
    setTearing(true)
    try {
      await fetch(apiUrl('/api/infrastructure/teardown'), { method: 'POST' })
      setInfra({ running: false, servers: [], root_port: null })
    } catch (e) {
      setError(e.message)
    } finally {
      setTearing(false)
    }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: 'var(--text)', marginBottom: 4 }}>dashboard</h1>
        <p style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 11 }}>
          dns infrastructure simulator
        </p>
      </div>

      {/* stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'servers', value: infra.servers.length, accent: infra.running },
          { label: 'root', value: serverCounts.root || 0, accent: false },
          { label: 'tld', value: serverCounts.tld || 0, accent: false },
          { label: 'auth', value: serverCounts.auth || 0, accent: false },
        ].map(c => (
          <div key={c.label} className="panel" style={{ padding: '14px 16px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              {c.label}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 500, color: c.accent ? 'var(--green)' : 'var(--text)', lineHeight: 1 }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* control panel */}
        <div className="panel" style={{ padding: 16 }}>
          <h2 style={{ marginBottom: 12 }}>infrastructure control</h2>

          {!infra.running && (
            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>
                  master.conf path (optional)
                </div>
                <input type="text" value={masterConf} onChange={e => setMasterConf(e.target.value)}
                  placeholder="./master.conf" style={{ width: '100%' }} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>
                  singles dir (optional)
                </div>
                <input type="text" value={singlesDir} onChange={e => setSinglesDir(e.target.value)}
                  placeholder="./singles" style={{ width: '100%' }} />
              </div>
            </div>
          )}

          {error && (
            <div style={{
              background: 'var(--red-bg)', border: '1px solid #5c1e1e',
              borderRadius: 'var(--radius)', padding: '8px 10px',
              fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--red)',
              marginBottom: 12,
            }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            {!infra.running ? (
              <button className="btn btn-green" onClick={launch} disabled={launching}>
                {launching ? <span className="spinning">↻</span> : '▶'} launch
              </button>
            ) : (
              <button className="btn btn-red" onClick={teardown} disabled={tearing}>
                {tearing ? <span className="spinning">↻</span> : '■'} teardown
              </button>
            )}
          </div>

          {infra.running && (
            <div style={{
              marginTop: 12, padding: '8px 10px',
              background: 'var(--green-bg)', border: '1px solid var(--green-dim)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--green)',
            }}>
              ● running — root on :{infra.root_port} · {infra.servers.length} servers · {totalRecords} records
            </div>
          )}
        </div>

        {/* quick actions */}
        <div className="panel" style={{ padding: 16 }}>
          <h2 style={{ marginBottom: 12 }}>quick actions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: '→ dns lookup', view: 'lookup', dim: !infra.running },
              { label: '→ server list', view: 'servers', dim: !infra.running },
              { label: '→ edit records', view: 'records', dim: !infra.running },
              { label: '→ run benchmark', view: 'benchmark', dim: !infra.running },
            ].map(a => (
              <button key={a.view} className="btn" onClick={() => setView(a.view)}
                disabled={a.dim}
                style={{ justifyContent: 'flex-start' }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* server grid */}
      {infra.servers.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="panel">
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <h2>servers</h2>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['type', 'name', 'port', 'records'].map(h => (
                    <th key={h} style={{
                      padding: '8px 14px', textAlign: 'left',
                      fontFamily: 'var(--mono)', fontSize: 10,
                      color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em',
                      fontWeight: 400,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {infra.servers.map((s, i) => (
                  <tr key={i} onClick={() => onNavigateServer?.(s.name)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background='var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <td style={{ padding: '8px 14px' }}>
                      <span className={`tag tag-${s.kind}`}>{s.kind}</span>
                    </td>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>
                      {s.name}
                    </td>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--green)' }}>
                      :{s.port}
                    </td>
                    <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {s.records.length}
                        <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>view →</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}