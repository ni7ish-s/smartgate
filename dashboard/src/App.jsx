import { useState } from 'react'
import Routes from './components/Routes'
import Traffic from './components/Traffic'
import Alerts from './components/Alerts'

export default function App() {
  const [tab, setTab] = useState('routes')

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>SmartGate Dashboard</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid #ddd', paddingBottom: 12 }}>
        {['routes', 'traffic', 'alerts'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 16px',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              background: tab === t ? '#0070f3' : '#f0f0f0',
              color: tab === t ? '#fff' : '#333',
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'routes' && <Routes />}
      {tab === 'traffic' && <Traffic />}
      {tab === 'alerts' && <Alerts />}
    </div>
  )
}