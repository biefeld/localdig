import { useState, useEffect } from 'react'
import { apiUrl } from './api.js'
import DemoModal from './components/DemoModal.jsx'
import { DEMO_SERVERS } from './demo.js'
import Dashboard from './views/Dashboard.jsx'
import Lookup from './views/Lookup.jsx'
import Servers from './views/Servers.jsx'
import Records from './views/Records.jsx'
import Benchmark from './views/Benchmark.jsx'

const NAV = [
  { id: 'dashboard',  label: 'dashboard',   icon: '⬡', group: 'monitor' },
  { id: 'lookup',     label: 'dns lookup',  icon: '⟳', group: 'monitor', requiresInfra: true },
  { id: 'servers',    label: 'servers',     icon: '▣', group: 'manage', requiresInfra: true },
  { id: 'records',    label: 'records',     icon: '≡', group: 'manage', requiresInfra: true },
  { id: 'benchmark',  label: 'benchmark',   icon: '◎', group: 'tools', requiresInfra: true },
]

export default function App() {
  const [view, setView] = useState('dashboard')
  const [infra, setInfra] = useState({ running: false, servers: [], root_port: null })
  const [demoMode, setDemoMode] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [history, setHistory] = useState([])
  const [lookupHostname, setLookupHostname] = useState('')
  const [targetServer, setTargetServer] = useState(null)

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(apiUrl('/api/infrastructure/status'))
        const d = await r.json()
        setInfra(d)
      } catch (_) {
        // backend unreachable — enter demo mode
        setDemoMode(true)
        setShowModal(true)
        setInfra({ running: true, servers: DEMO_SERVERS, root_port: 1025 })
        window.__demoMode = true
      }
    }
    check()
    const id = setInterval(() => {
      if (!demoMode) check()
    }, 3000)
    return () => clearInterval(id)
  }, [demoMode])


  const groups = ['monitor', 'manage', 'tools']

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {showModal && <DemoModal onClose={() => setShowModal(false)} />}

      {/* sidebar */}
      <aside style={{
        width: 180, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        padding: '0 0 16px',
        background: 'var(--bg-panel)',
      }}>
        {/* wordmark */}
        <div style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--border)',
          marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontFamily: 'var(--mono)', fontWeight: 500, fontSize: 14, color: 'var(--text)', letterSpacing: '0.05em' }}>
              nx<span style={{ color: 'var(--green)' }}>domain</span>
            </div>
            {demoMode && (
              <span onClick={() => setShowModal(true)} style={{
                fontFamily: 'var(--mono)', fontSize: 9,
                background: 'var(--amber-bg)', border: '1px solid #78400a',
                color: 'var(--amber)', padding: '2px 6px', borderRadius: 'var(--radius)',
                cursor: 'pointer', letterSpacing: '0.04em',
              }}>demo</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span className={`dot ${infra.running ? 'dot-green' : 'dot-dim'}`} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)' }}>
              {infra.running ? `root :${infra.root_port}` : 'offline'}
            </span>
          </div>
        </div>

        {groups.map(grp => (
          <div key={grp}>
            <div style={{
              padding: '8px 16px 4px',
              fontSize: 10, fontFamily: 'var(--mono)',
              color: 'var(--text-hint)', letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>{grp}</div>
            {NAV.filter(n => n.group === grp).map(n => {
              const disabled = n.requiresInfra && !infra.running
              return (
              <button key={n.id} onClick={() => !disabled && setView(n.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '7px 16px',
                background: view === n.id ? 'var(--bg-hover)' : 'transparent',
                border: 'none',
                borderLeft: view === n.id ? '2px solid var(--green)' : '2px solid transparent',
                color: view === n.id ? 'var(--text)' : disabled ? 'var(--text-hint)' : 'var(--text-dim)',
                fontFamily: 'var(--mono)', fontSize: 12,
                cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
                transition: 'all 0.1s',
                opacity: disabled ? 0.4 : 1,
              }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>{n.icon}</span>
                {n.label}
              </button>
              )
            })}
          </div>
        ))}
      </aside>

      {/* main */}
      <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {view === 'dashboard'  && <Dashboard infra={infra} setInfra={setInfra} setView={setView} onNavigateServer={name => { setTargetServer(name); setView('servers') }} demoMode={demoMode} />}
        {view === 'lookup'     && <Lookup infra={infra} history={history} setHistory={setHistory} initialHostname={lookupHostname} clearInitialHostname={() => setLookupHostname('')} demoMode={demoMode} />}
        {view === 'servers'    && <Servers infra={infra} setInfra={setInfra} onLookup={h => { setLookupHostname(h); setView('lookup') }} targetServer={targetServer} clearTargetServer={() => setTargetServer(null)} />}
        {view === 'records'    && <Records infra={infra} onLookup={h => { setLookupHostname(h); setView('lookup') }} onNavigateServer={name => { setTargetServer(name); setView('servers') }} />}
        {view === 'benchmark'  && <Benchmark infra={infra} demoMode={demoMode} />}
      </main>
    </div>
  )
}