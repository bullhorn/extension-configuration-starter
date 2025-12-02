const chalk = require('chalk');
const logger = require('./lib/logger');
const resultsSvc = require('./results-service');

/**
 * CRUD service for managing page interactions in Bullhorn
 */
class PageInteractionsCrudService {
  /**
   * Creates an instance of PageInteractionsCrudService
   * @param {Object} _restApiClient - REST API client for Bullhorn
   */
  constructor(_restApiClient) {
    this.apiClient = _restApiClient;
    this.logger = logger;
    this.resultsSvc = resultsSvc;
  }

  /**
   * Fetches page interaction data from Bullhorn API
   * @param {string} entityType - Entity type to query
   * @param {string} where - WHERE clause for query
   * @param {string} fields - Comma-separated list of fields to retrieve
   * @returns {Promise<Object>} Query result data
   */
  fetchPageInteractionData(entityType, where, fields) {
    return this.apiClient.queryAll(entityType, where, fields)
      .then((result) => {
        this.logger.piData(`Query ${entityType}: where: ${where}, fields: ${fields}`);
        this.logger.piData(`Query ${entityType} response: ${JSON.stringify(result)}`);

        return Promise.resolve(result);
      }).catch((error) => {
        this.logger.error(chalk.red(error));
      });
  }

  /**
   * Fetches multiple page interactions based on selective actions configuration
   * @param {Object} selectivePIActions - Object mapping actions to page interaction names
   * @returns {Promise<Array>} Flattened array of page interaction data
   */
  getPageInteractions(selectivePIActions) {
    const promiseList = [];

    Object.entries(selectivePIActions).forEach(([ piKey, piVal ]) => {
      const where = `(action = '${piKey}' AND name in ('${piVal.join('\', \'')}'))`;
      const fields = 'id,name,action';

      promiseList.push(this.fetchPageInteractionData('PageInteraction', where, fields));
    });

    return Promise.allSettled(promiseList).then((results) => {
      return results.map((result) => {
        return result.value.data;
      }).flat();
    });
  }

  /**
   * Fetches all page interactions for a specific user
   * @param {string} username - Username to filter page interactions by
   * @returns {Promise<Array>} Array of page interaction data
   */
  getAllPageInteractions(username) {
    const where = `modifyingUser.username='${username}'`;
    const fields = 'id,name,action';

    return this.apiClient.queryAll('PageInteraction', where, fields)
      .then((result) => {
        this.logger.piData(`Query Page Interaction url: query/PageInteraction, where: ${where}, fields: ${fields}`);
        this.logger.piData(`Query Page Interaction response: ${JSON.stringify(result)}`);

        return Promise.resolve(result.data);
      }).catch((error) => {
        this.logger.error(chalk.red(error));
      });
  }

  /**
   * Adds a new page interaction to Bullhorn
   * @param {Object} PI - Page interaction configuration object
   * @param {string} action - Action type for the page interaction
   * @param {string} pageInteraction - Name of the page interaction
   * @returns {Promise<Object>} Result object containing status and response
   */
  addPageInteraction(PI, action, pageInteraction) {
    this.logger.debug(`Adding Page Interaction: name: '${pageInteraction}', PI: ${JSON.stringify(PI)}`);
    let resCode;

    return this.apiClient.insertEntity('PageInteraction', PI).then((response) => {
      resCode = response.status;

      return response.json();
    }).then((result) => {
      const formattedResponse = JSON.stringify(result);
      this.logger.piData('Add Page Interaction url: entity/PageInteraction');
      this.logger.piData(`Add Page Interaction payload: ${JSON.stringify(PI)}`);
      this.logger.piData(`Add Page Interaction result: ${formattedResponse}`);

      return Promise.resolve(this.resultsSvc.createPIAddResult(action, pageInteraction, resCode, formattedResponse));
    }).catch((error) => {
      this.logger.error(chalk.red(error));

      return Promise.reject(new Error(`Fail to make Insert Page Interaction call with error: ${error}`));
    });
  }

  /**
   * Updates an existing page interaction in Bullhorn
   * @param {Object} PI - Page interaction configuration object with updated values
   * @param {string} action - Action type for the page interaction
   * @param {Object} pageInteraction - Existing page interaction object with id and name
   * @returns {Promise<Object>} Result object containing status and response
   */
  updatePageInteraction(PI, action, pageInteraction) {
    this.logger.debug(`Updating Page Interaction: #${pageInteraction.id}, name: ${pageInteraction.name}, pageInteraction: ${JSON.stringify(pageInteraction)}`);
    let resCode;

    return this.apiClient.updateEntity('PageInteraction', pageInteraction.id, PI).then((response) => {
      resCode = response.status;

      return response.json();
    }).then((result) => {
      const formattedResponse = JSON.stringify(result);
      this.logger.piData(`Update Page Interaction url: entity/PageInteraction/${pageInteraction.id}`);
      this.logger.piData(`Update Page Interaction payload: ${JSON.stringify(PI)}`);
      this.logger.piData(`Update Page Interaction result: ${formattedResponse}`);

      return Promise.resolve(this.resultsSvc.createPIUpdateResult(action, pageInteraction, resCode, formattedResponse));
    }).catch((error) => {
      this.logger.error(chalk.red(error));

      return Promise.reject(new Error(`Fail to make Update Page Interaction call with error: ${error}`));
    });
  }

  /**
   * Deletes a page interaction from Bullhorn
   * @param {number} id - Page interaction ID to delete
   * @param {string} action - Action type for the page interaction
   * @param {string} interactionName - Name of the page interaction being deleted
   * @returns {Promise<Object>} Result object containing status and response
   */
  deletePageInteraction(id, action, interactionName) {
    this.logger.debug(`Deleting Page Interaction #${id}, name: '${interactionName}'`);
    let resCode;

    return this.apiClient.deleteEntity('PageInteraction', id).then((response) => {
      resCode = response.status;

      return response.json();
    }).then((result) => {
      const formattedResponse = JSON.stringify(result);
      this.logger.piData(`Delete Page Interaction url: entity/PageInteraction/${id}`);
      this.logger.piData(`Delete Page Interaction  response: ${formattedResponse}`);
      return Promise.resolve(this.resultsSvc.createPIDeleteResult(action, { name: interactionName, id: id }, resCode, formattedResponse));
    }).catch((error) => {
      this.logger.error(chalk.red(error));

      return Promise.reject(new Error(`Fail to make delete Page Interaction  call with error: ${error}`));
    });
  }
}

module.exports = PageInteractionsCrudService;
