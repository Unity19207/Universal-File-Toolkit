import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface CsvExcelOptions {
  direction: 'csv-to-excel' | 'excel-to-csv'
  sheetName: string
  delimiter: ',' | ';' | '\t'
  pretty: boolean
}

function CsvExcelOptionsComponent({ options, onChange }: ToolOptionsComponentProps<CsvExcelOptions>) {
  return (
    <OptionsSection label="Conversion Settings">
      <OptionsSelect
        label="Direction"
        value={options.direction}
        onChange={(val) => onChange({ ...options, direction: val as CsvExcelOptions['direction'] })}
        options={[
          { value: 'csv-to-excel', label: 'CSV → Excel' },
          { value: 'excel-to-csv', label: 'Excel → CSV' },
        ]}
      />
      {options.direction === 'csv-to-excel' && (
        <OptionsInput
          label="Sheet Name"
          value={options.sheetName}
          onChange={(val) => onChange({ ...options, sheetName: val })}
          placeholder="Sheet1"
        />
      )}
      <OptionsSelect
        label="CSV Delimiter"
        value={options.delimiter}
        onChange={(val) => onChange({ ...options, delimiter: val as CsvExcelOptions['delimiter'] })}
        options={[
          { value: ',', label: 'Comma' },
          { value: ';', label: 'Semicolon' },
          { value: '\t', label: 'Tab' },
        ]}
      />
      <OptionsCheckbox
        label="Auto-fit column widths (Excel output)"
        checked={options.pretty}
        onChange={(val) => onChange({ ...options, pretty: val })}
      />
    </OptionsSection>
  )
}

const module: ToolModule<CsvExcelOptions> = {
  defaultOptions: {
    direction: 'csv-to-excel',
    sheetName: 'Sheet1',
    delimiter: ',',
    pretty: true,
  },
  OptionsComponent: CsvExcelOptionsComponent,
  async run(files, options, helpers) {
    const XLSX = await import('xlsx')
    const Papa = (await import('papaparse')).default
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.3, message: `Converting ${input.name}` })

    if (options.direction === 'csv-to-excel') {
      const text = await input.file.text()
      const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true })
      const ws = XLSX.utils.aoa_to_sheet(parsed.data)
      if (options.pretty && parsed.data.length > 0) {
        const cols = parsed.data[0].map((_col: string, i: number) => {
          const maxLen = parsed.data.reduce((max: number, row: string[]) => Math.max(max, (row[i] ?? '').toString().length), 0)
          return { wch: Math.min(Math.max(maxLen + 2, 8), 50) }
        })
        ws['!cols'] = cols
      }
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, options.sheetName)
      const xlsxBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
      const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      helpers.onProgress({ phase: 'finalizing', value: 1, message: `Converted ${input.name}` })
      return {
        outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}.xlsx`, blob, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: blob.size }],
        preview: { kind: 'download', title: 'CSV → Excel complete', summary: `${input.name} converted to Excel.`, metadata: [{ label: 'Sheet', value: options.sheetName }, { label: 'Rows', value: `${parsed.data.length}` }] },
      }
    } else {
      const buffer = await input.file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const delimMap: Record<string, string> = { ',': ',', ';': ';', '\t': '\t' }
      const csv = XLSX.utils.sheet_to_csv(ws, { FS: delimMap[options.delimiter] ?? ',' })
      const blob = new Blob([csv], { type: 'text/csv' })
      helpers.onProgress({ phase: 'finalizing', value: 1, message: `Converted ${input.name}` })
      return {
        outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}.csv`, blob, type: 'text/csv', size: blob.size }],
        preview: { kind: 'text', title: 'Excel → CSV complete', summary: `${input.name} converted to CSV.`, textContent: csv, copyText: csv, metadata: [{ label: 'Sheet', value: wb.SheetNames[0] }] },
      }
    }
  },
}

export default module
