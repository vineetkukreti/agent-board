/**
 * Lightweight markdown renderer — no dependencies.
 * Supports: **bold**, `inline code`, ```code blocks```, [links](url), and line breaks.
 */
export default function SimpleMarkdown({ text, className = '' }) {
  if (!text) return null

  const blocks = text.split(/\n{2,}/)

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const trimmed = block.trim()
        if (!trimmed) return null

        // Code block: ```...```
        if (trimmed.startsWith('```')) {
          const code = trimmed.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
          return (
            <pre key={i} className="text-xs rounded-md p-3 my-2 overflow-x-auto font-mono"
              style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
              {code}
            </pre>
          )
        }

        // Heading: ## or ###
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={i} className="text-xs font-semibold uppercase tracking-wide mt-3 mb-1"
              style={{ color: 'var(--text-secondary)' }}>
              {renderInline(trimmed.slice(4))}
            </h4>
          )
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={i} className="text-sm font-semibold mt-3 mb-1"
              style={{ color: 'var(--text-primary)' }}>
              {renderInline(trimmed.slice(3))}
            </h3>
          )
        }

        // Regular paragraph
        const lines = trimmed.split('\n')
        return (
          <p key={i} className="text-sm leading-relaxed mb-1.5" style={{ color: 'var(--text-primary)' }}>
            {lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {renderInline(line)}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function renderInline(text) {
  // Split on **bold**, `code`, and [link](url) patterns
  const parts = []
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[2]) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {match[2]}
        </strong>
      )
    } else if (match[3]) {
      // `code`
      parts.push(
        <code key={match.index} className="text-xs px-1.5 py-0.5 rounded font-mono"
          style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--accent)' }}>
          {match[3]}
        </code>
      )
    } else if (match[4] && match[5]) {
      // [link](url)
      parts.push(
        <a key={match.index} href={match[5]} target="_blank" rel="noopener noreferrer"
          className="underline" style={{ color: 'var(--accent)' }}>
          {match[4]}
        </a>
      )
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : text
}
