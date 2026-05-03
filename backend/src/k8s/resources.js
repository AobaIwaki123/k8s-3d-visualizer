import { coreV1Api, appsV1Api, networkingV1Api } from './client.js'

function items(res) {
  return (res.body || res).items || []
}

export function formatPod(p) {
  const owner = p.metadata.ownerReferences?.[0] || {}
  const phase = p.metadata.deletionTimestamp ? 'Terminating' : (p.status?.phase || 'Unknown')
  return {
    name: p.metadata.name,
    namespace: p.metadata.namespace,
    nodeName: p.spec?.nodeName || '',
    phase,
    ip: p.status?.podIP || '',
    images: p.spec?.containers?.map(c => c.image) || [],
    labels: p.metadata.labels || {},
    owner: { kind: owner.kind || '', name: owner.name || '' },
    restartCount: p.status?.containerStatuses?.reduce((acc, s) => acc + (s.restartCount || 0), 0) || 0,
    createdAt: p.metadata.creationTimestamp || '',
  }
}

export function formatNode(n) {
  return {
    name: n.metadata.name,
    status: n.status?.conditions?.find(c => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady',
    ip: n.status?.addresses?.find(a => a.type === 'InternalIP')?.address || '',
    cpu: n.status?.capacity?.cpu || '',
    memory: n.status?.capacity?.memory || '',
    labels: n.metadata.labels || {},
    capacity: n.status?.capacity || {},
    allocatable: n.status?.allocatable || {},
  }
}

export function formatService(s) {
  return {
    name: s.metadata.name,
    namespace: s.metadata.namespace,
    type: s.spec?.type || 'ClusterIP',
    clusterIP: s.spec?.clusterIP || '',
    selector: s.spec?.selector || {},
    ports: s.spec?.ports?.map(p => ({ port: p.port, targetPort: p.targetPort, protocol: p.protocol })) || [],
  }
}

export function formatDeployment(d) {
  return {
    name: d.metadata.name,
    namespace: d.metadata.namespace,
    replicas: d.spec?.replicas || 0,
    readyReplicas: d.status?.readyReplicas || 0,
    selector: d.spec?.selector?.matchLabels || {},
  }
}

export function formatIngress(i) {
  return {
    name: i.metadata.name,
    namespace: i.metadata.namespace,
    class: i.spec?.ingressClassName || i.metadata.annotations?.['kubernetes.io/ingress.class'] || '',
    hosts: i.spec?.rules?.map(r => ({
      host: r.host || '',
      paths: r.http?.paths?.map(p => ({
        path: p.path || '/',
        serviceName: p.backend?.service?.name || p.backend?.serviceName || '',
      })) || [],
    })) || [],
  }
}

function computeServiceToPods(services, pods) {
  return services.map(svc => {
    if (!svc.selector || Object.keys(svc.selector).length === 0) {
      return { name: svc.name, namespace: svc.namespace, pods: [] }
    }
    const matched = pods
      .filter(p => {
        if (p.namespace !== svc.namespace) return false
        return Object.entries(svc.selector).every(([k, v]) => p.labels?.[k] === v)
      })
      .map(p => p.name)
    return { name: svc.name, namespace: svc.namespace, pods: matched }
  })
}

export async function getClusterState() {
  const [podsRes, nodesRes, servicesRes, namespacesRes, deploymentsRes] = await Promise.all([
    coreV1Api.listPodForAllNamespaces(),
    coreV1Api.listNode(),
    coreV1Api.listServiceForAllNamespaces(),
    coreV1Api.listNamespace(),
    appsV1Api.listDeploymentForAllNamespaces(),
  ])

  let ingressItems = []
  try {
    const ingressRes = await networkingV1Api.listIngressForAllNamespaces()
    ingressItems = items(ingressRes)
  } catch (e) {
    console.warn('Could not fetch ingresses:', e.message)
  }

  const pods = items(podsRes).map(formatPod)
  const nodes = items(nodesRes).map(formatNode)
  const services = items(servicesRes).map(formatService)
  const namespaces = items(namespacesRes).map(n => n.metadata.name)
  const deployments = items(deploymentsRes).map(formatDeployment)
  const ingresses = ingressItems.map(formatIngress)

  return {
    nodes,
    namespaces,
    pods,
    services,
    deployments,
    ingresses,
    relationships: { serviceToPods: computeServiceToPods(services, pods) },
  }
}

export async function getPodDetail(namespace, name) {
  const res = await coreV1Api.readNamespacedPod(name, namespace)
  const p = res.body || res
  const owner = p.metadata.ownerReferences?.[0] || {}
  const phase = p.metadata.deletionTimestamp ? 'Terminating' : (p.status?.phase || 'Unknown')
  return {
    name: p.metadata.name,
    namespace: p.metadata.namespace,
    nodeName: p.spec?.nodeName || '',
    phase,
    ip: p.status?.podIP || '',
    images: p.spec?.containers?.map(c => c.image) || [],
    labels: p.metadata.labels || {},
    annotations: p.metadata.annotations || {},
    owner: { kind: owner.kind || '', name: owner.name || '' },
    conditions: p.status?.conditions?.map(c => ({ type: c.type, status: c.status })) || [],
    containerStatuses: p.status?.containerStatuses?.map(s => ({
      name: s.name,
      ready: s.ready,
      restartCount: s.restartCount,
      image: s.image,
    })) || [],
    createdAt: p.metadata.creationTimestamp || '',
  }
}

export async function getNodeDetail(name) {
  const res = await coreV1Api.readNode(name)
  const n = res.body || res
  return {
    name: n.metadata.name,
    status: n.status?.conditions?.find(c => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady',
    ip: n.status?.addresses?.find(a => a.type === 'InternalIP')?.address || '',
    cpu: n.status?.capacity?.cpu || '',
    memory: n.status?.capacity?.memory || '',
    kubeletVersion: n.status?.nodeInfo?.kubeletVersion || '',
    os: n.status?.nodeInfo?.operatingSystem || '',
    arch: n.status?.nodeInfo?.architecture || '',
    labels: n.metadata.labels || {},
    conditions: n.status?.conditions?.map(c => ({ type: c.type, status: c.status })) || [],
  }
}
