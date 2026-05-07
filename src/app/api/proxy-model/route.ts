import { NextRequest, NextResponse } from 'next/server'

export const runtime    = 'nodejs'
export const maxDuration = 60

// Extrai ID do Google Drive de vários formatos de URL
function extractGoogleDriveId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/open\?id=([a-zA-Z0-9_-]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

// Converte link de compartilhamento do Dropbox para link de download direto
function normalizeDropboxUrl(url: string): string {
  return url
    .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
    .replace(/[?&]dl=0/, '')
    .replace(/[?&]dl=1/, '')
}

async function resolveDownloadUrl(rawUrl: string): Promise<{ url: string; filename?: string }> {
  // Google Drive
  if (rawUrl.includes('drive.google.com') || rawUrl.includes('docs.google.com')) {
    const id = extractGoogleDriveId(rawUrl)
    if (!id) throw new Error('URL do Google Drive inválida. Certifique-se de compartilhar o arquivo.')
    return { url: `https://drive.google.com/uc?export=download&id=${id}&confirm=t` }
  }

  // Dropbox
  if (rawUrl.includes('dropbox.com')) {
    return { url: normalizeDropboxUrl(rawUrl) }
  }

  // OneDrive — converter link de compartilhamento para download direto
  if (rawUrl.includes('1drv.ms') || rawUrl.includes('onedrive.live.com') || rawUrl.includes('sharepoint.com')) {
    // Links do OneDrive geralmente já suportam download direto com &download=1
    const url = rawUrl.includes('download=1') ? rawUrl : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}download=1`
    return { url }
  }

  return { url: rawUrl }
}

// POST /api/proxy-model — body: { url: string }
// Retorna o arquivo binário, fazendo proxy do servidor (sem CORS)
export async function POST(req: NextRequest) {
  try {
    const { url: rawUrl } = await req.json()
    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json({ error: 'URL obrigatória' }, { status: 400 })
    }

    const { url } = await resolveDownloadUrl(rawUrl.trim())

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BIMElectrico/1.0)',
        'Accept': '*/*',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Falha ao buscar arquivo (${response.status}). Verifique se o link está público.` },
        { status: 400 }
      )
    }

    const contentType = response.headers.get('content-type') ?? 'application/octet-stream'

    // Se retornou HTML, provavelmente é página de confirmação ou erro
    if (contentType.includes('text/html')) {
      return NextResponse.json(
        { error: 'O link retornou uma página HTML em vez do arquivo. Verifique se o arquivo está compartilhado publicamente.' },
        { status: 400 }
      )
    }

    // Extrai nome do arquivo do Content-Disposition ou da URL
    const disposition = response.headers.get('content-disposition') ?? ''
    const nameMatch   = disposition.match(/filename[^;=\n]*=["']?([^"'\n;]+)/)
    const filename    = nameMatch?.[1]?.trim() ?? url.split('/').pop()?.split('?')[0] ?? 'model'

    // Stream do arquivo de volta para o cliente
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type':        'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Filename':          encodeURIComponent(filename),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro ao buscar arquivo' }, { status: 500 })
  }
}
