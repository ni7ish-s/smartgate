import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
})

// Routes
export const getRoutes = () => api.get('/admin/routes')
export const createRoute = (data) => api.post('/admin/routes', data)
export const updateRoute = (id, data) => api.put(`/admin/routes/${id}`, data)
export const deleteRoute = (id) => api.delete(`/admin/routes/${id}`)

// API Keys
export const getKeys = () => api.get('/admin/keys')
export const createKey = (name) => api.post('/admin/keys', { name })
export const revokeKey = (id) => api.delete(`/admin/keys/${id}`)

// Logs
export const getLogs = () => api.get('/admin/logs')

// Alerts
export const getAlerts = () => api.get('/admin/alerts')