import { formatRegionalNumber, type NumberSettings } from '../../settings/featureSettings'
import { ComboBox, GroupBox, TextBox } from '../../ui'

export function RegionalNumber({
  value,
  onChange,
}: {
  value: NumberSettings
  onChange: (value: NumberSettings) => void
}) {
  const text = (label: string, key: 'decimalSymbol' | 'groupSymbol' | 'negativeSign' | 'listSeparator') => (
    <label className="contents" htmlFor={`regional-${key}`}>
      <span>{label}:</span>
      <TextBox
        id={`regional-${key}`}
        aria-label={label}
        value={value[key]}
        maxLength={3}
        onChange={(event) => onChange({ ...value, [key]: event.target.value })}
      />
    </label>
  )
  const combo = (
    label: string,
    current: string,
    options: readonly { key: string; label: string }[],
    change: (value: string) => void,
  ) => (
    <div className="contents">
      <span>{label}:</span>
      <ComboBox aria-label={label} value={current} options={options} onChange={change} />
    </div>
  )
  const choices = (values: readonly string[]) => values.map((key) => ({ key, label: key }))
  return (
    <>
      <GroupBox label="Sample" className="mt-2">
        <p data-number-sample="positive">Positive: {formatRegionalNumber(123456789, value)}</p>
        <p className="mt-2" data-number-sample="negative">
          Negative: {formatRegionalNumber(-123456789, value)}
        </p>
        <p className="mt-2" data-number-sample="fraction">
          Fraction: {formatRegionalNumber(0.7, value)}
        </p>
      </GroupBox>
      <div className="grid grid-cols-[154px_1fr] gap-x-3 gap-y-2 mt-4">
        {text('Decimal symbol', 'decimalSymbol')}
        {combo(
          'No. of digits after decimal',
          String(value.digits),
          choices(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']),
          (digits) => onChange({ ...value, digits: Number(digits) }),
        )}
        {text('Digit grouping symbol', 'groupSymbol')}
        {combo(
          'No. of digits in group',
          value.grouping,
          [
            { key: '0', label: '123456789' },
            { key: '3', label: '123,456,789' },
            { key: '3;2', label: '12,34,56,789' },
          ],
          (grouping) => onChange({ ...value, grouping }),
        )}
        {text('Negative sign symbol', 'negativeSign')}
        {combo(
          'Negative number format',
          value.negativeFormat,
          ['(n)', '-n', '- n', 'n-', 'n -'].map((key) => ({ key, label: key.replace('n', '1.1') })),
          (negativeFormat) => onChange({ ...value, negativeFormat }),
        )}
        {combo(
          'Display leading zeroes',
          String(value.leadingZero),
          [
            { key: 'true', label: '0.7' },
            { key: 'false', label: '.7' },
          ],
          (leadingZero) => onChange({ ...value, leadingZero: leadingZero === 'true' }),
        )}
        {combo('Measurement system', value.measurement, choices(['U.S.', 'Metric']), (measurement) =>
          onChange({ ...value, measurement: measurement === 'Metric' ? 'Metric' : 'U.S.' }),
        )}
        {text('List separator', 'listSeparator')}
      </div>
    </>
  )
}
