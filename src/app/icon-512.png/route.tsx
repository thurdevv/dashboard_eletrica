import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 290, fontWeight: 800, color: '#fff', letterSpacing: -6,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}>
        BIM
      </div>
    ),
    { width: 512, height: 512 },
  )
}
