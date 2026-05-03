import Fastify from 'fastify'
import fastifyWebsocket from '@fastify/websocket'
import fastifyCors from '@fastify/cors'
import { clusterRoutes } from './routes/cluster.js'
import { resourceRoutes } from './routes/resources.js'
import { registerWsRoute, broadcastWatchEvent } from './ws/handler.js'
import { watchResource } from './k8s/watcher.js'

const PORT = parseInt(process.env.PORT || '3001', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'

const fastify = Fastify({ logger: { level: LOG_LEVEL } })

await fastify.register(fastifyCors, { origin: CORS_ORIGIN })
await fastify.register(fastifyWebsocket)

await fastify.register(clusterRoutes)
await fastify.register(resourceRoutes)
registerWsRoute(fastify)

const watchTargets = [
  { path: '/api/v1/pods',              resource: 'pod' },
  { path: '/api/v1/nodes',             resource: 'node' },
  { path: '/api/v1/services',          resource: 'service' },
  { path: '/apis/apps/v1/deployments', resource: 'deployment' },
]

for (const { path, resource } of watchTargets) {
  watchResource(path, (phase, obj) => broadcastWatchEvent(phase, resource, obj))
    .catch(err => fastify.log.warn(err, `Watch init failed for ${path}`))
}

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
