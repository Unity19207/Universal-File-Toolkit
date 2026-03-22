import { useState, useCallback, useMemo } from 'react'
import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'

// --- SECTION 1 - TYPESCRIPT TYPES ---

type ColumnType =
  | 'auto_increment'     // 1, 2, 3... (integer, always unique, always ordered)
  | 'uuid'               // random UUID v4
  | 'first_name'
  | 'last_name'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'integer'            // random integer, user sets min and max
  | 'float'              // random float, user sets min, max, decimal places
  | 'boolean'
  | 'date'               // random date between startDate and endDate
  | 'timestamp'
  | 'city'
  | 'country'
  | 'zip_code'
  | 'street_address'
  | 'company'
  | 'job_title'
  | 'url'
  | 'ipv4'
  | 'hex_color'
  | 'text'               // random lorem-style words, user sets maxLength
  | 'enum'               // user provides comma-separated values, picks randomly
  | 'custom_sequence'    // user provides start number, tool increments by step
  | 'prefixed_sequence'  // e.g. ABC#0001, ORDER-0042
  | 'bios_uuid'          // compact random alphanumeric ID
  | 'template_string'    // user-authored template with tokens

interface ColumnDef {
  name: string
  type: ColumnType
  // type-specific options:
  minInt?: number         // for integer
  maxInt?: number         // for integer
  minFloat?: number       // for float
  maxFloat?: number       // for float
  decimalPlaces?: number  // for float (default 2)
  maxLength?: number      // for text (max chars, default 100)
  enumValues?: string     // comma-separated, for enum
  dateStart?: string      // ISO date string, for date/timestamp
  dateEnd?: string        // ISO date string, for date/timestamp
  sequenceStart?: number  // for custom_sequence
  sequenceStep?: number   // for custom_sequence (default 1)
  // prefixed_sequence options:
  prefix?: string
  separator?: string
  padLength?: number
  startAt?: number
  // bios_uuid options:
  charset?: 'alphanumeric' | 'uppercase' | 'lowercase' | 'hex'
  groupSize?: number
  groupSeparator?: string
  // template_string options:
  template?: string
  unique?: boolean        // enforce uniqueness (supported for integer, text, email, uuid)
  nullable?: boolean      // emit null for ~10% of rows (not for auto_increment/uuid)
}

interface MockDataOptions {
  outputFormat: 'csv' | 'json' | 'sql'
  rowCount: number          // 1 to 10,000,000
  columns: ColumnDef[]
  // CSV specific:
  csvDelimiter: ',' | ';' | '\t'
  csvIncludeHeader: boolean
  // JSON specific:
  jsonSample: string        // user-pasted sample JSON object (single object)
  jsonMode: 'schema' | 'sample'  // 'schema' = use columns[], 'sample' = infer from jsonSample
  // SQL specific:
  sqlTableName: string
  sqlDialect: 'mysql' | 'postgresql' | 'sqlite'
  sqlMode: 'schema' | 'sample'   // same as json
  sqlSample: string         // user-pasted sample INSERT or CREATE TABLE statement
}

// --- SECTION 4A-DATA PRIMITIVES DATA ---

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
  'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
  'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
  'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Dorothy', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa', 'Timothy', 'Deborah',
  'Ronald', 'Stephanie', 'Edward', 'Rebecca', 'Jason', 'Sharon', 'Jeffrey', 'Laura', 'Ryan', 'Cynthia',
  'Jacob', 'Kathleen', 'Gary', 'Amy', 'Nicholas', 'Shirley', 'Eric', 'Angela', 'Jonathan', 'Helen',
  'Stephen', 'Anna', 'Larry', 'Brenda', 'Justin', 'Pamela', 'Scott', 'Nicole', 'Brandon', 'Emma'
]

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes'
]

const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'protonmail.com', 'example.com', 'company.net', 'service.io', 'web.dev']

const CITIES = [
  'New York', 'London', 'Paris', 'Tokyo', 'Berlin', 'Madrid', 'Rome', 'Sydney', 'Toronto', 'Mumbai',
  'Singapore', 'Dubai', 'Shanghai', 'Sao Paulo', 'Mexico City', 'Cairo', 'Istanbul', 'Moscow', 'Seoul', 'Bangkok',
  'Amsterdam', 'Vienna', 'Barcelona', 'Lisbon', 'Munich', 'Prague', 'Stockholm', 'Oslo', 'Copenhagen', 'Helsinki',
  'Zurich', 'Geneva', 'Brussels', 'Dublin', 'Warsaw', 'Budapest', 'Athens', 'Milan', 'Venice', 'Florence',
  'Los Angeles', 'Chicago', 'San Francisco', 'Miami', 'Seattle', 'Boston', 'Austin', 'Denver', 'Atlanta', 'Dallas'
]

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Japan', 'India', 'Brazil', 'Mexico',
  'Italy', 'Spain', 'China', 'Russia', 'South Korea', 'Netherlands', 'Switzerland', 'Sweden', 'Norway', 'Denmark',
  'South Africa', 'Egypt', 'Turkey', 'Saudi Arabia', 'United Arab Emirates', 'Singapore', 'Thailand', 'Vietnam', 'Indonesia', 'Malaysia',
  'Argentina', 'Chile', 'Colombia', 'Peru', 'Portugal', 'Greece', 'Ireland', 'Belgium', 'Austria', 'Poland',
  'Israel', 'New Zealand', 'Finland', 'Czech Republic', 'Hungary', 'Romania', 'Ukraine', 'Pakistan', 'Nigeria', 'Kenya'
]

const COMPANIES = [
  'TechCorp', 'InnovaSystems', 'GlobalLogic', 'EcoSolutions', 'CloudNine', 'ApexIndustries', 'NextGen', 'DataPulse', 'SmartMove', 'PrimeGroup',
  'Streamline', 'Vantage', 'CoreLogic', 'BlueWave', 'Summit', 'Nexus', 'Peak', 'Zenith', 'Optima', 'Elite',
  'Fortune', 'Victory', 'Unity', 'Legacy', 'Liberty', 'Freedom', 'Pioneer', 'Horizon', 'Stellar', 'Quantum',
  'Cyberdyne', 'Umbrella', 'Weyland-Yutani', 'Stark Industries', 'Wayne Enterprises', 'Globex', 'Soylent', 'Aperture', 'Hooli', 'Initech',
  'Massive Dynamic', 'Veidt', 'Tyrell', 'Gekko & Co', 'Bluth Company', 'Dunder Mifflin', 'Sterling Cooper', 'E Corp', 'Pied Piper', 'Snoopy'
]

const JOB_TITLES = [
  'Software Engineer', 'Product Manager', 'Data Scientist', 'UX Designer', 'Marketing Lead', 'Sales Manager', 'HR Specialist', 'Financial Analyst', 'Project Manager', 'Customer Success',
  'Accountant', 'Lawyer', 'Doctor', 'Nurse', 'Teacher', 'Chef', 'Architect', 'Artist', 'Writer', 'Photographer',
  'Director', 'CEO', 'CTO', 'COO', 'VP of Engineering', 'Operations Manager', 'Consultant', 'Advisor', 'Strategist', 'Planner',
  'Associate', 'Senior Manager', 'Principal', 'Executive', 'Leader', 'Coordinator', 'Administrator', 'Support', 'Assistant', 'Specialist'
]

const STREET_NAMES = [
  'Main', 'Oak', 'Washington', 'Lake', 'Park', 'Maple', 'Cedar', 'Pine', 'View', 'Sunset',
  'River', 'Highland', 'Lowland', 'Forest', 'Meadow', 'Brook', 'Creek', 'Village', 'Hill', 'Mountain'
]

const STREET_TYPES = ['St', 'Ave', 'Rd', 'Ln', 'Dr', 'Ct', 'Pl', 'Blvd', 'Way', 'Ter']

const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do',
  'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua', 'ut',
  'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi',
  'ut', 'aliquip', 'ex', 'ea', 'commodo', 'consequat', 'duis', 'aute', 'irure', 'dolor',
  'in', 'reprehenderit', 'in', 'voluptate', 'velit', 'esse', 'cillum', 'dolore', 'eu', 'fugiat',
  'nulla', 'pariatur', 'excepteur', 'sint', 'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'in',
  'culpa', 'qui', 'officia', 'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum'
]

type CategoryGroup = 'Sequence' | 'Identity' | 'Numbers' | 'Dates' | 'Location' | 'Text' | 'Utility'

const TYPE_CATEGORIES: Record<ColumnType, { group: CategoryGroup, label: string, color: string }> = {
  // Sequence
  auto_increment: { group: 'Sequence', label: 'Auto increment', color: 'bg-[var(--accent-subtle)] text-[var(--accent-primary)]' },
  prefixed_sequence: { group: 'Sequence', label: 'Prefixed seq', color: 'bg-[var(--accent-subtle)] text-[var(--accent-primary)]' },
  custom_sequence: { group: 'Sequence', label: 'Custom seq', color: 'bg-[var(--accent-subtle)] text-[var(--accent-primary)]' },
  // Identity
  uuid: { group: 'Identity', label: 'UUID', color: 'bg-[rgba(59,130,246,0.1)] text-[#3b82f6]' },
  bios_uuid: { group: 'Identity', label: 'Compact ID', color: 'bg-[rgba(59,130,246,0.1)] text-[#3b82f6]' },
  first_name: { group: 'Identity', label: 'First name', color: 'bg-[rgba(59,130,246,0.1)] text-[#3b82f6]' },
  last_name: { group: 'Identity', label: 'Last name', color: 'bg-[rgba(59,130,246,0.1)] text-[#3b82f6]' },
  full_name: { group: 'Identity', label: 'Full name', color: 'bg-[rgba(59,130,246,0.1)] text-[#3b82f6]' },
  email: { group: 'Identity', label: 'Email', color: 'bg-[rgba(59,130,246,0.1)] text-[#3b82f6]' },
  phone: { group: 'Identity', label: 'Phone', color: 'bg-[rgba(59,130,246,0.1)] text-[#3b82f6]' },
  // Numbers
  integer: { group: 'Numbers', label: 'Integer', color: 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]' },
  float: { group: 'Numbers', label: 'Float', color: 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]' },
  boolean: { group: 'Numbers', label: 'Boolean', color: 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]' },
  // Dates
  date: { group: 'Dates', label: 'Date', color: 'bg-[rgba(245,158,11,0.1)] text-[#f59e0b]' },
  timestamp: { group: 'Dates', label: 'Timestamp', color: 'bg-[rgba(245,158,11,0.1)] text-[#f59e0b]' },
  // Location
  city: { group: 'Location', label: 'City', color: 'bg-[rgba(6,182,212,0.1)] text-[#06b6d4]' },
  country: { group: 'Location', label: 'Country', color: 'bg-[rgba(6,182,212,0.1)] text-[#06b6d4]' },
  zip_code: { group: 'Location', label: 'ZIP Code', color: 'bg-[rgba(6,182,212,0.1)] text-[#06b6d4]' },
  street_address: { group: 'Location', label: 'Street address', color: 'bg-[rgba(6,182,212,0.1)] text-[#06b6d4]' },
  // Text
  text: { group: 'Text', label: 'Lorem ipsum', color: 'bg-[rgba(139,92,246,0.1)] text-[#8b5cf6]' },
  enum: { group: 'Text', label: 'Enum', color: 'bg-[rgba(139,92,246,0.1)] text-[#8b5cf6]' },
  template_string: { group: 'Text', label: 'Template string', color: 'bg-[rgba(139,92,246,0.1)] text-[#8b5cf6]' },
  // Utility
  url: { group: 'Utility', label: 'URL', color: 'bg-[var(--bg-elevated)] text-[var(--text-muted)]' },
  ipv4: { group: 'Utility', label: 'IPv4', color: 'bg-[var(--bg-elevated)] text-[var(--text-muted)]' },
  hex_color: { group: 'Utility', label: 'Hex color', color: 'bg-[var(--bg-elevated)] text-[var(--text-muted)]' },
  company: { group: 'Utility', label: 'Company', color: 'bg-[var(--bg-elevated)] text-[var(--text-muted)]' },
  job_title: { group: 'Utility', label: 'Job Title', color: 'bg-[var(--bg-elevated)] text-[var(--text-muted)]' }
}

const DEFAULT_NAMES: Partial<Record<ColumnType, string>> = {
  auto_increment: 'id',
  uuid: 'uuid',
  bios_uuid: 'id',
  first_name: 'first_name',
  last_name: 'last_name',
  full_name: 'name',
  email: 'email',
  phone: 'phone',
  date: 'date',
  timestamp: 'created_at',
  city: 'city',
  country: 'country',
  zip_code: 'zip_code',
  street_address: 'address',
  company: 'company',
  job_title: 'job_title',
  url: 'url',
  ipv4: 'ip_address',
  hex_color: 'color'
}

// --- SECTION 4 - DATA GENERATION ENGINE ---

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const primitives = {
  genAutoIncrement: (i: number) => String(i + 1),
  genUUID: () => crypto.randomUUID(),
  genFirstName: () => pick(FIRST_NAMES),
  genLastName: () => pick(LAST_NAMES),
  genFullName: () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
  genEmail: (fn?: string, ln?: string) => {
    const f = fn || pick(FIRST_NAMES)
    const l = ln || pick(LAST_NAMES)
    return `${f.toLowerCase()}.${l.toLowerCase()}${Math.floor(Math.random() * 1000)}@${pick(DOMAINS)}`
  },
  genPhone: () => `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
  genInteger: (min = 0, max = 100) => Math.floor(Math.random() * (max - min + 1)) + min,
  genFloat: (min = 0, max = 100, dec = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(dec)),
  genBoolean: () => (Math.random() > 0.5 ? 'true' : 'false'),
  genDate: (startStr?: string, endStr?: string) => {
    const start = startStr ? new Date(startStr).getTime() : new Date(2020, 0, 1).getTime()
    const end = endStr ? new Date(endStr).getTime() : new Date(2025, 11, 31).getTime()
    return new Date(start + Math.random() * (end - start)).toISOString().split('T')[0]
  },
  genTimestamp: (startStr?: string, endStr?: string) => {
    const start = startStr ? new Date(startStr).getTime() : new Date(2020, 0, 1).getTime()
    const end = endStr ? new Date(endStr).getTime() : new Date().getTime()
    return new Date(start + Math.random() * (end - start)).toISOString()
  },
  genCity: () => pick(CITIES),
  genCountry: () => pick(COUNTRIES),
  genZip: () => String(Math.floor(Math.random() * 90000) + 10000),
  genStreetAddress: () => `${Math.floor(Math.random() * 9999) + 1} ${pick(STREET_NAMES)} ${pick(STREET_TYPES)}`,
  genCompany: () => pick(COMPANIES),
  genJobTitle: () => pick(JOB_TITLES),
  genURL: () => `https://www.${pick(LOREM_WORDS)}.${pick(['com', 'io', 'net', 'org', 'dev'])}`,
  genIPv4: () => Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join('.'),
  genHexColor: () => `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
  genText: (max = 100) => {
    let result = ''
    while (result.length < max) {
      result += (result ? ' ' : '') + pick(LOREM_WORDS)
    }
    return result.slice(0, max)
  },
  genEnum: (csv?: string) => {
    const vals = csv ? csv.split(',').map(s => s.trim()) : ['Option A', 'Option B']
    return pick(vals)
  },
  genSequence: (i: number, start = 1, step = 1) => String(start + i * step),
  genPrefixedSequence: (i: number, prefix = 'ABC', sep = '#', pad = 4, startAt = 1) => {
    return `${prefix}${sep}${String(startAt + i).padStart(pad, '0')}`
  },
  genBiosUUID: (maxLen = 25, charset: 'alphanumeric' | 'uppercase' | 'lowercase' | 'hex' = 'alphanumeric', groupSize = 0, groupSep = '-') => {
    const charsets: Record<string, string> = {
      alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      lowercase: 'abcdefghijklmnopqrstuvwxyz0123456789',
      hex: '0123456789ABCDEF',
    }
    const pool = charsets[charset] || charsets.alphanumeric
    let raw = ''
    for (let c = 0; c < maxLen; c++) raw += pool[Math.floor(Math.random() * pool.length)]
    if (groupSize <= 0) return raw
    const groups: string[] = []
    for (let g = 0; g < raw.length; g += groupSize) groups.push(raw.slice(g, g + groupSize))
    return groups.join(groupSep)
  },
  genTemplateString: (i: number, template = '') => {
    let seqCounter = 0
    return template.replace(/\{(\w+)(?::([^}]*))?\}/g, (_match, token: string, args: string | undefined) => {
      switch (token) {
        case 'firstName': return pick(FIRST_NAMES)
        case 'lastName': return pick(LAST_NAMES)
        case 'uuid': return crypto.randomUUID()
        case 'date': return new Date(new Date(2020, 0, 1).getTime() + Math.random() * (Date.now() - new Date(2020, 0, 1).getTime())).toISOString().split('T')[0]
        case 'seq': { const start = parseInt(args || '1', 10); return String(start + i + seqCounter++) }
        case 'integer': {
          const [minS, maxS] = (args || '0:100').split(':')
          const mn = parseInt(minS, 10) || 0
          const mx = parseInt(maxS, 10) || 100
          return String(Math.floor(Math.random() * (mx - mn + 1)) + mn)
        }
        case 'float': {
          const [fmin, fmax, fdec] = (args || '0:100:2').split(':')
          const fmn = parseFloat(fmin) || 0
          const fmx = parseFloat(fmax) || 100
          const fd = parseInt(fdec, 10) || 2
          return (Math.random() * (fmx - fmn) + fmn).toFixed(fd)
        }
        case 'enum': {
          const vals = (args || 'A,B,C').split(',')
          return pick(vals).trim()
        }
        case 'alpha': {
          const n = parseInt(args || '3', 10)
          const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
          let r = ''
          for (let c = 0; c < n; c++) r += pool[Math.floor(Math.random() * pool.length)]
          return r
        }
        case 'digit': {
          const n = parseInt(args || '3', 10)
          let r = ''
          for (let c = 0; c < n; c++) r += Math.floor(Math.random() * 10)
          return r
        }
        default: return _match
      }
    })
  }
}

function generateValue(type: ColumnType, i: number, def: ColumnDef): any {
  if (def.nullable && Math.random() < 0.1) return null

  switch (type) {
    case 'auto_increment': return primitives.genAutoIncrement(i)
    case 'uuid': return primitives.genUUID()
    case 'first_name': return primitives.genFirstName()
    case 'last_name': return primitives.genLastName()
    case 'full_name': return primitives.genFullName()
    case 'email': return primitives.genEmail()
    case 'phone': return primitives.genPhone()
    case 'integer': return primitives.genInteger(def.minInt, def.maxInt)
    case 'float': return primitives.genFloat(def.minFloat, def.maxFloat, def.decimalPlaces)
    case 'boolean': return primitives.genBoolean()
    case 'date': return primitives.genDate(def.dateStart, def.dateEnd)
    case 'timestamp': return primitives.genTimestamp(def.dateStart, def.dateEnd)
    case 'city': return primitives.genCity()
    case 'country': return primitives.genCountry()
    case 'zip_code': return primitives.genZip()
    case 'street_address': return primitives.genStreetAddress()
    case 'company': return primitives.genCompany()
    case 'job_title': return primitives.genJobTitle()
    case 'url': return primitives.genURL()
    case 'ipv4': return primitives.genIPv4()
    case 'hex_color': return primitives.genHexColor()
    case 'text': return primitives.genText(def.maxLength)
    case 'enum': return primitives.genEnum(def.enumValues)
    case 'custom_sequence': return primitives.genSequence(i, def.sequenceStart, def.sequenceStep)
    case 'prefixed_sequence': return primitives.genPrefixedSequence(i, def.prefix, def.separator, def.padLength, def.startAt)
    case 'bios_uuid': return primitives.genBiosUUID(def.maxLength, def.charset, def.groupSize, def.groupSeparator)
    case 'template_string': return primitives.genTemplateString(i, def.template)
    default: return 'mock'
  }
}


// --- SECTION 3 - OPTIONSUI COMPONENT ---

function MockDataOptionsComponent({ options, onChange }: ToolOptionsComponentProps<MockDataOptions>) {
  const defaultNewColumn: ColumnDef = { name: '', type: 'auto_increment' }

  const [builderOpen, setBuilderOpen] = useState(false)
  const [builderCol, setBuilderCol] = useState<ColumnDef>(defaultNewColumn)
  const [builderEditIndex, setBuilderEditIndex] = useState<number | null>(null)

  const handleUpdate = useCallback((updates: Partial<MockDataOptions>) => {
    onChange({ ...options, ...updates })
  }, [options, onChange])

  const openBuilder = (index: number | null = null) => {
    if (index === null) {
      setBuilderCol(defaultNewColumn)
      setBuilderEditIndex(null)
    } else {
      setBuilderCol({ ...options.columns[index] })
      setBuilderEditIndex(index)
    }
    setBuilderOpen(true)
  }

  const closeBuilder = () => {
    setBuilderOpen(false)
  }

  const saveBuilderCol = () => {
    if (!builderCol.name.trim() || nameError) return
    const newCols = [...options.columns]
    if (builderEditIndex === null) {
      newCols.push(builderCol)
    } else {
      newCols[builderEditIndex] = builderCol
    }
    handleUpdate({ columns: newCols })
    closeBuilder()
  }

  const removeColumn = (index: number) => {
    if (options.columns.length <= 1) return
    const newCols = [...options.columns]
    newCols.splice(index, 1)
    handleUpdate({ columns: newCols })
    if (builderEditIndex === index) closeBuilder()
  }

  const nameError = useMemo(() => {
    if (!builderCol.name) return 'Name is required'
    if (builderCol.name.length > 64) return 'Max 64 characters'
    const exists = options.columns.findIndex(c => c.name === builderCol.name)
    if (exists !== -1 && exists !== builderEditIndex) return 'Name already used'
    return null
  }, [builderCol.name, options.columns, builderEditIndex])

  // Need to define generateValue before genSampleValue (hoisting)
  const genSampleValueUnmemoized = useCallback((col: ColumnDef, i: number): string => {
    const val = generateValue(col.type, i, col)
    if (val === null) return '(null)'
    if (typeof val === 'boolean') return String(val)
    return String(val)
  }, [])
  
  const genSampleValue = useCallback((col: ColumnDef, i: number) => genSampleValueUnmemoized(col, i), [genSampleValueUnmemoized])

  const showBuilder = options.outputFormat === 'csv' ||
    (options.outputFormat === 'json' && options.jsonMode === 'schema') ||
    (options.outputFormat === 'sql' && options.sqlMode === 'schema')

  return (
    <div className="space-y-10 pb-12">
      {/* PANEL A - Output Format + Row Count */}
      <div className="space-y-6">
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Target Format</label>
          <div className="flex flex-wrap gap-2">
            {(['csv', 'json', 'sql'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleUpdate({ outputFormat: fmt })}
                className={`px-5 py-2.5 rounded-sm text-[11px] font-black uppercase tracking-widest transition-all border ${
                  options.outputFormat === fmt
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] shadow-md'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--accent-primary)]'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Record Count</label>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={10000000}
                value={options.rowCount}
                onChange={(e) => handleUpdate({ rowCount: Math.max(1, Math.min(10000000, Number(e.target.value))) })}
                className="tool-input pr-16"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--text-muted)] opacity-40">ROWS</span>
            </div>
          </div>
          
          {options.outputFormat === 'csv' && (
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Delimiter</label>
              <select 
                value={options.csvDelimiter} 
                onChange={(e) => handleUpdate({ csvDelimiter: e.target.value as any })}
                className="tool-input"
              >
                <option value=",">Comma (,)</option>
                <option value=";">Semicolon (;)</option>
                <option value="\t">Tab (\t)</option>
              </select>
            </div>
          )}
        </div>

        {options.rowCount > 500000 && (
          <div className="p-4 rounded-sm border border-[var(--accent-primary)] border-opacity-20 bg-[var(--accent-primary)] bg-opacity-5 flex gap-3 items-start">
            <span className="text-sm">⚡</span>
            <p className="text-[11px] text-[var(--text-primary)] font-medium leading-relaxed">
              Large dataset detected. Generation will be optimized for browser performance.
            </p>
          </div>
        )}
      </div>

      {/* PANEL B - Column Builder */}
      {showBuilder && (
        <div className="space-y-6 pt-6 border-t border-[var(--border-color)]">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Schema Definition</h3>
            <button
              onClick={() => openBuilder(null)}
              className="px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-sm text-[10px] font-black uppercase tracking-widest hover:border-[var(--accent-primary)] transition-all flex items-center gap-2"
            >
              <span className="text-lg leading-none">+</span> Add field
            </button>
          </div>

          <div className="space-y-3">
            {options.columns.length === 0 ? (
              <div 
                onClick={() => openBuilder(null)}
                className="w-full h-32 flex flex-col items-center justify-center border border-[var(--border-color)] border-dashed rounded-sm cursor-pointer hover:bg-[var(--bg-elevated)] transition-all opacity-60 hover:opacity-100"
              >
                <p className="text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)]">Design your first column</p>
              </div>
            ) : (
              <div className="space-y-2">
                {options.columns.map((col, idx) => (
                  <div key={`${idx}-${col.name}`} className="group flex items-center gap-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-4 hover:border-[var(--accent-primary)] transition-all">
                    <div className="shrink-0 w-8 h-8 rounded-sm bg-[var(--bg-base)] border border-[var(--border-color)] flex items-center justify-center text-[10px] font-mono font-bold text-[var(--text-muted)] opacity-60">
                      {idx + 1}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="font-bold text-sm text-[var(--text-primary)] truncate">{col.name}</span>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm ${TYPE_CATEGORIES[col.type].color}`}>
                          {TYPE_CATEGORIES[col.type].label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                        <span className="opacity-40">Sample:</span>
                        <span className="font-mono text-[var(--text-secondary)] truncate">{String(genSampleValue(col, 0))}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => openBuilder(idx)}
                        className="p-2 text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
                        title="Edit field"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button 
                        onClick={() => removeColumn(idx)}
                        disabled={options.columns.length <= 1}
                        className="p-2 text-[var(--text-muted)] hover:text-[var(--negative)] transition-colors disabled:opacity-20"
                        title="Delete field"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
            
            {/* COLUMN BUILDER PANEL */}
            {builderOpen && (
              <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-sm overflow-hidden shadow-2xl relative mt-6">
                <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-base)] bg-opacity-40">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">{builderEditIndex === null ? 'Create Field' : 'Edit Field'}</h4>
                  </div>
                  <button onClick={closeBuilder} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none p-1 transition-colors">×</button>
                </div>
                
                <div className="p-8 space-y-8">
                  {/* ZONE A: Identity */}
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Field Identifier</label>
                      <input
                        autoFocus
                        value={builderCol.name}
                        onChange={(e) => setBuilderCol({ ...builderCol, name: e.target.value.replace(/\s+/g, '_') })}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveBuilderCol() }}
                        placeholder="e.g. customer_id"
                        className={`tool-input font-mono ${nameError ? 'border-[var(--negative)]' : ''}`}
                      />
                      {nameError && <p className="text-[10px] text-[var(--negative)] font-bold">{nameError}</p>}
                    </div>
                    
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Data Archetype</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 p-6 bg-[var(--bg-base)] bg-opacity-50 rounded-sm border border-[var(--border-color)] max-h-[300px] overflow-y-auto custom-scrollbar">
                        {(['Sequence', 'Identity', 'Numbers', 'Dates', 'Location', 'Text', 'Utility'] as CategoryGroup[]).map(group => (
                          <div key={group} className="space-y-2">
                            <div className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-60 border-b border-[var(--border-color)] pb-1 mb-2">{group}</div>
                            <div className="flex flex-col gap-1">
                              {(Object.entries(TYPE_CATEGORIES) as [ColumnType, any][]).filter(([_, conf]) => conf.group === group).map(([type, conf]) => (
                                <button
                                  key={type}
                                  onClick={() => {
                                    const nextName = !builderCol.name ? (DEFAULT_NAMES[type] || '') : builderCol.name
                                    setBuilderCol({ ...builderCol, type, name: nextName })
                                  }}
                                  className={`text-left text-[11px] px-3 py-2 rounded-sm transition-all border ${
                                    builderCol.type === type 
                                      ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] font-bold shadow-md transform scale-[1.02]' 
                                      : 'text-[var(--text-secondary)] border-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-surface)]'
                                  }`}
                                >
                                  {conf.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ZONE B: Configuration */}
                  <div className="p-6 bg-[var(--bg-base)] bg-opacity-30 rounded-sm border border-[var(--border-color)]">
                    <div className="flex items-center justify-between mb-6 border-b border-[var(--border-color)] pb-3">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Archetype Parameters</h5>
                      <div className="text-[10px] font-mono text-[var(--accent-primary)] font-bold">
                        {builderCol.type.toUpperCase()}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                      {['first_name', 'last_name', 'full_name', 'email', 'phone', 'boolean', 'uuid', 'city', 'country', 'zip_code', 'street_address', 'url', 'ipv4', 'hex_color', 'company', 'job_title'].includes(builderCol.type) && (
                        <div className="col-span-1 sm:col-span-2 text-[11px] text-[var(--text-muted)] italic py-2">
                          Standard archetype selected. No additional parameters required.
                        </div>
                      )}

                      {builderCol.type === 'integer' && (
                        <>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Minimum</label>
                            <input type="number" value={builderCol.minInt ?? 0} onChange={(e) => setBuilderCol({ ...builderCol, minInt: Number(e.target.value) })} className="tool-input" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Maximum</label>
                            <input type="number" value={builderCol.maxInt ?? 100} onChange={(e) => setBuilderCol({ ...builderCol, maxInt: Number(e.target.value) })} className="tool-input" />
                          </div>
                        </>
                      )}

                      {builderCol.type === 'float' && (
                        <>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Range Start</label>
                            <input type="number" value={builderCol.minFloat ?? 0} onChange={(e) => setBuilderCol({ ...builderCol, minFloat: Number(e.target.value) })} className="tool-input" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Range End</label>
                            <input type="number" value={builderCol.maxFloat ?? 100} onChange={(e) => setBuilderCol({ ...builderCol, maxFloat: Number(e.target.value) })} className="tool-input" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Precision (Decimals)</label>
                            <input type="number" min={0} max={10} value={builderCol.decimalPlaces ?? 2} onChange={(e) => setBuilderCol({ ...builderCol, decimalPlaces: Number(e.target.value) })} className="tool-input" />
                          </div>
                        </>
                      )}

                      {builderCol.type === 'text' && (
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Max Characters</label>
                          <input type="number" value={builderCol.maxLength ?? 100} onChange={(e) => setBuilderCol({ ...builderCol, maxLength: Number(e.target.value) })} className="tool-input" />
                        </div>
                      )}

                      {builderCol.type === 'enum' && (
                        <div className="col-span-1 sm:col-span-2 space-y-2">
                          <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Enumerated Values (comma-separated)</label>
                          <textarea value={builderCol.enumValues ?? ''} onChange={(e) => setBuilderCol({ ...builderCol, enumValues: e.target.value })} className="tool-input h-20 resize-none font-mono" placeholder="active, pending, archived" />
                        </div>
                      )}

                      {(builderCol.type === 'date' || builderCol.type === 'timestamp') && (
                        <>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Boundary Start</label>
                            <input type="date" value={builderCol.dateStart ?? '2020-01-01'} onChange={(e) => setBuilderCol({ ...builderCol, dateStart: e.target.value })} className="tool-input" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Boundary End</label>
                            <input type="date" value={builderCol.dateEnd ?? '2025-12-31'} onChange={(e) => setBuilderCol({ ...builderCol, dateEnd: e.target.value })} className="tool-input" />
                          </div>
                        </>
                      )}

                      {builderCol.type === 'custom_sequence' && (
                        <>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Base Value</label>
                            <input type="number" value={builderCol.sequenceStart ?? 1} onChange={(e) => setBuilderCol({ ...builderCol, sequenceStart: Number(e.target.value) })} className="tool-input" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Incremental Step</label>
                            <input type="number" value={builderCol.sequenceStep ?? 1} onChange={(e) => setBuilderCol({ ...builderCol, sequenceStep: Number(e.target.value) })} className="tool-input" />
                          </div>
                        </>
                      )}

                      {builderCol.type === 'prefixed_sequence' && (
                        <>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Prefix Token</label>
                            <input type="text" value={builderCol.prefix ?? 'ABC'} onChange={(e) => setBuilderCol({ ...builderCol, prefix: e.target.value })} className="tool-input font-mono uppercase" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Delimiter</label>
                            <input type="text" value={builderCol.separator ?? '#'} onChange={(e) => setBuilderCol({ ...builderCol, separator: e.target.value })} className="tool-input font-mono" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Zero Padding</label>
                            <input type="number" min={1} max={12} value={builderCol.padLength ?? 4} onChange={(e) => setBuilderCol({ ...builderCol, padLength: Number(e.target.value) })} className="tool-input" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Start At</label>
                            <input type="number" value={builderCol.startAt ?? 1} onChange={(e) => setBuilderCol({ ...builderCol, startAt: Number(e.target.value) })} className="tool-input" />
                          </div>
                        </>
                      )}

                      {builderCol.type === 'bios_uuid' && (
                        <>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Length (chars)</label>
                            <input type="number" min={1} max={36} value={builderCol.maxLength ?? 25} onChange={(e) => setBuilderCol({ ...builderCol, maxLength: Math.max(1, Math.min(36, Number(e.target.value))) })} className="tool-input" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Charset Definition</label>
                            <select value={builderCol.charset ?? 'alphanumeric'} onChange={(e) => setBuilderCol({ ...builderCol, charset: e.target.value as ColumnDef['charset'] })} className="tool-input">
                              <option value="alphanumeric">Alphanumeric (Mix)</option>
                              <option value="uppercase">Uppercase Only</option>
                              <option value="lowercase">Lowercase Only</option>
                              <option value="hex">Hexadecimal</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Grouping (blocks)</label>
                            <input type="number" min={0} max={12} value={builderCol.groupSize ?? 0} onChange={(e) => setBuilderCol({ ...builderCol, groupSize: Number(e.target.value) })} className="tool-input" />
                          </div>
                        </>
                      )}

                      {builderCol.type === 'template_string' && (
                        <div className="col-span-1 sm:col-span-2 space-y-3">
                          <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Template Definition</label>
                          <input type="text" value={builderCol.template ?? ''} onChange={(e) => setBuilderCol({ ...builderCol, template: e.target.value })} className="tool-input font-mono" placeholder="ID_{seq:10}-{alpha:4}" />
                          <div className="p-3 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-sm text-[9px] text-[var(--text-muted)] leading-relaxed font-mono opacity-80">
                            Tokens: {'{firstName}'} {'{lastName}'} {'{integer:min:max}'} {'{float:min:max:dec}'} {'{uuid}'} {'{date}'} {'{seq:start}'} {'{enum:A,B,C}'} {'{alpha:n}'} {'{digit:n}'}
                          </div>
                        </div>
                      )}

                      {/* Common bottom modifiers */}
                      {builderCol.type !== 'auto_increment' && builderCol.type !== 'uuid' && builderCol.type !== 'prefixed_sequence' && (
                        <div className="col-span-1 sm:col-span-2 flex flex-wrap gap-6 pt-6 mt-2 border-t border-[var(--border-color)]">
                          <label className="flex items-center gap-3 text-[11px] font-bold text-[var(--text-primary)] cursor-pointer group">
                             <div className="relative flex items-center">
                                <input type="checkbox" checked={builderCol.nullable} onChange={(e) => setBuilderCol({ ...builderCol, nullable: e.target.checked })} className="peer opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10" />
                                <div className="w-4 h-4 rounded-sm border-2 border-[var(--border-color)] peer-checked:bg-[var(--accent-primary)] peer-checked:border-[var(--accent-primary)] transition-all flex items-center justify-center">
                                   <svg className="w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                                </div>
                             </div>
                            <span>Enable Nullability</span>
                          </label>
                          
                          {['integer', 'text', 'email', 'template_string'].includes(builderCol.type) && (
                            <label className="flex items-center gap-3 text-[11px] font-bold text-[var(--text-primary)] cursor-pointer group">
                               <div className="relative flex items-center">
                                  <input type="checkbox" checked={builderCol.unique} onChange={(e) => setBuilderCol({ ...builderCol, unique: e.target.checked })} className="peer opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10" />
                                  <div className="w-4 h-4 rounded-sm border-2 border-[var(--border-color)] peer-checked:bg-[var(--accent-primary)] peer-checked:border-[var(--accent-primary)] transition-all flex items-center justify-center">
                                     <svg className="w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                                  </div>
                               </div>
                              <span>Enforce Uniqueness</span>
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PREVIEW + ACTIONS */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-6 pt-4">
                    <div className="flex-1 p-4 bg-[var(--accent-primary)] bg-opacity-5 border border-[var(--accent-primary)] border-opacity-10 rounded-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-primary)]">Live Preview</span>
                        <span className="text-[9px] font-mono text-[var(--text-muted)] opacity-50">VALUE #1</span>
                      </div>
                      <div className="text-sm font-bold text-[var(--text-primary)] font-mono truncate">
                        {String(genSampleValue(builderCol, 0))}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={closeBuilder}
                        className="flex-1 sm:flex-none px-6 py-2.5 text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                      >
                        Discard
                      </button>
                      <button 
                        onClick={saveBuilderCol}
                        disabled={!builderCol.name.trim() || !!nameError}
                        className="flex-1 sm:flex-none px-8 py-2.5 bg-[var(--accent-primary)] text-white text-[11px] font-black uppercase tracking-widest rounded-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-30 disabled:translate-y-0"
                      >
                        {builderEditIndex === null ? 'Create Field' : 'Update Field'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      {/* PANEL C - Format-specific specifics */}
      <div className="space-y-6 pt-6 border-t border-[var(--border-color)]">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{options.outputFormat} Optimization</h3>

        {options.outputFormat === 'csv' && (
          <div className="space-y-4">
            <label className="flex items-center gap-3 text-[11px] font-bold text-[var(--text-primary)] cursor-pointer group">
               <div className="relative flex items-center">
                  <input type="checkbox" checked={options.csvIncludeHeader} onChange={(e) => handleUpdate({ csvIncludeHeader: e.target.checked })} className="peer opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10" />
                  <div className="w-4 h-4 rounded-sm border-2 border-[var(--border-color)] peer-checked:bg-[var(--accent-primary)] peer-checked:border-[var(--accent-primary)] transition-all flex items-center justify-center">
                     <svg className="w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
               </div>
              <span>Include Header Row</span>
            </label>
          </div>
        )}

        {options.outputFormat === 'json' && (
          <div className="space-y-4">
            <div className="flex gap-1 p-1 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-sm">
              {(['schema', 'sample'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => handleUpdate({ jsonMode: mode })}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all ${
                    options.jsonMode === mode ? 'bg-[var(--accent-primary)] text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  {mode === 'schema' ? 'Schema Builder' : 'Infer From Sample'}
                </button>
              ))}
            </div>
            {options.jsonMode === 'sample' && (
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Source JSON Template</label>
                <textarea
                  value={options.jsonSample}
                  onChange={(e) => handleUpdate({ jsonSample: e.target.value })}
                  placeholder='{ "id": 1, "name": "Alice" }'
                  className="tool-input h-32 font-mono resize-none"
                />
                <p className="text-[10px] text-[var(--text-muted)] opacity-50 italic">Fields and archetypes will be inferred from your template structure.</p>
              </div>
            )}
          </div>
        )}

        {options.outputFormat === 'sql' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Target Table</label>
                <input
                  value={options.sqlTableName}
                  onChange={(e) => handleUpdate({ sqlTableName: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                  className="tool-input font-mono"
                  placeholder="users"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">SQL Dialect</label>
                <select 
                  value={options.sqlDialect} 
                  onChange={(e) => handleUpdate({ sqlDialect: e.target.value as any })}
                  className="tool-input"
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="sqlite">SQLite</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-1 p-1 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-sm">
              {(['schema', 'sample'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => handleUpdate({ sqlMode: mode })}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all ${
                    options.sqlMode === mode ? 'bg-[var(--accent-primary)] text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  {mode === 'schema' ? 'Schema Builder' : 'Infer From Statement'}
                </button>
              ))}
            </div>
            
            {options.sqlMode === 'sample' && (
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Source SQL Script</label>
                <textarea
                  value={options.sqlSample}
                  onChange={(e) => handleUpdate({ sqlSample: e.target.value })}
                  placeholder="CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);"
                  className="tool-input h-32 font-mono resize-none"
                />
                <p className="text-[10px] text-[var(--text-muted)] opacity-50 italic">The engine will parse your DDL/DML to extract field definitions.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


const module: ToolModule<MockDataOptions> = {
  defaultOptions: {
    outputFormat: 'csv',
    rowCount: 100,
    columns: [{ name: 'id', type: 'auto_increment' }],
    csvDelimiter: ',',
    csvIncludeHeader: true,
    jsonSample: '',
    jsonMode: 'schema',
    sqlTableName: 'users',
    sqlDialect: 'mysql',
    sqlMode: 'schema',
    sqlSample: '',
  },
  OptionsComponent: MockDataOptionsComponent,
  async run(_files, options, helpers) {
    const { outputFormat, rowCount } = options
    let columns = [...options.columns]

    // --- 4D & 4E: INFER FROM SAMPLE ---
    if (outputFormat === 'json' && options.jsonMode === 'sample' && options.jsonSample) {
      try {
        const obj = JSON.parse(options.jsonSample)
        columns = Object.entries(obj).map(([key, value]) => {
          let type: ColumnType = 'text'
          if (typeof value === 'number') {
            type = key.toLowerCase().includes('id') ? 'auto_increment' : 'integer'
          } else if (typeof value === 'boolean') {
            type = 'boolean'
          } else if (typeof value === 'string') {
            if (value.includes('@')) type = 'email'
            else if (!isNaN(Date.parse(value))) type = 'timestamp'
            else if (value.startsWith('http')) type = 'url'
            else if (key.toLowerCase().includes('name')) type = 'full_name'
          }
          return { name: key, type, maxLength: typeof value === 'string' ? Math.max(100, value.length * 3) : undefined }
        })
      } catch (e) {
        throw new Error('Could not parse JSON sample.')
      }
    } else if (outputFormat === 'sql' && options.sqlMode === 'sample' && options.sqlSample) {
      // Basic SQL inference
      const createMatch = options.sqlSample.match(/CREATE\s+TABLE\s+(\w+)\s*\(([\s\S]+)\)/i)
      if (createMatch) {
        const tableName = createMatch[1]
        const colDefinitions = createMatch[2].split(',')
        columns = colDefinitions.map(cd => {
          const parts = cd.trim().split(/\s+/)
          const name = parts[0].replace(/[`"']/g, '')
          const sqlLayer = parts[1]?.toLowerCase() || 'text'
          let type: ColumnType = 'text'
          if (sqlLayer.includes('int')) type = 'integer'
          else if (sqlLayer.includes('char') || sqlLayer.includes('text')) type = 'text'
          else if (sqlLayer.includes('bool')) type = 'boolean'
          else if (sqlLayer.includes('date') || sqlLayer.includes('time')) type = 'timestamp'
          return { name, type }
        })
        options.sqlTableName = tableName
      }
    }

    // --- 4B: UNIQUENESS MAPS ---
    const uniquenessMaps = new Map<string, Set<any>>()
    columns.forEach(c => { if (c.unique) uniquenessMaps.set(c.name, new Set()) })

    const CHUNK_SIZE = 10000
    const chunks: any[][] = []

    // --- 4C: STREAMING GENERATION ---
    for (let i = 0; i < rowCount; i += CHUNK_SIZE) {
      if (helpers.signal.aborted) throw new Error('Operation cancelled by user.')

      const currentChunkSize = Math.min(CHUNK_SIZE, rowCount - i)
      const chunk = []

      for (let j = 0; j < currentChunkSize; j++) {
        const rowIndex = i + j
        const row: any = {}

        columns.forEach(col => {
          let val = generateValue(col.type, rowIndex, col)

          if (col.unique && val !== null) {
            const set = uniquenessMaps.get(col.name)!
            let attempts = 0
            while (set.has(val) && attempts < 10) {
              val = generateValue(col.type, rowIndex, col)
              attempts++
            }
            if (set.has(val)) val = `${val}_${rowIndex}`
            set.add(val)
          }

          row[col.name] = val
        })
        chunk.push(row)
      }

      chunks.push(chunk)
      helpers.onProgress({ phase: 'processing', value: Math.min(0.9, (i + currentChunkSize) / rowCount), message: `Generated ${Math.min(rowCount, i + currentChunkSize).toLocaleString()} rows...` })

      // Yield to event loop
      await new Promise(r => setTimeout(r, 0))
    }

    // --- 4F: OUTPUT ASSEMBLY ---
    let blob: Blob
    let filename: string
    let mime: string

    if (outputFormat === 'csv') {
      const { csvDelimiter, csvIncludeHeader } = options
      const header = csvIncludeHeader ? columns.map(c => `"${c.name}"`).join(csvDelimiter) + '\n' : ''

      const lines = chunks.map(chunk => {
        return chunk.map(row => {
          return columns.map(c => {
            const val = row[c.name]
            if (val === null) return ''
            const str = String(val)
            return str.includes(csvDelimiter) || str.includes('\n') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
          }).join(csvDelimiter)
        }).join('\n')
      }).join('\n')

      blob = new Blob([header + lines], { type: 'text/csv' })
      filename = `${options.sqlTableName || 'data'}_mock_${rowCount}.csv`
      mime = 'text/csv'

    } else if (outputFormat === 'json') {
      const allRows = chunks.flat()
      if (rowCount > 100000) {
        // Stream as JSONL
        const jsonl = allRows.map(r => JSON.stringify(r)).join('\n')
        blob = new Blob([jsonl], { type: 'application/x-jsonlines' })
        filename = `mock_data_${rowCount}.jsonl`
        mime = 'application/x-jsonlines'
      } else {
        const json = JSON.stringify(allRows, null, 2)
        blob = new Blob([json], { type: 'application/json' })
        filename = `mock_data_${rowCount}.json`
        mime = 'application/json'
      }

    } else {
      // SQL
      const { sqlTableName, sqlDialect } = options
      const q = sqlDialect === 'postgresql' ? '"' : '`'

      const inserts = chunks.map(chunk => {
        const batches = []
        for (let k = 0; k < chunk.length; k += 1000) {
          const sub = chunk.slice(k, k + 1000)
          const colsStr = columns.map(c => `${q}${c.name}${q}`).join(', ')
          const valuesStr = sub.map(row => {
            const vals = columns.map(c => {
              const v = row[c.name]
              if (v === null) return 'NULL'
              if (typeof v === 'number' || typeof v === 'boolean') return String(v)
              return `'${String(v).replace(/'/g, "''")}'`
            }).join(', ')
            return `(${vals})`
          }).join(',\n  ')
          batches.push(`INSERT INTO ${q}${sqlTableName}${q} (${colsStr}) VALUES\n  ${valuesStr};`)
        }
        return batches.join('\n\n')
      }).join('\n\n')

      blob = new Blob([inserts], { type: 'text/plain' })
      filename = `${sqlTableName}_seed.sql`
      mime = 'text/plain'
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Finalizing file...' })

    return {
      outputs: [{ id: crypto.randomUUID(), name: filename, blob, type: mime, size: blob.size }],
      preview: {
        kind: outputFormat === 'json' && rowCount <= 1000 ? 'json' : 'text',
        title: 'Mock Data Ready',
        summary: `Generated ${rowCount.toLocaleString()} rows and ${columns.length} columns in ${outputFormat.toUpperCase()} format.`,
        textContent: (await blob.slice(0, 10000).text()) + (blob.size > 10000 ? '\n\n... (truncated for preview)' : ''),
        metadata: [
          { label: 'Rows', value: rowCount.toLocaleString() },
          { label: 'Columns', value: `${columns.length}` },
          { label: 'Format', value: outputFormat.toUpperCase() }
        ]
      }
    }
  }
}

export default module
