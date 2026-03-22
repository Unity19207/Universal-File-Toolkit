import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface UrlParserOptions {
  decodeUri: boolean
}

function UrlParserOptionsComponent({ options, onChange }: ToolOptionsComponentProps<UrlParserOptions>) {
  return (
    <OptionsSection label="Parsing Options" noBorder>
      <OptionsCheckbox
        label="URL-Decode search parameters and hash"
        checked={options.decodeUri}
        onChange={(val) => onChange({ ...options, decodeUri: val })}
      />
      <p className="text-xs text-secondary mt-2">
        Breaks down URLs into structured components, identifying protocols, hosts, paths, and query parameters.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<UrlParserOptions> = {
  defaultOptions: { decodeUri: true },
  OptionsComponent: UrlParserOptionsComponent,
  async run(files, options, helpers) {
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.5, message: `Parsing URL(s)` })
    
    const text = await input.file.text()
    const lines = text.split('\n').filter((l) => l.trim())
    
    if (lines.length === 1) {
      let urlStr = text.trim()
      if (!/^https?:\/\//i.test(urlStr)) urlStr = `https://${urlStr}`
      const url = new URL(urlStr)

      const queryParams: Record<string, string> = {}
      url.searchParams.forEach((value, key) => {
        queryParams[key] = options.decodeUri ? decodeURIComponent(value) : value
      })

      const parsedObj = {
        href: url.href,
        protocol: url.protocol,
        host: url.host,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        search: url.search,
        searchParams: queryParams,
        hash: options.decodeUri ? decodeURIComponent(url.hash) : url.hash,
        origin: url.origin,
      }

      const output = JSON.stringify(parsedObj, null, 2)
      const blob = new Blob([output], { type: 'application/json' })

      helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
      return {
        outputs: [{ id: crypto.randomUUID(), name: 'url-parsed.json', blob, type: 'application/json', size: blob.size }],
        preview: { kind: 'json', title: 'URL Parsed', summary: `Broken down URL into parts.`, textContent: output, copyText: output, metadata: [{ label: 'Host', value: url.hostname }] },
      }
    } else {
      const parsedUrls = lines.map((l) => {
        try {
          let urlStr = l.trim()
          if (!/^https?:\/\//i.test(urlStr)) urlStr = `https://${urlStr}`
          const url = new URL(urlStr)
          return { original: l.trim(), hostname: url.hostname, pathname: url.pathname }
        } catch {
          return { original: l.trim(), error: 'Invalid URL' }
        }
      })
      const output = JSON.stringify(parsedUrls, null, 2)
      const blob = new Blob([output], { type: 'application/json' })

      helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
      return {
        outputs: [{ id: crypto.randomUUID(), name: 'urls-parsed.json', blob, type: 'application/json', size: blob.size }],
        preview: { kind: 'json', title: 'URLs Parsed', summary: `Parsed ${lines.length} URLs.`, textContent: output, copyText: output, metadata: [{ label: 'Count', value: `${lines.length}` }] },
      }
    }
  },
}

export default module
