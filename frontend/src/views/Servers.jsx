import { useEffect } from 'react'
import { apiUrl } from '../api.js'

export default function Servers({ infra, setInfra, onLookup, targetServer, clearTargetServer }) {
  // refresh on mount so port lookups are always current
  useEffect(() => {
    fetch(apiUrl('/api/infrastructure/status'))
      .then(r => r.json())
      .then(d => { if (d.running) setInfra(d) })
      .catch(() => {})
  }, [])
  useEffect(() => {
    if (!targetServer) return
    const el = document.getElementById(`server-${targetServer}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.style.outline = '1px solid var(--green)'
      el.style.outlineOffset = '2px'
      setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = '' }, 1500)
    }
    clearTargetServer?.()
  }, [targetServer])
  if (!infra.running) {
    return (
      <div style={{ maxWidth: 700 }}>
        <h1 style={{ marginBottom: 8 }}>servers</h1>
        <div style={{ padding: '16px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>
          infrastructure not running — launch from dashboard
        </div>
      </div>
    )
  }

  const byKind = { root: [], tld: [], auth: [] }
  infra.servers.forEach(s => {
    if (byKind[s.kind]) byKind[s.kind].push(s)
  })

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>servers</h1>
        <p style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 11 }}>
          {infra.servers.length} servers running
        </p>
      </div>

      {Object.entries(byKind).filter(([, list]) => list.length > 0).map(([kind, list]) => (
        <div key={kind} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span className={`tag tag-${kind}`}>{kind}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
              {list.length} instance{list.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {list.map((s, i) => (
              <div key={i} id={`server-${s.name}`} className="panel" style={{ padding: 14, transition: 'outline 0.3s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>
                      {s.name}
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 500, color: 'var(--green)' }}>
                      :{s.port}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span className="dot dot-green" />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)' }}>running</span>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    records ({s.records.length})
                  </div>
                  {s.records.map((r, j) => {
                    const isAuth = s.kind === 'auth'
                    const isNavToServer = s.kind === 'root' || s.kind === 'tld'
                    const targetName = isNavToServer
                      ? (infra.servers.find(sv => sv.port === r.port)?.name
                        // fallback: match by hostname suffix e.g. "vercel.com" -> "auth-vercel.com"
                        ?? infra.servers.find(sv => sv.name === `auth-${r.hostname}`)?.name)
                      : null
                    const clickable = isAuth || (isNavToServer && !!targetName)
                    const handleClick = () => {
                      if (isAuth) onLookup?.(r.hostname)
                      else if (targetName) {
                        const el = document.getElementById(`server-${targetName}`)
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          el.style.outline = '1px solid var(--green)'
                          el.style.outlineOffset = '2px'
                          setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = '' }, 1500)
                        }
                      }
                    }
                    return (
                    <div key={j} onClick={clickable ? handleClick : undefined}
                      style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '3px 0',
                        borderBottom: j < s.records.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: clickable ? 'pointer' : 'default',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (clickable) e.currentTarget.style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: clickable ? 'var(--text)' : 'var(--text-dim)' }}>
                        {r.hostname}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--green)' }}>:{r.port}</span>
                        {isAuth && <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>resolve →</span>}
                        {isNavToServer && targetName && <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>view →</span>}
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}