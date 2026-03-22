import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsCheckbox, OptionsInput } from '../../components/workspace/OptionsComponents'

export type InputMode = 'paste' | 'file'
export type ContentHint =
  | 'auto'          // auto-detect (default)
  | 'plain_text'    // unstructured prose
  | 'code'          // source code of any language
  | 'csv_table'     // CSV or TSV data
  | 'json_data'     // JSON object or array
  | 'xml_data'      // XML
  | 'html_page'     // HTML to clean and convert
  | 'key_value'     // key: value pairs / .env style / config files
  | 'log_output'    // terminal/log output
  | 'numbered_list' // already has 1. 2. 3. structure
  | 'bullet_list'   // already has - or * bullets
  | 'meeting_notes' // prose with action items, attendees
  | 'changelog'     // version-tagged entries
  | 'readme'        // existing readme to reformat

export interface TextToMarkdownOptions {
  contentHint: ContentHint         // default 'auto'
  // Formatting options:
  addTitleFromContent: boolean     // extract/generate an H1 title (default true)
  addTableOfContents: boolean      // add TOC for long docs (default false)
  wrapCodeBlocks: boolean          // detect code and wrap in ``` (default true)
  detectLanguage: boolean          // try to detect code language for syntax hint (default true)
  convertUrlsToLinks: boolean      // bare URLs → [url](url) (default true)
  highlightKeyTerms: boolean       // bold first occurrence of key terms (default false)
  addHorizontalRules: boolean      // add --- between major sections (default true)
  tableBorderStyle: 'github' | 'simple'  // default 'github'
  lineBreakMode: 'preserve' | 'normalize' // default 'normalize'
  addFrontMatter: boolean          // add YAML front matter block (default false)
  frontMatterFields: string        // comma-separated: "title,date,author,tags" (default "title,date")
  showPreview: boolean             // default true
}

const HINTS: { value: ContentHint; label: string }[] = [
  { value: 'auto', label: 'Auto Detect ✨' },
  { value: 'plain_text', label: 'Plain Text' },
  { value: 'code', label: 'Source Code' },
  { value: 'csv_table', label: 'CSV / Table' },
  { value: 'json_data', label: 'JSON Data' },
  { value: 'xml_data', label: 'XML Data' },
  { value: 'html_page', label: 'HTML Page' },
  { value: 'key_value', label: 'Key-Value' },
  { value: 'log_output', label: 'Log Output' },
  { value: 'bullet_list', label: 'Bullet List' },
  { value: 'numbered_list', label: 'Numbered List' },
  { value: 'meeting_notes', label: 'Meeting Notes' },
  { value: 'changelog', label: 'Changelog' },
  { value: 'readme', label: 'README' },
]

function TextToMarkdownOptionsComponent({ options, onChange }: ToolOptionsComponentProps<TextToMarkdownOptions>) {
  const handleUpdate = (updates: Partial<TextToMarkdownOptions>) => {
    onChange({ ...options, ...updates })
  }

  return (
    <div className="space-y-6">
      <OptionsSection label="Content Discovery">
        <OptionsSelect
          label="Source Content Hint"
          value={options.contentHint}
          onChange={(val) => handleUpdate({ contentHint: val as ContentHint })}
          options={HINTS}
        />
        <p className="text-[11px] text-secondary mt-3 italic">
          Helps the engine choose the best transformation strategy. Auto-detect is usually sufficient.
        </p>
      </OptionsSection>

      <OptionsSection label="Structural Rules">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <OptionsCheckbox
            label="Extract Title (H1)"
            checked={options.addTitleFromContent}
            onChange={(val) => handleUpdate({ addTitleFromContent: val })}
          />
          <OptionsCheckbox
            label="Convert URLs to Links"
            checked={options.convertUrlsToLinks}
            onChange={(val) => handleUpdate({ convertUrlsToLinks: val })}
          />
          <OptionsCheckbox
            label="Wrap Code Blocks"
            checked={options.wrapCodeBlocks}
            onChange={(val) => handleUpdate({ wrapCodeBlocks: val })}
          />
          <OptionsCheckbox
            label="Detect Language"
            checked={options.detectLanguage}
            disabled={!options.wrapCodeBlocks}
            onChange={(val) => handleUpdate({ detectLanguage: val })}
          />
          <OptionsCheckbox
            label="Add Table of Contents"
            checked={options.addTableOfContents}
            onChange={(val) => handleUpdate({ addTableOfContents: val })}
          />
          <OptionsCheckbox
            label="Add Section Dividers"
            checked={options.addHorizontalRules}
            onChange={(val) => handleUpdate({ addHorizontalRules: val })}
          />
          <OptionsCheckbox
            label="Highlight Key Terms"
            checked={options.highlightKeyTerms}
            onChange={(val) => handleUpdate({ highlightKeyTerms: val })}
          />
          <OptionsCheckbox
            label="Add YAML Frontmatter"
            checked={options.addFrontMatter}
            onChange={(val) => handleUpdate({ addFrontMatter: val })}
          />
        </div>

        {options.addFrontMatter && (
          <div className="mt-6">
            <OptionsInput
              label="Frontmatter Keys"
              value={options.frontMatterFields}
              onChange={(val) => handleUpdate({ frontMatterFields: val })}
              placeholder="title, date, author"
            />
          </div>
        )}
      </OptionsSection>

      <OptionsSection label="Advanced Syntax" noBorder>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <OptionsSelect
            label="Line Processing"
            value={options.lineBreakMode}
            onChange={(val) => handleUpdate({ lineBreakMode: val as any })}
            options={[
              { value: 'normalize', label: 'Normalize' },
              { value: 'preserve', label: 'Preserve' },
            ]}
          />
          <OptionsSelect
            label="Table dialect"
            value={options.tableBorderStyle}
            onChange={(val) => handleUpdate({ tableBorderStyle: val as any })}
            options={[
              { value: 'github', label: 'GitHub GFM' },
              { value: 'simple', label: 'Simple' },
            ]}
          />
        </div>
        <div className="mt-6">
          <OptionsCheckbox
            label="Visual Live Preview"
            checked={options.showPreview}
            onChange={(val) => handleUpdate({ showPreview: val })}
          />
        </div>
      </OptionsSection>
    </div>
  )
}

function detectContentType(text: string): ContentHint {
  const lines = text.split('\n')
  const sample = text.slice(0, 1000).trim()

  if ((sample.startsWith('{') && sample.endsWith('}')) || (sample.startsWith('[') && sample.endsWith(']'))) {
    try {
      JSON.parse(sample)
      return 'json_data'
    } catch {}
  }

  if (sample.startsWith('<?xml') || sample.startsWith('<root') || (sample.includes('<') && sample.includes('>') && sample.match(/<\/.*?>/g)?.length)) {
    return 'xml_data'
  }

  if (sample.startsWith('<!DOCTYPE') || sample.startsWith('<html') || sample.toLowerCase().includes('</body>')) {
    return 'html_page'
  }

  const commaLines = lines.filter(l => l.includes(',')).length
  const tabLines = lines.filter(l => l.includes('\t')).length
  if (commaLines / lines.length > 0.6 || tabLines / lines.length > 0.6) {
    return 'csv_table'
  }

  const kvLines = lines.filter(l => l.match(/^[a-zA-Z0-9_\-\.]+[\s]*[:=][\s]*.*$/)).length
  if (kvLines / lines.length > 0.5) {
    return 'key_value'
  }

  const logLines = lines.filter(l => l.match(/^[0-9\[\\]|(ERROR|WARN|INFO|DEBUG|TRACE|FATAL)/)).length
  if (logLines / lines.length > 0.3) {
    return 'log_output'
  }

  const bulletLines = lines.filter(l => l.trim().startsWith('- ') || l.trim().startsWith('* ')).length
  if (bulletLines / lines.length > 0.4) {
    return 'bullet_list'
  }

  const numberedLines = lines.filter(l => l.trim().match(/^\d+\.\s/)).length
  if (numberedLines / lines.length > 0.4) {
    return 'numbered_list'
  }

  const codeMatch = sample.match(/\b(function|class|import|const|let|def|fn|public class|SELECT|xmlns)\b/)
  if (codeMatch) {
    return 'code'
  }

  if (text.includes('## ') || text.startsWith('# ')) {
    return 'readme'
  }

  return 'plain_text'
}

function extractTitle(lines: string[]): { title: string; remaining: string[] } {
  const titleLine = lines.find(l => l.trim().length > 0 && l.trim().length < 60 && !l.endsWith('.'))
  if (titleLine) {
    return { title: titleLine.trim(), remaining: lines.filter(l => l !== titleLine) }
  }
  return { title: 'Untitled Document', remaining: lines }
}

function convertUrls(text: string): string {
  // Simple URL regex
  return text.replace(/(^|[^"'])(https?:\/\/[^\s\)<>]+)($|[^"'])/g, '$1[$2]($2)$3')
}

// Simplified core parser, a true implementation would be longer
function convertToMarkdown(text: string, hint: ContentHint, options: TextToMarkdownOptions): string {
  let frontMatter = ''

  if (options.addFrontMatter) {
    const fields = options.frontMatterFields.split(',').map(f => f.trim()).filter(Boolean)
    frontMatter = '---\n'
    fields.forEach(f => {
      frontMatter += `${f}: ${f === 'date' ? new Date().toISOString().split('T')[0] : '""'}\n`
    })
    frontMatter += '---\n\n'
  }

  let finalContent = ''

  if (hint === 'plain_text' || hint === 'readme') {
    let lines = text.split(options.lineBreakMode === 'normalize' ? /\r?\n/ : '\n')
    if (options.addTitleFromContent && !text.includes('# ')) {
      const { title, remaining } = extractTitle(lines)
      lines = remaining
      finalContent = `# ${title}\n\n`
    }
    
    // Convert to paras
    let paras = lines.join('\n').split('\n\n')
    paras = paras.map(p => {
      let pt = p.trim()
      if (pt === pt.toUpperCase() && pt.length > 3 && pt.length < 50 && !pt.includes('\n')) {
        return `## ${pt}`
      }
      // Sentence that looks like heading
      if (pt.length < 60 && !pt.endsWith('.') && !pt.includes('\n') && paras.length > 1) {
        return `### ${pt}`
      }
      return pt
    })
    finalContent += paras.join('\n\n')

    if (options.convertUrlsToLinks) {
      finalContent = convertUrls(finalContent)
    }

  } else if (hint === 'code') {
    let lang = ''
    if (options.detectLanguage) {
      if (text.match(/\b(import|from|const|let|=>)\b/)) lang = 'javascript'
      else if (text.match(/\b(def|class|print\()\b/)) lang = 'python'
      else if (text.match(/\b(func|package|fmt\.)\b/)) lang = 'go'
    }
    if (options.addTitleFromContent) finalContent = `# Code Snippet\n\n`
    finalContent += '```' + lang + '\n' + text + '\n```'
  } else if (hint === 'csv_table') {
    function parseCSV(text: string): string[][] {
      const lines = text.trim().split('\n').filter(l => l.trim() !== '')
      return lines.map(line => {
        const delimiter = line.includes('\t') ? '\t' : ','
        const cells: string[] = []
        let current = ''
        let inQuote = false
        for (let i = 0; i < line.length; i++) {
          const ch = line[i]
          if (ch === '"') { inQuote = !inQuote; continue }
          if (ch === delimiter && !inQuote) {
            cells.push(current.trim()); current = ''; continue
          }
          current += ch
        }
        cells.push(current.trim())
        return cells
      })
    }

    function trimEmptyTrailingColumns(rows: string[][]): string[][] {
      if (rows.length === 0) return rows
      const maxCols = Math.max(...rows.map(r => r.length))
      let lastNonEmpty = 0
      for (let col = 0; col < maxCols; col++) {
        const hasContent = rows.some(row => row[col] && row[col].trim() !== '')
        if (hasContent) lastNonEmpty = col
      }
      return rows.map(row => row.slice(0, lastNonEmpty + 1))
    }

    function buildMarkdownTable(rows: string[][]): string {
      if (rows.length === 0) return ''
      const headers = rows[0]
      const dataRows = rows.slice(1)
      
      const colWidths = headers.map((h, ci) => {
        const dataMax = dataRows.reduce((max, row) => {
          return Math.max(max, (row[ci] ?? '').length)
        }, 0)
        return Math.max((h ?? '').length, dataMax, 3)
      })
      
      const pad = (str: string, width: number) =>
        str + ' '.repeat(Math.max(0, width - str.length))
      
      const headerRow = '| ' + headers.map((h,i) => pad(h ?? '', colWidths[i])).join(' | ') + ' |'
      const sepRow   = '| ' + colWidths.map(w => '-'.repeat(w)).join(' | ') + ' |'
      const dataRowsStr = dataRows.map(row =>
        '| ' + headers.map((_,i) => pad(row[i] ?? '', colWidths[i])).join(' | ') + ' |'
      ).join('\n')
      
      return [headerRow, sepRow, dataRowsStr].join('\n')
    }

    let parsed = parseCSV(text)
    parsed = trimEmptyTrailingColumns(parsed)
    if (parsed.length > 0) {
      if (options.addTitleFromContent) finalContent = `# Data Table\n\n`
      finalContent += `_[${parsed.length > 1 ? parsed.length - 1 : 0} rows · ${parsed[0].length} columns · converted from CSV]_\n\n`
      finalContent += buildMarkdownTable(parsed)
      finalContent += '\n'
    }
  } else if (hint === 'json_data') {
    if (options.addTitleFromContent) finalContent = `# JSON Data\n\n`
    
    try {
      const data = JSON.parse(text)
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        const keys = Object.keys(data[0])
        finalContent += `## Data (${data.length} items)\n\n`
        finalContent += `| ${keys.join(' | ')} |\n`
        finalContent += `| ${keys.map(() => '---').join(' | ')} |\n`
        for (let i = 0; i < Math.min(data.length, 20); i++) {
          finalContent += `| ${keys.map(k => String(data[i][k] ?? '').slice(0, 50)).join(' | ')} |\n`
        }
        finalContent += `\n<details>\n<summary>Raw JSON</summary>\n\n`
      }
    } catch {}
    
    finalContent += '```json\n' + JSON.stringify(JSON.parse(text || '{}'), null, 2) + '\n```'
    if (finalContent.includes('<details>')) {
       finalContent += '\n\n</details>'
    }
  } else if (hint === 'xml_data') {
    if (options.addTitleFromContent) finalContent = `# XML Document\n\n`
    const rootMatch = text.match(/<([a-zA-Z0-9_-]+)/)
    if (rootMatch) {
      finalContent += `**Root element:** \`<${rootMatch[1]}>\`\n\n`
    }
    finalContent += '```xml\n' + text + '\n```'
  } else if (hint === 'html_page') {
    if (options.addTitleFromContent) finalContent = `# HTML Document\n\n`
    
    let processed = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    
    // Super simple HTML to MD logic for the required spec
    processed = processed.replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (_, level, content) => `${'#'.repeat(Number(level))} ${content}\n\n`)
    processed = processed.replace(/<(strong|b)>(.*?)<\/\1>/gi, '**$2**')
    processed = processed.replace(/<(em|i)>(.*?)<\/\1>/gi, '_$2_')
    processed = processed.replace(/<a href="(.*?)">(.*?)<\/a>/gi, '[$2]($1)')
    processed = processed.replace(/<li>(.*?)<\/li>/gi, '- $1\n')
    processed = processed.replace(/<code>(.*?)<\/code>/gi, '`$1`')
    processed = processed.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n')
    processed = processed.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '> $1\n')
    processed = processed.replace(/<hr\s*\/?>/gi, '---\n')
    
    processed = processed.replace(/<[^>]+>/g, '') // strip rest
    processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n') // cleanup newlines
    
    // simple HTML Entity decode
    processed = processed.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    
    finalContent += processed.trim()
  } else if (hint === 'key_value') {
    if (options.addTitleFromContent) finalContent = `# Configuration\n\n`
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
    finalContent += `| Key | Value |\n| --- | --- |\n`
    
    for (const line of lines) {
      if (line.startsWith('[') && line.endsWith(']')) {
        finalContent += `\n## ${line.slice(1, -1)}\n\n| Key | Value |\n| --- | --- |\n`
        continue
      }
      
      const match = line.match(/^([^:=]+)[:=](.*)$/)
      if (match) {
        let key = match[1].trim()
        let val = match[2].trim()
        
        if (/password|secret|token|key|auth|api_key|private/i.test(key)) {
           val = '••••••••'
        }
        finalContent += `| ${key} | ${val} |\n`
      }
    }
  } else if (hint === 'log_output') {
    if (options.addTitleFromContent) finalContent = `# Log Output\n\n`
    finalContent += '```log\n' + text + '\n```'
  } else {
    // bullet_list / numbered_list fallback
    finalContent = text
  }

  if (options.addHorizontalRules && finalContent.includes('## ')) {
    finalContent = finalContent.replace(/\n## /g, '\n\n---\n\n## ')
  }

  return frontMatter + finalContent.trim()
}

const module: ToolModule<TextToMarkdownOptions> = {
  defaultOptions: {
    contentHint: 'auto',
    addTitleFromContent: true,
    addTableOfContents: false,
    wrapCodeBlocks: true,
    detectLanguage: true,
    convertUrlsToLinks: true,
    highlightKeyTerms: false,
    addHorizontalRules: true,
    tableBorderStyle: 'github',
    lineBreakMode: 'normalize',
    addFrontMatter: false,
    frontMatterFields: 'title, date',
    showPreview: true
  },
  OptionsComponent: TextToMarkdownOptionsComponent,
  async run(files, options, helpers) {
    let text = ''

    if (files.length > 0) {
      text = await files[0].file.text()
    } else {
      // Find pasted text from runtime somehow? Wait, WorkspacePage injects via options.pastedText?
      // "Else: Text comes from options.pastedText (the workspace paste field)"
      // Let's add it dynamically to options type to make typescript happy.
      text = (options as any).pastedText || ''
    }

    if (!text.trim()) {
      throw new Error('Paste some text or upload a file to convert.')
    }

    helpers.onProgress({ phase: 'processing', value: 0.2, message: 'Analyzing content...' })

    let hint = options.contentHint
    if (hint === 'auto') {
      hint = detectContentType(text)
    }

    helpers.onProgress({ phase: 'processing', value: 0.6, message: `Converting as ${hint}...` })

    const outputMd = convertToMarkdown(text, hint, options)
    
    const blob = new Blob([outputMd], { type: 'text/markdown' })
    const filename = files.length > 0 
      ? `${files[0].name.replace(/\.[^.]+$/, '')}-formatted.md` 
      : 'converted-text.md'

    helpers.onProgress({ phase: 'finalizing', value: 1.0, message: 'Done!' })

    return {
      outputs: [
        {
          id: crypto.randomUUID(),
          name: filename,
          blob,
          type: 'text/markdown',
          size: blob.size,
        },
      ],
      preview: {
        kind: options.showPreview ? 'markdown-tabs' : 'text',
        title: 'Markdown Generated',
        summary: `Converted as ${hint}.`,
        textContent: outputMd,
        copyText: outputMd,
        metadata: [
          { label: 'Content Type', value: hint },
          { label: 'Lines out', value: String(outputMd.split('\n').length) },
        ],
      },
    }
  },
}

export default module
