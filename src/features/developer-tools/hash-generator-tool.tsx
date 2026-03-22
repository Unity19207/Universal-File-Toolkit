import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface HashGeneratorOptions {
  algorithm: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512' | 'MD5'
  outputFormat: 'hex' | 'base64'
  uppercase: boolean
}

function HashGeneratorOptionsComponent({ options, onChange }: ToolOptionsComponentProps<HashGeneratorOptions>) {
  return (
    <OptionsSection label="Hash Settings">
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Algorithm"
          value={options.algorithm}
          onChange={(val) => onChange({ ...options, algorithm: val as HashGeneratorOptions['algorithm'] })}
          options={[
            { value: 'SHA-256', label: 'SHA-256 (Default)' },
            { value: 'SHA-1', label: 'SHA-1' },
            { value: 'SHA-384', label: 'SHA-384' },
            { value: 'SHA-512', label: 'SHA-512' },
            { value: 'MD5', label: 'MD5 (Legacy)' },
          ]}
        />
        <OptionsSelect
          label="Output Encoding"
          value={options.outputFormat}
          onChange={(val) => onChange({ ...options, outputFormat: val as HashGeneratorOptions['outputFormat'] })}
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
        Calculates cryptographic integrity hashes locally using the Web Crypto API or CryptoJS.
      </p>
    </OptionsSection>
  )
}

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

const module: ToolModule<HashGeneratorOptions> = {
  defaultOptions: { algorithm: 'SHA-256', outputFormat: 'hex', uppercase: false },
  OptionsComponent: HashGeneratorOptionsComponent,
  async run(files, options, helpers) {
    const outputs = []
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Generating hashes...' })
    
    if (files.length === 0) {
      // Empty input - graceful return
    }

    for (const [i, input] of files.entries()) {
      helpers.onProgress({ phase: 'processing', value: 0.1 + (i / files.length) * 0.8, message: `Hashing ${input.name}` })
      
      let hashStr = ''
      if (options.algorithm === 'MD5') {
        const CryptoJS = (await import('crypto-js')).default
        const text = await input.file.text()
        const hash = CryptoJS.MD5(text)
        hashStr = options.outputFormat === 'hex' ? hash.toString(CryptoJS.enc.Hex) : hash.toString(CryptoJS.enc.Base64)
        if (options.uppercase && options.outputFormat === 'hex') hashStr = hashStr.toUpperCase()
      } else {
        const buffer = await input.file.arrayBuffer()
        const hashBuffer = await crypto.subtle.digest(options.algorithm, buffer)
        hashStr = encodeBuffer(hashBuffer, options.outputFormat, options.uppercase)
      }
      
      const blob = new Blob([hashStr], { type: 'text/plain' })
      outputs.push({ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-${options.algorithm.toLowerCase()}.txt`, blob, type: 'text/plain', size: blob.size })
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const singleResult = outputs.length === 1 ? await outputs[0].blob.text() : ''
    
    return {
      outputs,
      preview: { kind: 'text', title: 'Hash generation complete', summary: `Calculated ${options.algorithm} for ${files.length} file(s).`, textContent: singleResult || `${outputs.length} hashes generated`, copyText: singleResult || '', metadata: [{ label: 'Algorithm', value: options.algorithm }, { label: 'Format', value: options.outputFormat }] },
    }
  },
}

export default module
