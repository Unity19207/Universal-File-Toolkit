import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsInput } from '../../components/workspace/OptionsComponents'

interface CsvPickerOptions {
  columns: string
  renameMap: string
}

function CsvPickerOptionsComponent({ options, onChange }: ToolOptionsComponentProps<CsvPickerOptions>) {
  return (
    <OptionsSection label="Selection Settings">
      <OptionsInput
        label="Columns to Keep"
        value={options.columns}
        onChange={(val) => onChange({ ...options, columns: val })}
        placeholder="e.g. id, name, email"
      />
      <OptionsInput
        label="Rename Map"
        value={options.renameMap}
        onChange={(val) => onChange({ ...options, renameMap: val })}
        placeholder="e.g. old:new, phone:mobile"
      />
      <p className="text-xs text-secondary mt-2">
        Pick, reorder, and rename CSV columns without specialized software. Operates locally via PapaParse thread bridge.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<CsvPickerOptions> = {
  defaultOptions: { columns: '', renameMap: '' },
  OptionsComponent: CsvPickerOptionsComponent,
  async run(files, options, helpers) {
    const Papa = await import('papaparse')
    const input = files[0]
    
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Streaming records...' })
    const text = await input.file.text()
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
    
    // Parse order/pick
    const keepCols = options.columns.split(',').map(s => s.trim()).filter(Boolean)
    const renameParts = options.renameMap.split(',').map(s => s.trim()).filter(Boolean)
    const renameMap: Record<string, string> = {}
    renameParts.forEach(p => {
       const [old, newVal] = p.split(':').map(s => s.trim())
       if (old && newVal) renameMap[old] = newVal
    })

    helpers.onProgress({ phase: 'processing', value: 0.5, message: 'Filtering column space...' })

    const finalRows = (parsed.data as any[]).map(row => {
       const newRow: any = {}
       const colsToIterate = keepCols.length > 0 ? keepCols : Object.keys(row)
       
       colsToIterate.forEach(col => {
          const val = row[col]
          const finalName = renameMap[col] || col
          newRow[finalName] = val
       })
       return newRow
    })

    helpers.onProgress({ phase: 'processing', value: 0.8, message: 'Encoding results...' })

    const resultCSV = Papa.unparse(finalRows)
    const resultBlob = new Blob([resultCSV], { type: 'text/csv' })

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const outName = `${input.name.replace(/\.[^.]+$/, '')}-picked.csv`

    return {
       outputs: [{ id: crypto.randomUUID(), name: outName, blob: resultBlob, type: 'text/csv', size: resultBlob.size }],
       preview: {
         kind: 'text',
         title: 'Column Mapping Complete',
         summary: `Resulted in ${finalRows.length} rows with ${Object.keys(finalRows[0] || {}).length} columns.`,
         textContent: resultCSV
       }
    }
  },
}

export default module
