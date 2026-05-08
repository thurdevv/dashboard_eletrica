import { NextRequest, NextResponse } from 'next/server'
import { pathToFileURL } from 'url'
import { createRequire } from 'module'
import path from 'path'

export const runtime = 'nodejs'
export const maxDuration = 60   // Netlify Pro allows up to 26s; Vercel/local up to 60s

// POST /api/convert  — body: FormData { file: File(.ifc) }
// Returns: XKT binary (application/octet-stream)
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'ifc') return NextResponse.json({ error: 'Only .ifc files are supported' }, { status: 400 })

    const sourceData = Buffer.from(await file.arrayBuffer())

    const [{ convert2xkt }, WebIFCModule] = await Promise.all([
      import('@xeokit/xeokit-convert/src/convert2xkt.js') as Promise<{ convert2xkt: Function }>,
      import('web-ifc') as Promise<any>,
    ])

    const WebIFC = WebIFCModule.default ?? WebIFCModule

    // Resolve WASM directory — nft bundler on Vercel traces JS but NOT package.json,
    // so resolve the main entry point (web-ifc.js) and use its directory.
    let wasmDir: string
    try {
      const _require = createRequire(import.meta.url)
      wasmDir = path.dirname(_require.resolve('web-ifc'))
    } catch {
      wasmDir = path.join(process.cwd(), 'node_modules', 'web-ifc')
    }
    const wasmFileUrl = pathToFileURL(wasmDir).href + '/'

    // Patch IfcAPI so SetWasmPath always uses the absolute file:// wasm URL,
    // overriding the hardcoded "./" that convert2xkt passes internally.
    const OrigIfcAPI = WebIFC.IfcAPI
    class PatchedIfcAPI extends OrigIfcAPI {
      SetWasmPath(_path: string, _absolute?: boolean) {
        super.SetWasmPath(wasmFileUrl, true)
      }
    }
    const PatchedWebIFC = { ...WebIFC, IfcAPI: PatchedIfcAPI }

    const xktBuffers: Uint8Array[] = []

    await convert2xkt({
      WebIFC: PatchedWebIFC,
      sourceData,
      sourceFormat: 'ifc',
      outputXKT: (xktData: Uint8Array) => { xktBuffers.push(xktData) },
      log: () => {},
    })

    if (!xktBuffers.length) {
      return NextResponse.json({ error: 'Conversion produced no output' }, { status: 500 })
    }

    const xkt = xktBuffers[0]
    return new NextResponse(xkt as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/octet-stream',
        'Content-Disposition': `attachment; filename="${file.name.replace(/\.ifc$/i, '.xkt')}"`,
        'Content-Length':      String(xkt.byteLength),
      },
    })
  } catch (err: any) {
    console.error('[/api/convert]', err)
    return NextResponse.json({ error: err?.message ?? 'Conversion failed' }, { status: 500 })
  }
}
