import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(request: Request) {
  try {
    const { bookingId } = await request.json()

    if (!bookingId) {
      return NextResponse.json({ error: 'ID de reserva no proporcionado' }, { status: 400 })
    }

    // 1. Obtener la reserva
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    }

    if (!booking.user_email) {
      return NextResponse.json({ error: 'Esta reserva no tiene un correo registrado.' }, { status: 400 })
    }

    // 2. Generar un código aleatorio de 6 dígitos
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()

    // 3. Guardar el código en Supabase
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ cancellation_code: otpCode })
      .eq('id', bookingId)

    if (updateError) {
      return NextResponse.json({ error: 'Error al guardar el código: ' + updateError.message }, { status: 500 })
    }

    // 4. Obtener nombre del recurso
    let resourceName = 'Recurso'
    if (booking.resource_id) {
      const { data: resData } = await supabase
        .from('resources')
        .select('name')
        .eq('id', booking.resource_id)
        .single()
      if (resData?.name) resourceName = resData.name
    }

    // 5. Enviar el código por correo mediante Resend
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Falta la variable RESEND_API_KEY en las configuraciones.' }, { status: 500 })
    }

    const startDate = new Date(booking.start_time).toLocaleDateString('es-ES')

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Sistema de Reservas <onboarding@resend.dev>',
        to: [booking.user_email],
        subject: '🔑 Código de verificación para cancelar tu reserva',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #dc2626;">Solicitud de Cancelación</h2>
            <p>Hola <strong>${booking.user_name}</strong>,</p>
            <p>Se ha solicitado la cancelación de tu reserva para <strong>${resourceName}</strong> el día <strong>${startDate}</strong>.</p>
            <p>Tu código de verificación para confirmar la cancelación es:</p>
            <div style="background-color: #f3f4f6; padding: 15px; font-size: 26px; font-weight: bold; text-align: center; letter-spacing: 6px; border-radius: 6px; margin: 20px 0; color: #1f2937;">
              ${otpCode}
            </div>
            <p style="font-size: 12px; color: #6b7280;">Si no solicitaste esta cancelación, puedes ignorar este correo y tu reserva se mantendrá intacta.</p>
          </div>
        `,
      }),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      return NextResponse.json(
        { error: `Resend: ${resendData.message || 'Error al enviar el correo'}` },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}