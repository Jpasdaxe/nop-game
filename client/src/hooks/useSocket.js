// src/hooks/useSocket.js
import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

let socketInstance = null

export function useSocket() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!socketInstance) {
      socketInstance = io(SERVER_URL, { autoConnect: true })
    }

    socketInstance.on('connect', () => setConnected(true))
    socketInstance.on('disconnect', () => setConnected(false))

    if (socketInstance.connected) setConnected(true)

    return () => {
      socketInstance.off('connect')
      socketInstance.off('disconnect')
    }
  }, [])

  return { socket: socketInstance, connected }
}
