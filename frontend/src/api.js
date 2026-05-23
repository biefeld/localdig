const BASE = import.meta.env.VITE_API_URL ?? ''

export const apiUrl = (path) => `${BASE}${path}`

export const wsUrl = (path) => {
  const base = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/^https/, 'wss').replace(/^http/, 'ws')
    : `ws://${location.host}`
  return `${base}${path}`
}