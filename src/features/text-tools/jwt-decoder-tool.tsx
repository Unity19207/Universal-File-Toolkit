import type { ToolModule } from '../../core/plugins/types'
import { OptionsSection } from '../../components/workspace/OptionsComponents'

function base64UrlToJson(segment: string) {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const decoded = atob(padded)
  const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
}

const module: ToolModule<Record<string, never>> = {
  defaultOptions: {},
  OptionsComponent() {
    return (
      <OptionsSection label="Info" noBorder>
        <p className="text-xs text-secondary">
          Decodes JWT segments (Header/Payload) instantly in your browser. 
          Signature verification is not performed.
        </p>
      </OptionsSection>
    )
  },
  async run(files, _options, helpers) {
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Processing...' })
    if (files.length === 0) return { outputs: [], preview: { kind: 'text', title: 'No input', summary: 'Paste content or upload a file to decode.', textContent: '', copyText: '' } }

    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.35, message: `Decoding ${input.name}` })
    const text = (await input.file.text()).trim().replace(/^Bearer\s+/i, '')
    const [headerPart, payloadPart, signature = ''] = text.split('.')

    if (!headerPart || !payloadPart) throw new Error('JWT tokens must contain header.payload.signature segments.')

    const header = base64UrlToJson(headerPart)
    const payload = base64UrlToJson(payloadPart)
    const exp = typeof payload.exp === 'number' ? payload.exp : null
    const result = {
      header,
      payload,
      signature,
      isExpired: exp === null ? null : Date.now() > exp * 1000,
      expiresAt: exp === null ? null : new Date(exp * 1000).toISOString(),
    }

    const output = JSON.stringify(result, null, 2)
    const blob = new Blob([output], { type: 'application/json' })

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })

    return {
      outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-decoded.json`, blob, type: 'application/json', size: blob.size }],
      preview: {
        kind: 'json',
        title: 'JWT decoded',
        summary: 'Header and payload were decoded locally. Signature verification is not performed.',
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Algorithm', value: typeof header.alg === 'string' ? header.alg : 'Unknown' },
          { label: 'Expired', value: result.isExpired === null ? 'Unknown' : result.isExpired ? 'Yes' : 'No' },
        ],
      },
    }
  },
}

export default module
