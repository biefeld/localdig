export default function DemoModal({ onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div className="panel animate-in" style={{
        maxWidth: 520, width: '100%', padding: '28px 32px',
        border: '1px solid var(--border-hi)',
      }}>
        {/* header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 500, marginBottom: 6 }}>
            local<span style={{ color: 'var(--green)' }}>dig</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)', marginLeft: 12 }}>
              dns infrastructure simulator
            </span>
          </div>
          <div style={{ width: 32, height: 1, background: 'var(--green)', marginTop: 8 }} />
        </div>

        {/* description */}
        <p style={{ color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 16, fontSize: 13 }}>
          A full DNS resolution stack built in Python — recursive resolver, root, TLD, and
          authoritative nameservers communicating over raw TCP sockets, with record caching
          and a real-time web dashboard.
        </p>

        {/* demo mode notice */}
        <div style={{
          background: 'var(--amber-bg)', border: '1px solid #78400a',
          borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 20,
        }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--amber)', marginBottom: 4, fontWeight: 500 }}>
            ⚠ demo mode
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            The Python backend requires local port bindings across 30+ TCP ports — not
            possible on free hosting. This demo simulates the resolution chain with
            pre-recorded data and realistic latency. Clone the repo to run the real thing.
          </div>
        </div>

        {/* what works */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            what's simulated
          </div>
          {[
            'DNS resolution trace — root → TLD → authoritative',
            'Cache hits with TTL countdown',
            'Server list with record navigation',
            'Benchmark chart (pre-recorded data)',
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 5 }}>
              <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: 11, marginTop: 1 }}>✓</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{item}</span>
            </div>
          ))}
        </div>

        {/* actions */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-green" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
            explore demo →
          </button>
          <a href="https://github.com/biefeld/localdig" target="_blank" rel="noreferrer"
            style={{ textDecoration: 'none' }}>
            <button className="btn" style={{ whiteSpace: 'nowrap' }}>
              view on github ↗
            </button>
          </a>
        </div>
      </div>
    </div>
  )
}