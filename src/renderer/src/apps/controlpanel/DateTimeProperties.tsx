import { useEffect, useState } from 'react'
import { clockOffsetForParts, clockParts } from '../../settings/clock'
import { timeZones } from '../../settings/model'
import { GroupBox, TextBox } from '../../ui'
import { PropertySheet, useSettingsDraft } from './PropertySheet'

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function AnalogClock({ hour, minute, second }: { hour: number; minute: number; second: number }) {
  const hand = (angle: number, length: number) => ({
    x2: 60 + Math.sin(angle) * length,
    y2: 60 - Math.cos(angle) * length,
  })
  return (
    <svg role="img" aria-label="Analog clock" viewBox="0 0 120 120" className="w-[132px] h-[132px]">
      <title>Analog clock</title>
      <circle cx="60" cy="60" r="55" fill="#ffffff" stroke="#808080" strokeWidth="3" />
      {Array.from({ length: 60 }, (_, index) => {
        const angle = (index * Math.PI) / 30
        return (
          <line
            key={`tick-${index.toString()}`}
            x1={60 + Math.sin(angle) * (index % 5 === 0 ? 45 : 49)}
            y1={60 - Math.cos(angle) * (index % 5 === 0 ? 45 : 49)}
            {...hand(angle, 51)}
            stroke="#000000"
            strokeWidth={index % 5 === 0 ? 2 : 1}
          />
        )
      })}
      <line
        x1="60"
        y1="60"
        {...hand((((hour % 12) + minute / 60) * Math.PI) / 6, 27)}
        stroke="#000000"
        strokeWidth="4"
      />
      <line
        x1="60"
        y1="60"
        {...hand(((minute + second / 60) * Math.PI) / 30, 39)}
        stroke="#000000"
        strokeWidth="3"
      />
      <line x1="60" y1="60" {...hand((second * Math.PI) / 30, 43)} stroke="#808080" />
      <circle cx="60" cy="60" r="3" fill="#000000" />
    </svg>
  )
}

export function DateTimeProperties({ onClose }: { onClose: () => void }) {
  const state = useSettingsDraft()
  const { draft, change } = state
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const parts = clockParts(now + draft.clockOffset, draft.timeZone)
  const update = (patch: Partial<typeof parts>) => {
    const current = Date.now()
    change({
      clockOffset: clockOffsetForParts(
        { ...clockParts(current + draft.clockOffset, draft.timeZone), ...patch },
        draft.timeZone,
        current,
      ),
    })
  }
  const days = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate()
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, 1)).getUTCDay()
  return (
    <PropertySheet
      title="Date/Time Properties"
      state={state}
      onClose={onClose}
      width={396}
      tabs={[
        {
          label: 'Date & Time',
          content: (
            <>
              <div className="flex gap-3 mt-2">
                <GroupBox label="Date" className="w-[192px]">
                  <div className="flex gap-2">
                    <select
                      aria-label="Month"
                      className="w-[105px]"
                      value={parts.month}
                      onChange={(event) => {
                        const month = Number(event.target.value)
                        update({
                          month,
                          day: Math.min(parts.day, new Date(Date.UTC(parts.year, month, 0)).getUTCDate()),
                        })
                      }}
                    >
                      {months.map((month, index) => (
                        <option key={month} value={index + 1}>
                          {month}
                        </option>
                      ))}
                    </select>
                    <TextBox
                      aria-label="Year"
                      type="number"
                      min={1900}
                      max={2099}
                      className="w-[60px]"
                      value={parts.year}
                      onChange={(event) => {
                        const year = event.currentTarget.valueAsNumber
                        if (year >= 1900 && year <= 2099)
                          update({
                            year,
                            day: Math.min(parts.day, new Date(Date.UTC(year, parts.month, 0)).getUTCDate()),
                          })
                      }}
                    />
                  </div>
                  <fieldset className="cp-calendar bevel-sunken" aria-label="Calendar">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                      <span key={`weekday-${index.toString()}`} className="border-b border-shadow mb-1">
                        {day}
                      </span>
                    ))}
                    {Array.from({ length: weekday }, (_, index) => (
                      <span key={`empty-${index.toString()}`} />
                    ))}
                    {Array.from({ length: days }, (_, index) => (
                      <button
                        type="button"
                        key={`day-${index.toString()}`}
                        aria-label={`Day ${index + 1}`}
                        aria-pressed={parts.day === index + 1}
                        onClick={() => update({ day: index + 1 })}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </fieldset>
                </GroupBox>
                <GroupBox label="Time" className="flex-1 flex flex-col items-center">
                  <AnalogClock {...parts} />
                  <TextBox
                    aria-label="Time"
                    type="time"
                    step={1}
                    className="w-[116px] mt-2"
                    value={[parts.hour, parts.minute, parts.second]
                      .map((value) => String(value).padStart(2, '0'))
                      .join(':')}
                    onChange={(event) => {
                      const [hour, minute, second = 0] = event.target.value.split(':').map(Number)
                      if (hour !== undefined && minute !== undefined) update({ hour, minute, second })
                    }}
                  />
                </GroupBox>
              </div>
              <p className="mt-5">Current time zone: {draft.timeZone.replaceAll('_', ' ')}</p>
              <p className="mt-4">Select a date and time. Changes take effect when you choose Apply or OK.</p>
            </>
          ),
        },
        {
          label: 'Time Zone',
          content: (
            <>
              <label className="flex flex-col gap-2 mt-2">
                Time zone:
                <select
                  aria-label="Time zone"
                  value={draft.timeZone}
                  onChange={(event) =>
                    change({ timeZone: timeZones.find((zone) => zone === event.target.value) ?? 'UTC' })
                  }
                >
                  {timeZones.map((zone) => (
                    <option key={zone}>{zone}</option>
                  ))}
                </select>
              </label>
              <div className="mt-5 h-[150px] bg-[#008080] border border-shadow relative overflow-hidden">
                <svg role="img" aria-label="Time zone map" viewBox="0 0 330 150" className="w-full h-full">
                  <title>Time zone map</title>
                  <path
                    d="M12 32L35 14 80 18 108 35 85 59 62 56 53 79 35 62ZM70 77L101 80 112 106 91 145 81 119ZM149 25L188 15 200 26 240 18 278 26 315 51 284 66 261 60 255 89 232 83 220 63 201 70 192 56 170 61 161 45ZM160 66L187 67 206 87 195 112 178 127 166 103ZM265 109L297 102 314 125 285 136 271 126Z"
                    fill="#808000"
                    stroke="#c0c0c0"
                  />
                  {Array.from({ length: 12 }, (_, index) => (
                    <path key={`zone-${index.toString()}`} d={`M${index * 30} 0v150`} stroke="#00a0a0" />
                  ))}
                </svg>
              </div>
              <p className="mt-4">Daylight saving time follows the selected time zone.</p>
            </>
          ),
        },
      ]}
    />
  )
}
