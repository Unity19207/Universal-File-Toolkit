import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect } from '../../components/workspace/OptionsComponents'

interface AudioNormalizerOptions {
  targetLUFS: number
  outputFormat: 'mp3' | 'wav'
}

function AudioNormalizerOptionsComponent({ options, onChange }: ToolOptionsComponentProps<AudioNormalizerOptions>) {
  return (
    <OptionsSection label="Dynamic Normalization" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Loudness Target (LUFS)"
          value={options.targetLUFS}
          onChange={(val) => onChange({ ...options, targetLUFS: Number(val) })}
          options={[
            { value: '-14', label: 'Streaming (-14) - Spotify/YouTube' },
            { value: '-16', label: 'Podcast (-16) - Apple/Standard' },
            { value: '-23', label: 'Broadcast (-23) - EBU R128 TV' },
            { value: '-10', label: 'Loud (-10) - Club/EDM' },
          ]}
        />
        <OptionsSelect
          label="Container Format"
          value={options.outputFormat}
          onChange={(val) => onChange({ ...options, outputFormat: val as AudioNormalizerOptions['outputFormat'] })}
          options={[
            { value: 'mp3', label: 'MP3 (Compressed)' },
            { value: 'wav', label: 'WAV (Uncompressed)' },
          ]}
        />
      </div>
      <p className="text-xs text-secondary mt-6">
        Analyzes audio power levels and permanentely shifts perceived loudness 
        strictly mathematically via the EBU R128 loudnorm protocol.
      </p>
    </OptionsSection>
  )
}

let globalFFmpeg: any = null

const module: ToolModule<AudioNormalizerOptions> = {
  defaultOptions: { targetLUFS: -14, outputFormat: 'mp3' },
  OptionsComponent: AudioNormalizerOptionsComponent,
  async run(files, options, helpers) {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const { fetchFile, toBlobURL } = await import('@ffmpeg/util')

    if (!globalFFmpeg) {
      helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Loading audio engine...' })
      globalFFmpeg = new FFmpeg()
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm'
      await globalFFmpeg.load({ coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'), wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm') })
    }

    const ffmpeg = globalFFmpeg
    const outputs = []

    for (const [i, input] of files.entries()) {
      const ext = input.name.split('.').pop() || 'mp3'
      const inName = `input_${i}.${ext}`
      const outName = `output_${i}.${options.outputFormat}`

      await ffmpeg.writeFile(inName, await fetchFile(input.file))
      
      // Single pass loudnorm filter
      // (Two pass is more accurate but extremely convoluted with ffmpeg wasm outputs)
      const args = [
        '-i', inName,
        '-af', `loudnorm=I=${options.targetLUFS}:TP=-2:LRA=11`,
      ]
      
      if (options.outputFormat === 'mp3') {
        args.push('-c:a', 'libmp3lame', '-b:a', '192k')
      } else {
        args.push('-c:a', 'pcm_s16le')
      }
      args.push(outName)
      
      helpers.onProgress({ phase: 'processing', value: 0.5, message: `Normalizing loudness for ${input.name}...` })
      await ffmpeg.exec(args)
      
      const data = await ffmpeg.readFile(outName)
      const mime = options.outputFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav'
      const blob = new Blob([((data as Uint8Array).buffer as unknown) as BlobPart], { type: mime })
      
      outputs.push({ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-normalized.${options.outputFormat}`, blob, type: mime, size: blob.size })
      
      await ffmpeg.deleteFile(inName)
      await ffmpeg.deleteFile(outName)
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    return {
      outputs,
      preview: { kind: 'media', title: 'Audio Volume Normalized', summary: `Perceived overall volume mapped to ${options.targetLUFS} LUFS target.`, objectUrl: URL.createObjectURL(outputs[0].blob) }
    }
  },
}

export default module
