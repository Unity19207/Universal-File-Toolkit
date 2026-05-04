import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput } from '../../components/workspace/OptionsComponents'

interface CsvMergerOptions {
  mode: 'Stack rows (Union)' | 'Join on primary key (Left Join)'
  keyColumn: string
  handleHeaders: 'Use first file headers' | 'Merge all unique headers'
}

function CsvMergerOptionsComponent({ options, onChange }: ToolOptionsComponentProps<CsvMergerOptions>) {
  return (
    <OptionsSection label="Merge Settings">
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Merger Strategy"
          value={options.mode}
          onChange={(val) => onChange({ ...options, mode: val as CsvMergerOptions['mode'] })}
          options={[
            { value: 'Stack rows (Union)', label: 'Stack rows (Union)' },
            { value: 'Join on primary key (Left Join)', label: 'Join on key (Left Join)' },
          ]}
        />
        <OptionsSelect
          label="Header Handling"
          value={options.handleHeaders}
          onChange={(val) => onChange({ ...options, handleHeaders: val as CsvMergerOptions['handleHeaders'] })}
          options={[
            { value: 'Use first file headers', label: 'Use first file headers' },
            { value: 'Merge all unique headers', label: 'Merge all unique headers' },
          ]}
        />
      </div>
      {options.mode === 'Join on primary key (Left Join)' && (
        <OptionsInput
          label="Primary Key Column Name"
          value={options.keyColumn}
          onChange={(val) => onChange({ ...options, keyColumn: val })}
          placeholder="e.g. id or email"
        />
      )}
      <p className="text-xs text-secondary mt-2">
        Merges multiple CSV files into one following relational union or join patterns.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<CsvMergerOptions> = {
  defaultOptions: { mode: 'Stack rows (Union)', keyColumn: 'id', handleHeaders: 'Use first file headers' },
  OptionsComponent: CsvMergerOptionsComponent,
  async run(files, options, helpers) {
    const Papa = await import('papaparse')
    
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Parsing CSV data pools...' })
    
    if (files.length < 2) throw new Error('You must upload at least two CSV files to perform a merge.')

    const parsedData: any[][] = []
    const allHeaders = new Set<string>()

    for (let i = 0; i < files.length; i++) {
      helpers.onProgress({ phase: 'processing', value: 0.1 + (0.4 * i) / files.length, message: `Streaming ${files[i].name}...` })
      const text = await files[i].file.text()
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
      // Fix #18: throw on empty file so indices don't desync
      if (parsed.data.length === 0) throw new Error(`File "${files[i].name}" is empty or has no data rows. All files must have data.`)
      parsedData.push(parsed.data)
      if (parsed.meta.fields) {
        parsed.meta.fields.forEach(f => allHeaders.add(f))
      }
    }

    helpers.onProgress({ phase: 'processing', value: 0.6, message: 'Executing merger logic...' })

    let finalRows: any[] = []
    
    if (options.mode === 'Stack rows (Union)') {
      finalRows = parsedData.flat()
    } else {
      // Left Join on first file
      const baseRows = [...parsedData[0]]
      const keyCol = options.keyColumn

      for (let i = 1; i < parsedData.length; i++) {
        const others = parsedData[i]
        const otherMap: Record<string, any> = {}
        for (const row of others) {
          // Fix #19: strict null check so numeric key 0 is correctly matched
          if (row[keyCol] !== undefined && row[keyCol] !== null) otherMap[String(row[keyCol])] = row
        }

        for (let j = 0; j < baseRows.length; j++) {
          const baseVal = baseRows[j][keyCol]
          if (baseVal !== undefined && baseVal !== null && otherMap[String(baseVal)]) {
            baseRows[j] = { ...baseRows[j], ...otherMap[String(baseVal)] }
          }
        }
      }
      finalRows = baseRows
    }

    helpers.onProgress({ phase: 'processing', value: 0.8, message: 'Generating output buffer...' })

    // Fix #20: use per-file header union for 'Use first file headers' too (Object.keys reads only row 0's keys)
    const firstFileHeaders = parsedData[0].length > 0 ? Object.keys(parsedData[0][0]) : []
    const finalHeaders = options.handleHeaders === 'Use first file headers' ? firstFileHeaders : Array.from(allHeaders)
    const resultCSV = Papa.unparse(finalRows, { columns: finalHeaders })
    const resultBlob = new Blob([resultCSV], { type: 'text/csv' })

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const outName = `merged-data-${new Date().getTime()}.csv`

    return {
      outputs: [{ id: crypto.randomUUID(), name: outName, blob: resultBlob, type: 'text/csv', size: resultBlob.size }],
      preview: {
        kind: 'text',
        title: 'CSV Merge Complete',
        summary: `Resulted in ${finalRows.length} rows with ${finalHeaders.length} columns.`,
        textContent: resultCSV
      }
    }
  },
}

export default module
