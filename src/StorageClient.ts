import StorageFileApi from './packages/StorageFileApi'
import StorageBucketApi from './packages/StorageBucketApi'
import { Fetch } from './lib/fetch'

export class StorageClient extends StorageBucketApi {
  _accessToken: () => Promise<string | null>
  constructor(
    url: string,
    headers: { [key: string]: string } = {},
    getAccessToken: () => Promise<string | null>,
    fetch?: Fetch
  ) {
    super(url, headers, fetch)
    this._accessToken = getAccessToken
  }

  /**
   * Perform file operation in a bucket.
   *
   * @param id The bucket id to operate on.
   */
  from(id: string): StorageFileApi {
    return new StorageFileApi(this.url, this.headers, this.getAccessToken, id, this.fetch)
  }

  get getAccessToken(): () => Promise<string | null> {
    return this._accessToken
  }
}
