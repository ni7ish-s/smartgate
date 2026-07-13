import { useState, useEffect } from 'react'
import { getRoutes, createRoute, deleteRoute } from '../api'

export default function Routes() {
  const [routes, setRoutes] = useState([])
  const [form, setForm] = useState({ prefix: '', upstream: '', strip_prefix: false, auth_required: false, rate_limit_rps: 100 })
  const [error, setError] = useState(null)

  const load = async () => {
    try {
      const res = await getRoutes()
      setRoutes(res.data)
    } catch {
      setError('Failed to load routes')
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    try {
      await createRoute(form)
      setForm({ prefix: '', upstream: '', strip_prefix: false, auth_required: false, rate_limit_rps: 100 })
      load()
    } catch {
      setError('Failed to create route')
    }
  }

  const handleDelete = async (id) => {
    await deleteRoute(id)
    load()
  }

  return (
    <div>
      <h2>Routes</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <input placeholder="/api/users" value={form.prefix} onChange={e => setForm({ ...form, prefix: e.target.value })} style={inputStyle} />
        <input placeholder="http://user-svc:4001" value={form.upstream} onChange={e => setForm({ ...form, upstream: e.target.value })} style={inputStyle} />
        <input type="number" placeholder="RPS limit" value={form.rate_limit_rps} onChange={e => setForm({ ...form, rate_limit_rps: parseInt(e.target.value) })} style={{ ...inputStyle, width: 100 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={form.strip_prefix} onChange={e => setForm({ ...form, strip_prefix: e.target.checked })} />
          Strip prefix
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={form.auth_required} onChange={e => setForm({ ...form, auth_required: e.target.checked })} />
          Auth required
        </label>
        <button onClick={handleCreate} style={btnStyle}>Add Route</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            {['Prefix', 'Upstream', 'Strip', 'Auth', 'RPS', 'Active', ''].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {routes.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={tdStyle}>{r.prefix}</td>
              <td style={tdStyle}>{r.upstream}</td>
              <td style={tdStyle}>{r.strip_prefix ? '✓' : '—'}</td>
              <td style={tdStyle}>{r.auth_required ? '✓' : '—'}</td>
              <td style={tdStyle}>{r.rate_limit_rps}</td>
              <td style={tdStyle}>{r.active ? '🟢' : '🔴'}</td>
              <td style={tdStyle}>
                <button onClick={() => handleDelete(r.id)} style={{ ...btnStyle, background: '#ff4444' }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const inputStyle = { padding: '6px 10px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14 }
const btnStyle = { padding: '6px 14px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }
const thStyle = { padding: '8px 12px', textAlign: 'left', fontWeight: 600 }
const tdStyle = { padding: '8px 12px' }