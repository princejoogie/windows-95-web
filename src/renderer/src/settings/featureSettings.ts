export const accessibilityFeatures = {
  StickyKeys: { shortcut: true, lock: true, twoKeysOff: true, sound: true, status: true },
  FilterKeys: {
    shortcut: true,
    beep: false,
    status: true,
    mode: 'repeat' as 'bounce' | 'repeat',
    bounceSeconds: 0.5,
    acceptSeconds: 0,
    repeatDelay: 1,
    repeatSeconds: 0.5,
  },
  ToggleKeys: { shortcut: true },
  SoundSentry: { effect: 'Flash active caption bar' },
  'High Contrast': { shortcut: true, scheme: 'High Contrast Black' },
  MouseKeys: {
    shortcut: true,
    speed: 5,
    acceleration: 5,
    controlSpeed: true,
    numLock: 'On' as 'On' | 'Off',
    status: true,
  },
  SerialKeys: { port: 'COM1', baud: '300' },
}
export type AccessibilityFeatures = typeof accessibilityFeatures
export type AccessibilityFeature = keyof AccessibilityFeatures
export const numberDefaults = {
  decimalSymbol: '.',
  digits: 2,
  groupSymbol: ',',
  grouping: '3',
  negativeSign: '-',
  negativeFormat: '-n',
  leadingZero: true,
  measurement: 'U.S.' as 'U.S.' | 'Metric',
  listSeparator: ',',
}
export type NumberSettings = typeof numberDefaults
export const tcpipDefaults = {
  addressMode: 'auto' as 'auto' | 'manual',
  address: '',
  subnet: '',
  winsMode: 'dhcp' as 'dhcp' | 'manual' | 'disabled',
  winsPrimary: '',
  winsSecondary: '',
  dhcpWins: true,
  gateways: [] as string[],
  dnsEnabled: false,
  host: '',
  domain: '',
  dnsServers: [] as string[],
  domainSuffixes: [] as string[],
  clientBinding: true,
  defaultProtocol: true,
  allowBindingToAtm: false,
  forwardBroadcasts: false,
  enableLmhosts: true,
}
export type TcpipSettings = typeof tcpipDefaults

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {}
}
const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)
const text = (value: unknown, fallback: string, limit = 128) =>
  typeof value === 'string' ? value.slice(0, limit) : fallback
const number = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
const choice = <T extends string>(value: unknown, choices: readonly T[], fallback: T): T =>
  choices.find((item) => item === value) ?? fallback
const strings = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .slice(0, 16)
        .map((item) => item.slice(0, 128))
    : []

export function parseFeatures(value: unknown): AccessibilityFeatures {
  const source = object(value)
  const sticky = object(source.StickyKeys)
  const filter = object(source.FilterKeys)
  const toggle = object(source.ToggleKeys)
  const sentry = object(source.SoundSentry)
  const contrast = object(source['High Contrast'])
  const mouse = object(source.MouseKeys)
  const serial = object(source.SerialKeys)
  return {
    StickyKeys: {
      shortcut: bool(sticky.shortcut, true),
      lock: bool(sticky.lock, true),
      twoKeysOff: bool(sticky.twoKeysOff, true),
      sound: bool(sticky.sound, true),
      status: bool(sticky.status, true),
    },
    FilterKeys: {
      shortcut: bool(filter.shortcut, true),
      beep: bool(filter.beep, false),
      status: bool(filter.status, true),
      mode: choice(filter.mode, ['bounce', 'repeat'], 'repeat'),
      bounceSeconds: number(filter.bounceSeconds, 0.5, 0.5, 2),
      acceptSeconds: number(filter.acceptSeconds, 0, 0, 2),
      repeatDelay: number(filter.repeatDelay, 1, 0.3, 2),
      repeatSeconds: number(filter.repeatSeconds, 0.5, 0.3, 2),
    },
    ToggleKeys: { shortcut: bool(toggle.shortcut, true) },
    SoundSentry: {
      effect: choice(
        sentry.effect,
        ['None', 'Flash active caption bar', 'Flash active window', 'Flash desktop'],
        'Flash active caption bar',
      ),
    },
    'High Contrast': {
      shortcut: bool(contrast.shortcut, true),
      scheme: choice(
        contrast.scheme,
        ['High Contrast Black', 'High Contrast White', 'High Contrast #1', 'High Contrast #2'],
        'High Contrast Black',
      ),
    },
    MouseKeys: {
      shortcut: bool(mouse.shortcut, true),
      speed: number(mouse.speed, 5, 1, 10),
      acceleration: number(mouse.acceleration, 5, 1, 10),
      controlSpeed: bool(mouse.controlSpeed, true),
      numLock: choice(mouse.numLock, ['On', 'Off'], 'On'),
      status: bool(mouse.status, true),
    },
    SerialKeys: {
      port: choice(serial.port, ['COM1', 'COM2', 'COM3', 'COM4'], 'COM1'),
      baud: choice(serial.baud, ['300', '1200', '2400', '4800', '9600', '19200'], '300'),
    },
  }
}

export function parseNumberSettings(value: unknown): NumberSettings {
  const source = object(value)
  return {
    decimalSymbol: text(source.decimalSymbol, '.', 3),
    digits: Math.round(number(source.digits, 2, 0, 9)),
    groupSymbol: text(source.groupSymbol, ',', 3),
    grouping: choice(source.grouping, ['0', '3', '3;2'], '3'),
    negativeSign: text(source.negativeSign, '-', 3),
    negativeFormat: choice(source.negativeFormat, ['(n)', '-n', '- n', 'n-', 'n -'], '-n'),
    leadingZero: bool(source.leadingZero, true),
    measurement: choice(source.measurement, ['U.S.', 'Metric'], 'U.S.'),
    listSeparator: text(source.listSeparator, ',', 3),
  }
}

export function formatRegionalNumber(value: number, settings: NumberSettings): string {
  const [whole = '', fraction] = Math.abs(value).toFixed(settings.digits).split('.')
  let integer = whole
  if (settings.grouping !== '0') {
    const groups: string[] = []
    let rest = whole
    let size = 3
    while (rest.length > size) {
      groups.unshift(rest.slice(-size))
      rest = rest.slice(0, -size)
      if (settings.grouping === '3;2') size = 2
    }
    integer = [rest, ...groups].join(settings.groupSymbol)
  }
  if (!settings.leadingZero && whole === '0' && fraction) integer = ''
  const positive = `${integer}${fraction ? settings.decimalSymbol + fraction : ''}`
  return value < 0
    ? settings.negativeFormat.replace('n', positive).replace('-', settings.negativeSign)
    : positive
}

export function parseTcpip(value: unknown): TcpipSettings {
  const source = object(value)
  return {
    addressMode: choice(source.addressMode, ['auto', 'manual'], 'auto'),
    address: text(source.address, '', 15),
    subnet: text(source.subnet, '', 15),
    winsMode: choice(source.winsMode, ['dhcp', 'manual', 'disabled'], 'dhcp'),
    winsPrimary: text(source.winsPrimary, '', 15),
    winsSecondary: text(source.winsSecondary, '', 15),
    dhcpWins: bool(source.dhcpWins, true),
    gateways: strings(source.gateways),
    dnsEnabled: bool(source.dnsEnabled, false),
    host: text(source.host, '', 63),
    domain: text(source.domain, '', 128),
    dnsServers: strings(source.dnsServers),
    domainSuffixes: strings(source.domainSuffixes),
    clientBinding: bool(source.clientBinding, true),
    defaultProtocol: bool(source.defaultProtocol, true),
    allowBindingToAtm: bool(source.allowBindingToAtm, false),
    forwardBroadcasts: bool(source.forwardBroadcasts, false),
    enableLmhosts: bool(source.enableLmhosts, true),
  }
}

export const validIp = (value: string): boolean =>
  /^\d{1,3}(\.\d{1,3}){3}$/.test(value) && value.split('.').every((part) => Number(part) <= 255)
export function tcpipError(settings: TcpipSettings): string | null {
  if (settings.addressMode === 'manual' && (!validIp(settings.address) || !validIp(settings.subnet)))
    return 'Enter a valid IP address and subnet mask. Each address has four numbers from 0 to 255.'
  if (
    settings.winsMode === 'manual' &&
    (!validIp(settings.winsPrimary) || (settings.winsSecondary && !validIp(settings.winsSecondary)))
  )
    return 'Enter valid WINS server addresses.'
  if ([...settings.gateways, ...settings.dnsServers].some((address) => !validIp(address)))
    return 'Enter valid gateway and DNS server addresses.'
  if (settings.dnsEnabled && !settings.host.trim()) return 'Enter a host name before enabling DNS.'
  return null
}
