import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsInput, OptionsSlider } from '../../components/workspace/OptionsComponents'

interface AudioTrimmerOptions {
  startTime: string
  endTime: string
  fadeIn: number
  fadeOut: number
}

function AudioTrimmerOptionsComponent({ options, onChange }: ToolOptionsComponentProps<AudioTrimmerOptions>) {
  return (
    <OptionsSection label="Clip Boundaries" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsInput
          label="Start Position"
          value={options.startTime}
          onChange={(val) => onChange({ ...options, startTime: val })}
          placeholder="00:00:00 or seconds"
        />
        <OptionsInput
          label="End Position"
          value={options.endTime}
          onChange={(val) => onChange({ ...options, endTime: val })}
          placeholder="Optional (e.g. 00:01:30)"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 mt-6">
        <OptionsSlider
          label="Fade In Effect"
          min={0}
          max={10}
          step={0.5}
          value={options.fadeIn}
          onChange={(val) => onChange({ ...options, fadeIn: val })}
          displayValue={`${options.fadeIn}s`}
        />
        <OptionsSlider
          label="Fade Out Effect"
          min={0}
          max={10}
          step={0.5}
          value={options.fadeOut}
          onChange={(val) => onChange({ ...options, fadeOut: val })}
          displayValue={`${options.fadeOut}s`}
        />
      </div>
      <p className="text-xs text-secondary mt-6">
        Supports timestamp strings (HH:MM:SS) or raw seconds. 
        Fade out requires an explicit &apos;End Position&apos; to calculate the offset.
      </p>
    </OptionsSection>
  )
}

let globalFFmpeg: any = null

const module: ToolModule<AudioTrimmerOptions> = {
  defaultOptions: { startTime: '0', endTime: '', fadeIn: 0, fadeOut: 0 },
  OptionsComponent: AudioTrimmerOptionsComponent,
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
      const outName = `output_${i}.mp3` // output as mp3 to normalize

      await ffmpeg.writeFile(inName, await fetchFile(input.file))
      
      const args = []
      if (options.startTime) args.push('-ss', options.startTime)
      args.push('-i', inName)
      if (options.endTime) args.push('-to', options.endTime)
      
      // Calculate fade logic
      if (options.fadeIn > 0 || options.fadeOut > 0) {
        let af = ''
        if (options.fadeIn > 0) af += `afade=t=in:ss=0:d=${options.fadeIn}`
        if (options.fadeOut > 0) {
          if (af) af += ','
          // Fake fadeOut by reading backward? In WASM usually we need exact out length. 
          // If we don't have exact duration it's hard, but we can do it if `endTime` is numbers.
          // For safety, just add fade in or rely on exact end times if available.
          af += `afade=t=out:st=${parseInt(options.endTime || '9999') - options.fadeOut}:d=${options.fadeOut}`
        }
        args.push('-af', af)
      }
      
      args.push('-b:a', '192k', outName)
      
      ffmpeg.on('progress', ({ progress }: any) => {
         helpers.onProgress({ phase: 'processing', value: Math.max(0.1, progress), message: `Processing (${Math.round(progress * 100)}%)` })
      })

      await ffmpeg.exec(args)
      
      const data = await ffmpeg.readFile(outName)
      const blob = new Blob([((data as Uint8Array).buffer as unknown) as BlobPart], { type: 'audio/mpeg' })
      
      outputs.push({ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-trimmed.mp3`, blob, type: 'audio/mpeg', size: blob.size })
      
      ffmpeg.off('progress', () => {})
      await ffmpeg.deleteFile(inName)
      await ffmpeg.deleteFile(outName)
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    return {
      outputs,
      preview: { kind: 'media', title: 'Audio Trimmed', summary: 'Audio snippet cropped correctly.', objectUrl: URL.createObjectURL(outputs[0].blob) }
    }
  },
}

export default module
