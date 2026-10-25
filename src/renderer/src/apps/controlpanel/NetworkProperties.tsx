import { useId, useState } from 'react'
import { defaultSettings } from '../../settings/model'
import { Button, Checkbox, ComboBox, Dialog, GroupBox, Radio, TextBox } from '../../ui'
import { DeviceList } from './DeviceList'
import { PropertySheet, useSettingsDraft } from './PropertySheet'

export function NetworkProperties({ onClose }: { onClose: () => void }) {
  const id = useId()
  const state = useSettingsDraft()
  const network = state.draft.network
  const [selected, setSelected] = useState(network.components[0] ?? '')
  const [dialog, setDialog] = useState<string | null>(null)
  const [addition, setAddition] = useState(defaultSettings.network.components[0] ?? '')
  const [binding, setBinding] = useState(true)
  return (
    <>
      <PropertySheet
        title="Network"
        state={state}
        onClose={onClose}
        width={430}
        tabs={[
          {
            label: 'Configuration',
            content: (
              <>
                <p className="mb-2">The following network components are installed:</p>
                <DeviceList
                  label="Network components"
                  items={network.components}
                  value={selected}
                  onChange={setSelected}
                  className="h-[130px]"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <Button onClick={() => setDialog('add')}>Add...</Button>
                  <Button
                    disabled={!selected}
                    onClick={() => {
                      state.change({
                        network: {
                          ...network,
                          components: network.components.filter((name) => name !== selected),
                        },
                      })
                      setSelected('')
                    }}
                  >
                    Remove
                  </Button>
                  <Button disabled={!selected} onClick={() => setDialog('properties')}>
                    Properties
                  </Button>
                </div>
                <label htmlFor={`${id}-logon`} className="block mt-4">
                  Primary Network Logon:
                  <ComboBox
                    aria-label="Primary Network Logon"
                    id={`${id}-logon`}
                    value="Windows Logon"
                    options={[{ key: 'Windows Logon', label: 'Windows Logon' }]}
                    onChange={() => {}}
                    className="w-full mt-1"
                  />
                </label>
                <GroupBox label="Description" className="mt-3">
                  {selected === 'TCP/IP'
                    ? 'TCP/IP is the protocol you use to connect to the Internet and wide-area networks.'
                    : selected === 'Dial-Up Adapter'
                      ? 'Enables your computer to use a modem to connect to a network.'
                      : 'Allows your computer to access resources on a Microsoft network.'}
                </GroupBox>
              </>
            ),
          },
          {
            label: 'Identification',
            content: (
              <>
                <p className="mb-5">
                  Windows uses the following information to identify your computer on the network.
                </p>
                <label htmlFor={`${id}-computer`} className="cp-form-row">
                  Computer name:
                  <TextBox
                    aria-label="Computer name"
                    id={`${id}-computer`}
                    maxLength={15}
                    value={network.computer}
                    onChange={(e) => state.change({ network: { ...network, computer: e.target.value } })}
                  />
                </label>
                <label htmlFor={`${id}-workgroup`} className="cp-form-row">
                  Workgroup:
                  <TextBox
                    aria-label="Workgroup"
                    id={`${id}-workgroup`}
                    maxLength={15}
                    value={network.workgroup}
                    onChange={(e) => state.change({ network: { ...network, workgroup: e.target.value } })}
                  />
                </label>
                <label htmlFor={`${id}-description`} className="cp-form-row">
                  Computer Description:
                  <TextBox
                    aria-label="Computer Description"
                    id={`${id}-description`}
                    maxLength={48}
                    value={network.description}
                    onChange={(e) => state.change({ network: { ...network, description: e.target.value } })}
                  />
                </label>
              </>
            ),
          },
          {
            label: 'Access Control',
            content: (
              <>
                <p className="mb-5">
                  You can control access to shared resources by using passwords or a list of users.
                </p>
                <div className="flex flex-col gap-4">
                  <Radio
                    name="access"
                    label="Share-level access control"
                    checked={!network.userAccess}
                    onChange={() => state.change({ network: { ...network, userAccess: false } })}
                  />
                  <p className="ml-5">Enables you to supply a password for each shared resource.</p>
                  <Radio
                    name="access"
                    label="User-level access control"
                    checked={network.userAccess}
                    onChange={() => state.change({ network: { ...network, userAccess: true } })}
                  />
                  <p className="ml-5">
                    Enables you to specify users and groups that can access shared resources.
                  </p>
                </div>
                <label htmlFor={`${id}-server`} className="block mt-5">
                  Obtain list of users and groups from:
                  <TextBox
                    id={`${id}-server`}
                    aria-label="User list server"
                    className="w-full mt-2"
                    disabled
                  />
                </label>
              </>
            ),
          },
        ]}
      />
      {dialog && (
        <Dialog
          title={dialog === 'add' ? 'Select Network Component Type' : `${selected} Properties`}
          onClose={() => setDialog(null)}
        >
          <div className="p-3 w-[340px]">
            {dialog === 'add' ? (
              <>
                <p className="mb-3">Select the network component you want to install.</p>
                <DeviceList
                  label="Available network components"
                  items={defaultSettings.network.components.filter(
                    (name) => !network.components.includes(name),
                  )}
                  value={addition}
                  onChange={setAddition}
                  className="h-[105px]"
                />
              </>
            ) : (
              <>
                <GroupBox label="Bindings">
                  <Checkbox
                    label="Client for Microsoft Networks"
                    checked={binding}
                    onChange={(e) => setBinding(e.target.checked)}
                  />
                </GroupBox>
                <p className="mt-3">
                  This component is installed. No physical network connection is available.
                </p>
              </>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button
                isDefault
                disabled={dialog === 'add' && (!addition || network.components.includes(addition))}
                onClick={() => {
                  if (dialog === 'add') {
                    state.change({ network: { ...network, components: [...network.components, addition] } })
                    setSelected(addition)
                  }
                  setDialog(null)
                }}
              >
                OK
              </Button>
              <Button onClick={() => setDialog(null)}>Cancel</Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  )
}
