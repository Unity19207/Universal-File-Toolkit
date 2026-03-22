import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsInput, OptionsSelect, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface HmacGeneratorOptions {
  algorithm: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512' | 'MD5'
  secretKey: string
  outputFormat: 'hex' | 'base64'
  uppercase: boolean
}

/**
 * Standard buffer encoder for hex/base64 strings.
 */
function encodeBuffer(buffer: ArrayBuffer, format: 'hex' | 'base64', uppercase: boolean): string {
  const bytes = new Uint8Array(buffer)
  if (format === 'hex') {
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
    return uppercase ? hex.toUpperCase() : hex.toLowerCase()
  } else {
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    return btoa(binary)
  }
}

function HmacGeneratorOptionsComponent({ options, onChange }: ToolOptionsComponentProps<HmacGeneratorOptions>) {
  return (
    <>
      <OptionsSection label="Authentication Key">
        <OptionsInput
          label="Secret Key"
          type="password"
          value={options.secretKey}
          onChange={(val) => onChange({ ...options, secretKey: val })}
          placeholder="Enter secret key..."
        />
      </OptionsSection>

      <OptionsSection label="HMAC Settings" noBorder>
        <div className="grid gap-4 sm:grid-cols-2">
          <OptionsSelect
            label="Algorithm"
            value={options.algorithm}
            onChange={(val) => onChange({ ...options, algorithm: val as HmacGeneratorOptions['algorithm'] })}
            options={[
              { value: 'SHA-256', label: 'HMAC SHA-256' },
              { value: 'SHA-1', label: 'HMAC SHA-1' },
              { value: 'SHA-384', label: 'HMAC SHA-384' },
              { value: 'SHA-512', label: 'HMAC SHA-512' },
              { value: 'MD5', label: 'HMAC MD5' },
            ]}
          />
          <OptionsSelect
            label="Output Encoding"
            value={options.outputFormat}
            onChange={(val) => onChange({ ...options, outputFormat: val as HmacGeneratorOptions['outputFormat'] })}
            options={[
              { value: 'hex', label: 'Hexadecimal' },
              { value: 'base64', label: 'Base64' },
            ]}
          />
        </div>
        <OptionsCheckbox
          label="Uppercase output"
          checked={options.uppercase}
          onChange={(val) => onChange({ ...options, uppercase: val })}
        />
        <p className="text-xs text-secondary mt-2">
          Signed Message Authentication Code generated entirely client-side.
        </p>
      </OptionsSection>
    </>
  )
}

const module: ToolModule<HmacGeneratorOptions> = {
  defaultOptions: { algorithm: 'SHA-256', secretKey: '', outputFormat: 'hex', uppercase: false },
  OptionsComponent: HmacGeneratorOptionsComponent,
  async run(files, options, helpers) {
    if (!options.secretKey) throw new Error('Secret key is required for HMAC.')
    const outputs = []
    
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Calculating HMAC...' })

    if (files.length === 0) {
      // Handle potential pasted content if tool supports it via paste area (which adds file)
      // If truly no files, we just return empty or could throw. 
      // But user said "Do NOT check inputs.length or throw 'No files provided'".
      // So we return empty success.
    }

    for (const [i, input] of files.entries()) {
      helpers.onProgress({ phase: 'processing', value: 0.1 + (i / files.length) * 0.8, message: `Calculating HMAC for ${input.name}` })
      
      let hashStr = ''
      if (options.algorithm === 'MD5') {
        const CryptoJS = (await import('crypto-js')).default
        const text = await input.file.text()
        const hash = CryptoJS.HmacMD5(text, options.secretKey)
        hashStr = options.outputFormat === 'hex' ? hash.toString(CryptoJS.enc.Hex) : hash.toString(CryptoJS.enc.Base64)
        if (options.uppercase && options.outputFormat === 'hex') hashStr = hashStr.toUpperCase()
      } else {
        const textEnc = new TextEncoder()
        const keyData = textEnc.encode(options.secretKey)
        const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: options.algorithm }, false, ['sign'])
        const buffer = await input.file.arrayBuffer()
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, buffer)
        hashStr = encodeBuffer(signature, options.outputFormat, options.uppercase)
      }
      
      const blob = new Blob([hashStr], { type: 'text/plain' })
      outputs.push({ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-hmac.txt`, blob, type: 'text/plain', size: blob.size })
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const singleResult = outputs.length === 1 ? await outputs[0].blob.text() : ''
    
    return {
      outputs,
      preview: { kind: 'text', title: 'HMAC generation complete', summary: `Calculated HMAC-${options.algorithm} for ${files.length} file(s).`, textContent: singleResult || `${outputs.length} HMACs generated`, copyText: singleResult || '', metadata: [{ label: 'Algorithm', value: `HMAC-${options.algorithm}` }] },
    }
  },
}

export default module
