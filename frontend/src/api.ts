import type { Resume, ResumeContent } from './types'

const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8001/api').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  const headers = new Headers(init?.headers)
  if (!(init?.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers })
  } catch {
    throw new Error(`Can’t reach the backend at ${BASE}. Start the FastAPI server on port 8001 and try again.`)
  }

  if (!response.ok) {
    let detail = ''
    try {
      const payload: unknown = await response.json()
      if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
        const value = payload.detail
        detail = typeof value === 'string' ? value : JSON.stringify(value)
      }
    } catch {
      detail = ''
    }
    throw new Error(detail || `The request failed (${response.status}). Please try again.`)
  }

  return response.json() as Promise<T>
}

export const api = {
  list: () => request<Resume[]>('/resumes'),
  create: (resume: Resume) =>
    request<Resume>('/resumes', { method: 'POST', body: JSON.stringify(resume) }),
  update: (id: string, resume: Resume) =>
    request<Resume>(`/resumes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(resume),
    }),
  analyze: (content: ResumeContent, job_description: string) =>
    request<Analysis>('/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ content, job_description }),
    }),
  tailor: (content: ResumeContent, job_description: string) =>
    request<Match>('/ai/tailor', {
      method: 'POST',
      body: JSON.stringify({ content, job_description }),
    }),
  summary: (content: ResumeContent) =>
    request<{ suggestion: string }>('/ai/summary', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  rewrite: (content: ResumeContent, bullet: string) =>
    request<{ suggestion: string }>('/ai/rewrite-bullet', {
      method: 'POST',
      body: JSON.stringify({ content, bullet }),
    }),
  chat: (content: ResumeContent, message: string, job_description: string) =>
    request<{ reply: string }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ content, message, job_description }),
    }),
  importResume: (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return request<{ draft: Partial<ResumeContent>; warning: string }>('/import', {
      method: 'POST',
      body,
    })
  },
  analyzeUpload: (file: File, job_description: string) => {
    const body = new FormData()
    body.append('file', file)
    body.append('job_description', job_description)
    return request<UploadedResumeAnalysis>('/ai/analyze-upload', {
      method: 'POST',
      body,
    })
  },
  async downloadPdf(id: string): Promise<Blob> {
    let response: Response
    try {
      response = await fetch(`${BASE}/export/${encodeURIComponent(id)}/pdf`)
    } catch {
      throw new Error(`Can’t reach the backend at ${BASE}. Start the FastAPI server on port 8001 and try again.`)
    }
    if (!response.ok) throw new Error(`PDF export failed (${response.status}). Please try again.`)
    return response.blob()
  },
}

export type Analysis = {
  score: number
  breakdown: Record<string, number>
  issues: { category: string; message: string }[]
  disclaimer: string
}

export type Match = {
  coverage: number
  keywords: string[]
  matched_keywords: string[]
  missing_keywords: string[]
  suggestions: string[]
}

export type UploadedResumeAnalysis = {
  filename: string
  analysis: Analysis
  match: Match | null
  sections_found: Record<string, boolean>
  word_count: number
  extracted_text: string
}
