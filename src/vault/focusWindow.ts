import { getCurrentWindow } from '@tauri-apps/api/window'

// Windows won't let a background process steal foreground focus or z-order
// via setFocus() alone. hide -> unminimize -> show handles the minimized
// case; briefly pinning alwaysOnTop forces it above whatever else is
// currently on top (e.g. a browser window), which setFocus() by itself
// can't do. Awaiting these calls only confirms the IPC round-trip, not that
// the OS has actually restacked and painted the window, so releasing the
// pin immediately raced ahead of that - give it a beat before releasing.
export async function focusCurrentWindow(): Promise<void> {
  const win = getCurrentWindow()
  await win.hide()
  await win.unminimize()
  await win.show()
  await win.setAlwaysOnTop(true)
  await win.setFocus()
  await new Promise((resolve) => setTimeout(resolve, 150))
  await win.setAlwaysOnTop(false)
}
