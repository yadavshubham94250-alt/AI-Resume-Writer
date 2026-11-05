import { useEffect, useRef, useState } from 'react'
import {
  BarChart3, BriefcaseBusiness, Check, Download, FileText, FileSearch, LayoutTemplate,
  LoaderCircle, MessageCircle, Plus, Save, Sparkles, Target, Trash2, Upload, Wand2,
} from 'lucide-react'
import { api, type Analysis, type Match, type UploadedResumeAnalysis } from './api'
import { ChatPanel } from './components/ChatPanel'
import { Insights } from './components/Insights'
import { ResumePreview } from './components/ResumePreview'
import { blankResume, type Education, type Experience, type Project, type Resume, type ResumeContent } from './types'

type View = 'resume' | 'templates' | 'job-match' | 'insights' | 'copilot'

const navigation: { id: View; label: string; icon: typeof FileText }[] = [
  { id: 'resume', label: 'Resume editor', icon: FileText },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'job-match', label: 'Job match', icon: Target },
  { id: 'insights', label: 'ATS insights', icon: BarChart3 },
  { id: 'copilot', label: 'AI copilot', icon: MessageCircle },
]

const templateChoices: { id: Resume['template']; name: string; description: string }[] = [
  { id: 'modern', name: 'Modern', description: 'Clean typography and a contemporary layout.' },
  { id: 'classic', name: 'Classic', description: 'A traditional format for a formal, timeless look.' },
  { id: 'minimal', name: 'Minimal', description: 'A light, understated layout that keeps focus on content.' },
]

function newExperience(): Experience {
  return { id: `experience-${Date.now()}`, company: '', role: '', location: '', start_date: '', end_date: '', bullets: [''], technologies: [] }
}
function newEducation(): Education {
  return { id: `education-${Date.now()}`, institution: '', degree: '', field: '', start_date: '', end_date: '', grade: '' }
}
function newProject(): Project {
  return { id: `project-${Date.now()}`, name: '', description: '', technologies: [], bullets: [], links: [] }
}

export function App() {
  const [resume, setResume] = useState<Resume>(blankResume)
  const [jobDescription, setJobDescription] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [match, setMatch] = useState<Match | null>(null)
  const [uploadedAnalysis, setUploadedAnalysis] = useState<UploadedResumeAnalysis | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [view, setView] = useState<View>('resume')
  const [chatOpen, setChatOpen] = useState(false)
  const [notice, setNotice] = useState('Your edits remain in this browser session until you save them to SQLite.')
  const [busy, setBusy] = useState('')
  const [saved, setSaved] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)
  const atsUploadInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    api.list().then(resumes => {
      if (active && resumes.length) {
        setResume(resumes[0])
        setSaved(true)
        setNotice('Your most recently saved resume is ready to edit.')
      }
    }).catch(() => {
      if (active) setNotice('Backend not connected. You can edit now; connect and save to keep changes in SQLite.')
    })
    return () => { active = false }
  }, [])

  function update(patch: Partial<Resume>) {
    setResume(current => ({ ...current, ...patch }))
    setSaved(false)
  }

  function updateContent(patch: Partial<ResumeContent>) {
    setResume(current => ({ ...current, content: { ...current.content, ...patch } }))
    setSaved(false)
  }

  function updateExperience(index: number, patch: Partial<Experience>) {
    updateContent({ experience: resume.content.experience.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) })
  }

  async function saveResume(): Promise<Resume | null> {
    setBusy('save')
    try {
      const result = resume.id ? await api.update(resume.id, resume) : await api.create(resume)
      setResume(result)
      setSaved(true)
      setNotice('Resume saved to your local SQLite database.')
      return result
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save your resume.')
      return null
    } finally {
      setBusy('')
    }
  }

  async function exportPdf() {
    const persisted = await saveResume()
    if (!persisted) return
    setBusy('export')
    try {
      const file = await api.downloadPdf(persisted.id!)
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = `${(persisted.title || 'resume').replace(/[<>:"/\\|?*]+/g, '-').trim() || 'resume'}.pdf`
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setNotice('Your resume PDF has been downloaded.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not export your resume.')
    } finally {
      setBusy('')
    }
  }

  async function runReview() {
    setBusy('analysis')
    setNotice('Analyzing your resume and job description…')
    try {
      const [nextAnalysis, nextMatch] = await Promise.all([
        api.analyze(resume.content, jobDescription),
        api.tailor(resume.content, jobDescription),
      ])
      setAnalysis(nextAnalysis)
      setMatch(nextMatch)
      setNotice('Analysis updated. Scores are transparent heuristics, not hiring guarantees.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Analysis is unavailable.')
    } finally {
      setBusy('')
    }
  }

  async function generateSummary() {
    setBusy('summary')
    try {
      const result = await api.summary(resume.content)
      updateContent({ summary: result.suggestion })
      setNotice('AI summary inserted. Review every detail before using it.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Local AI is unavailable.')
    } finally {
      setBusy('')
    }
  }

  async function rewriteBullet(experienceIndex: number, bulletIndex: number) {
    const currentExperience = resume.content.experience[experienceIndex]
    if (!currentExperience?.bullets[bulletIndex]?.trim()) {
      setNotice('Add a bullet with your actual work before asking AI to rewrite it.')
      return
    }
    const key = `rewrite-${experienceIndex}-${bulletIndex}`
    setBusy(key)
    try {
      const result = await api.rewrite(resume.content, currentExperience.bullets[bulletIndex])
      const bullets = [...currentExperience.bullets]
      bullets[bulletIndex] = result.suggestion
      updateExperience(experienceIndex, { bullets })
      setNotice('AI suggestion inserted. Review it for accuracy before saving.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Local AI is unavailable.')
    } finally {
      setBusy('')
    }
  }

  async function importResume(file?: File) {
    if (!file) return
    setBusy('import')
    try {
      const result = await api.importResume(file)
      const contact = { ...resume.content.contact, ...result.draft.contact, links: resume.content.contact.links }
      updateContent({ ...result.draft, contact })
      setNotice(`${result.warning} Review the extracted contact details and complete the remaining sections.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not read that resume file.')
    } finally {
      setBusy('')
      if (importInput.current) importInput.current.value = ''
    }
  }

  function selectAtsResume(file?: File) {
    if (!file) return
    const extensionAllowed = /\.(pdf|docx)$/i.test(file.name)
    if (!extensionAllowed) {
      setUploadedFile(null)
      setNotice('Choose a PDF or DOCX file to run the ATS review.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadedFile(null)
      setNotice('This file is over the 10 MB upload limit. Choose a smaller PDF or DOCX.')
      return
    }
    setUploadedFile(file)
    setUploadedAnalysis(null)
    setNotice(`${file.name} selected. Start the check to extract the resume text and calculate its ATS score.`)
  }

  async function analyzeUploadedResume() {
    if (!uploadedFile || busy === 'ats-upload') return
    setBusy('ats-upload')
    setNotice('Uploading your file locally, extracting readable text, and checking resume sections…')
    try {
      const result = await api.analyzeUpload(uploadedFile, jobDescription)
      setUploadedAnalysis(result)
      setNotice(`ATS check complete for ${result.filename}. The uploaded document was analyzed without saving it to your resume database.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not analyze this resume file.')
    } finally {
      setBusy('')
      if (atsUploadInput.current) atsUploadInput.current.value = ''
    }
  }

  const activeLabel = navigation.find(item => item.id === view)?.label ?? 'Resume editor'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={event => { event.preventDefault(); setView('resume') }}>
          <span className="brand-mark"><img src="/resume-analyzer-mark.png" alt="Resume Analyzer" /></span>
        </a>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="nav-links" aria-label="Main navigation">
          {navigation.map(item => {
            const Icon = item.icon
            return <button type="button" key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}>
              <Icon size={18} /><span>{item.label}</span>
            </button>
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-badge"><i /> Local & private <small>Your resume stays on your machine.</small></div>
          <div className="profile-chip"><span>{resume.content.contact.name.trim().charAt(0).toUpperCase() || 'R'}</span><div><strong>{resume.content.contact.name || 'Your workspace'}</strong><small>{saved ? 'Saved locally' : 'Unsaved changes'}</small></div></div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="title-block"><p className="eyebrow">RESUME WORKSPACE <span>/</span> {activeLabel.toUpperCase()}</p>
            <input className="resume-title" aria-label="Resume title" value={resume.title} onChange={event => update({ title: event.target.value })} />
          </div>
          <div className="top-actions">
            {view !== 'copilot' && <button className="ghost" type="button" onClick={runReview} disabled={busy === 'analysis'}><BarChart3 size={16} />{busy === 'analysis' ? 'Analyzing…' : 'Analyze'}</button>}
            <button className="ghost save-button" type="button" onClick={() => void saveResume()} disabled={busy === 'save' || busy === 'export'}>
              {busy === 'save' ? <LoaderCircle size={16} className="spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
              {busy === 'save' ? 'Saving…' : saved ? 'Saved' : 'Save'}
            </button>
            <button className="primary" type="button" onClick={() => void exportPdf()} disabled={busy === 'export' || busy === 'save'}>
              <Download size={16} />{busy === 'export' ? 'Preparing…' : 'Export PDF'}
            </button>
          </div>
        </header>
        <p className={`notice ${notice.includes('Could not') || notice.includes('Can’t') || notice.includes('unavailable') ? 'notice-error' : ''}`} aria-live="polite">{notice}</p>

        {view === 'resume' && <div className="work-grid">
          <section className="editor card">
            <div className="section-heading"><div><p className="eyebrow">YOUR STORY</p><h2>Resume details</h2></div>
              <button className="ai-button" type="button" onClick={() => void generateSummary()} disabled={busy === 'summary'}>
                {busy === 'summary' ? <LoaderCircle size={15} className="spin" /> : <Wand2 size={15} />}Write with AI
              </button>
            </div>
            <label>Target role<input value={resume.target_role} onChange={event => update({ target_role: event.target.value })} placeholder="e.g. Product designer" /></label>
            <div className="form-grid">
              <label>Full name<input value={resume.content.contact.name} onChange={event => updateContent({ contact: { ...resume.content.contact, name: event.target.value } })} placeholder="Your name" /></label>
              <label>Email<input type="email" value={resume.content.contact.email} onChange={event => updateContent({ contact: { ...resume.content.contact, email: event.target.value } })} placeholder="you@example.com" /></label>
              <label>Phone<input value={resume.content.contact.phone} onChange={event => updateContent({ contact: { ...resume.content.contact, phone: event.target.value } })} placeholder="Phone number" /></label>
              <label>Location<input value={resume.content.contact.location} onChange={event => updateContent({ contact: { ...resume.content.contact, location: event.target.value } })} placeholder="City, region" /></label>
            </div>
            <label>Professional summary<textarea value={resume.content.summary} onChange={event => updateContent({ summary: event.target.value })} rows={4} placeholder="A concise overview of your experience and strengths." /></label>

            <div className="editor-subhead"><h3>Experience</h3><button className="text-button" type="button" onClick={() => updateContent({ experience: [...resume.content.experience, newExperience()] })}><Plus size={15} /> Add role</button></div>
            {resume.content.experience.length === 0 && <p className="field-hint">Add your most relevant roles, with specific and accurate contributions.</p>}
            {resume.content.experience.map((item, index) => <div className="repeat-section" key={item.id}>
              <div className="repeat-heading"><strong>Role {index + 1}</strong><button className="icon-button danger" type="button" aria-label={`Remove role ${index + 1}`} onClick={() => updateContent({ experience: resume.content.experience.filter((_, i) => i !== index) })}><Trash2 size={15} /></button></div>
              <div className="form-grid">
                <label>Job title<input value={item.role} onChange={event => updateExperience(index, { role: event.target.value })} placeholder="Role" /></label>
                <label>Company<input value={item.company} onChange={event => updateExperience(index, { company: event.target.value })} placeholder="Company" /></label>
                <label>Location<input value={item.location} onChange={event => updateExperience(index, { location: event.target.value })} placeholder="City or remote" /></label>
                <label>Dates<input value={[item.start_date, item.end_date].filter(Boolean).join(' – ')} onChange={event => { const [start_date = '', end_date = ''] = event.target.value.split('–').map(value => value.trim()); updateExperience(index, { start_date, end_date }) }} placeholder="2022 – Present" /></label>
              </div>
              <span className="field-label">Achievement bullets</span>
              {item.bullets.map((bullet, bulletIndex) => <div className="bullet-edit" key={`${item.id}-${bulletIndex}`}>
                <textarea aria-label={`Role ${index + 1} bullet ${bulletIndex + 1}`} value={bullet} rows={2} onChange={event => updateExperience(index, { bullets: item.bullets.map((value, i) => i === bulletIndex ? event.target.value : value) })} placeholder="Describe a contribution you can substantiate." />
                <div className="bullet-actions">
                  <button type="button" onClick={() => void rewriteBullet(index, bulletIndex)} disabled={busy === `rewrite-${index}-${bulletIndex}`} aria-label="Rewrite bullet with AI" title="Rewrite with local AI">{busy === `rewrite-${index}-${bulletIndex}` ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}</button>
                  <button type="button" onClick={() => updateExperience(index, { bullets: item.bullets.filter((_, i) => i !== bulletIndex) })} aria-label="Remove bullet"><Trash2 size={14} /></button>
                </div>
              </div>)}
              <button className="text-button subtle" type="button" onClick={() => updateExperience(index, { bullets: [...item.bullets, ''] })}><Plus size={14} /> Add bullet</button>
            </div>)}

            <div className="editor-subhead"><h3>Education</h3><button className="text-button" type="button" onClick={() => updateContent({ education: [...resume.content.education, newEducation()] })}><Plus size={15} /> Add education</button></div>
            {resume.content.education.map((item, index) => <div className="repeat-section" key={item.id}>
              <div className="repeat-heading"><strong>Education {index + 1}</strong><button className="icon-button danger" type="button" aria-label="Remove education" onClick={() => updateContent({ education: resume.content.education.filter((_, i) => i !== index) })}><Trash2 size={15} /></button></div>
              <div className="form-grid">
                <label>Institution<input value={item.institution} onChange={event => updateContent({ education: resume.content.education.map((entry, i) => i === index ? { ...entry, institution: event.target.value } : entry) })} /></label>
                <label>Degree<input value={item.degree} onChange={event => updateContent({ education: resume.content.education.map((entry, i) => i === index ? { ...entry, degree: event.target.value } : entry) })} /></label>
                <label>Field of study<input value={item.field} onChange={event => updateContent({ education: resume.content.education.map((entry, i) => i === index ? { ...entry, field: event.target.value } : entry) })} /></label>
                <label>Dates<input value={[item.start_date, item.end_date].filter(Boolean).join(' – ')} onChange={event => { const [start_date = '', end_date = ''] = event.target.value.split('–').map(value => value.trim()); updateContent({ education: resume.content.education.map((entry, i) => i === index ? { ...entry, start_date, end_date } : entry) }) }} placeholder="2018 – 2022" /></label>
              </div>
            </div>)}

            <div className="editor-subhead"><h3>Skills</h3></div>
            <label>Skills <small>Separate with commas</small><input value={resume.content.skills.join(', ')} onChange={event => updateContent({ skills: event.target.value.split(',').map(value => value.trim()).filter(Boolean) })} placeholder="Research, Figma, ..." /></label>
            <label>Certifications <small>Separate with commas</small><input value={resume.content.certifications.join(', ')} onChange={event => updateContent({ certifications: event.target.value.split(',').map(value => value.trim()).filter(Boolean) })} placeholder="Certification name, ..." /></label>
            <div className="editor-subhead"><h3>Projects</h3><button className="text-button" type="button" onClick={() => updateContent({ projects: [...resume.content.projects, newProject()] })}><Plus size={15} /> Add project</button></div>
            {resume.content.projects.map((item, index) => <div className="repeat-section" key={item.id}>
              <div className="repeat-heading"><strong>Project {index + 1}</strong><button className="icon-button danger" type="button" aria-label="Remove project" onClick={() => updateContent({ projects: resume.content.projects.filter((_, i) => i !== index) })}><Trash2 size={15} /></button></div>
              <label>Project name<input value={item.name} onChange={event => updateContent({ projects: resume.content.projects.map((entry, i) => i === index ? { ...entry, name: event.target.value } : entry) })} /></label>
              <label>Description<textarea rows={2} value={item.description} onChange={event => updateContent({ projects: resume.content.projects.map((entry, i) => i === index ? { ...entry, description: event.target.value } : entry) })} /></label>
              <label>Technologies <small>Separate with commas</small><input value={item.technologies.join(', ')} onChange={event => updateContent({ projects: resume.content.projects.map((entry, i) => i === index ? { ...entry, technologies: event.target.value.split(',').map(value => value.trim()).filter(Boolean) } : entry) })} /></label>
            </div>)}
            <div className="import-row"><input ref={importInput} className="sr-only" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => void importResume(event.target.files?.[0])} />
              <button type="button" className="ghost" onClick={() => importInput.current?.click()} disabled={busy === 'import'}>{busy === 'import' ? <LoaderCircle size={15} className="spin" /> : <FileText size={15} />} Import existing PDF / DOCX</button>
            </div>
          </section>

          <section className="preview-column">
            <div className="preview-toolbar"><div><span className="status-dot" /> Live preview</div>
              <select aria-label="Resume template" value={resume.template} onChange={event => update({ template: event.target.value as Resume['template'] })}>{templateChoices.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select>
            </div>
            <ResumePreview resume={resume} />
          </section>
        </div>}

        {view === 'templates' && <div className="page-grid">
          <section className="card page-card"><p className="eyebrow">PRESENTATION</p><h2>Choose a template</h2><p className="page-intro">Switch layouts instantly. Your content stays exactly the same.</p>
            <div className="template-list">{templateChoices.map(template => <button type="button" key={template.id} className={`template-option ${resume.template === template.id ? 'selected' : ''}`} onClick={() => update({ template: template.id })}>
              <span className={`template-swatch swatch-${template.id}`}><i /><i /><i /><i /></span><span><strong>{template.name}</strong><small>{template.description}</small></span><span className="radio-mark">{resume.template === template.id && <Check size={14} />}</span>
            </button>)}</div>
          </section>
          <section className="template-preview"><div className="preview-toolbar"><span>Preview · {resume.template}</span></div><ResumePreview resume={resume} /></section>
        </div>}

        {view === 'job-match' && <div className="page-grid job-page">
          <section className="card page-card"><span className="page-icon"><BriefcaseBusiness size={19} /></span><p className="eyebrow">TARGET A ROLE</p><h2>Compare with a job description</h2><p className="page-intro">See which words appear in your resume and where there may be gaps. Only include skills and experience that are accurate.</p>
            <label>Job description<textarea rows={13} value={jobDescription} onChange={event => setJobDescription(event.target.value)} placeholder="Paste the job description here…" /></label>
            <button className="primary" type="button" onClick={() => void runReview()} disabled={busy === 'analysis'}>{busy === 'analysis' ? <LoaderCircle size={16} className="spin" /> : <Target size={16} />}{busy === 'analysis' ? 'Comparing…' : 'Analyze match'}</button>
          </section>
          <section className="card page-card results-card"><p className="eyebrow">MATCH RESULTS</p><h2>Keyword coverage</h2><Insights analysis={null} match={match} /><div className="resume-mini-preview"><p className="eyebrow">LIVE RESUME</p><ResumePreview resume={resume} /></div></section>
        </div>}

        {view === 'insights' && <div className="insights-page">
          <section className="card page-card ats-upload-card">
            <div className="upload-intro">
              <span className="page-icon"><FileSearch size={19} /></span>
              <div><p className="eyebrow">UPLOAD A RESUME</p><h2>Check an existing resume</h2>
                <p className="page-intro">Upload a text-based PDF or DOCX to extract the text, inspect common ATS sections, and calculate a transparent resume score. Files are analyzed locally and are not added to your saved resumes.</p>
              </div>
            </div>
            <label className="ats-job-label" htmlFor="uploaded-job-description">
              Optional job description <span>for role-specific keyword matching</span>
              <textarea id="uploaded-job-description" rows={3} value={jobDescription} onChange={event => setJobDescription(event.target.value)} placeholder="Paste the target job description to see matched and missing keywords…" />
            </label>
            <input
              ref={atsUploadInput}
              className="sr-only"
              id="ats-resume-upload"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={event => selectAtsResume(event.target.files?.[0])}
            />
            <div className="ats-upload-controls">
              <button className="ghost" type="button" onClick={() => atsUploadInput.current?.click()} disabled={busy === 'ats-upload'}>
                <Upload size={16} /> Choose PDF or DOCX
              </button>
              <span className="upload-file-name">{uploadedFile?.name ?? 'No file selected · up to 10 MB'}</span>
              <button className="primary" type="button" onClick={() => void analyzeUploadedResume()} disabled={!uploadedFile || busy === 'ats-upload'}>
                {busy === 'ats-upload' ? <LoaderCircle size={16} className="spin" /> : <BarChart3 size={16} />}
                {busy === 'ats-upload' ? 'Extracting & scoring…' : 'Upload and check ATS score'}
              </button>
            </div>
            {busy === 'ats-upload' && <div className="upload-progress" role="status"><LoaderCircle size={15} className="spin" /> Extracting text and checking contact details, headings, readability, impact, and keywords…</div>}
            {uploadedAnalysis && <div className="uploaded-results" aria-live="polite">
              <div className="upload-result-heading">
                <div><p className="eyebrow">DOCUMENT REVIEW</p><h3>{uploadedAnalysis.filename}</h3><p>{uploadedAnalysis.word_count} readable words extracted. This file has not been saved.</p></div>
                <span className="upload-score">{uploadedAnalysis.analysis.score}<small>/100</small></span>
              </div>
              <div className="analysis-steps">
                {Object.entries(uploadedAnalysis.sections_found).map(([section, found]) => <span className={found ? 'step-found' : 'step-missing'} key={section}>
                  {found ? <Check size={13} /> : <span className="step-x">!</span>}{section.charAt(0).toUpperCase() + section.slice(1)}
                </span>)}
                <span className="step-found"><Check size={13} />Text extracted</span>
              </div>
              <Insights analysis={uploadedAnalysis.analysis} match={uploadedAnalysis.match} />
              <details className="extracted-text">
                <summary>Review extracted text</summary>
                <pre>{uploadedAnalysis.extracted_text}</pre>
              </details>
              <p className="disclaimer">{uploadedAnalysis.analysis.disclaimer}</p>
            </div>}
            <p className="upload-note">Scanned image-only PDFs may not contain selectable text; OCR is not included. A low score highlights review opportunities, not a hiring prediction.</p>
          </section>
          <section className="card page-card insights-main"><div className="section-heading"><div><p className="eyebrow">RESUME HEALTH</p><h2>Insights & ATS review</h2></div>
            <button type="button" className="primary" onClick={() => void runReview()} disabled={busy === 'analysis'}>{busy === 'analysis' ? <LoaderCircle size={16} className="spin" /> : <BarChart3 size={16} />} Run analysis</button></div>
            <p className="page-intro">A transparent content review with practical structure, readability, impact, and keyword checks. It is not a prediction of ATS results.</p>
            <Insights analysis={analysis} match={match} />
            {analysis?.disclaimer && <p className="disclaimer">{analysis.disclaimer}</p>}
          </section>
          <section className="card page-card"><p className="eyebrow">JOB TARGETING</p><h3>Refine keyword analysis</h3><p className="page-intro">Paste a job description to compare your resume with a specific role.</p>
            <label className="sr-only" htmlFor="insights-job">Job description</label><textarea id="insights-job" rows={8} value={jobDescription} onChange={event => setJobDescription(event.target.value)} placeholder="Paste a job description…" />
            <button type="button" className="secondary full" onClick={() => void runReview()} disabled={busy === 'analysis'}><Target size={16} /> Compare resume</button>
          </section>
        </div>}

        {view === 'copilot' && <div className="copilot-page"><div className="copilot-intro"><span className="page-icon"><Sparkles size={19} /></span><p className="eyebrow">PRIVATE BY DESIGN</p><h2>Resume copilot</h2><p>Ask for grounded resume feedback, wording improvements, or interview practice. Responses are generated by your local Ollama model and use the resume facts you provided.</p></div>
          <ChatPanel embedded content={resume.content} jobDescription={jobDescription} />
        </div>}
      </main>

      {view !== 'copilot' && (chatOpen ? <ChatPanel content={resume.content} jobDescription={jobDescription} onClose={() => setChatOpen(false)} /> :
        <button className="chat-fab" type="button" onClick={() => setChatOpen(true)}><MessageCircle size={18} /> Ask copilot</button>)}
    </div>
  )
}
