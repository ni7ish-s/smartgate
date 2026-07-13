import { useEffect, useState } from 'react'
import { getAlerts } from '../api'

const severityColor = { low: '#f5a623', medium: '#ff8c00', high: '#ff4444' }

export default function Alerts() {
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    getAlerts().then(res => setAlerts(res.data)).catch(() => setAlerts([]))
  }, [])

  if (!alerts.length) return <div><h2>Alerts</h2><p style={{ color: '#888' }}>No alerts yet. The system is actively monitoring traffic for anomalies.</p></div>

  return (
    <div>
      <h2>Alerts</h2>
      {alerts.map(a => (
        <div key={a.id} style={{ border: `1px solid ${severityColor[a.severity]}`, borderRadius: 6, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, color: severityColor[a.severity], textTransform: 'uppercase' }}>{a.severity}</span>
            <span style={{ color: '#888', fontSize: 13 }}>{new Date(a.created_at).toLocaleString()}</span>
          </div>
          <p style={{ margin: '8px 0 0' }}>{a.description}</p>
          {a.metadata && <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 12, marginTop: 8 }}>{JSON.stringify(a.metadata, null, 2)}</pre>}
        </div>
      ))}
    </div>
  )
}