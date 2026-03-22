import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsInput, OptionsSelect } from '../../components/workspace/OptionsComponents'

interface ExcelFormulaOptions {
  formula: string
  sheetRange: string
  outputFormat: 'JSON' | 'CSV'
}

function ExcelFormulaOptionsComponent({ options, onChange }: ToolOptionsComponentProps<ExcelFormulaOptions>) {
  return (
    <>
      <OptionsSection label="Formula Execution">
        <OptionsInput
          label="Custom Excel Formula"
          value={options.formula}
          onChange={(val) => onChange({ ...options, formula: val })}
          placeholder="=SUM(A1:C10)"
        />
        <p className="text-xs text-secondary mt-2">
          Examples: =AVERAGE(B1:B100), =COUNTIF(A:A, "Pending")
        </p>
      </OptionsSection>

      <OptionsSection label="Data Scope & Output" noBorder>
        <div className="grid gap-4 sm:grid-cols-2">
          <OptionsInput
            label="Import Range Scope"
            value={options.sheetRange}
            onChange={(val) => onChange({ ...options, sheetRange: val })}
            placeholder="A1:Z100"
          />
          <OptionsSelect
            label="Export Format"
            value={options.outputFormat}
            onChange={(val) => onChange({ ...options, outputFormat: val as ExcelFormulaOptions['outputFormat'] })}
            options={[
              { value: 'CSV', label: 'CSV Spreadsheet' },
              { value: 'JSON', label: 'JSON Data Array' },
            ]}
          />
        </div>
        <p className="text-xs text-secondary mt-4">
          Natively evaluates complex formulas using the HyperFormula engine. No remote server required.
        </p>
      </OptionsSection>
    </>
  )
}

const module: ToolModule<ExcelFormulaOptions> = {
  defaultOptions: { formula: '=SUM(A1:A10)', sheetRange: 'A1:Z100', outputFormat: 'CSV' },
  OptionsComponent: ExcelFormulaOptionsComponent,
  async run(files, options, helpers) {
    const XLSX = await import('xlsx')
    const { HyperFormula } = await import('hyperformula')
    const Papa = await import('papaparse')
    const input = files[0]
    
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Ingesting spreadsheet bytes...' })
    const arrayBuffer = await input.file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    
    // Convert to 2D array for HyperFormula
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
    
    helpers.onProgress({ phase: 'processing', value: 0.4, message: 'Spinning up HyperFormula calculator...' })
    
    const hf = HyperFormula.buildFromArray(data, { licenseKey: 'gpl-v3' })
    
    helpers.onProgress({ phase: 'processing', value: 0.7, message: 'Evaluating expression tree...' })
    
    let result: any = null
    try {
      result = hf.calculateFormula(options.formula, 0)
    } catch (e: any) {
      throw new Error(`Formula evaluation error: ${e.message}`)
    }

    const report = {
       formula: options.formula,
       value: result,
       metadata: {
         sheetName: workbook.SheetNames[0],
         timestamp: new Date().toISOString()
       }
    }

    helpers.onProgress({ phase: 'processing', value: 0.9, message: 'Formatting calculated outputs...' })

    let resultStr = ''
    let mime = 'text/plain'
    if (options.outputFormat === 'JSON') {
       resultStr = JSON.stringify(report, null, 2)
       mime = 'application/json'
    } else {
       resultStr = Papa.unparse([{ Formula: options.formula, Result: result }])
       mime = 'text/csv'
    }
    
    const resultBlob = new Blob([resultStr], { type: mime })

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const outName = `${input.name.replace(/\.[^.]+$/, '')}-eval.${options.outputFormat.toLowerCase()}`

    return {
       outputs: [{ id: crypto.randomUUID(), name: outName, blob: resultBlob, type: mime, size: resultBlob.size }],
       preview: {
         kind: 'text',
         title: 'HyperFormula Calculation Complete',
         summary: `The formula ${options.formula} evaluated to: ${result}`,
         textContent: resultStr,
         metadata: [{ label: 'Formula', value: options.formula }, { label: 'Result', value: String(result) }]
       }
    }
  },
}

export default module
