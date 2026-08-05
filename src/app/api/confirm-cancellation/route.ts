import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(request: Request) {
  try {
    const { bookingId, code } = await request.json()

    if (!bookingId || !code) {
      return NextResponse.json({ error: 'Faltan datos para realizar la validación.' }, { status: 400 })
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

    // 2. Verificar que el código coincida
    if (!booking.cancellation_code || booking.cancellation_code.trim() !== code.trim()) {
      return NextResponse.json({ error: 'El código de verificación ingresado es incorrecto.' }, { status: 400 })
    }

    // 3. Eliminar la reserva
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId)

    if (deleteError) {
      return NextResponse.json({ error: 'Error al cancelar la reserva: ' + deleteError.message }, { status: 500 })
    }

    // 4. Enviar correo informando la cancelación exitosa
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey && booking.user_email) {
      let resourceName = 'Recurso'
      if (booking.resource_id) {
        const { data: resData } = await supabase
          .from('resources')
          .select('name')
          .eq('id', booking.resource_id)
          .single()
        if (resData?.name) resourceName = resData.name
      }

      const startDate = new Date(booking.start_time).toLocaleDateString('es-ES')

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Sistema de Reservas <onboarding@resend.dev>',
          to: [booking.user_email],
          subject: ' Confirmación de Cancelación de Reserva',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #2563eb;">Reserva Cancelada</h2>
              <p>Hola <strong>${booking.user_name}</strong>,</p>
              <p>Tu reserva para <strong>${resourceName}</strong> el día <strong>${startDate}</strong> ha sido cancelada exitosamente.</p>
            </div>
          `,
        }),
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}