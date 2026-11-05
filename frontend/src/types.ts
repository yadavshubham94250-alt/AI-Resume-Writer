export type Link = { label: string; url: string }
export type Experience = {
  id: string
  company: string
  role: string
  location: string
  start_date: string
  end_date: string
  bullets: string[]
  technologies: string[]
}
export type Education = {
  id: string
  institution: string
  degree: string
  field: string
  start_date: string
  end_date: string
  grade: string
}
export type Project = {
  id: string
  name: string
  description: string
  technologies: string[]
  bullets: string[]
  links: Link[]
}
export type ResumeContent = {
  contact: { name: string; email: string; phone: string; location: string; links: Link[] }
  summary: string
  experience: Experience[]
  education: Education[]
  projects: Project[]
  skills: string[]
  certifications: string[]
  achievements: string[]
}
export type Resume = {
  id?: string
  created_at?: string
  updated_at?: string
  title: string
  target_role: string
  template: 'classic' | 'modern' | 'minimal'
  content: ResumeContent
}

export const blankResume: Resume = {
  title: 'Untitled resume',
  target_role: '',
  template: 'modern',
  content: {
    contact: { name: '', email: '', phone: '', location: '', links: [] },
    summary: '',
    experience: [],
    education: [],
    projects: [],
    skills: [],
    certifications: [],
    achievements: [],
  },
}
