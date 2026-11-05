import { FormEvent, useRef, useState } from 'react'
import { Bot, LoaderCircle, Send, X } from 'lucide-react'
import { api } from '../api'
import type { ResumeContent } from '../types'

type Message = { role: 'assistant' | 'user'; content: string }

export function ChatPanel({
  content,
  jobDescription,
  onClose,
  embedded = false,
}: {
  content: ResumeContent
  jobDescription: string
  onClose?: () => void
  embedded?: boolean
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! Ask me about ATS feedback, resume wording, or interview preparation. I’ll only use facts in the resume you provide.',
    },
  ])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [retryMessage, setRetryMessage] = useState('')
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  async function sendMessage(message: string, appendUser = true) {
    if (inFlight.current || !message.trim()) return
    inFlight.current = true
    setError('')
    setRetryMessage('')
    setSending(true)
    if (appendUser) setMessages(current => [...current, { role: 'user', content: message }])
    try {
      const result = await api.chat(content, message, jobDescription)
      setMessages(current => [...current, { role: 'assistant', content: result.reply }])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The local AI could not respond. Please try again.')
      setRetryMessage(message)
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const question = draft.trim()
    if (!question || sending) return
    setDraft('')
    void sendMessage(question)
  }

  return (
    <section className={`chat-panel ${embedded ? 'chat-embedded' : ''}`} aria-label="Resume copilot">
      <div className="chat-heading">
        <div>
          <Bot size={19} />
          <strong>Resume copilot</strong>
          <span>Local AI · grounded in your resume</span>
        </div>
        {onClose && <button type="button" onClick={onClose} aria-label="Close chatbot"><X size={18} /></button>}
      </div>
      <div className="chat-messages" aria-live="polite" aria-busy={sending}>
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`message ${message.role}`}>{message.content}</div>
        ))}
        {sending && <div className="message assistant thinking"><LoaderCircle size={15} className="spin" /> Thinking with your local model…</div>}
        {error && (
          <div className="chat-error" role="alert">
            <p>{error}</p>
            {retryMessage && <button type="button" className="text-button" onClick={() => void sendMessage(retryMessage, false)}>Retry</button>}
          </div>
        )}
      </div>
      <form onSubmit={submit} className="chat-form">
        <label className="sr-only" htmlFor="chat-input">Ask the resume copilot</label>
        <input
          id="chat-input"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder="Ask about your resume…"
          disabled={sending}
        />
        <button aria-label="Send chat message" disabled={sending || !draft.trim()}><Send size={17} /></button>
      </form>
    </section>
  )
}
