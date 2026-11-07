import axios from 'axios'

/**
 * Single Axios instance for the future FastAPI backend.
 * - No secrets live here. AI provider keys stay on the server.
 * - Set VITE_USE_MOCK=false and VITE_API_BASE_URL to switch from demo data to the backend.
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

export const mockDelay = <T,>(value: T, ms = 450): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))
