import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsSlider, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface PasswordGeneratorOptions {
  mode: 'password' | 'passphrase'
  length: number
  wordCount: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
  excludeAmbiguous: boolean
  count: number
  separator: string
}

const WORD_LIST: string[] = [
  'abandon','ability','able','about','above','absent','absorb','abstract','absurd','abuse',
  'access','accident','account','accuse','achieve','acid','across','action','actor','actress',
  'actual','adapt','add','addict','address','adjust','admit','adult','advance','advice',
  'afraid','again','age','agent','agree','ahead','aim','air','airport','aisle',
  'alarm','album','alert','alien','almost','alone','alpha','already','also','alter',
  'always','amount','anchor','ancient','anger','angle','animal','ankle','announce','annual',
  'another','answer','anxiety','apart','apple','approve','arctic','arena','army','arrange',
  'arrest','arrive','arrow','artist','artwork','aspect','attack','attend','attract','auction',
  'aunt','author','autumn','average','avocado','avoid','awake','aware','awesome','awful',
  'axis','baby','bachelor','bacon','badge','balance','balcony','ball','bamboo','banana',
  'banner','barely','bargain','barrel','basic','basket','battle','beach','bean','beauty',
  'become','before','begin','behind','believe','below','bench','benefit','best','betray',
  'better','beyond','bicycle','bird','birth','bitter','black','blade','blame','blanket',
  'blast','blaze','bleak','bless','blind','blood','blossom','blue','blur','blush',
  'board','boat','body','bomb','bone','bonus','book','border','bottom','bounce',
  'brain','brand','brave','bread','breeze','brick','bridge','brief','bright','bring',
  'broken','brother','brown','brush','bubble','buddy','budget','build','bullet','bundle',
  'burger','burst','busy','butter','buyer','cabin','cable','cactus','cage','cake',
  'calm','camera','camp','canal','cancel','candy','capable','capital','captain','carbon',
  'cargo','carpet','carry','castle','casual','catch','cattle','cause','caution','cave',
  'ceiling','celery','cement','census','century','cereal','certain','chair','champion','change',
  'chaos','chapter','charge','chase','cheap','check','cheese','cherry','chicken','chief',
  'child','chimney','choice','chunk','cinema','circle','citizen','civil','claim','clap',
  'clarify','claw','clay','clean','clerk','clever','click','client','cliff','climb',
  'clinic','clip','clock','close','cloth','cloud','clown','club','cluster','clutch',
  'coach','coconut','code','coffee','coil','collect','color','column','combine','come',
  'comfort','comic','common','company','concert','conduct','confirm','congress','connect','consider',
  'control','convince','cook','cool','copper','copy','coral','core','corner','correct',
  'cotton','couch','country','couple','course','cousin','cover','craft','crane','crash',
  'crater','crazy','cream','credit','creek','crew','cricket','crime','crisp','critic',
  'crop','cross','crouch','crowd','crucial','cruel','cruise','crumble','crush','crystal',
  'cube','culture','cup','cupboard','curious','current','curtain','curve','cushion','custom',
  'cycle','damage','dance','danger','daring','dash','daughter','dawn','debate','decade',
  'december','decide','decline','decorate','decrease','deer','defense','define','defy','demand',
  'denial','dentist','deny','depart','depend','deposit','depth','deputy','derive','describe',
  'desert','design','detail','detect','develop','device','devote','diagram','diamond','diary',
  'diesel','diet','differ','digital','dignity','dilemma','dinner','dinosaur','direct','dirt',
  'disagree','discover','disease','dish','dismiss','disorder','display','distance','divert','divide',
  'doctor','document','dodge','dolphin','domain','donate','donkey','donor','door','double',
  'dove','draft','dragon','drama','drastic','draw','dream','dress','drift','drill',
  'drink','drip','drive','drop','drum','dry','duck','dumb','dune','during',
  'dust','dutch','dwarf','dynamic','eager','eagle','earth','easily','east','easy',
]

function buildCharset(options: PasswordGeneratorOptions): string {
  const ambiguousChars = new Set(['0', 'O', 'l', '1', 'I'])
  let charset = ''
  if (options.uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (options.lowercase) charset += 'abcdefghijklmnopqrstuvwxyz'
  if (options.numbers) charset += '0123456789'
  if (options.symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?'
  if (options.excludeAmbiguous) {
    charset = charset
      .split('')
      .filter((c) => !ambiguousChars.has(c))
      .join('')
  }
  return charset
}

function generatePassword(charset: string, length: number): string {
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  return Array.from(values, (v) => charset[v % charset.length]).join('')
}

function generatePassphrase(wordCount: number, separator: string): string {
  const values = new Uint32Array(wordCount)
  crypto.getRandomValues(values)
  return Array.from(values, (v) => WORD_LIST[v % WORD_LIST.length]).join(separator)
}

function PasswordGeneratorOptionsComponent({ options, onChange }: ToolOptionsComponentProps<PasswordGeneratorOptions>) {
  return (
    <>
      <OptionsSection label="Security Schema">
        <OptionsSelect
          label="Generation Strategy"
          value={options.mode}
          onChange={(val) => onChange({ ...options, mode: val as PasswordGeneratorOptions['mode'] })}
          options={[
            { value: 'password', label: 'Randomized Character String' },
            { value: 'passphrase', label: 'Dictionary-based Passphrase' },
          ]}
        />
      </OptionsSection>

      <OptionsSection label="Complexity Parameters">
        {options.mode === 'password' ? (
          <div className="space-y-6">
            <OptionsSlider
              label="String Length"
              min={8}
              max={128}
              value={options.length}
              onChange={(val) => onChange({ ...options, length: val })}
              displayValue={`${options.length} characters`}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <OptionsCheckbox
                label="Uppercase (A-Z)"
                checked={options.uppercase}
                onChange={(val) => onChange({ ...options, uppercase: val })}
              />
              <OptionsCheckbox
                label="Lowercase (a-z)"
                checked={options.lowercase}
                onChange={(val) => onChange({ ...options, lowercase: val })}
              />
              <OptionsCheckbox
                label="Numbers (0-9)"
                checked={options.numbers}
                onChange={(val) => onChange({ ...options, numbers: val })}
              />
              <OptionsCheckbox
                label="Symbols (!@#$%^&*)"
                checked={options.symbols}
                onChange={(val) => onChange({ ...options, symbols: val })}
              />
            </div>
            <OptionsCheckbox
              label="Exclude ambiguous (0, O, l, 1, I)"
              checked={options.excludeAmbiguous}
              onChange={(val) => onChange({ ...options, excludeAmbiguous: val })}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <OptionsSlider
              label="Word Count"
              min={3}
              max={12}
              value={options.wordCount}
              onChange={(val) => onChange({ ...options, wordCount: val })}
              displayValue={`${options.wordCount} words`}
            />
            <OptionsInput
              label="Word Separator"
              value={options.separator}
              onChange={(val) => onChange({ ...options, separator: val })}
              placeholder='e.g. "-" or "_"'
            />
          </div>
        )}
      </OptionsSection>

      <OptionsSection label="Batch Configuration" noBorder>
        <div className="grid gap-4 sm:grid-cols-2">
          <OptionsInput
            label="Quantity to Generate"
            type="number"
            min={1}
            max={500}
            value={options.count}
            onChange={(val) => onChange({ ...options, count: Math.min(500, Math.max(1, Number(val))) })}
          />
        </div>
        <p className="text-[11px] text-muted mt-6">
          Utilizes the hardware-accelerated Web Crypto API for cryptographically 
          secure entropy. All computation happens in memory.
        </p>
      </OptionsSection>
    </>
  )
}

const module: ToolModule<PasswordGeneratorOptions> = {
  defaultOptions: {
    mode: 'password',
    length: 16,
    wordCount: 4,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeAmbiguous: false,
    count: 10,
    separator: '-',
  },
  OptionsComponent: PasswordGeneratorOptionsComponent,
  async run(files, options, helpers) {
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Generating passwords…' })

    if (options.mode === 'password') {
      const charset = buildCharset(options)
      if (charset.length === 0) throw new Error('Enable at least one character set (uppercase, lowercase, numbers, or symbols).')
    }

    const passwords: string[] = []
    const charset = options.mode === 'password' ? buildCharset(options) : ''
    const entropy =
      options.mode === 'password'
        ? Math.floor(Math.log2(Math.pow(charset.length, options.length)))
        : Math.floor(Math.log2(Math.pow(WORD_LIST.length, options.wordCount)))

    for (let i = 0; i < options.count; i++) {
      const pwd = options.mode === 'password' ? generatePassword(charset, options.length) : generatePassphrase(options.wordCount, options.separator)
      passwords.push(pwd)
      if (i % 100 === 0) {
        helpers.onProgress({
          phase: 'processing',
          value: Math.min(0.9, 0.1 + (i / options.count) * 0.8),
          message: `Generated ${i + 1} / ${options.count}`,
        })
      }
    }

    const output = passwords.join('\n')
    const blob = new Blob([output], { type: 'text/plain' })

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })

    const inputName = files.length > 0 ? files[0].name.replace(/\.[^.]+$/, '') : 'generated'
    return {
      outputs: [{ id: crypto.randomUUID(), name: `${inputName}-passwords.txt`, blob, type: 'text/plain', size: blob.size }],
      preview: {
        kind: 'text',
        title: `${options.count} passwords generated`,
        summary: `Generated ${options.count} ${options.mode === 'password' ? `${options.length}-char passwords` : `${options.wordCount}-word passphrases`} locally using Web Crypto.`,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Mode', value: options.mode },
          { label: 'Entropy', value: `~${entropy} bits` },
          { label: 'Count', value: `${options.count}` },
        ],
      },
    }
  },
}

export default module
