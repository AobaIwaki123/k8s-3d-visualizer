import { getPodDetail, getNodeDetail } from '../k8s/resources.js'

export async function resourceRoutes(fastify) {
  fastify.get('/api/pod/:namespace/:name', async (req, reply) => {
    const { namespace, name } = req.params
    try {
      return await getPodDetail(namespace, name)
    } catch (err) {
      fastify.log.error(err)
      reply.code(err.statusCode || 500).send({ error: err.message })
    }
  })

  fastify.get('/api/node/:name', async (req, reply) => {
    const { name } = req.params
    try {
      return await getNodeDetail(name)
    } catch (err) {
      fastify.log.error(err)
      reply.code(err.statusCode || 500).send({ error: err.message })
    }
  })
}
