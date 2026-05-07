// Google Drive sync via OAuth2 (client-side only, scope: drive.file)
// Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID env var

const DRIVE_META_KEY = (projectId: string) => `bim_drive_${projectId}`

export interface DriveMeta {
  fileId:   string
  fileName: string
  lastSync: string   // ISO date
}

export function getDriveMeta(projectId: string): DriveMeta | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(DRIVE_META_KEY(projectId))
  return raw ? JSON.parse(raw) : null
}

export function saveDriveMeta(projectId: string, meta: DriveMeta): void {
  localStorage.setItem(DRIVE_META_KEY(projectId), JSON.stringify(meta))
}

export function clearDriveMeta(projectId: string): void {
  localStorage.removeItem(DRIVE_META_KEY(projectId))
}

export function googleClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''
}

let _tokenClient: any = null
let _cachedToken: string | null = null
let _tokenExpiry = 0

// Carrega o script do Google Identity Services (uma vez)
function loadGISScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts) { resolve(); return }
    const script = document.createElement('script')
    script.src   = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload  = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar Google Identity Services'))
    document.head.appendChild(script)
  })
}

// Solicita token OAuth2 — escopo drive para leitura + escrita completa
export async function requestDriveToken(forceConsent = false): Promise<string> {
  if (!forceConsent && _cachedToken && Date.now() < _tokenExpiry) return _cachedToken

  const clientId = googleClientId()
  if (!clientId) throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID não configurado')

  await loadGISScript()
  const google = (window as any).google

  return new Promise((resolve, reject) => {
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope:     'https://www.googleapis.com/auth/drive',
      callback:  (resp: any) => {
        if (resp.error) { reject(new Error(resp.error_description ?? resp.error)); return }
        _cachedToken = resp.access_token
        _tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000
        resolve(resp.access_token)
      },
    })
    _tokenClient.requestAccessToken({ prompt: forceConsent ? 'consent' : '' })
  })
}

// ─── Listar itens de uma pasta do Drive ───────────────────────
export const FOLDER_MIME = 'application/vnd.google-apps.folder'

export interface DriveItem {
  id:           string
  name:         string
  mimeType:     string
  size?:        string
  modifiedTime: string
}

export async function listDriveItems(token: string, parentId = 'root'): Promise<DriveItem[]> {
  const q      = encodeURIComponent(`'${parentId}' in parents and trashed = false`)
  const fields = encodeURIComponent('files(id,name,mimeType,size,modifiedTime)')
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=folder,name&pageSize=200`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Erro ${res.status} ao listar pasta`)
  }
  const data = await res.json()
  return data.files ?? []
}

// ─── Baixar arquivo do Drive ──────────────────────────────────
export async function downloadDriveFile(token: string, fileId: string): Promise<ArrayBuffer> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Erro ${res.status} ao baixar arquivo`)
  }
  return res.arrayBuffer()
}

// Faz upload (POST) ou atualização (PATCH) no Drive
export async function uploadZipToDrive(
  token:          string,
  blob:           Blob,
  filename:       string,
  existingFileId?: string,
): Promise<DriveMeta> {
  const metadata = JSON.stringify({ name: filename, mimeType: 'application/octet-stream' })
  const boundary = 'bim_boundary_xyz'

  const enc     = new TextEncoder()
  const metaPart = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`
  )
  const filePart = enc.encode(`--${boundary}\r\nContent-Type: application/zip\r\n\r\n`)
  const endPart  = enc.encode(`\r\n--${boundary}--`)

  const fileBytes  = new Uint8Array(await blob.arrayBuffer())
  const body       = new Uint8Array(metaPart.byteLength + filePart.byteLength + fileBytes.byteLength + endPart.byteLength)
  let offset = 0
  body.set(metaPart, offset);  offset += metaPart.byteLength
  body.set(filePart, offset);  offset += filePart.byteLength
  body.set(fileBytes, offset); offset += fileBytes.byteLength
  body.set(endPart, offset)

  const url    = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
  const method = existingFileId ? 'PATCH' : 'POST'

  const res = await fetch(url, {
    method,
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })

  if (!res.ok) {
    if (res.status === 404 && existingFileId) {
      // Arquivo foi deletado do Drive — cria um novo
      return uploadZipToDrive(token, blob, filename)
    }
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Erro ${res.status} ao enviar para o Drive`)
  }

  const data = await res.json()
  return {
    fileId:   data.id,
    fileName: filename,
    lastSync: new Date().toISOString(),
  }
}
