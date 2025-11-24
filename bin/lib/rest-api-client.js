/**
 * Helper function to integrate new auth into existing scripts
 */
const {BullhornAuth} = require('./auth.js');

const apiDefaults = {
  pageSize: 500,
  maxRecordsToReturn: 1000000,
};

// Helper function to check if need query more records
function shouldPullMoreRecords(dataResponse, max) {
  let total = dataResponse.total;
  let start = dataResponse.start;
  const count = dataResponse.count;
  const maxTotal = Math.min(max, apiDefaults.maxRecordsToReturn);

  // Don't pull more if we already have the maximum requested
  if (total >= maxTotal) {
    return false;
  }

  // Handle missing values
  if (start == null) {
    start = 0;
  }
  if (total == null) {
    total = count;
  }

  const nextStart = start + count;

  return nextStart < total && count !== 0 && nextStart < maxTotal;
}

/**
 * Create an authenticated API client
 */
async function createRestApiClient(config) {
  const auth = new BullhornAuth(config);
  await auth.authenticate();

  return {
    auth,
    session: auth.getSession(),

    // Helper method for making any requests
    async fetch(endpoint, options) {
      return auth.makeRequest(endpoint, options);
    },

    // Entity operations
    async getEntity(entityType, entityId, fields) {
      return auth.makeRequest(`entity/${entityType}/${entityId}?fields=${fields}`);
    },

    async insertEntity(entityType, data) {
      return auth.makeRequest(`entity/${entityType}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    async updateEntity(entityType, entityId, data) {
      return auth.makeRequest(`entity/${entityType}/${entityId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async deleteEntity(entityType, entityId) {
      return auth.makeRequest(`entity/${entityType}/${entityId}`, {
        method: 'DELETE',
      });
    },

    async queryAll(entityType, where, fields = 'id', meta = 'off', start = 0, count = apiDefaults.pageSize, orderBy = 'id') {
      const postData = {where, fields, meta, start, count, orderBy, showTotalMatched: true};
      const queryResponse = await auth.makeRequest(`query/${entityType}`, {method: 'POST', body: JSON.stringify(postData)});
      let onePull = typeof queryResponse.json === 'function' ? await queryResponse.json() : queryResponse;

      // If the user provided a count that is small, don't make multiple calls
      while (shouldPullMoreRecords(onePull, apiDefaults.maxRecordsToReturn)) {
        postData.start = onePull.data.length;
        const body = JSON.stringify(postData);
        const nextQueryResponse = await auth.makeRequest(`query/${entityType}`, {method: 'POST', body: body});
        const nextPull = typeof nextQueryResponse.json === 'function' ? await nextQueryResponse.json() : nextQueryResponse;
        nextPull.data.push(...onePull.data);
        Object.assign(onePull, nextPull);
      }

      return onePull;
    }
  }
}

module.exports = {
  createRestApiClient
};
