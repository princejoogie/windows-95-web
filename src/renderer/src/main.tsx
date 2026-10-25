import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Shell } from './shell/Shell'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('missing #root')

createRoot(root).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
)
