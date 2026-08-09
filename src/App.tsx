import { Editor } from './components/Editor'
import './App.css'

function App() {
  return (
    <>
      <div data-tauri-drag-region className="drag-region" />
      <Editor />
    </>
  )
}

export default App
