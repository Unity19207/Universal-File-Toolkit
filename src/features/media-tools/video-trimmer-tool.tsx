import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsInput, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface VideoTrimmerOptions {
  startTime: string
  endTime: string
  copyCodec: boolean
}

function VideoTrimmerOptionsComponent({ options, onChange }: ToolOptionsComponentProps<VideoTrimmerOptions>) {
  return (
    <OptionsSection label="Trim Settings">
      <OptionsInput
        label="Start Time"
        value={options.startTime}
        onChange={(v) => onChange({ ...options, startTime: v })}
        placeholder="00:00:00 or seconds"
      />
      <OptionsInput
        label="End Time"
        value={options.endTime}
        onChange={(v) => onChange({ ...options, endTime: v })}
        placeholder="Optional (e.g. 00:01:30)"
      />
      <OptionsCheckbox
        label="Fast Trim (Stream Copy) — Strips re-encoding. Extremely fast, but may be slightly inaccurate to the millisecond due to keyframe snapping."
        checked={options.copyCodec}
        onChange={(v) => onChange({ ...options, copyCodec: v })}
      />
    </OptionsSection>
  )
}

let globalFFmpeg: any = null

const module: ToolModule<VideoTrimmerOptions> = {
  defaultOptions: { startTime: '00:00:00', endTime: '', copyCodec: true },
  OptionsComponent: VideoTrimmerOptionsComponent,
  async run(files, options, helpers) {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const { fetchFile, toBlobURL } = await import('@ffmpeg/util')

    if (!globalFFmpeg) {
      helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Loading video engine (~30MB)...' })
      globalFFmpeg = new FFmpeg()
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm'
      await globalFFmpeg.load({ coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'), wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm') })
    }

    const ffmpeg = globalFFmpeg
    const outputs = []

    for (const [i, input] of files.entries()) {
      const ext = input.name.split('.').pop() || 'mp4'
      const inName = `input_${i}.${ext}`
      const outName = `output_${i}.${ext}`

      await ffmpeg.writeFile(inName, await fetchFile(input.file))
      helpers.onProgress({ phase: 'processing', value: 0.5, message: `Trimming ${input.name}...` })

      const args = []
      if (options.startTime) args.push('-ss', options.startTime)
      args.push('-i', inName)
      if (options.endTime) args.push('-to', options.endTime)

      if (options.copyCodec) {
        args.push('-c', 'copy')
      } else {
        args.push('-c:v', 'libx264', '-c:a', 'aac') // Re-encode for precision
      }

      args.push(outName)
      await ffmpeg.exec(args)

      const data = await ffmpeg.readFile(outName)
      const blob = new Blob([((data as Uint8Array).buffer as unknown) as BlobPart], { type: input.file.type || 'video/mp4' })

      outputs.push({ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-trimmed.${ext}`, blob, type: input.file.type, size: blob.size })
      await ffmpeg.deleteFile(inName)
      await ffmpeg.deleteFile(outName)
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    return {
      outputs,
      preview: { kind: 'media', title: 'Video Trimmed', summary: 'Trim applied successfully.', objectUrl: URL.createObjectURL(outputs[0].blob) }
    }
  },
}

export default module
