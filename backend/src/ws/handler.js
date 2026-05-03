import { getClusterState, formatPod, formatNode, formatService, formatDeployment } from '../k8s/resources.js'

const clients = new Set()

const formatters = {
  pod: formatPod,
  node: formatNode,
  service: formatService,
  deployment: formatDeployment,
}

export function registerWsRoute(fastify) {
  fastify.get('/ws', { websocket: true }, async (socket) => {
    clients.add(socket)

    try {
      const state = await getClusterState()
      socket.send(JSON.stringify({ type: 'INIT', payload: state }))
    } catch (err) {
      fastify.log.error(err, 'Failed to send INIT')
      socket.send(JSON.stringify({ type: 'ERROR', message: err.message }))
    }

    socket.on('close', () => clients.delete(socket))
    socket.on('error', () => clients.delete(socket))
  })
}

export function broadcastWatchEvent(phase, resource, obj) {
  const fmt = formatters[resource]
  if (!fmt) return

  const msg = JSON.stringify({
    type: phase,     // 'ADDED' | 'MODIFIED' | 'DELETED'
    resource,
    payload: fmt(obj),
  })

  clients.forEach(c => {
    if (c.readyState === 1) c.send(msg)
  })
}
