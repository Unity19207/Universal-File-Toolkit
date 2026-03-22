import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsInput, OptionsSlider, OptionsSelect } from '../../components/workspace/OptionsComponents'

type OutputFormat = 'human' | 'iso' | 'unix'

interface CronParserOptions {
  expression: string
  nextN: number
  timezone: string
  outputFormat: OutputFormat
}

/**
 * Parses and describes a cron expression in simple English.
 */
function describeCron(expression: string): string {
  const parts = expression.trim().split(/\s+/)
  if (parts.length < 5 || parts.length > 6) return expression
  const [minute, hour, dom, month, dow] = parts.length === 6 ? parts.slice(1) : parts

  const pieces: string[] = []
  if (minute === '*' && hour === '*') pieces.push('Every minute')
  else if (minute === '0' && hour === '*') pieces.push('Every hour')
  else if (minute !== '*' && hour !== '*') pieces.push(`At ${hour}:${minute.padStart(2, '0')}`)
  else if (hour === '*') pieces.push(`At minute ${minute} of every hour`)
  else pieces.push(`At ${hour}:${minute.padStart(2, '0')}`)

  if (dom !== '*' && dom !== '?') pieces.push(`on day ${dom} of the month`)
  if (month !== '*') pieces.push(`in month ${month}`)
  if (dow !== '*' && dow !== '?') {
    const dayNames: Record<string, string> = { '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat', '7': 'Sun' }
    const mapped = dow.replace(/\d/g, (d) => dayNames[d] ?? d)
    pieces.push(`on ${mapped}`)
  }
  return pieces.join(' ')
}

function CronParserOptionsComponent({ options, onChange }: ToolOptionsComponentProps<CronParserOptions>) {
  return (
    <>
      <OptionsSection label="Expression">
        <OptionsInput
          label="Cron Expression"
          value={options.expression}
          onChange={(val) => onChange({ ...options, expression: val })}
          placeholder="0 9 * * 1-5"
        />
        <div className="text-xs text-secondary mt-3 p-3 bg-elevated rounded-lg border-l-2 border-accent">
          <span className="font-bold text-accent mr-2 uppercase tracking-tighter">Interpretation:</span>
          <span className="italic">{describeCron(options.expression)}</span>
        </div>
      </OptionsSection>

      <OptionsSection label="Configuration" noBorder>
        <div className="grid gap-4 sm:grid-cols-2">
          <OptionsSlider
            label="Recurrences"
            min={5}
            max={50}
            value={options.nextN}
            onChange={(val) => onChange({ ...options, nextN: val })}
            displayValue={`${options.nextN} runs`}
          />
          <OptionsInput
            label="Target Timezone"
            value={options.timezone}
            onChange={(val) => onChange({ ...options, timezone: val })}
            placeholder="UTC"
          />
        </div>
        <div className="mt-6">
          <OptionsSelect
            label="Timestamp Format"
            value={options.outputFormat}
            onChange={(val) => onChange({ ...options, outputFormat: val as OutputFormat })}
            options={[
              { value: 'human', label: 'Human Readable' },
              { value: 'iso', label: 'ISO 8601 (Strict)' },
              { value: 'unix', label: 'Unix Epoch (Seconds)' },
            ]}
          />
        </div>
      </OptionsSection>
      <p className="text-[11px] text-muted mt-4">
        Validates POSIX and quartz cron syntax locally. No network traffic is generated.
      </p>
    </>
  )
}

function formatDate(date: Date, format: OutputFormat): string {
  switch (format) {
    case 'human':
      return date.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    case 'iso':
      return date.toISOString()
    case 'unix':
      return `${Math.floor(date.getTime() / 1000)}`
  }
}

const module: ToolModule<CronParserOptions> = {
  defaultOptions: {
    expression: '0 9 * * 1-5',
    nextN: 10,
    timezone: 'UTC',
    outputFormat: 'human',
  },
  OptionsComponent: CronParserOptionsComponent,
  async run(files, options, helpers) {
    const { CronExpressionParser } = await import('cron-parser')
    helpers.onProgress({ phase: 'processing', value: 0.3, message: 'Parsing cron expression…' })

    if (!options.expression.trim()) throw new Error('Enter a cron expression to parse.')

    const interval = CronExpressionParser.parse(options.expression, {
      tz: options.timezone || 'UTC',
    })

    const nextRuns: Date[] = interval.take(options.nextN).map((cronDate) => cronDate.toDate())

    const description = describeCron(options.expression)

    const result = {
      expression: options.expression,
      description,
      timezone: options.timezone || 'UTC',
      nextRuns: nextRuns.map((d) => formatDate(d, options.outputFormat)),
    }

    const output = JSON.stringify(result, null, 2)
    const blob = new Blob([output], { type: 'application/json' })

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })

    const inputName = files.length > 0 ? files[0].name.replace(/\.[^.]+$/, '') : 'cron'
    return {
      outputs: [{ id: crypto.randomUUID(), name: `${inputName}-schedule.json`, blob, type: 'application/json', size: blob.size }],
      preview: {
        kind: 'json',
        title: 'Cron expression parsed',
        summary: description,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Expression', value: options.expression },
          { label: 'Description', value: description },
          { label: 'Next runs', value: `${nextRuns.length}` },
        ],
      },
    }
  },
}

export default module
