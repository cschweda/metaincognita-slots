// app/composables/useSimWorker.ts
import { ref, shallowRef, onScopeDispose } from 'vue'
import type { SimLabOptions, SimLabResult } from '~/engine/sessions'
import type { SimWorkerOutgoing } from '~/workers/sim-worker-protocol'

export type SimRunParams = Omit<SimLabOptions, 'machineId'> & { machineId: string }

export function useSimWorker() {
  const running = ref(false)
  const progress = ref(0) // 0..1
  const completed = ref(0)
  const total = ref(0)
  const result = shallowRef<SimLabResult | null>(null)
  const error = ref<string | null>(null)
  let worker: Worker | null = null

  function terminate(): void {
    if (worker) {
      worker.terminate()
      worker = null
    }
  }

  function run(params: SimRunParams): void {
    terminate()
    error.value = null
    result.value = null
    completed.value = 0
    total.value = params.sessions
    progress.value = 0
    running.value = true

    worker = new Worker(new URL('../workers/sim.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<SimWorkerOutgoing>): void => {
      const m = e.data
      if (m.type === 'progress') {
        completed.value = m.completed
        total.value = m.total
        progress.value = m.total > 0 ? m.completed / m.total : 0
      } else if (m.type === 'done' || m.type === 'cancelled') {
        result.value = m.result
        running.value = false
        progress.value = 1
        terminate()
      } else if (m.type === 'error') {
        error.value = m.message
        running.value = false
        terminate()
      }
    }
    worker.onerror = (e: ErrorEvent): void => {
      error.value = e.message || 'worker error'
      running.value = false
      terminate()
    }

    const { machineId, ...opts } = params
    worker.postMessage({ type: 'run', machineId, opts })
  }

  function cancel(): void {
    if (worker && running.value) worker.postMessage({ type: 'cancel' })
  }

  onScopeDispose(terminate)
  return { running, progress, completed, total, result, error, run, cancel }
}
