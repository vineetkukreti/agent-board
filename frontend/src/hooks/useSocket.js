import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import { SOCKET_URL } from '../config'

let socket = null

function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    })
  }
  return socket
}

export default function useSocket() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const s = getSocket()

    s.on('agent.updated', () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    })

    s.on('ticket.created', () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    })

    s.on('ticket.updated', () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    })

    s.on('session.started', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    })

    s.on('session.ended', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    })

    return () => {
      s.off('agent.updated')
      s.off('ticket.created')
      s.off('ticket.updated')
      s.off('session.started')
      s.off('session.ended')
    }
  }, [queryClient])
}
