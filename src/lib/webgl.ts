/**
 * Detecção de suporte a WebGL2.
 *
 * O xeokit-sdk emite shaders GLSL ES 3.0 (`#version 300 es`) que só
 * compilam em contexto WebGL2. Quando o navegador cai em WebGL1 — seja
 * porque a GPU não suporta, drivers estão desatualizados, aceleração
 * por hardware está desligada, ou o swrast/SwiftShader está sendo usado
 * — o shader falha com "unsupported shader version".
 *
 * Esta função roda um teste leve em canvas descartável antes de
 * criarmos o Viewer, para conseguirmos abortar com uma mensagem
 * amigável em vez de exibir o erro de shader cru.
 */
export type WebGLSupport =
  | { ok: true }
  | { ok: false; reason: 'no-canvas' | 'no-webgl2' }

export function detectWebGL2Support(): WebGLSupport {
  if (typeof document === 'undefined') return { ok: false, reason: 'no-canvas' }
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return { ok: false, reason: 'no-webgl2' }
    // Libera o contexto imediatamente; alguns drivers limitam o número
    // de contextos simultâneos.
    const ext = gl.getExtension('WEBGL_lose_context')
    ext?.loseContext()
    return { ok: true }
  } catch {
    return { ok: false, reason: 'no-webgl2' }
  }
}
