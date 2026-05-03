import { watch } from './client.js'

export async function watchResource(path, onEvent) {
  try {
    await watch.watch(
      path,
      {},
      (phase, obj) => {
        if (phase === 'ADDED' || phase === 'MODIFIED' || phase === 'DELETED') {
          onEvent(phase, obj)
        }
      },
      (err) => {
        if (err) console.error(`Watch error on ${path}:`, err.message)
        setTimeout(() => watchResource(path, onEvent), 5000)
      }
    )
  } catch (err) {
    console.error(`Failed to start watch on ${path}:`, err.message)
    setTimeout(() => watchResource(path, onEvent), 5000)
  }
}
