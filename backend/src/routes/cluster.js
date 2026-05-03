import { getClusterState } from '../k8s/resources.js'

export async function clusterRoutes(fastify) {
  fastify.get('/api/cluster', async (req, reply) => {
    try {
      const state = await getClusterState()
      return state
    } catch (err) {
      fastify.log.error(err)
      reply.code(500).send({ error: err.message })
    }
  })

  fastify.get('/health', async () => ({ status: 'ok' }))
}
