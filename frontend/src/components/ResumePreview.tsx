import type { Resume } from '../types'

export function ResumePreview({ resume }: { resume: Resume }) {
  const { contact, summary, experience, skills, education, projects, certifications } = resume.content
  const details = [contact.email, contact.phone, contact.location, ...contact.links.map(link => link.url)].filter(Boolean)

  return (
    <article className={`resume-preview template-${resume.template}`} aria-label="Live resume preview">
      <header>
        <h1>{contact.name || 'Your name'}</h1>
        {details.length > 0 && <p>{details.join('  ·  ')}</p>}
      </header>
      {summary && <section><h2>Profile</h2><p>{summary}</p></section>}
      {experience.length > 0 && <section>
        <h2>Experience</h2>
        {experience.map(item => (
          <div className="resume-job" key={item.id}>
            <div><strong>{item.role || 'Role'}</strong><span>{item.company}</span></div>
            <small>{[item.location, [item.start_date, item.end_date].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}</small>
            <ul>{item.bullets.filter(Boolean).map((bullet, index) => <li key={`${item.id}-bullet-${index}`}>{bullet}</li>)}</ul>
          </div>
        ))}
      </section>}
      {projects.length > 0 && <section>
        <h2>Projects</h2>
        {projects.map(project => <div className="resume-job" key={project.id}>
          <div><strong>{project.name}</strong><span>{project.technologies.join(' · ')}</span></div>
          {project.description && <p>{project.description}</p>}
          <ul>{project.bullets.filter(Boolean).map((bullet, index) => <li key={`${project.id}-bullet-${index}`}>{bullet}</li>)}</ul>
        </div>)}
      </section>}
      {education.length > 0 && <section>
        <h2>Education</h2>
        {education.map(item => <div className="resume-job" key={item.id}>
          <div><strong>{item.degree}{item.field ? `, ${item.field}` : ''}</strong><span>{item.institution}</span></div>
          <small>{[item.start_date, item.end_date].filter(Boolean).join(' – ')}</small>
        </div>)}
      </section>}
      {skills.length > 0 && <section><h2>Skills</h2><p>{skills.join(' · ')}</p></section>}
      {certifications.length > 0 && <section><h2>Certifications</h2><p>{certifications.join(' · ')}</p></section>}
    </article>
  )
}
