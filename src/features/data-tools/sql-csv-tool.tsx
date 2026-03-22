import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsTextArea, OptionsSelect } from '../../components/workspace/OptionsComponents'

interface SqlCsvOptions {
  query: string
  outputFormat: 'CSV' | 'JSON'
}

function SqlCsvOptionsComponent({ options, onChange }: ToolOptionsComponentProps<SqlCsvOptions>) {
  return (
    <OptionsSection label="Query Configuration" noBorder>
      <div className="space-y-4">
        <OptionsTextArea
          label="SQL SELECT Query"
          value={options.query}
          onChange={(val) => onChange({ ...options, query: val })}
          placeholder="SELECT * FROM data LIMIT 100"
          rows={4}
        />
        <OptionsSelect
          label="Output Protocol"
          value={options.outputFormat}
          onChange={(val) => onChange({ ...options, outputFormat: val as SqlCsvOptions['outputFormat'] })}
          options={[
            { value: 'CSV', label: 'CSV Spreadsheet' },
            { value: 'JSON', label: 'JSON Data Array' },
          ]}
        />
      </div>
      <p className="text-xs text-secondary mt-4">
        Table name is strictly 'data'. Operates locally using the SQL.js WASM engine.
      </p>
    </OptionsSection>
  )
}

let sqlPromise: Promise<any> | null = null

async function getSQL() {
  if (sqlPromise) return sqlPromise
  
  if (typeof window === 'undefined') throw new Error('Cannot load SQL.js outside DOM layer.')
  
  sqlPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js'
    script.onload = async () => {
      try {
        // @ts-ignore
        const SQL = await window.initSqlJs({
          locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
        })
        resolve(SQL)
      } catch (e) {
        reject(e)
      }
    }
    script.onerror = () => reject(new Error('Failed to load SQL.js via CDN'))
    document.head.appendChild(script)
  })
  return sqlPromise
}

const module: ToolModule<SqlCsvOptions> = {
  defaultOptions: { query: 'SELECT * FROM data LIMIT 100', outputFormat: 'CSV' },
  OptionsComponent: SqlCsvOptionsComponent,
  async run(files, options, helpers) {
    const Papa = await import('papaparse')
    
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Downloading SQL WASM runtime (~2MB)...' })
    const SQL = await getSQL()
    
    helpers.onProgress({ phase: 'processing', value: 0.3, message: 'Parsing CSV payload...' })
    const text = await files[0].file.text()
    
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
    if (parsed.data.length === 0 || !parsed.meta.fields) throw new Error('Empty or invalid CSV file.')
    
    helpers.onProgress({ phase: 'processing', value: 0.5, message: 'Spinning up virtual SQLite database...' })
    const db = new SQL.Database()
    
    const cols = parsed.meta.fields.map(f => `"${f.replace(/"/g, '""')}" TEXT`).join(', ')
    db.run(`CREATE TABLE data (${cols})`)
    
    const placeholders = parsed.meta.fields.map(() => '?').join(', ')
    const insertStmt = `INSERT INTO data VALUES (${placeholders})`
    
    db.run('BEGIN TRANSACTION')
    for (const row of parsed.data as any[]) {
      const vals = parsed.meta.fields.map(f => row[f] || null)
      db.run(insertStmt, vals)
    }
    db.run('COMMIT')
    
    helpers.onProgress({ phase: 'processing', value: 0.8, message: 'Executing your SQL query...' })
    
    let results: any[] = []
    try {
      const execResult = db.exec(options.query || 'SELECT * FROM data')
      if (execResult.length > 0) {
        const columns = execResult[0].columns
        const values = execResult[0].values
        
        results = values.map((row: any[]) => {
          const obj: Record<string, any> = {}
          for (let i = 0; i < columns.length; i++) obj[columns[i]] = row[i]
          return obj
        })
      }
    } catch (e: any) {
      throw new Error(`SQL syntax or logic error: ${e.message}`)
    }
    
    let resultBlob: Blob
    let resultFileName: string
    let resultStr = ''
    
    if (options.outputFormat === 'JSON') {
      resultStr = JSON.stringify(results, null, 2)
      resultBlob = new Blob([resultStr], { type: 'application/json' })
      resultFileName = `${files[0].name.replace(/\.[^.]+$/, '')}-query.json`
    } else {
      resultStr = Papa.unparse(results)
      resultBlob = new Blob([resultStr], { type: 'text/csv' })
      resultFileName = `${files[0].name.replace(/\.[^.]+$/, '')}-query.csv`
    }
    
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    
    return {
      outputs: [{ id: crypto.randomUUID(), name: resultFileName, blob: resultBlob, type: resultBlob.type, size: resultBlob.size }],
      preview: { kind: 'text', title: 'SQL Query Complete', summary: `Query returned ${results.length} row(s).`, textContent: resultStr }
    }
  },
}

export default module
