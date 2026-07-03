import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts'
import { getLogs } from '../api'

export default function Traffic() {
  const [data, setData] = useState([])

  useEffect(() => {
    getLogs().then(res => {
      // Group logs by minute
      const grouped = {}
      res.data.forEach(log => {
        const minute = new Date(log.logged_at).toISOString().slice(11, 16)
        if (!grouped[minute]) grouped[minute] = { time: minute, requests: 0, errors: 0, avgDuration: 0, totalDuration: 0 }
        grouped[minute].requests++
        if (log.status_code >= 400) grouped[minute].errors++
        grouped[minute].totalDuration += log.duration_ms ?? 0
      })

      const result = Object.values(grouped).map(g => ({
        ...g,
        avgDuration: Math.round(g.totalDuration / g.requests),
      }))

      setData(result)
    })
  }, [])

  return (
    <div>
      <h2>Traffic</h2>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="requests" stroke="#0070f3" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="errors" stroke="#ff4444" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="avgDuration" stroke="#f5a623" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}