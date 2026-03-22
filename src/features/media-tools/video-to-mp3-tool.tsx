import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect } from '../../components/workspace/OptionsComponents'
import { extractMp3 } from './ffmpeg-service'

interface VideoToMp3Options {
  bitrate: '96k' | '128k' | '192k'
}

function VideoToMp3OptionsComponent({ options, onChange }: ToolOptionsComponentProps<VideoToMp3Options>) {
  return (
    <OptionsSection label="Audio Settings">
      <OptionsSelect
        label="MP3 Bitrate"
        value={options.bitrate}
        onChange={(v) => onChange({ bitrate: v as VideoToMp3Options['bitrate'] })}
        options={[
          { value: '96k', label: '96 kbps' },
          { value: '128k', label: '128 kbps' },
          { value: '192k', label: '192 kbps' },
        ]}
      />
    </OptionsSection>
  )
}

const module: ToolModule<VideoToMp3Options> = {
  defaultOptions: {
    bitrate: '128k',
  },
  OptionsComponent: VideoToMp3OptionsComponent,
  async run(files, options, helpers) {
    helpers.onProgress({ phase: 'loading', value: 0.08, message: 'Preparing FFmpeg worker' })
    const result = await extractMp3(files[0].file, options.bitrate, (value, message) => {
      helpers.onProgress({
        phase: value < 0.25 ? 'loading' : 'processing',
        value,
        message,
      })
    })
    return {
      outputs: [
        {
          id: crypto.randomUUID(),
          name: result.fileName,
          blob: result.blob,
          type: 'audio/mpeg',
          size: result.blob.size,
        },
      ],
      preview: {
        kind: 'media',
        title: 'MP3 extraction complete',
        summary: `${files[0].name} was converted to MP3 without uploading any media.`,
        metadata: [
          { label: 'Bitrate', value: options.bitrate },
          { label: 'Output type', value: 'audio/mpeg' },
        ],
      },
    }
  },
}

export default module
