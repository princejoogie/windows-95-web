import { useState } from 'react'
import { type TcpipSettings, tcpipError, validIp } from '../../settings/featureSettings'
import {
  Button,
  Checkbox,
  ComboBox,
  Dialog,
  GroupBox,
  ListBox,
  MessageBox,
  Radio,
  Tabs,
  TextBox,
} from '../../ui'

function AddressList({
  label,
  values,
  onChange,
  onError,
  addresses = true,
}: {
  label: string
  values: readonly string[]
  onChange: (values: string[]) => void
  onError: (message: string) => void
  addresses?: boolean
}) {
  const [entry, setEntry] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const add = () => {
    const text = entry.trim()
    if (addresses ? !validIp(text) : !/^(?=.{1,128}$)[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(text)) {
      onError(
        addresses ? 'Enter an IP address with four numbers from 0 to 255.' : 'Enter a valid domain name.',
      )
      return
    }
    if (!values.includes(text)) onChange([...values, text])
    setEntry('')
  }
  const move = (direction: number) => {
    const index = selected === null ? -1 : values.indexOf(selected)
    if (index < 0 || index + direction < 0 || index + direction >= values.length) return
    const next = [...values]
    const target = next[index + direction]
    if (target === undefined || selected === null) return
    next[index] = target
    next[index + direction] = selected
    onChange(next)
  }
  return (
    <GroupBox label={label} className="mt-3">
      <div className="flex gap-2">
        <TextBox
          aria-label={`New ${label}`}
          value={entry}
          onChange={(event) => setEntry(event.target.value)}
          className="flex-1"
        />
        <Button disabled={!entry.trim()} onClick={add}>
          Add
        </Button>
      </div>
      <div className="flex gap-2 mt-2">
        <ListBox
          label={label}
          items={values}
          value={selected}
          onChange={setSelected}
          className="h-[74px] flex-1"
        />
        <div className="flex flex-col gap-1">
          <Button
            disabled={!selected}
            onClick={() => {
              onChange(values.filter((value) => value !== selected))
              setSelected(null)
            }}
          >
            Remove
          </Button>
          <div className="flex gap-1">
            <Button
              className="!min-w-0 flex-1"
              aria-label={`${label} up`}
              disabled={!selected || values.indexOf(selected) < 1}
              onClick={() => move(-1)}
            >
              Up
            </Button>
            <Button
              className="!min-w-0 flex-1"
              aria-label={`${label} down`}
              disabled={!selected || values.indexOf(selected) >= values.length - 1}
              onClick={() => move(1)}
            >
              Down
            </Button>
          </div>
        </div>
      </div>
    </GroupBox>
  )
}

export function TcpipProperties({
  value,
  onOK,
  onClose,
}: {
  value: TcpipSettings
  onOK: (settings: TcpipSettings) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(value)
  const tabs = [
    'IP Address',
    'WINS Configuration',
    'Gateway',
    'DNS Configuration',
    'Bindings',
    'Advanced',
  ] as const
  const [tab, setTab] = useState<(typeof tabs)[number]>('IP Address')
  const [error, setError] = useState<string | null>(null)
  const [advanced, setAdvanced] = useState<'allowBindingToAtm' | 'forwardBroadcasts' | 'enableLmhosts'>(
    'enableLmhosts',
  )
  const change = (patch: Partial<TcpipSettings>) => setDraft((current) => ({ ...current, ...patch }))
  const address = (
    label: string,
    key: 'address' | 'subnet' | 'winsPrimary' | 'winsSecondary',
    disabled: boolean,
  ) => (
    <label className="flex justify-between items-center my-3" htmlFor={`tcpip-${key}`}>
      {label}:
      <TextBox
        id={`tcpip-${key}`}
        aria-label={label}
        value={draft[key]}
        disabled={disabled}
        className="w-[170px]"
        maxLength={15}
        onChange={(event) => change({ [key]: event.target.value })}
      />
    </label>
  )
  const page = () => {
    switch (tab) {
      case 'IP Address':
        return (
          <>
            <p className="mb-5">
              An IP address can be automatically assigned to this computer. If your network does not
              automatically assign IP addresses, ask your network administrator for an address.
            </p>
            <Radio
              name="ip-mode"
              label="Obtain an IP address automatically"
              checked={draft.addressMode === 'auto'}
              onChange={() => change({ addressMode: 'auto' })}
            />
            <Radio
              name="ip-mode"
              label="Specify an IP address"
              checked={draft.addressMode === 'manual'}
              onChange={() => change({ addressMode: 'manual' })}
              className="mt-4"
            />
            <div className="ml-5">
              {address('IP address', 'address', draft.addressMode !== 'manual')}
              {address('Subnet mask', 'subnet', draft.addressMode !== 'manual')}
            </div>
          </>
        )
      case 'WINS Configuration':
        return (
          <>
            <p className="mb-4">Windows Internet Name Service resolves computer names to IP addresses.</p>
            {(['disabled', 'manual', 'dhcp'] as const).map((mode) => (
              <Radio
                key={mode}
                name="wins-mode"
                className="my-3"
                label={
                  mode === 'disabled'
                    ? 'Disable WINS Resolution'
                    : mode === 'manual'
                      ? 'Enable WINS Resolution'
                      : 'Use DHCP for WINS Resolution'
                }
                checked={draft.winsMode === mode}
                onChange={() => change({ winsMode: mode })}
              />
            ))}
            {address('Primary WINS server', 'winsPrimary', draft.winsMode !== 'manual')}
            {address('Secondary WINS server', 'winsSecondary', draft.winsMode !== 'manual')}
            <Checkbox
              label="Use DHCP for WINS Resolution"
              checked={draft.dhcpWins}
              onChange={(event) => change({ dhcpWins: event.target.checked })}
            />
          </>
        )
      case 'Gateway':
        return (
          <>
            <p>Enter the address of each gateway on your local network. Use Up and Down to set the order.</p>
            <AddressList
              label="Installed gateways"
              values={draft.gateways}
              onChange={(gateways) => change({ gateways })}
              onError={setError}
            />
          </>
        )
      case 'DNS Configuration':
        return (
          <>
            <div className="flex gap-5">
              <Radio
                name="dns"
                label="Disable DNS"
                checked={!draft.dnsEnabled}
                onChange={() => change({ dnsEnabled: false })}
              />
              <Radio
                name="dns"
                label="Enable DNS"
                checked={draft.dnsEnabled}
                onChange={() => change({ dnsEnabled: true })}
              />
            </div>
            <div className="grid grid-cols-[40px_1fr_48px_1fr] gap-2 items-center mt-3">
              <label htmlFor="tcpip-host">Host:</label>
              <TextBox
                id="tcpip-host"
                aria-label="DNS host"
                value={draft.host}
                disabled={!draft.dnsEnabled}
                onChange={(event) => change({ host: event.target.value })}
              />
              <label htmlFor="tcpip-domain">Domain:</label>
              <TextBox
                id="tcpip-domain"
                aria-label="DNS domain"
                value={draft.domain}
                disabled={!draft.dnsEnabled}
                onChange={(event) => change({ domain: event.target.value })}
              />
            </div>
            <AddressList
              label="DNS Server Search Order"
              values={draft.dnsServers}
              onChange={(dnsServers) => change({ dnsServers })}
              onError={setError}
            />
            <AddressList
              label="Domain Suffix Search Order"
              values={draft.domainSuffixes}
              onChange={(domainSuffixes) => change({ domainSuffixes })}
              onError={setError}
              addresses={false}
            />
          </>
        )
      case 'Bindings':
        return (
          <>
            <p className="mb-4">Select the network components that use this protocol.</p>
            <GroupBox label="Bindings">
              <Checkbox
                label="Client for Microsoft Networks"
                checked={draft.clientBinding}
                onChange={(event) => change({ clientBinding: event.target.checked })}
              />
            </GroupBox>
          </>
        )
      case 'Advanced':
        return (
          <>
            <p className="mb-3">Select a property, and then select its value.</p>
            <div className="flex gap-3">
              <ListBox
                label="TCP/IP advanced properties"
                items={['allowBindingToAtm', 'forwardBroadcasts', 'enableLmhosts'] as const}
                value={advanced}
                onChange={setAdvanced}
                render={(key) =>
                  ({
                    allowBindingToAtm: 'Allow Binding To ATM',
                    forwardBroadcasts: 'Forward Broadcasts',
                    enableLmhosts: 'Enable LMHOSTS Lookup',
                  })[key]
                }
                className="h-[150px] flex-1"
              />
              <div className="w-[115px]">
                <p className="mb-2">Value:</p>
                <ComboBox
                  aria-label="Advanced property value"
                  value={String(draft[advanced])}
                  options={[
                    { key: 'true', label: 'Yes' },
                    { key: 'false', label: 'No' },
                  ]}
                  onChange={(value) => change({ [advanced]: value === 'true' })}
                />
              </div>
            </div>
            <Checkbox
              className="mt-5"
              label="Set this protocol to be the default protocol"
              checked={draft.defaultProtocol}
              onChange={(event) => change({ defaultProtocol: event.target.checked })}
            />
          </>
        )
      default:
        return null
    }
  }
  return (
    <>
      <Dialog title="TCP/IP Properties" onClose={onClose} className="cp-dialog">
        <div className="p-2 w-[480px]">
          <Tabs
            tabs={[
              'IP Address',
              'WINS Configuration',
              'Gateway',
              'DNS Configuration',
              'Bindings',
              'Advanced',
            ]}
            active={tab}
            onChange={setTab}
            pageClassName="min-h-[336px] p-3"
          >
            {page()}
          </Tabs>
          <div className="flex justify-end gap-2 mt-3">
            <Button
              isDefault
              onClick={() => {
                const error = tcpipError(draft)
                if (error) setError(error)
                else {
                  onOK(draft)
                  onClose()
                }
              }}
            >
              OK
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </Dialog>
      {error && (
        <MessageBox
          title="TCP/IP"
          icon="error"
          message={error}
          buttons={['OK']}
          onClose={() => setError(null)}
        />
      )}
    </>
  )
}

export function NetworkComponentProperties({
  name,
  binding,
  onOK,
  onClose,
}: {
  name: string
  binding: boolean
  onOK: (binding: boolean) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(binding)
  return (
    <Dialog title={`${name} Properties`} onClose={onClose}>
      <div className="p-3 w-[340px]">
        <GroupBox label={name === 'Dial-Up Adapter' ? 'Bindings' : 'Logon validation'}>
          <Checkbox
            label={name === 'Dial-Up Adapter' ? 'TCP/IP' : 'Log on to Windows NT domain'}
            checked={value}
            onChange={(event) => setValue(event.target.checked)}
          />
        </GroupBox>
        <p className="mt-3">This component is installed. No physical network connection is available.</p>
        <div className="flex justify-end gap-2 mt-4">
          <Button
            isDefault
            onClick={() => {
              onOK(value)
              onClose()
            }}
          >
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  )
}
