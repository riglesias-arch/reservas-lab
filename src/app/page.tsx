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
  const [bookingDate, setBookingDate] = useState('')
  const [startHour, setStartHour] = useState(8)
  const [endHour, setEndHour] = useState(9)
  const [errorMsg, setErrorMsg] = useState('')
  const [statusMsg, setStatusMsg] = useState('Cargando recursos desde Supabase...')

  useEffect(() => {
    async function loadResources() {
      try {
        const { data, error } = await supabase.from('resources').select('*')
        
        if (error) {
          setStatusMsg(`Error de conexión con Supabase: ${error.message}`)
          return
        }

        if (!data || data.length === 0) {
          setStatusMsg('Conexión exitosa, pero la tabla "resources" está vacía en Supabase.')
          return
        }

        setResources(data)
        setSelectedResourceId(data[0].id)
        setStatusMsg('') // Limpiar si todo estuvo bien
      } catch (err: any) {
        setStatusMsg(`Error inesperado: ${err.message || 'Verifica el archivo .env.local'}`)
      }
    }
    loadResources()
  }, [])

  useEffect(() => {
    if (!selectedResourceId) return
    async function loadBookings() {
      const { data } = await supabase
        .from('bookings')
        .select('*')
        .eq('resource_id', selectedResourceId)
      if (data) setBookings(data)
    }
    loadBookings()
  }, [selectedResourceId])

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!userName || !bookingDate) {
      setErrorMsg('Por favor completa todos los campos.')
      return
    }

    const start = new Date(`${bookingDate}T${startHour.toString().padStart(2, '0')}:00:00`)
    const end = new Date(`${bookingDate}T${endHour.toString().padStart(2, '0')}:00:00`)

    if (end <= start) {
      setErrorMsg('La hora de fin debe ser posterior a la hora de inicio.')
      return
    }

    const { error } = await supabase.from('bookings').insert([
      {
        resource_id: selectedResourceId,
        user_name: userName,
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
      setUserName('')
      const { data } = await supabase
        .from('bookings')
        .select('*')
        .eq('resource_id', selectedResourceId)
      if (data) setBookings(data)
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

        {/* Banner de Estado / Errores */}
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

        {/* Lista de Reservas Actuales */}
        <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
          <h2 className="text-lg font-bold text-gray-800">Reservas Activas para este recurso</h2>
          {bookings.length === 0 ? (
            <p className="text-sm text-gray-500">No hay reservas registradas aún para este recurso.</p>
          ) : (
            <div className="space-y-2">
              {bookings.map((b) => (
                <div key={b.id} className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex justify-between text-sm">
                  <span className="font-semibold text-blue-900">{b.user_name}</span>
                  <span className="text-blue-700">
                    {new Date(b.start_time).toLocaleDateString('es-ES')} | {' '}
                    {new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {' '}
                    {new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal para Crear Reserva */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
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