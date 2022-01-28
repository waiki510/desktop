import { remote } from 'electron'
import { IMenuItem, ISerializableMenuItem } from '../lib/menu-item'
import { RequestResponseChannels, RequestChannels } from '../lib/ipc-shared'
import { ExecutableMenuItem } from '../models/app-menu'
import * as ipcRenderer from '../lib/ipc-renderer'

/**
 * Creates a strongly typed proxy method for sending a duplex IPC message to the
 * main process. The parameter types and return type are infered from the
 * RequestResponseChannels type which defines the valid duplex channel names.
 */
export function invokeProxy<T extends keyof RequestResponseChannels>(
  channel: T
): (
  ...args: Parameters<RequestResponseChannels[T]>
) => ReturnType<RequestResponseChannels[T]> {
  return (...args) => ipcRenderer.invoke(channel, ...args) as any
}

/**
 * Creates a strongly typed proxy method for sending a simplex IPC message to
 * the main process. The parameter types are infered from the
 * RequestResponseChannels type which defines the valid duplex channel names.
 */
export function sendProxy<T extends keyof RequestChannels>(
  channel: T
): (...args: Parameters<RequestChannels[T]>) => void {
  return (...args) => ipcRenderer.send(channel, ...args)
}

/**
 * Tell the main process to select all of the current web contents
 */
export const selectAllWindowContents = sendProxy('select-all-window-contents')

/** Set the menu item's enabledness. */
export const updateMenuState = sendProxy('update-menu-state')

/** Tell the main process that the renderer is ready. */
export const sendReady = sendProxy('renderer-ready')

/** Tell the main process to execute (i.e. simulate a click of) the menu item. */
export const executeMenuItem = (item: ExecutableMenuItem) =>
  executeMenuItemById(item.id)

/** Tell the main process to execute (i.e. simulate a click of) the menu item. */
export const executeMenuItemById = sendProxy('execute-menu-item-by-id')

/**
 * Tell the main process to obtain whether the window is focused.
 */
export const isWindowFocused = invokeProxy('is-window-focused')

export const showItemInFolder = sendProxy('show-item-in-folder')
export const showFolderContents = sendProxy('show-folder-contents')
export const openExternal = invokeProxy('open-external')
export const moveItemToTrash = invokeProxy('move-to-trash')

/**
 * Show the OS-provided certificate trust dialog for the certificate, using the
 * given message.
 */
export const showCertificateTrustDialog = sendProxy(
  'show-certificate-trust-dialog'
)

/**
 * Tell the main process that we're going to quit. This means it should allow
 * the window to close.
 *
 * This event is sent synchronously to avoid any races with subsequent calls
 * that would tell the app to quit.
 */
export function sendWillQuitSync() {
  // eslint-disable-next-line no-sync
  ipcRenderer.sendSync('will-quit')
}

/**
 * Tell the main process to move the application to the application folder
 */
export const moveToApplicationsFolder = sendProxy('move-to-applications-folder')

/**
 * Ask the main-process to send over a copy of the application menu.
 * The response will be send as a separate event with the name 'app-menu' and
 * will be received by the dispatcher.
 */
export const getAppMenu = sendProxy('get-app-menu')

function findSubmenuItem(
  currentContextualMenuItems: ReadonlyArray<IMenuItem>,
  indices: ReadonlyArray<number>
): IMenuItem | undefined {
  let foundMenuItem: IMenuItem | undefined = {
    submenu: currentContextualMenuItems,
  }

  // Traverse the submenus of the context menu until we find the appropriate index.
  for (const index of indices) {
    if (foundMenuItem === undefined || foundMenuItem.submenu === undefined) {
      return undefined
    }

    foundMenuItem = foundMenuItem.submenu[index]
  }

  return foundMenuItem
}

const _showContextualMenu = invokeProxy('show-contextual-menu')

/** Show the given menu items in a contextual menu. */
export async function showContextualMenu(
  items: ReadonlyArray<IMenuItem>,
  mergeWithSpellcheckSuggestions = false
) {
  /*
  This is a regular context menu that does not need to merge with spellcheck
  items. They can be shown right away.
  */
  const indices = await _showContextualMenu(
    serializeMenuItems(items),
    mergeWithSpellcheckSuggestions
  )

  if (indices !== null) {
    const menuItem = findSubmenuItem(items, indices)

    if (menuItem !== undefined && menuItem.action !== undefined) {
      menuItem.action()
    }
  }
}

/**
 * Remove the menu items properties that can't be serializable in
 * order to pass them via IPC.
 */
function serializeMenuItems(
  items: ReadonlyArray<IMenuItem>
): ReadonlyArray<ISerializableMenuItem> {
  return items.map(item => ({
    ...item,
    action: undefined,
    submenu: item.submenu ? serializeMenuItems(item.submenu) : undefined,
  }))
}

/** Update the menu item labels with the user's preferred apps. */
export const updatePreferredAppMenuItemLabels = sendProxy(
  'update-preferred-app-menu-item-labels'
)

function getIpcFriendlyError(error: Error) {
  return {
    message: error.message || `${error}`,
    name: error.name || `${error.name}`,
    stack: error.stack || undefined,
  }
}

export const _reportUncaughtException = sendProxy('uncaught-exception')

export function reportUncaughtException(error: Error) {
  _reportUncaughtException(getIpcFriendlyError(error))
}

const _sendErrorReport = sendProxy('send-error-report')

export function sendErrorReport(
  error: Error,
  extra: Record<string, string>,
  nonFatal: boolean
) {
  _sendErrorReport(getIpcFriendlyError(error), extra, nonFatal)
}

/** Tells the main process to resolve the proxy for a given url */
export const resolveProxy = invokeProxy('resolve-proxy')

/**
 * Tell the main process to show open dialog
 */
export const showOpenDialog = invokeProxy('show-open-dialog')
