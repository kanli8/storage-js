import { isStorageError, StorageError } from '../lib/errors'
import { Fetch, get, post, remove } from '../lib/fetch'
import { resolveFetch } from '../lib/helpers'
import {
  FileObject,
  FileOptions,
  SearchOptions,
  FetchParameters,
  TransformOptions,
} from '../lib/types'

declare const wx: any

const DEFAULT_SEARCH_OPTIONS = {
  limit: 100,
  offset: 0,
  sortBy: {
    column: 'name',
    order: 'asc',
  },
}

const DEFAULT_FILE_OPTIONS: FileOptions = {
  cacheControl: '3600',
  contentType: 'text/plain;charset=UTF-8',
  upsert: false,
}

export default class StorageFileApi {
  protected url: string
  protected headers: { [key: string]: string }
  protected bucketId?: string
  protected fetch: Fetch
  protected accessToken: () => Promise<string | null>
  constructor(
    url: string,
    headers: { [key: string]: string } = {},
    accessToken: () => Promise<string | null>,
    bucketId?: string,
    fetch?: Fetch
  ) {
    this.url = url
    this.headers = headers
    this.accessToken = accessToken
    this.bucketId = bucketId
    this.fetch = resolveFetch(fetch)
  }

  /**
   * Uploads a file to an existing bucket or replaces an existing file at the specified path with a new one.
   *
   * @param method HTTP method.
   * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
   * @param fileBody The body of the file to be stored in the bucket.
   */
  private async uploadOrUpdate(
    method: 'POST' | 'PUT',
    path: string,
    fileBody:
      | ArrayBuffer
      | ArrayBufferView
      | Blob
      | Buffer
      | File
      | FormData
      | NodeJS.ReadableStream
      | ReadableStream<Uint8Array>
      | URLSearchParams
      | string,
    fileOptions?: FileOptions
  ): Promise<
    | {
        data: { path: string }
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      let body
      const options = { ...DEFAULT_FILE_OPTIONS, ...fileOptions }
      const headers: Record<string, string> = {
        ...this.headers,
        ...(method === 'POST' && { 'x-upsert': String(options.upsert as boolean) }),
      }

      if (typeof Blob !== 'undefined' && fileBody instanceof Blob) {
        body = new FormData()
        body.append('cacheControl', options.cacheControl as string)
        body.append('', fileBody)
      } else if (typeof FormData !== 'undefined' && fileBody instanceof FormData) {
        body = fileBody
        body.append('cacheControl', options.cacheControl as string)
      } else {
        //
        body = fileBody
        headers['cache-control'] = `max-age=${options.cacheControl}`
        headers['content-type'] = options.contentType as string
        return this.uploadFromWechat(path, body as string)
      }

      const cleanPath = this._removeEmptyFolders(path)
      const _path = this._getFinalPath(cleanPath)
      const res = await this.fetch(`${this.url}/object/${_path}`, {
        method,
        body: body as BodyInit,
        headers,
      })

      if (res.ok) {
        return {
          data: { path: cleanPath },
          error: null,
        }
      } else {
        const error = await res.json()
        return { data: null, error }
      }
    } catch (error) {
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Uploads a file to an existing bucket.
   *
   * @param path The file path, including the file name. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
   * @param fileBody The body of the file to be stored in the bucket.
   */
  async upload(
    path: string,
    fileBody:
      | ArrayBuffer
      | ArrayBufferView
      | Blob
      | Buffer
      | File
      | FormData
      | NodeJS.ReadableStream
      | ReadableStream<Uint8Array>
      | URLSearchParams
      | string,
    fileOptions?: FileOptions
  ): Promise<
    | {
        data: { path: string }
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    return this.uploadOrUpdate('POST', path, fileBody, fileOptions)
  }

  /**
   * Replaces an existing file at the specified path with a new one.
   *
   * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to update.
   * @param fileBody The body of the file to be stored in the bucket.
   */
  async update(
    path: string,
    fileBody:
      | ArrayBuffer
      | ArrayBufferView
      | Blob
      | Buffer
      | File
      | FormData
      | NodeJS.ReadableStream
      | ReadableStream<Uint8Array>
      | URLSearchParams
      | string,
    fileOptions?: FileOptions
  ): Promise<
    | {
        data: { path: string }
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    return this.uploadOrUpdate('PUT', path, fileBody, fileOptions)
  }

  /**
   * Moves an existing file to a new path in the same bucket.
   *
   * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
   * @param toPath The new file path, including the new file name. For example `folder/image-new.png`.
   */
  async move(
    fromPath: string,
    toPath: string
  ): Promise<
    | {
        data: { message: string }
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await post(
        this.fetch,
        `${this.url}/object/move`,
        { bucketId: this.bucketId, sourceKey: fromPath, destinationKey: toPath },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Copies an existing file to a new path in the same bucket.
   *
   * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
   * @param toPath The new file path, including the new file name. For example `folder/image-copy.png`.
   */
  async copy(
    fromPath: string,
    toPath: string
  ): Promise<
    | {
        data: { path: string }
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await post(
        this.fetch,
        `${this.url}/object/copy`,
        { bucketId: this.bucketId, sourceKey: fromPath, destinationKey: toPath },
        { headers: this.headers }
      )
      return { data: { path: data.Key }, error: null }
    } catch (error) {
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Creates a signed URL. Use a signed URL to share a file for a fixed amount of time.
   *
   * @param path The file path, including the current file name. For example `folder/image.png`.
   * @param expiresIn The number of seconds until the signed URL expires. For example, `60` for a URL which is valid for one minute.
   * @param options.download triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
   * @param options.transform Transform the asset before serving it to the client.
   */
  async createSignedUrl(
    path: string,
    expiresIn: number,
    options?: { download?: string | boolean; transform?: TransformOptions }
  ): Promise<
    | {
        data: { signedUrl: string }
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      let _path = this._getFinalPath(path)

      let data = await post(
        this.fetch,
        `${this.url}/object/sign/${_path}`,
        { expiresIn, ...(options?.transform ? { transform: options.transform } : {}) },
        { headers: this.headers }
      )
      const downloadQueryParam = options?.download
        ? `&download=${options.download === true ? '' : options.download}`
        : ''
      const signedUrl = encodeURI(`${this.url}${data.signedURL}${downloadQueryParam}`)
      data = { signedUrl }
      return { data, error: null }
    } catch (error) {
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Creates multiple signed URLs. Use a signed URL to share a file for a fixed amount of time.
   *
   * @param paths The file paths to be downloaded, including the current file names. For example `['folder/image.png', 'folder2/image2.png']`.
   * @param expiresIn The number of seconds until the signed URLs expire. For example, `60` for URLs which are valid for one minute.
   * @param options.download triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
   */
  async createSignedUrls(
    paths: string[],
    expiresIn: number,
    options?: { download: string | boolean }
  ): Promise<
    | {
        data: { error: string | null; path: string | null; signedUrl: string }[]
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await post(
        this.fetch,
        `${this.url}/object/sign/${this.bucketId}`,
        { expiresIn, paths },
        { headers: this.headers }
      )

      const downloadQueryParam = options?.download
        ? `&download=${options.download === true ? '' : options.download}`
        : ''
      return {
        data: data.map((datum: { signedURL: string }) => ({
          ...datum,
          signedUrl: datum.signedURL
            ? encodeURI(`${this.url}${datum.signedURL}${downloadQueryParam}`)
            : null,
        })),
        error: null,
      }
    } catch (error) {
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  async uploadFromWechat(
    path: string,
    body: string
  ): Promise<
    | {
        data: { path: string }
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    const options = { ...DEFAULT_FILE_OPTIONS }
    const headers: Record<string, string> = {
      ...this.headers,
      ...{ method: 'POST' },
      ...{ 'x-upsert': String(options.upsert as boolean) },
    }

    headers['cache-control'] = `max-age=${options.cacheControl}`
    headers['content-type'] = options.contentType as string

    const token = (await this.accessToken()) ?? null
    if (token == null) {
    } else {
      headers['Authorization'] = `Bearer ${token}`
    }

    const cleanPath = this._removeEmptyFolders(path)
    const _path = this._getFinalPath(cleanPath)
    return new Promise((resolve, reject) => {
      // wx.uploadFile({
      //   url: 'http://192.168.0.70:8000/storage/v1/object/test2/public/test112.png', //仅为示例，非真实的接口地址
      //   filePath: avatarFile,
      //   name: 'file',
      //      header: {
      //         'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
      //         'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE'
      //       },
      //   success (res){
      //     const data = res.data
      //     //do something
      // console.log(data) ;
      //   }
      // }) ;
      wx.uploadFile({
        url: `${this.url}/object/${_path}`,
        filePath: body,
        name: 'file',
        header: headers,
        success: (res: any) => {
          if (res.statusCode === 200) {
            resolve({
              data: { path: _path },
              error: null,
            })
          }
        },
        fail: (err: any) => {
          reject({
            data: null,
            error: err,
          })
        },
      })
    })
  }

  /**
   * Downloads a file from a private bucket. For public buckets, make a request to the URL returned from `getPublicUrl` instead.
   *
   * @param path The full path and file name of the file to be downloaded. For example `folder/image.png`.
   * @param options.transform Transform the asset before serving it to the client.
   *
   * wx ,only download image
   */
  async download(
    path: string,
    options?: { transform?: TransformOptions }
  ): Promise<
    | {
        tempUrl: string
        error: null
      }
    | {
        tempUrl: null
        error: StorageError
      }
  > {
    const wantsTransformation = typeof options?.transform !== 'undefined'
    const renderPath = wantsTransformation ? 'render/image/authenticated' : 'object'
    const _path = this._getFinalPath(path)
    const transformationQuery = this.transformOptsToQueryString(options?.transform || {})
    const queryString = transformationQuery ? `?${transformationQuery}` : ''

    let header: { [key: string]: string } = {}
    const token = (await this.accessToken()) ?? null
    if (token == null) {
      header = this.headers
    } else {
      header = { ...this.headers, Authorization: `Bearer ${token}` }
    }
    return new Promise((resolve, reject) => {
      wx.downloadFile({
        url: `${this.url}/${renderPath}/${_path}${queryString}`,
        header: header,
        success: (res: any) => {
          if (res.statusCode === 200) {
            resolve({
              tempUrl: res.tempFilePath,
              error: null,
            })

            // this.setData({
            //   imgSrc: res.tempFilePath // 将下载后的图片路径存储在数据中
            // });
          }
        },
        fail: (err: any) => {
          reject({
            tempUrl: null,
            error: err,
          })
        },
      })
    })
  }

  /**
   * A simple convenience function to get the URL for an asset in a public bucket. If you do not want to use this function, you can construct the public URL by concatenating the bucket URL with the path to the asset.
   * This function does not verify if the bucket is public. If a public URL is created for a bucket which is not public, you will not be able to download the asset.
   *
   * @param path The path and name of the file to generate the public URL for. For example `folder/image.png`.
   * @param options.download Triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
   * @param options.transform Transform the asset before serving it to the client.
   */
  getPublicUrl(
    path: string,
    options?: { download?: string | boolean; transform?: TransformOptions }
  ): { data: { publicUrl: string } } {
    const _path = this._getFinalPath(path)
    const _queryString = []

    const downloadQueryParam = options?.download
      ? `download=${options.download === true ? '' : options.download}`
      : ''

    if (downloadQueryParam !== '') {
      _queryString.push(downloadQueryParam)
    }

    const wantsTransformation = typeof options?.transform !== 'undefined'
    const renderPath = wantsTransformation ? 'render/image' : 'object'
    const transformationQuery = this.transformOptsToQueryString(options?.transform || {})

    if (transformationQuery !== '') {
      _queryString.push(transformationQuery)
    }

    let queryString = _queryString.join('&')
    if (queryString !== '') {
      queryString = `?${queryString}`
    }

    return {
      data: { publicUrl: encodeURI(`${this.url}/${renderPath}/public/${_path}${queryString}`) },
    }
  }

  /**
   * Deletes files within the same bucket
   *
   * @param paths An array of files to delete, including the path and file name. For example [`'folder/image.png'`].
   */
  async remove(paths: string[]): Promise<
    | {
        data: FileObject[]
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await remove(
        this.fetch,
        `${this.url}/object/${this.bucketId}`,
        { prefixes: paths },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Get file metadata
   * @param id the file id to retrieve metadata
   */
  // async getMetadata(
  //   id: string
  // ): Promise<
  //   | {
  //       data: Metadata
  //       error: null
  //     }
  //   | {
  //       data: null
  //       error: StorageError
  //     }
  // > {
  //   try {
  //     const data = await get(this.fetch, `${this.url}/metadata/${id}`, { headers: this.headers })
  //     return { data, error: null }
  //   } catch (error) {
  //     if (isStorageError(error)) {
  //       return { data: null, error }
  //     }

  //     throw error
  //   }
  // }

  /**
   * Update file metadata
   * @param id the file id to update metadata
   * @param meta the new file metadata
   */
  // async updateMetadata(
  //   id: string,
  //   meta: Metadata
  // ): Promise<
  //   | {
  //       data: Metadata
  //       error: null
  //     }
  //   | {
  //       data: null
  //       error: StorageError
  //     }
  // > {
  //   try {
  //     const data = await post(
  //       this.fetch,
  //       `${this.url}/metadata/${id}`,
  //       { ...meta },
  //       { headers: this.headers }
  //     )
  //     return { data, error: null }
  //   } catch (error) {
  //     if (isStorageError(error)) {
  //       return { data: null, error }
  //     }

  //     throw error
  //   }
  // }

  /**
   * Lists all the files within a bucket.
   * @param path The folder path.
   */
  async list(
    path?: string,
    options?: SearchOptions,
    parameters?: FetchParameters
  ): Promise<
    | {
        data: FileObject[]
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const body = { ...DEFAULT_SEARCH_OPTIONS, ...options, prefix: path || '' }
      const data = await post(
        this.fetch,
        `${this.url}/object/list/${this.bucketId}`,
        body,
        { headers: this.headers },
        parameters
      )
      return { data, error: null }
    } catch (error) {
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  private _getFinalPath(path: string) {
    return `${this.bucketId}/${path}`
  }

  private _removeEmptyFolders(path: string) {
    return path.replace(/^\/|\/$/g, '').replace(/\/+/g, '/')
  }

  private transformOptsToQueryString(transform: TransformOptions) {
    const params = []
    if (transform.width) {
      params.push(`width=${transform.width}`)
    }

    if (transform.height) {
      params.push(`height=${transform.height}`)
    }

    if (transform.resize) {
      params.push(`resize=${transform.resize}`)
    }

    if (transform.format) {
      params.push(`format=${transform.format}`)
    }

    if (transform.quality) {
      params.push(`quality=${transform.quality}`)
    }

    return params.join('&')
  }
}
