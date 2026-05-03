import * as k8s from '@kubernetes/client-node'

const kc = new k8s.KubeConfig()

if (process.env.KUBERNETES_SERVICE_HOST) {
  kc.loadFromCluster()
} else {
  kc.loadFromDefault()
}

export const coreV1Api = kc.makeApiClient(k8s.CoreV1Api)
export const appsV1Api = kc.makeApiClient(k8s.AppsV1Api)
export const networkingV1Api = kc.makeApiClient(k8s.NetworkingV1Api)
export const watch = new k8s.Watch(kc)
