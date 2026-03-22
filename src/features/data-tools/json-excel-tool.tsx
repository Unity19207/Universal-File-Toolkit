import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface JsonExcelOptions {
  direction: 'json-to-excel' | 'excel-to-json'
  sheetName: string
  jsonPath: string
  pretty: boolean
}

function navigatePath(obj: unknown, path: string): unknown {
  if (!path) return obj
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[key]
    }
    throw new Error(`Path "${path}" not found in JSON data.`)
  }, obj)
}

function JsonExcelOptionsComponent({ options, onChange }: ToolOptionsComponentProps<JsonExcelOptions>) {
  return (
    <OptionsSection label="Converter Configuration" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Conversion Pathway"
          value={options.direction}
          onChange={(val) => onChange({ ...options, direction: val as JsonExcelOptions['direction'] })}
          options={[
            { value: 'json-to-excel', label: 'JSON → Excel' },
            { value: 'excel-to-json', label: 'Excel → JSON' },
          ]}
        />
        <OptionsInput
          label="Target Sheet Name"
          value={options.sheetName}
          onChange={(val) => onChange({ ...options, sheetName: val })}
          placeholder="e.g. Data"
        />
      </div>

      <div className="mt-6 space-y-4">
        {options.direction === 'json-to-excel' && (
          <OptionsInput
            label="JSON Path to Array (optional)"
            value={options.jsonPath}
            onChange={(val) => onChange({ ...options, jsonPath: val })}
            placeholder="e.g. data.items"
          />
        )}
        <OptionsCheckbox
          label={options.direction === 'json-to-excel' ? 'Auto-fit column widths in Excel' : 'Pretty-print JSON output'}
          checked={options.pretty}
          onChange={(val) => onChange({ ...options, pretty: val })}
        />
      </div>
      <p className="text-xs text-secondary mt-4">
        Transforms structured data formats locally using the SheetJS engine.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<JsonExcelOptions> = {
  defaultOptions: {
    direction: 'json-to-excel',
    sheetName: 'Data',
    jsonPath: '',
    pretty: true,
  },
  OptionsComponent: JsonExcelOptionsComponent,
  async run(files, options, helpers) {
    const XLSX = await import('xlsx')
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.3, message: `Converting ${input.name}` })

    if (options.direction === 'json-to-excel') {
      const text = await input.file.text()
      const parsed = JSON.parse(text) as unknown
      const data = navigatePath(parsed, options.jsonPath)
      if (!Array.isArray(data)) throw new Error('The JSON data (or path target) must be an array of objects.')
      const ws = XLSX.utils.json_to_sheet(data as Record<string, unknown>[])
      if (options.pretty && data.length > 0) {
        const keys = Object.keys(data[0] as Record<string, unknown>)
        ws['!cols'] = keys.map((key) => {
          const maxLen = data.reduce((max: number, row: unknown) => Math.max(max, String((row as Record<string, unknown>)[key] ?? '').length), key.length)
          return { wch: Math.min(Math.max(maxLen + 2, 8), 50) }
        })
      }
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, options.sheetName)
      const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
      const blob = new Blob([xlsxBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      helpers.onProgress({ phase: 'finalizing', value: 1, message: `Converted ${input.name}` })
      return {
        outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}.xlsx`, blob, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: blob.size }],
        preview: { kind: 'download', title: 'JSON → Excel complete', summary: `${data.length} rows exported.`, metadata: [{ label: 'Rows', value: `${data.length}` }, { label: 'Sheet', value: options.sheetName }] },
      }
    } else {
      const buffer = await input.file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
      const output = JSON.stringify(json, null, options.pretty ? 2 : 0)
      const blob = new Blob([output], { type: 'application/json' })
      helpers.onProgress({ phase: 'finalizing', value: 1, message: `Converted ${input.name}` })
      return {
        outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}.json`, blob, type: 'application/json', size: blob.size }],
        preview: { kind: 'json', title: 'Excel → JSON complete', summary: `${json.length} rows extracted.`, textContent: output, copyText: output, metadata: [{ label: 'Rows', value: `${json.length}` }] },
      }
    }
  },
}

export default module
