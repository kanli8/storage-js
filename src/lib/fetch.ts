import { StorageApiError, StorageUnknownError } from './errors'
import { FetchParameters } from './types'
import { fetch } from './uniFetch'

export type Fetch = typeof fetch

export interface FetchOptions {
  headers?: {
    [key: string]: string
  }
  noResolveJson?: boolean
}

export type RequestMethodType = 'GET' | 'POST' | 'PUT' | 'DELETE'

const _getErrorMessage = (err: any): string =>
  err.msg || err.message || err.error_description || err.error || JSON.stringify(err)

const _getRequestParams = (
  method: RequestMethodType,
  options?: FetchOptions,
  parameters?: FetchParameters,
  body?: object
) => {
  const params: { [k: string]: any } = { method, headers: options?.headers || {} }

  if (method === 'GET') {
    return params
  }

  params.headers = { 'Content-Type': 'application/json', ...options?.headers }
  params.body = JSON.stringify(body)
  return { ...params, ...parameters }
}

async function _handleRequest(
  fetcher: Fetch,
  method: RequestMethodType,
  url: string,
  options?: FetchOptions,
  parameters?: FetchParameters,
  body?: object
): Promise<any> {
  return new Promise((resolve, reject) => {
    fetcher(url, _getRequestParams(method, options, parameters, body))
      .then((res: any) => {
        // console.log('storage----fetch-----res = ', res)
        const data = res.data
        if (!data.error) {
          // console.log('storage----fetch-----data = ', data)
          resolve(data)
        } else {
          let error = data
          error.statusCode = res.statusCode
          // console.log('storage----fetch-----error = ', error)
          reject(new StorageApiError(_getErrorMessage(error), error.statusCode || 500))
        }
      })
      .catch((error) => {
        // console.log('storage----fetch-----catch error = ', error)
        reject(new StorageUnknownError(_getErrorMessage(error), error))
      })
  })
}

export async function get(
  fetcher: Fetch,
  url: string,
  options?: FetchOptions,
  parameters?: FetchParameters
): Promise<any> {
  return _handleRequest(fetcher, 'GET', url, options, parameters)
}

export async function post(
  fetcher: Fetch,
  url: string,
  body: object,
  options?: FetchOptions,
  parameters?: FetchParameters
): Promise<any> {
  return _handleRequest(fetcher, 'POST', url, options, parameters, body)
}

export async function put(
  fetcher: Fetch,
  url: string,
  body: object,
  options?: FetchOptions,
  parameters?: FetchParameters
): Promise<any> {
  return _handleRequest(fetcher, 'PUT', url, options, parameters, body)
}

export async function remove(
  fetcher: Fetch,
  url: string,
  body: object,
  options?: FetchOptions,
  parameters?: FetchParameters
): Promise<any> {
  return _handleRequest(fetcher, 'DELETE', url, options, parameters, body)
}
