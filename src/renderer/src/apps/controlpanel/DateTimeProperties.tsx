import { useEffect, useRef, useState } from 'react'
import { type ClockParts, clockOffsetForParts, clockParts } from '../../settings/clock'
import { timeZones } from '../../settings/model'
import { timeZoneInfo, windowsTimeZones } from '../../settings/timeZones'
import { ComboBox } from '../../ui/ComboBox'
import { Checkbox, GroupBox, TextBox } from '../../ui/fields'
import { PropertySheet, useSettingsDraft } from './PropertySheet'
import { WorldMap } from './WorldMap'

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

const formatTime = (time: ClockParts) =>
  `${String(time.hour % 12 || 12).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}:${String(time.second).padStart(2, '0')} ${time.hour < 12 ? 'AM' : 'PM'}`

function TimeEdit({
  parts,
  onChange,
}: {
  parts: ClockParts
  onChange: (patch: Partial<ClockParts>) => void
}) {
  const [value, setValue] = useState(() => formatTime(parts))
  const [editing, setEditing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const segment = useRef(0)
  useEffect(() => {
    if (!editing) setValue(formatTime(parts))
  }, [parts, editing])
  const commit = () => {
    const match = /^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim())
    if (
      match &&
      Number(match[1]) >= 1 &&
      Number(match[1]) <= 12 &&
      Number(match[2]) < 60 &&
      Number(match[3]) < 60
    )
      onChange({
        hour: (Number(match[1]) % 12) + (match[4]?.toUpperCase() === 'PM' ? 12 : 0),
        minute: Number(match[2]),
        second: Number(match[3]),
      })
    else setValue(formatTime(parts))
    setEditing(false)
  }
  const step = (direction: number) => {
    const field = segment.current === 0 ? 'hour' : segment.current === 1 ? 'minute' : 'second'
    const limit = field === 'hour' ? 24 : 60
    const patch =
      segment.current === 3
        ? { hour: (parts.hour + 12) % 24 }
        : { [field]: (parts[field] + direction + limit) % limit }
    onChange(patch)
    setValue(formatTime({ ...parts, ...patch }))
    input.current?.focus()
    input.current?.setSelectionRange(segment.current * 3, segment.current * 3 + 2)
  }
  return (
    <div className="flex mt-2 h-[23px] w-[125px] bg-white bevel-sunken p-[2px]">
      <input
        ref={input}
        aria-label="Time"
        className="w-[101px] min-w-0 bg-white outline-none text-center"
        value={value}
        onFocus={() => setEditing(true)}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onSelect={(event) => {
          segment.current = Math.min(3, Math.floor((event.currentTarget.selectionStart ?? 0) / 3))
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            step(event.key === 'ArrowUp' ? 1 : -1)
          }
        }}
      />
      <div className="flex flex-col w-[16px] shrink-0">
        {[1, -1].map((direction) => (
          <button
            key={direction}
            type="button"
            tabIndex={-1}
            aria-label={direction === 1 ? 'Increase time' : 'Decrease time'}
            className="bevel-raised h-[9px] leading-[7px] text-[7px]"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => step(direction)}
          >
            {direction === 1 ? '▲' : '▼'}
          </button>
        ))}
      </div>
    </div>
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
  const parts = clockParts(now + draft.clockOffset, draft.timeZone, draft.adjustForDaylightSaving)
  const [yearInput, setYearInput] = useState(String(parts.year))
  useEffect(() => setYearInput(String(parts.year)), [parts.year])
  const update = (patch: Partial<typeof parts>) => {
    const current = Date.now()
    setNow(current)
    change({
      clockOffset: clockOffsetForParts(
        {
          ...clockParts(current + draft.clockOffset, draft.timeZone, draft.adjustForDaylightSaving),
          ...patch,
        },
        draft.timeZone,
        current,
        draft.adjustForDaylightSaving,
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
                    <ComboBox
                      aria-label="Month"
                      className="w-[105px]"
                      value={String(parts.month)}
                      onChange={(value) => {
                        const month = Number(value)
                        update({
                          month,
                          day: Math.min(parts.day, new Date(Date.UTC(parts.year, month, 0)).getUTCDate()),
                        })
                      }}
                      options={months.map((label, index) => ({ key: String(index + 1), label }))}
                    />
                    <TextBox
                      aria-label="Year"
                      type="number"
                      min={1900}
                      max={2099}
                      className="w-[60px]"
                      value={yearInput}
                      onChange={(event) => {
                        setYearInput(event.currentTarget.value)
                        const year = event.currentTarget.valueAsNumber
                        if (year >= 1900 && year <= 2099)
                          update({
                            year,
                            day: Math.min(parts.day, new Date(Date.UTC(year, parts.month, 0)).getUTCDate()),
                          })
                      }}
                      onBlur={() => setYearInput(String(parts.year))}
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
                  <TimeEdit parts={parts} onChange={update} />
                </GroupBox>
              </div>
              <p className="mt-5">Current time zone: {timeZoneInfo(draft.timeZone).standard}</p>
            </>
          ),
        },
        {
          label: 'Time Zone',
          content: (
            <>
              <div className="flex flex-col gap-2 mt-2">
                Time zone:
                <ComboBox
                  aria-label="Time zone"
                  value={draft.timeZone}
                  onChange={(value) =>
                    change({ timeZone: timeZones.find((zone) => zone === value) ?? 'UTC' })
                  }
                  options={windowsTimeZones.map((zone) => ({ key: zone.id, label: zone.label }))}
                />
              </div>
              <div className="mt-5">
                <WorldMap offset={timeZoneInfo(draft.timeZone).offset} />
              </div>
              <Checkbox
                className="mt-4"
                label="Automatically adjust clock for daylight saving changes"
                checked={draft.adjustForDaylightSaving}
                onChange={(event) => change({ adjustForDaylightSaving: event.target.checked })}
              />
            </>
          ),
        },
      ]}
    />
  )
}
