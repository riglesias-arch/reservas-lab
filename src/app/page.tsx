'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

interface Resource {
  id: string
  name: string
  type: string
}

interface Booking {
  id: string
  resource_id: string
  user_name: string
  user_email: string
  start_time: string
  end_time: string
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

export default function Home() {
  const supabase = createClient()
  const [resources, setResources] = useState<Resource[]>([])
  const [selectedResourceId, setSelectedResourceId] = useState<string>('')
  const [bookings, setBookings] = useState<Booking[]>([])

  // Modal y Formulario
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [bookingDate, setBookingDate] = useState('')
  const [startHour, setStartHour] = useState(8)
  const [endHour, setEndHour] = useState(9)
  const [errorMsg, setErrorMsg] = useState('')
  const [statusMsg, setStatusMsg] = useState('Cargando recursos...')

  useEffect(() => {
    async function loadResources() {
      try {
        const { data, error } = await supabase.from('resources').select('*')
        if (error) {
          setStatusMsg(`Error de conexión: ${error.message}`)
          return
        }
        if (!data || data.length === 0) {
          setStatusMsg('La tabla de recursos está vacía.')
          return
        }
        setResources(data)
        setSelectedResourceId(data[0].id)
        setStatusMsg('')
      } catch (err: any) {
        setStatusMsg(`Error inesperado: ${err.message}`)
      }
    }
    loadResources()
  }, [])

  const loadBookingsForSelected = async (resourceId: string) => {
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('resource_id', resourceId)
      .order('start_time', { ascending: true })
    if (data) setBookings(data)
  }

  useEffect(() => {
    if (selectedResourceId) {
      loadBookingsForSelected(selectedResourceId)
    }
  }, [selectedResourceId])

  // Función para enviar correos llamando a nuestra API
  const sendEmailNotification = async (to: string, subject: string, message: string) => {
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, message }),
      })
    } catch (e) {
      console.error('Error al enviar correo:', e)
    }
  }

  // 1. Crear Reserva
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!userName || !userEmail || !bookingDate) {
      setErrorMsg('Por favor completa todos los campos (Nombre, Email y Fecha).')
      return
    }

    const start = new Date(`${bookingDate}T${startHour.toString().padStart(2, '0')}:00:00`)
    const end = new Date(`${bookingDate}T${endHour.toString().padStart(2, '0')}:00:00`)

    if (end <= start) {
      setErrorMsg('La hora de fin debe ser posterior a la hora de inicio.')
      return
    }

    const currentResource = resources.find((r) => r.id === selectedResourceId)

    const { error } = await supabase.from('bookings').insert([
      {
        resource_id: selectedResourceId,
        user_name: userName,
        user_email: userEmail,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      },
    ])

    if (error) {
      if (error.code === '23P01') {
        setErrorMsg('El horario seleccionado ya se encuentra ocupado.')
      } else {
        setErrorMsg('Error al guardar: ' + error.message)
      }
    } else {
      setIsModalOpen(false)

      // Notificar por correo
      const dateFormatted = start.toLocaleDateString('es-ES')
      const timeFormatted = `${startHour}:00 a ${endHour}:00`
      await sendEmailNotification(
        userEmail,
        ' Confirmación de Reserva - Laboratorio',
        `<p>Hola <strong>${userName}</strong>,</p>
         <p>Tu reserva ha sido confirmada con éxito:</p>
         <ul>
           <li><strong>Recurso:</strong> ${currentResource?.name}</li>
           <li><strong>Fecha:</strong> ${dateFormatted}</li>
           <li><strong>Horario:</strong> ${timeFormatted}</li>
         </ul>`
      )

      setUserName('')
      setUserEmail('')
      loadBookingsForSelected(selectedResourceId)
    }
  }

  // 2. Cancelar Reserva
  const handleCancelBooking = async (booking: Booking) => {
    const confirmCancel = window.confirm(
      `¿Estás seguro de que deseas cancelar la reserva de ${booking.user_name}?`
    )

    if (!confirmCancel) return

    const { error } = await supabase.from('bookings').delete().eq('id', booking.id)

    if (error) {
      alert('Error al cancelar la reserva: ' + error.message)
    } else {
      const currentResource = resources.find((r) => r.id === selectedResourceId)
      const start = new Date(booking.start_time)
      const end = new Date(booking.end_time)

      // Notificar cancelación por correo si tenía email registrado
      if (booking.user_email) {
        await sendEmailNotification(
          booking.user_email,
          ' Cancelación de Reserva - Laboratorio',
          `<p>Hola <strong>${booking.user_name}</strong>,</p>
           <p>Tu reserva ha sido cancelada:</p>
           <ul>
             <li><strong>Recurso:</strong> ${currentResource?.name}</li>
             <li><strong>Fecha:</strong> ${start.toLocaleDateString('es-ES')}</li>
             <li><strong>Horario:</strong> ${start.getHours()}:00 a ${end.getHours()}:00</li>
           </ul>`
        )
      }

      loadBookingsForSelected(selectedResourceId)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sistema de Reservas del Laboratorio</h1>
            <p className="text-sm text-gray-500">Gestión de espacios y equipos</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            + Nueva Reserva
          </button>
        </header>

        {statusMsg && (
          <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-sm font-medium">
            {statusMsg}
          </div>
        )}

        {/* Selector de Recurso */}
        <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
          <label className="block text-sm font-semibold text-gray-700">Selecciona un Recurso:</label>
          <select
            value={selectedResourceId}
            onChange={(e) => setSelectedResourceId(e.target.value)}
            disabled={resources.length === 0}
            className="w-full p-2.5 border rounded-lg text-sm bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            {resources.length === 0 ? (
              <option>No hay recursos disponibles</option>
            ) : (
              resources.map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.type.toUpperCase()}] {r.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Lista de Reservas Activas */}
        <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
          <h2 className="text-lg font-bold text-gray-800">Reservas Activas para este recurso</h2>
          {bookings.length === 0 ? (
            <p className="text-sm text-gray-500">No hay reservas registradas aún para este recurso.</p>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                >
                  <div>
                    <div className="font-semibold text-blue-950">{b.user_name}</div>
                    <div className="text-xs text-blue-600">{b.user_email || 'Sin email'}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      📅 {new Date(b.start_time).toLocaleDateString('es-ES')} | ⏰ {' '}
                      {new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {' '}
                      {new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelBooking(b)}
                    className="self-start sm:self-center px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-medium text-xs rounded-md border border-red-200 transition"
                  >
                    Cancelar Reserva
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal para Crear Reserva */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-xl font-bold">Hacer una Reserva</h3>
            {errorMsg && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{errorMsg}</div>}

            <form onSubmit={handleCreateBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600">Nombre del Investigador</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Ej: Dra. María Gómez"
                  className="w-full p-2 border rounded-lg text-sm mt-1"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600">Correo Electrónico (para notificaciones)</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="ejemplo@laboratorio.com"
                  className="w-full p-2 border rounded-lg text-sm mt-1"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600">Fecha</label>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full p-2 border rounded-lg text-sm mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Hora Inicio</label>
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg text-sm mt-1"
                  >
                    {HOURS.slice(0, -1).map((h) => (
                      <option key={h} value={h}>{`${h}:00`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Hora Fin</label>
                  <select
                    value={endHour}
                    onChange={(e) => setEndHour(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg text-sm mt-1"
                  >
                    {HOURS.filter((h) => h > startHour).map((h) => (
                      <option key={h} value={h}>{`${h}:00`}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                  Guardar Reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}