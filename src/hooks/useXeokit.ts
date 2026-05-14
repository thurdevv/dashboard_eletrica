'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import type { IFCElement, ExecutionRecord, LoadedModel } from '@/types'
import { buildGlobalIdMap, buildReverseMap, buildLevelMap, extractIFCElement } from '@/lib/viewer/elementMapper'
import { colorizeByStatus, highlightObject, showAll } from '@/lib/viewer/colorizer'
import { AppError, toAppError } from '@/lib/errors'
import { detectWebGL2Support } from '@/lib/webgl'
import { captureException } from '@/lib/observability/sentry'

interface UseXeokitOptions {
  canvasId:        string
  model:           LoadedModel | null
  onElementSelect: (element: IFCElement) => void
}

export function useXeokit({ canvasId, model, onElementSelect }: UseXeokitOptions) {
  const viewerRef       = useRef<any>(null)
  const globalIdMapRef  = useRef<Map<string, string>>(new Map())
  const reverseMapRef   = useRef<Map<string, string>>(new Map())
  const levelMapRef     = useRef<Map<string, string>>(new Map())
  const selectedObjRef  = useRef<string | undefined>(undefined)
  const measurePluginRef = useRef<any>(null)
  const [isLoading,     setIsLoading]     = useState(false)
  const [error,         setError]         = useState<AppError | null>(null)
  const [elementCount,  setElementCount]  = useState(0)
  const [modelLevels,   setModelLevels]   = useState<string[]>([])
  const [measureActive, setMeasureActive] = useState(false)
  const [edgesEnabled,  setEdgesEnabled]  = useState(true)

  // Modelos grandes derrubam o framerate ao desenhar arestas de cada
  // elemento. Usamos o tamanho do binário como heurística (não temos a
  // contagem antes de carregar) e desligamos edges para modelos pesados.
  const EDGES_OFF_THRESHOLD_BYTES = 8 * 1024 * 1024   // 8 MB

  useEffect(() => {
    if (!model) return

    let viewer: any = null
    let destroyed   = false

    setIsLoading(true)
    setError(null)

    async function initViewer() {
      const m = model
      if (!m) return
      try {
        // Aborta cedo se WebGL2 não está disponível: o xeokit usa shaders
        // GLSL ES 3.0 que falham silenciosamente em WebGL1 com a mensagem
        // críptica "unsupported shader version".
        const webgl = detectWebGL2Support()
        if (!webgl.ok) {
          throw new AppError('WEBGL2_UNSUPPORTED', `reason: ${webgl.reason}`)
        }

        const [xeokitSdk, webIfcNs] = await Promise.all([
          import('@xeokit/xeokit-sdk'),
          import('web-ifc'),
        ])
        // Turbopack/CJS interop: IfcAPI pode estar no default ou direto no namespace
        const WebIFC: any = (webIfcNs as any).default ?? webIfcNs

        const {
          Viewer,
          XKTLoaderPlugin,
          WebIFCLoaderPlugin,
          NavCubePlugin,
          DistanceMeasurementsPlugin,
        } = xeokitSdk

        if (destroyed) return

        // Destroy previous viewer instance if any
        viewerRef.current?.destroy()

        try {
          viewer = new Viewer({ canvasId, transparent: true })
        } catch (initErr) {
          throw new AppError('VIEWER_INIT_FAILED',
            initErr instanceof Error ? initErr.message : String(initErr))
        }
        viewerRef.current = viewer

        // Algumas GPUs declaram WebGL2 mas falham ao compilar o SAO em
        // contextos limitados. Desligamos o SAO logo após criar o Viewer
        // para evitar o erro de shader "unsupported shader version" sem
        // perder o restante da renderização. Modelos continuam visíveis,
        // apenas sem oclusão ambiente.
        try { viewer.scene.sao.enabled = false } catch { /* opção pode não existir */ }

        new NavCubePlugin(viewer, {
          canvasId:   `${canvasId}-navcube`,
          visible:    true,
          syncCamera: true,
        } as any)

        if (DistanceMeasurementsPlugin) {
          // defaultAxisVisible: false → some o "fantasma" verde dos eixos X/Y/Z
          // que aparecia atrás da linha azul principal da medição.
          const mp = new DistanceMeasurementsPlugin(viewer, {
            defaultAxisVisible: false,
          })
          mp.control.deactivate()
          measurePluginRef.current = mp
        }

        viewer.camera.eye  = [-3.93, 2.85, 27.01]
        viewer.camera.look = [4.40,  3.72,  8.89]
        viewer.camera.up   = [0.01,  0.99,  0.04]

        let loadedModel: any

        // Heurística: modelo "grande" (binário > 8 MB) carrega sem arestas
        // para evitar travamento. Usuário pode religar com toggleEdges().
        const dataSize       = m.data?.byteLength ?? 0
        const initialEdges   = dataSize === 0 || dataSize < EDGES_OFF_THRESHOLD_BYTES
        setEdgesEnabled(initialEdges)

        if (m.type === 'ifc') {
          // Inicializa o WASM antes de passar ao plugin
          const IfcAPI = new WebIFC.IfcAPI()
          IfcAPI.SetWasmPath('/', true)   // true = caminho absoluto
          await IfcAPI.Init()             // carrega o WASM de /web-ifc.wasm

          const loader = new WebIFCLoaderPlugin(viewer, {
            WebIFC,
            IfcAPI,
            wasmPath: '/',
          } as any)
          // Usa ArrayBuffer direto para evitar bug de blob URL com cache-busting
          const loadParams: any = { id: 'model', edges: initialEdges }
          if (m.data) {
            loadParams.ifc = m.data
          } else {
            loadParams.src = m.url
          }
          loadedModel = loader.load(loadParams)
        } else {
          const loader    = new XKTLoaderPlugin(viewer)
          const xktParams: any = { id: 'model', edges: initialEdges }
          if (m.data) {
            xktParams.xkt = m.data          // ArrayBuffer — evita bug de blob URL
          } else {
            xktParams.src          = m.url
            xktParams.metaModelSrc = m.metaUrl
          }
          if (m.metaUrl && !m.data) xktParams.metaModelSrc = m.metaUrl
          loadedModel = loader.load(xktParams)
        }

        loadedModel.on('loaded', () => {
          if (destroyed) return
          const { scene, metaScene } = viewer

          if (metaScene?.metaObjects) {
            globalIdMapRef.current = buildGlobalIdMap(metaScene.metaObjects)
            levelMapRef.current    = buildLevelMap(metaScene)
          } else {
            // Fallback: treat objectId as its own globalId
            const fallback = new Map<string, string>()
            Object.keys(scene.objects).forEach((id) => fallback.set(id, id))
            globalIdMapRef.current = fallback
          }
          reverseMapRef.current = buildReverseMap(globalIdMapRef.current)

          // Extract all unique levels from model metadata
          const uniqueLevels = [...new Set(
            Array.from(levelMapRef.current.values()).filter(Boolean)
          )].sort()
          setModelLevels(uniqueLevels)

          // Count: use globalIdMap size (renderable elements with known IDs)
          // Fall back to scene.objects count if map is empty
          const count = globalIdMapRef.current.size > 0
            ? globalIdMapRef.current.size
            : Object.keys(scene.objects).length
          setElementCount(count)

          setIsLoading(false)
          viewer.cameraFlight.flyTo({ aabb: scene.aabb })
        })

        loadedModel.on('error', (msg: any) => {
          if (destroyed) return
          const text = typeof msg === 'string' ? msg
            : msg?.message ?? JSON.stringify(msg) ?? 'Erro desconhecido'
          // "getXKT error : null" is a benign warning (no conversion server) — not fatal
          if (text.includes('getXKT')) return
          // Erros de shader chegam aqui em alguns casos — detectamos pelo
          // texto e mapeamos para o código apropriado.
          const isShader = /shader|GLSL|version 300 es/i.test(text)
          setError(new AppError(
            isShader ? 'WEBGL2_UNSUPPORTED' : 'MODEL_LOAD_FAILED',
            text,
          ))
          setIsLoading(false)
          captureException(new Error(text), { where: 'useXeokit.modelLoad', modelType: m.type })
        })

        // Captura screenshot do canvas com o elemento já destacado
        function captureCanvasScreenshot(): string {
          try {
            const c = viewer.scene.canvas.canvas as HTMLCanvasElement
            return c.toDataURL('image/jpeg', 0.75)
          } catch { return '' }
        }

        // Função de seleção reutilizada pelo mouse e pelo toque
        function pickAndSelect(canvasPos: number[]) {
          // Tenta pick exato primeiro; se falhar faz busca em espiral (facilita seleção no touch)
          let pick = viewer.scene.pick({ canvasPos, pickSurface: true })
          if (!pick) {
            const radius = 22   // px de tolerância extra para dedos
            const steps  = 12
            for (let i = 1; i <= 3 && !pick; i++) {
              for (let s = 0; s < steps && !pick; s++) {
                const angle = (s / steps) * 2 * Math.PI
                const ox = Math.round(Math.cos(angle) * radius * i / 3)
                const oy = Math.round(Math.sin(angle) * radius * i / 3)
                pick = viewer.scene.pick({ canvasPos: [canvasPos[0] + ox, canvasPos[1] + oy], pickSurface: true })
              }
            }
          }
          if (!pick) return

          const objectId = pick.entity?.id
          if (!objectId) return

          highlightObject(viewer, objectId, selectedObjRef.current)
          selectedObjRef.current = objectId

          const element = extractIFCElement(
            objectId,
            viewer.scene.objects,
            levelMapRef.current,
            reverseMapRef.current,
            viewer.metaScene?.metaObjects,
          )
          if (element) {
            // Captura screenshot com o elemento já destacado
            element.screenshot = captureCanvasScreenshot()
            onElementSelect(element)
          }
        }

        // Seleção por mouse (desktop)
        viewer.scene.input.on('mouseclicked', (coords: number[]) => pickAndSelect(coords))

        // Seleção por toque (mobile)
        const canvas = viewer.scene.canvas.canvas as HTMLCanvasElement
        let touchStartX = 0
        let touchStartY = 0
        let touchStartTime = 0

        canvas.addEventListener('touchstart', (e: TouchEvent) => {
          const t = e.changedTouches[0]
          touchStartX    = t.clientX
          touchStartY    = t.clientY
          touchStartTime = Date.now()
        }, { passive: true })

        canvas.addEventListener('touchend', (e: TouchEvent) => {
          const t    = e.changedTouches[0]
          const dx   = t.clientX - touchStartX
          const dy   = t.clientY - touchStartY
          const dt   = Date.now() - touchStartTime
          // Considera tap apenas se o dedo não se moveu muito e foi rápido (< 300ms, < 12px)
          const isTap = Math.sqrt(dx * dx + dy * dy) < 12 && dt < 300
          if (!isTap) return

          const rect = canvas.getBoundingClientRect()
          const x    = t.clientX - rect.left
          const y    = t.clientY - rect.top
          pickAndSelect([x, y])
        }, { passive: true })

      } catch (err: unknown) {
        if (!destroyed) {
          const appErr = err instanceof AppError
            ? err
            // Erros de compilação de shader também caem aqui se vierem
            // do construtor do Viewer.
            : /shader|version 300 es|GLSL/i.test(String((err as Error)?.message ?? ''))
              ? new AppError('WEBGL2_UNSUPPORTED', (err as Error).message)
              : toAppError(err, 'VIEWER_INIT_FAILED')
          setError(appErr)
          setIsLoading(false)
          captureException(err, { where: 'useXeokit.init', modelType: m.type })
        }
      }
    }

    initViewer()

    return () => {
      destroyed = true
      measurePluginRef.current = null
      setMeasureActive(false)
      setModelLevels([])
      viewer?.destroy()
    }
  }, [canvasId, model]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMeasure = useCallback(() => {
    const plugin = measurePluginRef.current
    if (!plugin) return
    setMeasureActive(prev => {
      const next = !prev
      if (next) plugin.control.activate()
      else plugin.control.deactivate()
      return next
    })
  }, [])

  const clearMeasurements = useCallback(() => {
    measurePluginRef.current?.clear()
  }, [])

  // Liga/desliga as arestas (linhas pretas em torno de cada geometria) em
  // tempo de execução. Em modelos com milhares de elementos, manter as
  // arestas dobra ou triplica o custo de render — esse toggle dá uma
  // saída para o usuário que precisa de framerate.
  const toggleEdges = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    setEdgesEnabled((prev) => {
      const next = !prev
      try {
        for (const obj of Object.values<any>(viewer.scene.objects)) {
          obj.edges = next
        }
      } catch { /* alguns objetos podem não suportar — ignora */ }
      return next
    })
  }, [])

  const applyColors = useCallback((records: ExecutionRecord[], filterStatus?: string) => {
    if (!viewerRef.current) return
    colorizeByStatus(viewerRef.current, records, globalIdMapRef.current, filterStatus)
  }, [])

  const zoomTo = useCallback((globalId: string) => {
    const viewer   = viewerRef.current
    if (!viewer) return
    const objectId = globalIdMapRef.current.get(globalId)
    if (!objectId) return
    const obj = viewer.scene.objects[objectId]
    if (obj) viewer.cameraFlight.flyTo({ aabb: obj.aabb })
  }, [])

  const isolateLevel = useCallback((level: string | null) => {
    const viewer = viewerRef.current
    if (!viewer) return
    if (!level) { showAll(viewer); return }
    for (const [globalId, objectId] of globalIdMapRef.current.entries()) {
      const obj = viewer.scene.objects[objectId]
      if (obj) obj.visible = levelMapRef.current.get(globalId) === level
    }
  }, [])

  const searchElement = useCallback((query: string) => {
    const viewer = viewerRef.current
    if (!viewer) return
    const lower  = query.toLowerCase()
    let firstId: string | null = null
    for (const [, obj] of Object.entries<any>(viewer.scene.objects)) {
      const meta  = viewer.metaScene?.metaObjects[obj.id]
      const match = meta?.name?.toLowerCase().includes(lower)
      obj.highlighted = !!match
      if (match && !firstId) firstId = obj.id
    }
    if (firstId) {
      const obj = viewer.scene.objects[firstId]
      viewer.cameraFlight.flyTo({ aabb: obj.aabb })
    }
  }, [])

  const resetCamera = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.cameraFlight.flyTo({ aabb: viewer.scene.aabb })
  }, [])

  // Seleciona um elemento por GlobalId (usado por deep-links do QR Code).
  // Faz zoom, marca como destacado e dispara onElementSelect (que abre o
  // ElementPanel). Retorna true se encontrou; false se o globalId não está
  // no modelo carregado.
  const selectByGlobalId = useCallback((globalId: string): boolean => {
    const viewer = viewerRef.current
    if (!viewer) return false
    const objectId = globalIdMapRef.current.get(globalId)
    if (!objectId) return false

    highlightObject(viewer, objectId, selectedObjRef.current)
    selectedObjRef.current = objectId

    const obj = viewer.scene.objects[objectId]
    if (obj) viewer.cameraFlight.flyTo({ aabb: obj.aabb })

    const element = extractIFCElement(
      objectId,
      viewer.scene.objects,
      levelMapRef.current,
      reverseMapRef.current,
      viewer.metaScene?.metaObjects,
    )
    if (element) onElementSelect(element)
    return !!element
  }, [onElementSelect])

  return {
    isLoading, error, elementCount,
    modelLevels, measureActive, edgesEnabled,
    applyColors, zoomTo, isolateLevel, searchElement, resetCamera,
    toggleMeasure, clearMeasurements, toggleEdges,
    selectByGlobalId,
  }
}
