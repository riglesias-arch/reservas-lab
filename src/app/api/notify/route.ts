import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { to, subject, message } = await request.json()

    if (!to || !subject || !message) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY

    // Si aún no se ha configurado la clave, no falla la aplicación
    if (!apiKey) {
      console.warn('RESEND_API_KEY no configurada en las variables de entorno.')
      return NextResponse.json({ success: true, simulated: true })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Sistema de Reservas <onboarding@resend.dev>',
        to: [to],
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e7eb; rounded: 8px;">
            <h2 style="color: #2563eb;">Notificación del Laboratorio</h2>
            <div style="font-size: 14px; color: #374151;">${message}</div>
            <hr style="margin-top: 20px; border: none; border-top: 1px solid #e5e7eb;" />
            <p style="font-size: 12px; color: #6b7280;">Este es un mensaje automático generado por el Sistema de Reservas del Laboratorio.</p>
          </div>
        `,
      }),
    })

    const data = await res.json()
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}