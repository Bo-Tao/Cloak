import { useEffect, useRef, useState, memo, type ComponentProps } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import DOMPurify from 'dompurify'
import type { BundledLanguage } from 'shiki'
import { createHighlighter, type Highlighter } from 'shiki'

interface Props {
  content: string
}

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light'],
      langs: [
        'javascript',
        'typescript',
        'python',
        'bash',
        'json',
        'html',
        'css',
        'tsx',
        'jsx',
        'markdown',
        'yaml',
        'sql',
        'rust',
        'go',
        'diff',
      ],
    })
  }
  return highlighterPromise
}

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLPreElement>(null)
  const [html, setHtml] = useState<string | null>(null)
  const code = String(children).replace(/\n$/, '')
  const match = className?.match(/language-(\w+)/)
  const lang = match?.[1] || ''

  useEffect(() => {
    if (!lang) return
    let cancelled = false
    getHighlighter().then(async (h) => {
      if (cancelled) return
      const loadedLangs = h.getLoadedLanguages()
      if (!loadedLangs.includes(lang as BundledLanguage)) {
        try {
          await h.loadLanguage(lang as BundledLanguage)
        } catch {
          return
        }
      }
      if (cancelled) return
      const result = h.codeToHtml(code, { lang, theme: 'github-light' })
      setHtml(DOMPurify.sanitize(result))
    })
    return () => {
      cancelled = true
    }
  }, [code, lang])

  if (html) {
    return (
      <div className="relative group my-2">
        <CopyButton text={code} />
        <div
          ref={ref}
          className="rounded-lg overflow-x-auto text-sm [&_pre]:p-4 [&_pre]:m-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    )
  }

  return (
    <div className="relative group my-2">
      <CopyButton text={code} />
      <pre className="rounded-lg overflow-x-auto text-sm p-4 bg-gray-50">
        <code className={className}>{children}</code>
      </pre>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="absolute top-2 right-2 px-2 py-1 text-[10px] rounded bg-gray-200/80 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function InlineCode({ children }: { children?: React.ReactNode }) {
  return (
    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">
      {children}
    </code>
  )
}

const components: ComponentProps<typeof ReactMarkdown>['components'] = {
  code({ className, children }) {
    const isInline = !className
    if (isInline) return <InlineCode>{children}</InlineCode>
    return <CodeBlock className={className}>{children}</CodeBlock>
  },
  pre({ children }) {
    return <>{children}</>
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-terracotta hover:underline"
      >
        {children}
      </a>
    )
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full text-sm border-collapse border border-gray-200">
          {children}
        </table>
      </div>
    )
  },
  th({ children }) {
    return (
      <th className="border border-gray-200 px-3 py-2 bg-gray-50 text-left font-medium">
        {children}
      </th>
    )
  },
  td({ children }) {
    return <td className="border border-gray-200 px-3 py-2">{children}</td>
  },
}

const MarkdownRenderer = memo(function MarkdownRenderer({ content }: Props) {
  if (!content) return null

  return (
    <div className="prose prose-sm max-w-none text-gray-800 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_blockquote]:border-l-terracotta">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
})

export default MarkdownRenderer
