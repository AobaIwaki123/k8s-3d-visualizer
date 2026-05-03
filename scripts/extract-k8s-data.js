const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Executes a kubectl command and returns the parsed JSON output.
 */
function getK8sData(resource) {
  try {
    const output = execSync(`kubectl get ${resource} -A -o json`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 50 });
    return JSON.parse(output).items;
  } catch (err) {
    console.error(`Error fetching ${resource}:`, err.message);
    return [];
  }
}

/**
 * Main extraction and transformation logic
 */
function extract() {
  console.log('Fetching data from Kubernetes...');

  const rawNodes = getK8sData('nodes');
  const rawPods = getK8sData('pods');
  const rawServices = getK8sData('services');
  const rawIngresses = getK8sData('ingress');

  console.log(`Processing: ${rawNodes.length} nodes, ${rawPods.length} pods, ${rawServices.length} services, ${rawIngresses.length} ingresses`);

  // 1. Process Nodes
  const nodes = rawNodes.map(n => ({
    name: n.metadata.name,
    labels: n.metadata.labels,
    status: n.status.conditions.find(c => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady',
    capacity: n.status.capacity,
    allocatable: n.status.allocatable
  }));

  // 2. Process Pods
  const pods = rawPods.map(p => {
    const owner = p.metadata.ownerReferences?.[0] || {};
    return {
      name: p.metadata.name,
      namespace: p.metadata.namespace,
      nodeName: p.spec.nodeName,
      phase: p.status.phase,
      labels: p.metadata.labels,
      owner: { kind: owner.kind, name: owner.name },
      restartCount: p.status.containerStatuses?.reduce((acc, s) => acc + s.restartCount, 0) || 0,
      createdAt: p.metadata.creationTimestamp,
      ip: p.status.podIP || '',
      images: p.spec.containers?.map(c => c.image) || [],
      // Heuristic for "roles"
      isMonitoring: p.metadata.namespace.includes('monitoring') ||
                   /prometheus|loki|grafana|beyla/.test(p.metadata.name),
      isIngress: /cloudflare|tunnel|ingress/.test(p.metadata.name)
    };
  });

  // 3. Process Services
  const services = rawServices.map(s => ({
    name: s.metadata.name,
    namespace: s.metadata.namespace,
    type: s.spec.type,
    clusterIP: s.spec.clusterIP,
    selector: s.spec.selector || {},
    ports: s.spec.ports?.map(p => ({ port: p.port, targetPort: p.targetPort, protocol: p.protocol }))
  }));

  // 4. Process Ingresses (especially for Cloudflare)
  const ingresses = rawIngresses.map(i => ({
    name: i.metadata.name,
    namespace: i.metadata.namespace,
    class: i.spec.ingressClassName || i.metadata.annotations?.['kubernetes.io/ingress.class'],
    hosts: i.spec.rules?.map(r => ({
      host: r.host,
      paths: r.http?.paths.map(p => ({
        path: p.path,
        serviceName: p.backend?.service?.name || p.backend?.serviceName
      }))
    }))
  }));

  // 5. Build Relationships
  // Map Service -> Pods (via selector)
  const serviceToPods = services.map(svc => {
    if (!svc.selector || Object.keys(svc.selector).length === 0) return { name: svc.name, pods: [] };
    const matchedPods = pods.filter(p => {
      if (p.namespace !== svc.namespace) return false;
      return Object.entries(svc.selector).every(([k, v]) => p.labels?.[k] === v);
    }).map(p => p.name);
    return { name: svc.name, namespace: svc.namespace, pods: matchedPods };
  });

  const clusterState = {
    timestamp: new Date().toISOString(),
    nodes,
    pods,
    services,
    ingresses,
    relationships: {
      serviceToPods
    }
  };

  const outputPath = path.join(__dirname, '../frontend/public/cluster-state.json');
  fs.writeFileSync(outputPath, JSON.stringify(clusterState, null, 2));
  console.log(`Success! Data saved to ${outputPath}`);
}

extract();
