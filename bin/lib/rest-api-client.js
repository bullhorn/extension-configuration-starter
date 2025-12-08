const { BullhornAuth } = require('./auth');

const DEFAULT_PAGE_SIZE = 500;
const MAX_RECORDS_TO_RETURN = 1000000;

const apiDefaults = {
  pageSize: DEFAULT_PAGE_SIZE,
  maxRecordsToReturn: MAX_RECORDS_TO_RETURN,
};

class RestApiClient {
  constructor(_auth) {
    this.auth = _auth;
    this.session = _auth.getSession();
    this.apiDefaults = apiDefaults;
  }

  shouldPullMoreRecords(dataResponse, max) {
    let total = dataResponse.total;
    let start = dataResponse.start;
    const count = dataResponse.count;
    const maxTotal = Math.min(max, this.apiDefaults.maxRecordsToReturn);

    if (total >= maxTotal) {
      return false;
    }

    if (start === null || start === undefined) {
      start = 0;
    }
    if (total === null || total === undefined) {
      total = count;
    }

    const nextStart = start + count;

    return nextStart < total && count !== 0 && nextStart < maxTotal;
  }

  async fetch(endpoint, options) {
    return this.auth.makeRequest(endpoint, options);
  }

  async getEntity(entityType, entityId, fields) {
    return this.auth.makeRequest(`entity/${entityType}/${entityId}?fields=${fields}`);
  }

  async insertEntity(entityType, data) {
    return this.auth.makeRequest(`entity/${entityType}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateEntity(entityType, entityId, data) {
    return this.auth.makeRequest(`entity/${entityType}/${entityId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteEntity(entityType, entityId) {
    return this.auth.makeRequest(`entity/${entityType}/${entityId}`, {
      method: 'DELETE',
    });
  }

  async queryAll(entityType, where, fields = 'id', meta = 'off', start = 0, count = apiDefaults.pageSize, orderBy = 'id') {
    const postData = {
      where: where, fields: fields, meta: meta, start: start, count: count, orderBy: orderBy, showTotalMatched: true,
    };
    const queryResponse = await this.auth.makeRequest(`query/${entityType}`, { method: 'POST', body: JSON.stringify(postData) });
    const onePull = typeof queryResponse.json === 'function' ? await queryResponse.json() : queryResponse;

    while (this.shouldPullMoreRecords(onePull, this.apiDefaults.maxRecordsToReturn)) {
      postData.start = onePull.data.length;
      const body = JSON.stringify(postData);
      /* eslint-disable no-await-in-loop */
      const nextQueryResponse = await this.auth.makeRequest(`query/${entityType}`, { method: 'POST', body: body });
      const nextPull = typeof nextQueryResponse.json === 'function' ? await nextQueryResponse.json() : nextQueryResponse;
      /* eslint-enable no-await-in-loop */
      onePull.data.push(...nextPull.data);
      onePull.start = nextPull.start;
      onePull.count = nextPull.count;
      onePull.total = nextPull.total;
    }

    return onePull;
  }
}

async function createRestApiClient(config) {
  const auth = new BullhornAuth(config);
  const session = await auth.authenticate();

  if (!session) {
    return null;
  }

  return new RestApiClient(auth);
}

module.exports = {
  RestApiClient,
  createRestApiClient,
};
