/**
 * A promise whose settlement the test controls, so overlapping requests can be resolved
 * in a chosen order. Timers would only make the race likely, not deterministic.
 */
export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (cause: unknown) => void
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
