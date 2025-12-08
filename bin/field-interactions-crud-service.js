const chalk = require('chalk');
const logger = require('./lib/logger');
const resultsSvc = require('./results-service');

/**
 * CRUD service for managing field interactions in Bullhorn
 */
class FieldInteractionsCrudService {
  /**
   * Creates an instance of FieldInteractionsCrudService
   * @param {Object} _restApiClient - REST API client for Bullhorn
   */
  constructor(_restApiClient) {
    this.apiClient = _restApiClient;
    this.logger = logger;
    this.resultsSvc = resultsSvc;
  }

  /**
   * Fetches field interaction data from Bullhorn API
   * @param {string} entityType - Type of entity to query (e.g., 'FieldMapInstance', 'FieldInteraction')
   * @param {string} where - WHERE clause for the query
   * @param {string} fields - Comma-separated list of fields to retrieve
   * @param {string} entity - Entity name for tagging results
   * @returns {Promise<Object>} Query result with data array
   */
  fetchFieldInteractionData(entityType, where, fields, entity) {
    return this.apiClient.queryAll(entityType, where, fields)
      .then((result) => {
        this.logger.fiData(`Query ${entityType} for entity: ${entity}, where: ${where}, fields: ${fields}`);
        this.logger.fiData(`Query ${entityType} response: ${JSON.stringify(result)}`);

        if (result.data && result.data.length) {
          result.data.forEach((data) => {
            data.type = entity;

            return data;
          });
        }

        return Promise.resolve(result);
      }).catch((error) => {
        this.logger.error(chalk.red(error));
      });
  }

  /**
   * Retrieves field map instances for specified field interactions and private label
   * @param {Object} fieldInteractions - Object containing field interaction configurations
   * @param {number} privateLabelId - Private label ID to filter by
   * @returns {Promise<Array>} Flattened array of field map instances
   */
  getFieldMapInstances(fieldInteractions, privateLabelId) {
    const promiseList = [];

    for (const entity of Object.values(fieldInteractions)) {
      let where = `(entity = '${entity.entityName}' AND (`;
      const fieldQueries = [];

      for (const field of entity.fields) {
        fieldQueries.push(`(columnName = '${field.fieldName}'`);
      }

      where += fieldQueries.join(') OR ');
      where += `))) AND privateLabel = ${privateLabelId}`;

      promiseList.push(this.fetchFieldInteractionData('FieldMapInstance', where, 'id,entity,columnName', entity.entityName));
    }

    return Promise.allSettled(promiseList).then((results) => {
      return results.map((result) => {
        return result.value.data;
      }).flat();
    });
  }

  /**
   * Retrieves field interactions for specified configurations and private label
   * @param {Object} fieldInteractions - Object containing field interaction configurations
   * @param {number} privateLabelId - Private label ID to filter by
   * @returns {Promise<Array>} Flattened array of field interactions
   */
  getFieldInteractions(fieldInteractions, privateLabelId) {
    const promiseList = [];

    for (const entity of Object.values(fieldInteractions)) {
      let where = '(';
      where += entity.fields.map((field) => {
        return `(fieldMapID = ${field.fieldMapId} AND name in ('${field.fieldInteractionNames.join('\',\'')}')`;
      }).join(') OR ');
      where += `)) AND privateLabelID = ${privateLabelId}`;

      promiseList.push(this.fetchFieldInteractionData('FieldMapInteraction', where, 'id,name,fieldMapID,fieldName,entity', entity.entityName));
    }

    return Promise.allSettled(promiseList).then((results) => {
      return results.map((result) => {
        return result.value.data;
      }).flat();
    });
  }

  /**
   * Retrieves all field interactions for a specific user
   * @param {string} username - Username to filter field interactions by
   * @returns {Promise<Array>} Array of field interaction data
   */
  getAllFieldInteractions(username) {
    const where = `modifyingUser.username='${username}'`;
    const fields = 'id,name,fieldName,entity';

    return this.apiClient.queryAll('FieldMapInteraction', where, fields)
      .then((result) => {
        this.logger.fiData(`Query Field Map Interaction url: query/FieldMapInteraction, where: ${where}, fields: ${fields}`);
        this.logger.fiData(`Query Field Map Interaction response: ${JSON.stringify(result)}`);

        return Promise.resolve(result.data);
      }).catch((error) => {
        this.logger.error(chalk.red(error));
      });
  }

  /**
   * Adds a new field interaction to Bullhorn
   * @param {Object} FI - Field interaction configuration object
   * @param {string} entity - Entity name for the field interaction
   * @param {string} fieldName - Field name for the interaction
   * @param {number} fieldMapId - Field map ID to associate with
   * @param {string} interactionName - Name of the field interaction
   * @returns {Promise<Object>} Result object containing status and response
   */
  addFieldInteraction(FI, entity, fieldName, fieldMapId, interactionName) {
    this.logger.debug(`Adding Field Interaction: name: '${interactionName}' , FI: ${JSON.stringify(FI)}`);
    FI.fieldMapID = fieldMapId;
    let resCode;

    return this.apiClient.insertEntity('FieldMapInteraction', FI).then((response) => {
      resCode = response.status;

      return response.json();
    }).then((result) => {
      const formattedResponse = JSON.stringify(result);
      this.logger.fiData('Add Field Map Interaction url: entity/FieldMapInteraction');
      this.logger.fiData(`Add Field Map Interaction payload: ${JSON.stringify(FI)}`);
      this.logger.fiData(`Add Field Map Interaction response: ${formattedResponse}`);

      return Promise.resolve(this.resultsSvc.createFIAddResult(entity, fieldName, interactionName, resCode, formattedResponse));
    }).catch((error) => {
      this.logger.error(chalk.red(error));

      return Promise.reject(new Error(`Fail to make Insert Field Interaction call with error: ${error}`));
    });
  }

  /**
   * Updates an existing field interaction in Bullhorn
   * @param {Object} extensionFI - Updated field interaction configuration
   * @param {string} entity - Entity name for the field interaction
   * @param {string} fieldName - Field name for the interaction
   * @param {Object} toUpdateFI - Existing field interaction object with id and name
   * @returns {Promise<Object>} Result object containing status and response
   */
  updateFieldInteraction(extensionFI, entity, fieldName, toUpdateFI) {
    this.logger.debug(`Updating Field Map Interaction: #${toUpdateFI.id}, name: '${toUpdateFI.name}', toUpdateFI: ${JSON.stringify(toUpdateFI)}`);
    let resCode;

    return this.apiClient.updateEntity('FieldMapInteraction', toUpdateFI.id, extensionFI).then((response) => {
      resCode = response.status;

      return response.json();
    }).then((result) => {
      const formattedResponse = JSON.stringify(result);
      this.logger.fiData(`Update Field Map Interaction url: entity/FieldMapInteraction/${toUpdateFI.id}`);
      this.logger.fiData(`Update Field Map Interaction payload: ${JSON.stringify(extensionFI)}`);
      this.logger.fiData(`Update Field Map Interaction response: ${formattedResponse}`);

      return Promise.resolve(this.resultsSvc.createFIUpdateResult(entity, fieldName, toUpdateFI, resCode, formattedResponse));
    }).catch((error) => {
      this.logger.error(chalk.red(error));

      return Promise.reject(new Error(`Fail to make Update Field Interaction call with error: ${error}`));
    });
  }

  /**
   * Deletes a field interaction from Bullhorn
   * @param {number} id - Field interaction ID to delete
   * @param {string} entity - Entity name for the field interaction
   * @param {string} fieldName - Field name for the interaction
   * @param {string} interactionName - Name of the field interaction being deleted
   * @returns {Promise<Object>} Result object containing status and response
   */
  deleteFieldInteraction(id, entity, fieldName, interactionName) {
    this.logger.debug(`Deleting Field Map Interaction #${id}, name: '${interactionName}'`);
    let resCode;

    return this.apiClient.deleteEntity('FieldMapInteraction', id).then((response) => {
      resCode = response.status;

      return response.json();
    }).then((result) => {
      const formattedResponse = JSON.stringify(result);
      this.logger.fiData(`Delete Field Map Interaction url: entity/FieldMapInteraction/${id}`);
      this.logger.fiData(`Delete Field Map Interaction response: ${formattedResponse}`);

      return Promise.resolve(this.resultsSvc.createFIDeleteResult(entity, fieldName, { name: interactionName, id: id }, resCode, formattedResponse));
    }).catch((error) => {
      this.logger.error(chalk.red(error));

      return Promise.reject(new Error(`Fail to make delete Field Interaction call with error: ${error}`));
    });
  }
}

module.exports = FieldInteractionsCrudService;
