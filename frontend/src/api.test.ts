import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import { blankResume } from './types'

afterEach(() => vi.unstubAllGlobals())

describe('API client', () => {
  it('sends chatbot messages to FastAPI with resume context', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ reply: 'A real model response', review_required: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.chat(blankResume.content, 'Help with my summary', '')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:8001/api/chat')
    expect(JSON.parse(String(options.body))).toEqual({
      content: blankResume.content,
      message: 'Help with my summary',
      job_description: '',
    })
    expect(result.reply).toBe('A real model response')
  })

  it('surfaces backend errors instead of manufacturing a response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: 'Ollama is unavailable.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )))

    await expect(api.chat(blankResume.content, 'Question', '')).rejects.toThrow('Ollama is unavailable.')
  })

  it('uploads a resume and optional job description for ATS scoring', async () => {
    const file = new File(['resume content'], 'resume.pdf', { type: 'application/pdf' })
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        filename: 'resume.pdf',
        analysis: { score: 80, breakdown: {}, issues: [], disclaimer: 'Heuristic only.' },
        match: null,
        sections_found: { skills: true },
        word_count: 2,
        extracted_text: 'Resume content',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.analyzeUpload(file, 'Python developer')

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:8001/api/ai/analyze-upload')
    expect(options.headers).toBeInstanceOf(Headers)
    expect((options.headers as Headers).has('Content-Type')).toBe(false)
    expect(options.body).toBeInstanceOf(FormData)
    expect((options.body as FormData).get('file')).toBe(file)
    expect((options.body as FormData).get('job_description')).toBe('Python developer')
    expect(result.analysis.score).toBe(80)
  })
})
