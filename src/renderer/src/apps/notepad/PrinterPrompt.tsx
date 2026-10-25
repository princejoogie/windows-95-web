import { useState } from 'react'
import { MessageBox } from '../../ui'

export function PrinterPrompt({ onClose }: { onClose: () => void }) {
  const [install, setInstall] = useState(false)
  return install ? (
    <MessageBox
      title="Add Printer"
      icon="info"
      message="No printer ports are available on this computer."
      buttons={['OK']}
      onClose={onClose}
    />
  ) : (
    <MessageBox
      title="Printers"
      icon="question"
      message="Before you can perform printer-related tasks such as page setup or printing a document, you need to install a printer. Do you want to install a printer now?"
      buttons={['Yes', 'No']}
      onClose={(answer) => {
        if (answer === 'Yes') setInstall(true)
        else onClose()
      }}
    />
  )
}
