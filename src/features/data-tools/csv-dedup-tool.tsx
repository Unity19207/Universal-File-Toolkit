import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsCheckbox, OptionsInput } from '../../components/workspace/OptionsComponents'

interface CsvDedupOptions {
  mode: 'Exact duplicates' | 'Duplicate by column'
  targetColumn: string
  keepFirst: boolean
}

function CsvDedupOptionsComponent({ options, onChange }: ToolOptionsComponentProps<CsvDedupOptions>) {
  return (
    <OptionsSection label="Deduplication Settings">
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Search Mode"
          value={options.mode}
          onChange={(val) => onChange({ ...options, mode: val as CsvDedupOptions['mode'] })}
          options={[
            { value: 'Exact duplicates', label: 'Exact match (All columns)' },
            { value: 'Duplicate by column', label: 'Single target column' },
          ]}
        />
        <OptionsCheckbox
          label="Keep first occurrence"
          checked={options.keepFirst}
          onChange={(val) => onChange({ ...options, keepFirst: val })}
        />
      </div>
      {options.mode === 'Duplicate by column' && (
        <OptionsInput
          label="Target Column"
          value={options.targetColumn}
          onChange={(val) => onChange({ ...options, targetColumn: val })}
          placeholder="e.g. email or id"
        />
      )}
      <p className="text-xs text-secondary mt-2">
        Removes duplicate rows from your CSV data using local memory-mapped Set hashing.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<CsvDedupOptions> = {
  defaultOptions: { mode: 'Exact duplicates', targetColumn: '', keepFirst: true },
  OptionsComponent: CsvDedupOptionsComponent,
  async run(files, options, helpers) {
    const Papa = await import('papaparse')
    const input = files[0]
    
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Parsing source records...' })
    const text = await input.file.text()
    
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
    if (parsed.errors.length > 0) throw new Error(`Parse failure: ${parsed.errors[0].message}`)
    
    let rows = parsed.data as any[]
    const originalCount = rows.length
    
    helpers.onProgress({ phase: 'processing', value: 0.4, message: 'Deduplicating rows...' })
    
    if (options.keepFirst === false) {
       rows = [...rows].reverse()
    }

    const seen = new Set<string>()
    const finalRows: any[] = []

    for (const row of rows) {
       let key = ''
       if (options.mode === 'Exact duplicates') {
          key = JSON.stringify(row)
       } else {
          key = String(row[options.targetColumn] || '')
       }

       if (!seen.has(key)) {
          seen.add(key)
          finalRows.push(row)
       }
    }

    if (options.keepFirst === false) {
       finalRows.reverse()
    }

    helpers.onProgress({ phase: 'processing', value: 0.9, message: 'Exporting unique data pool...' })

    const resultCSV = Papa.unparse(finalRows)
    const resultBlob = new Blob([resultCSV], { type: 'text/csv' })

    const removed = originalCount - finalRows.length
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const outName = `${input.name.replace(/\.[^.]+$/, '')}-unique.csv`

    return {
       outputs: [{ id: crypto.randomUUID(), name: outName, blob: resultBlob, type: 'text/csv', size: resultBlob.size }],
       preview: {
         kind: 'text',
         title: 'Deduplication Results',
         summary: `Removed ${removed} duplicates out of ${originalCount} total rows.`,
         textContent: resultCSV,
         metadata: [{ label: 'Source Rows', value: originalCount.toString() }, { label: 'Unique Rows', value: finalRows.length.toString() }, { label: 'Removed', value: removed.toString() }]
       }
    }
  },
}

export default module
