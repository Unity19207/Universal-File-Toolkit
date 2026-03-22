import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput } from '../../components/workspace/OptionsComponents'

interface TarCreatorOptions {
  format: 'TAR (uncompressed)' | '.tar.gz (gzip compressed)'
  fileName: string
}

function TarCreatorOptionsComponent({ options, onChange }: ToolOptionsComponentProps<TarCreatorOptions>) {
  return (
    <OptionsSection label="Archive Settings">
      <OptionsSelect
        label="Archive Format"
        value={options.format}
        onChange={(val) => onChange({ ...options, format: val as TarCreatorOptions['format'] })}
        options={[
          { value: 'TAR (uncompressed)', label: 'Standard TAR (Uncompressed)' },
          { value: '.tar.gz (gzip compressed)', label: 'TAR.GZ (Gzip Compressed)' },
        ]}
      />
      <OptionsInput
        label="Archive File Name"
        value={options.fileName}
        onChange={(val) => onChange({ ...options, fileName: val })}
        placeholder="archive.tar.gz"
      />
    </OptionsSection>
  )
}

const module: ToolModule<TarCreatorOptions> = {
  defaultOptions: { format: '.tar.gz (gzip compressed)', fileName: 'archive.tar.gz' },
  OptionsComponent: TarCreatorOptionsComponent,
  async run(files, options, helpers) {
    const { gzip } = await import('fflate')
    
    helpers.onProgress({ phase: 'processing', value: 0.2, message: 'Reading files...' })
    
    // TAR variables
    const BLOCK_SIZE = 512
    let totalSize = 1024 // 2 empty blocks at end
    const fileEntries: { name: string; bytes: Uint8Array; sz: number; padding: number }[] = []
    
    for (const [i, input] of files.entries()) {
      helpers.onProgress({ phase: 'processing', value: 0.2 + (0.3 * i) / files.length, message: `Reading ${input.name}` })
      const buffer = await input.file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const sz = bytes.length
      const padding = (BLOCK_SIZE - (sz % BLOCK_SIZE)) % BLOCK_SIZE
      fileEntries.push({ name: input.name, bytes, sz, padding })
      totalSize += BLOCK_SIZE + sz + padding
    }

    helpers.onProgress({ phase: 'processing', value: 0.6, message: 'Building TAR structure...' })

    await new Promise<void>((resolve) => setTimeout(resolve, 50)) // Yield to UI

    const tarBlob = new Uint8Array(totalSize)
    let offset = 0
    
    const enc = new TextEncoder()
    const fillString = (str: string, len: number) => {
      const arr = new Uint8Array(len)
      const encoded = enc.encode(str)
      arr.set(encoded.subarray(0, len))
      return arr
    }
    const createHeader = (name: string, size: number) => {
      const header = new Uint8Array(BLOCK_SIZE)
      header.set(fillString(name, 100), 0) // name
      header.set(fillString('0000777\0', 8), 100) // mode
      header.set(fillString('0000000\0', 8), 108) // uid
      header.set(fillString('0000000\0', 8), 116) // gid
      header.set(fillString(size.toString(8).padStart(11, '0') + ' ', 12), 124) // size
      header.set(fillString(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + ' ', 12), 136) // mtime
      header.set(fillString('        ', 8), 148) // chksum placeholder
      header.set(fillString('0', 1), 156) // typeflag
      header.set(fillString('ustar\0', 6), 257) // magic
      header.set(fillString('00', 2), 263) // version
      
      let checksum = 0
      for (let i = 0; i < BLOCK_SIZE; i++) checksum += header[i]
      header.set(fillString(checksum.toString(8).padStart(6, '0') + '\0 ', 8), 148)
      return header
    }

    for (const f of fileEntries) {
      tarBlob.set(createHeader(f.name, f.sz), offset)
      offset += BLOCK_SIZE
      tarBlob.set(f.bytes, offset)
      offset += f.sz + f.padding
    }

    let finalData = tarBlob
    let mime = 'application/x-tar'

    if (options.format === '.tar.gz (gzip compressed)') {
      helpers.onProgress({ phase: 'processing', value: 0.8, message: 'Compressing with GZIP algorithm...' })
      await new Promise<void>((resolve) => setTimeout(resolve, 50))
      finalData = await new Promise<any>((resolve, reject) => {
        gzip(tarBlob, { level: 6 }, (err, data) => {
          if (err) reject(err)
          else resolve(data)
        })
      })
      mime = 'application/gzip'
    }

    const blob = new Blob([finalData as unknown as BlobPart], { type: mime })
    let finalName = options.fileName
    if (!finalName.includes('.')) {
      finalName += options.format.includes('gz') ? '.tar.gz' : '.tar'
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const totalInputSize = files.reduce((acc, f) => acc + f.file.size, 0)

    return {
      outputs: [{ id: crypto.randomUUID(), name: finalName, blob, type: mime, size: blob.size }],
      preview: { kind: 'text', title: 'TAR Archive Created', summary: `${files.length} files archived.`, textContent: `Successfully processed ${files.length} file(s).`, metadata: [{ label: 'Size Difference', value: `${(totalInputSize / 1024 / 1024).toFixed(2)} MB -> ${(blob.size / 1024 / 1024).toFixed(2)} MB` }] }
    }
  },
}

export default module
