import { fetch } from './uniFetch'

type Fetch = typeof fetch

export const resolveFetch = (customFetch?: Fetch): Fetch => {
  let _fetch: Fetch
  if (customFetch) {
    _fetch = customFetch
  } else if (typeof fetch === 'undefined') {
    _fetch = fetch as unknown as Fetch
  } else {
    _fetch = fetch
  }
  return (...args) => _fetch(...args)
}
