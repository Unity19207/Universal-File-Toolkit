import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsTextArea, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface JsonSchemaOptions {
  schemaInput: string
  strict: boolean
}

function JsonSchemaOptionsComponent({ options, onChange }: ToolOptionsComponentProps<JsonSchemaOptions>) {
  return (
    <OptionsSection label="Validation Rules" noBorder>
      <OptionsTextArea
        label="JSON Schema (Draft-07)"
        value={options.schemaInput}
        onChange={(val) => onChange({ ...options, schemaInput: val })}
        placeholder='{ "type": "object", "properties": { "id": { "type": "string" } } }'
        rows={6}
      />
      <div className="mt-4">
        <OptionsCheckbox
          label="Strict mode (Prevent unknown properties)"
          checked={options.strict}
          onChange={(val) => onChange({ ...options, strict: val })}
        />
      </div>
      <p className="text-xs text-secondary mt-4">
        Validates JSON data entries against a provided schema using the AJV engine in your browser.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<JsonSchemaOptions> = {
  defaultOptions: { schemaInput: '', strict: false },
  OptionsComponent: JsonSchemaOptionsComponent,
  async run(files, options, helpers) {
    const Ajv = (await import('ajv')).default
    const input = files[0]
    
    helpers.onProgress({ phase: 'processing', value: 0.2, message: 'Parsing schema tree...' })
    const text = await input.file.text()
    
    let schemaObj = {}
    try {
      schemaObj = JSON.parse(options.schemaInput)
    } catch (e: any) {
      throw new Error(`Schema JSON syntax error: ${e.message}`)
    }
    
    const ajv = new Ajv({ strict: options.strict, allErrors: true })
    const validate = ajv.compile(schemaObj)
    
    helpers.onProgress({ phase: 'processing', value: 0.5, message: 'Executing validation engine...' })
    
    let dataObj = {}
    try {
       dataObj = JSON.parse(text)
    } catch (e: any) {
       throw new Error(`Data JSON syntax error: ${e.message}`)
    }
    
    const valid = validate(dataObj)
    const result = { valid, errors: validate.errors || [] }
    const resultStr = JSON.stringify(result, null, 2)
    const resultBlob = new Blob([resultStr], { type: 'application/json' })

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const outName = `${input.name.replace(/\.[^.]+$/, '')}-validation.json`

    return {
       outputs: [{ id: crypto.randomUUID(), name: outName, blob: resultBlob, type: 'application/json', size: resultBlob.size }],
       preview: {
         kind: 'text',
         title: valid ? 'Validation Passed' : 'Validation Failed',
         summary: valid ? 'Your JSON is 100% schema compliant.' : `Detected ${result.errors.length} schema violations.`,
         textContent: resultStr
       }
    }
  },
}

export default module
