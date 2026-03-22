import React from 'react'

/**
 * A logical grouping of options with a label.
 */
export const OptionsSection: React.FC<{
  label: string
  children: React.ReactNode
  noBorder?: boolean
}> = ({ label, children, noBorder }) => (
  <div className={`opts-section ${noBorder ? 'opts-section-last' : ''}`}>
    <div className="opts-section-label">{label}</div>
    <div className="opts-section-content">{children}</div>
  </div>
)

/**
 * A group of buttons for choosing between several values.
 */
export const OptionsPillGroup: React.FC<{
  label?: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}> = ({ label, options, value, onChange }) => (
  <div className="opts-field">
    {label && <label className="opts-label">{label}</label>}
    <div className="opts-pill-group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`opts-pill ${value === opt.value ? 'active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
)

/**
 * Standard text or number input.
 */
export const OptionsInput: React.FC<{
  label: string
  type?: string
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}> = ({ label, type = 'text', value, onChange, placeholder, min, max, step, disabled }) => (
  <div className={`opts-field ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
    <label className="opts-label">{label}</label>
    <input
      className="opts-input"
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
    />
  </div>
)

/**
 * Standard dropdown select.
 */
export const OptionsSelect: React.FC<{
  label: string
  value: string | number
  onChange: (value: string) => void
  options: { value: string | number; label: string }[]
  disabled?: boolean
}> = ({ label, value, onChange, options, disabled }) => (
  <div className={`opts-field ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
    <label className="opts-label">{label}</label>
    <select className="opts-select" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
)

/**
 * A checkbox with a label next to it.
 */
export const OptionsCheckbox: React.FC<{
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}> = ({ label, checked, onChange, disabled }) => (
  <label className={`opts-checkbox-row ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
    <input
      type="checkbox"
      className="opts-checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
    />
    <span className="opts-checkbox-label">{label}</span>
  </label>
)

/**
 * A range slider with a label and value display.
 */
export const OptionsSlider: React.FC<{
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  displayValue?: string | number
  disabled?: boolean
}> = ({ label, value, min, max, step = 1, onChange, displayValue, disabled }) => (
  <div className={`opts-field ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
    <div className="opts-label-row">
      <label className="opts-label">{label}</label>
      <span className="opts-value">{displayValue ?? value}</span>
    </div>
    <input
      type="range"
      className="opts-slider"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
    />
  </div>
)

/**
 * Multi-line text area.
 */
export const OptionsTextArea: React.FC<{
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
}> = ({ label, value, onChange, placeholder, rows = 3, disabled }) => (
  <div className={`opts-field ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
    <label className="opts-label">{label}</label>
    <textarea
      className="opts-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      style={{ resize: 'vertical', minHeight: '80px' }}
    />
  </div>
)
