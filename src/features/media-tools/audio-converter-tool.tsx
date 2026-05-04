import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect } from '../../components/workspace/OptionsComponents'

interface AudioConverterOptions {
  outputFormat: 'mp3' | 'wav' | 'aac' | 'ogg'
  bitrate: '64k' | '128k' | '192k' | '256k' | '320k'
}

function AudioConverterOptionsComponent({ options, onChange }: ToolOptionsComponentProps<AudioConverterOptions>) {
  return (
    <OptionsSection label="Acoustic Processing" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Target Encoding"
          value={options.outputFormat}
          onChange={(val) => onChange({ ...options, outputFormat: val as AudioConverterOptions['outputFormat'] })}
          options={[
            { value: 'mp3', label: 'MP3 (MPEG Audio)' },
            { value: 'wav', label: 'WAV (Waveform / Lossless)' },
            { value: 'aac', label: 'AAC (Advanced Audio Coding)' },
            { value: 'ogg', label: 'OGG (Vorbis / Open Source)' },
          ]}
        />
        <OptionsSelect
          label="Bitrate Profile"
          disabled={options.outputFormat === 'wav'}
          value={options.bitrate}
          onChange={(val) => onChange({ ...options, bitrate: val as AudioConverterOptions['bitrate'] })}
          options={[
            { value: '64k', label: '64 kbps (Draft/Mobile)' },
            { value: '128k', label: '128 kbps (Standard)' },
            { value: '192k', label: '192 kbps (High Fidelity)' },
            { value: '256k', label: '256 kbps (Premium)' },
            { value: '320k', label: '320 kbps (Lossy Max)' },
          ]}
        />
      </div>
      <p className="text-xs text-secondary mt-6">
        Utilizes high-performance FFmpeg WebAssembly for local signal processing. 
        WAV output disables bitrate throttling as it is uncompressed.
      </p>
    </OptionsSection>
  )
}

const mimeTypes: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  aac: 'audio/aac',
  ogg: 'audio/ogg'
}

// Global ffmpeg instance to avoid reloading it multiple times per session
let globalFFmpeg: any = null

const module: ToolModule<AudioConverterOptions> = {
  defaultOptions: { outputFormat: 'mp3', bitrate: '192k' },
  OptionsComponent: AudioConverterOptionsComponent,
  async run(files, options, helpers) {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const { fetchFile } = await import('@ffmpeg/util')

    if (!globalFFmpeg) {
      helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Loading audio processing engine (first time only, ~30MB)...' })
      globalFFmpeg = new FFmpeg()

      // Fix #39: load from local @ffmpeg/core package (offline-first, no CDN)
      const ffmpegCoreUrl = new URL('@ffmpeg/core/dist/esm/ffmpeg-core.js', import.meta.url).toString()
      const ffmpegWasmUrl = new URL('@ffmpeg/core/dist/esm/ffmpeg-core.wasm', import.meta.url).toString()
      try {
        await globalFFmpeg.load({ coreURL: ffmpegCoreUrl, wasmURL: ffmpegWasmUrl })
      } catch (e) {
        globalFFmpeg = null // Fix #40: reset so next run can retry cleanly
        throw e
      }
    }

    const ffmpeg = globalFFmpeg
    const outputs = []

    // Fix #41: define handler once outside the loop so it can be properly unregistered
    let currentFileIndex = 0
    const onFFmpegProgress = ({ progress }: { progress: number }) => {
      const baseVal = (currentFileIndex / files.length) * 0.9
      helpers.onProgress({ phase: 'processing', value: baseVal + 0.1 + progress * 0.8, message: `Converting (${Math.round(progress * 100)}%)` })
    }
    ffmpeg.on('progress', onFFmpegProgress)

    try {
      for (const [i, input] of files.entries()) {
        currentFileIndex = i
        const inName = `input_${i}.${input.name.split('.').pop() || 'tmp'}`
        const outName = `output_${i}.${options.outputFormat}`

        helpers.onProgress({ phase: 'processing', value: (i / files.length) * 0.9, message: `Reading ${input.name}` })
        await ffmpeg.writeFile(inName, await fetchFile(input.file))

        const ffmpegArgs = ['-i', inName]
        if (options.outputFormat !== 'wav') ffmpegArgs.push('-b:a', options.bitrate)
        ffmpegArgs.push(outName)
        await ffmpeg.exec(ffmpegArgs)

        const data = await ffmpeg.readFile(outName)
        const blob = new Blob([((data as Uint8Array).buffer as unknown) as BlobPart], { type: mimeTypes[options.outputFormat] })

        const finalName = `${input.name.replace(/\.[^.]+$/, '')}.${options.outputFormat}`
        outputs.push({ id: crypto.randomUUID(), name: finalName, blob, type: mimeTypes[options.outputFormat], size: blob.size })

        await ffmpeg.deleteFile(inName)
        await ffmpeg.deleteFile(outName)
      }
    } finally {
      // Fix #41: always unregister using the same reference
      ffmpeg.off('progress', onFFmpegProgress)
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })

    const totalSize = outputs.reduce((acc, curr) => acc + curr.size, 0)

    return {
      outputs,
      preview: { 
        kind: 'media', 
        title: 'Audio Conversion Complete', 
        summary: `Converted ${files.length} file(s) to ${options.outputFormat.toUpperCase()}.`, 
        objectUrl: URL.createObjectURL(outputs[0].blob), 
        metadata: [
          { label: 'Format', value: options.outputFormat.toUpperCase() }, 
          { label: 'Total Size', value: `${(totalSize / 1024 / 1024).toFixed(2)} MB` }
        ] 
      },
    }
  },
}

export default module
