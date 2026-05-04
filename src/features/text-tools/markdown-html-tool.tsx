import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface MarkdownHtmlOptions {
  direction: 'md-to-html' | 'html-to-md'
  wrapInDocument: boolean
  gfm: boolean
  headingStyle: 'atx' | 'setext'
}

function MarkdownHtmlOptionsComponent({ options, onChange }: ToolOptionsComponentProps<MarkdownHtmlOptions>) {
  return (
    <OptionsSection label="Converter Settings" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Conversion Pathway"
          value={options.direction}
          onChange={(val) => onChange({ ...options, direction: val as MarkdownHtmlOptions['direction'] })}
          options={[
            { value: 'md-to-html', label: 'Markdown → HTML' },
            { value: 'html-to-md', label: 'HTML → Markdown' },
          ]}
        />
        {options.direction === 'html-to-md' && (
          <OptionsSelect
            label="MD Heading Style"
            value={options.headingStyle}
            onChange={(val) => onChange({ ...options, headingStyle: val as MarkdownHtmlOptions['headingStyle'] })}
            options={[
              { value: 'atx', label: 'ATX (# H1)' },
              { value: 'setext', label: 'Setext (H1 ===)' },
            ]}
          />
        )}
      </div>

      <div className="mt-6 space-y-4">
        {options.direction === 'md-to-html' && (
          <>
            <OptionsCheckbox
              label="Enable GitHub Flavored Markdown (GFM)"
              checked={options.gfm}
              onChange={(val) => onChange({ ...options, gfm: val })}
            />
            <OptionsCheckbox
              label="Wrap in standalone HTML boilerplate"
              checked={options.wrapInDocument}
              onChange={(val) => onChange({ ...options, wrapInDocument: val })}
            />
          </>
        )}
      </div>
      <p className="text-xs text-secondary mt-4">
        Bidirectional document transformation using Marked and Turndown engines.
        {options.direction === 'md-to-html' && options.wrapInDocument && (
          <span className="block mt-1 text-amber-500"> ⚠ The output HTML file will execute scripts if opened in a browser — this is expected.</span>
        )}
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<MarkdownHtmlOptions> = {
  defaultOptions: {
    direction: 'md-to-html',
    wrapInDocument: false,
    gfm: true,
    headingStyle: 'atx',
  },
  OptionsComponent: MarkdownHtmlOptionsComponent,
  async run(files, options, helpers) {
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.3, message: `Converting ${input.name}` })
    const text = await input.file.text()

    let output: string
    let extension: string
    let mimeType: string

    if (options.direction === 'md-to-html') {
      const { marked } = await import('marked')
      // Fix #25: pass options per-call instead of mutating global marked state
      const html = await marked.parse(text, { gfm: options.gfm, breaks: true })
      output = options.wrapInDocument
        ? `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Converted Document</title>\n</head>\n<body>\n${html}\n</body>\n</html>`
        : html
      extension = 'html'
      mimeType = 'text/html'
    } else {
      const TurndownService = (await import('turndown')).default
      const td = new TurndownService({ headingStyle: options.headingStyle })
      output = td.turndown(text)
      extension = 'md'
      mimeType = 'text/markdown'
    }

    const blob = new Blob([output], { type: mimeType })
    helpers.onProgress({ phase: 'finalizing', value: 1, message: `Converted ${input.name}` })

    return {
      outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}.${extension}`, blob, type: mimeType, size: blob.size }],
      preview: {
        kind: 'text',
        title: `${options.direction === 'md-to-html' ? 'Markdown → HTML' : 'HTML → Markdown'} conversion complete`,
        summary: `${input.name} was converted entirely in memory.`,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Direction', value: options.direction === 'md-to-html' ? 'Markdown → HTML' : 'HTML → Markdown' },
          { label: 'Characters', value: `${output.length}` },
        ],
      },
    }
  },
}

export default module
