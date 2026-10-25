import { describe, expect, it } from 'vitest'
import {
  formatRegionalNumber,
  numberDefaults,
  parseFeatures,
  parseNumberSettings,
  parseTcpip,
  tcpipDefaults,
  tcpipError,
  validIp,
} from './featureSettings'
import { defaultSettings, parseSettings, settingsReducer } from './model'

describe('feature settings persistence', () => {
  it('migrates old settings without losing enabled accessibility features', () => {
    const loaded = parseSettings({ accessibility: { stickyKeys: true }, regional: { currency: 'P' } })
    expect(loaded.accessibility.stickyKeys).toBe(true)
    expect(loaded.accessibility.features.StickyKeys.shortcut).toBe(true)
    expect(loaded.regional.currency).toBe('P')
    expect(loaded.regional.number).toEqual(numberDefaults)
    expect(loaded.regional.dateFormat).toBe('M/d/yy')
    expect(loaded.network.tcpip).toEqual(tcpipDefaults)
  })
  it('roundtrips each feature draft and validates persisted choices', () => {
    const features = parseFeatures({
      StickyKeys: { shortcut: false },
      FilterKeys: { mode: 'bounce', bounceSeconds: 1.5 },
      SoundSentry: { effect: 'Flash desktop' },
      MouseKeys: { speed: 8, numLock: 'Off' },
      SerialKeys: { port: 'COM4', baud: '9600' },
    })
    const applied = settingsReducer(defaultSettings, {
      type: 'apply',
      patch: { accessibility: { ...defaultSettings.accessibility, features } },
    })
    expect(parseSettings(JSON.parse(JSON.stringify(applied))).accessibility.features).toEqual(features)
    expect(parseFeatures({ SerialKeys: { port: 'https://wrong', baud: 'broken' } }).SerialKeys).toEqual({
      port: 'COM1',
      baud: '300',
    })
  })
  it('formats grouping, precision, signs, and fractions from edited number fields', () => {
    const number = parseNumberSettings({
      decimalSymbol: ',',
      digits: 3,
      groupSymbol: '.',
      grouping: '3;2',
      negativeSign: '~',
      negativeFormat: 'n-',
      leadingZero: false,
      measurement: 'Metric',
      listSeparator: ';',
    })
    expect(formatRegionalNumber(-123456789, number)).toBe('12.34.56.789,000~')
    expect(formatRegionalNumber(0.7, number)).toBe(',700')
    expect(formatRegionalNumber(-1234, { ...numberDefaults, negativeFormat: '(n)', grouping: '0' })).toBe(
      '(1234.00)',
    )
    expect(parseNumberSettings(number)).toEqual(number)
  })
  it('retains TCP/IP virtual configuration and rejects malformed addresses', () => {
    const tcpip = {
      ...tcpipDefaults,
      addressMode: 'manual' as const,
      address: '192.168.95.2',
      subnet: '255.255.255.0',
      gateways: ['192.168.95.1'],
      dnsServers: ['192.168.95.5'],
    }
    expect(parseTcpip(JSON.parse(JSON.stringify(tcpip)))).toEqual(tcpip)
    expect(tcpipError(tcpip)).toBeNull()
    expect(tcpipError({ ...tcpip, address: '999.0.0.1' })).toContain('valid IP')
    expect(tcpipError({ ...tcpip, dnsEnabled: true })).toContain('host name')
    for (const bad of ['256.1.1.1', '1.2.3', '1.2.3.4.5', '-1.0.0.0', '1e2.0.0.0'])
      expect(validIp(bad)).toBe(false)
  })
})
