const chalk = require('chalk');
const logger = require('./lib/logger');
const resultsSvc = require('./results-service');
const utils = require('./utils');

/**
 * CRUD service for managing custom object field interactions in Bullhorn
 */
class CustomObjectInteractionsCrudService {
  /**
   * Creates an instance of CustomObjectInteractionsCrudService
   * @param {Object} _restApiClient - REST API client for Bullhorn
   */
  constructor(_restApiClient) {
    this.apiClient = _restApiClient;
    this.logger = logger;
    this.resultsSvc = resultsSvc;
    this.utils = utils;
  }

  /**
   * Fetches custom object field interaction data from Bullhorn API
   * @param {string} entityType - Type of entity to query
   * @param {string} where - WHERE clause for the query
   * @param {string} fields - Comma-separated list of fields to retrieve
   * @param {string} entity - Entity name for tagging results
   * @returns {Promise<Object>} Query result with data array
   */
  fetchCustomObjectFieldInteractionData(entityType, where, fields, entity) {
    return this.apiClient.queryAll(entityType, where, fields)
      .then((result) => {
        this.logger.coFiData(`Query ${entityType} for entity: ${entity}, where: ${where}, fields: ${fields}`);
        this.logger.coFiData(`Query ${entityType} response: ${JSON.stringify(result)}`);

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
   * Retrieves custom objects based on configuration
   * @param {Object} coQueryConfigs - Configuration object mapping custom objects
   * @returns {Promise<Array>} Flattened array of custom object data
   */
  getCustomObjects(coQueryConfigs) {
    this.logger.coFiData('Fetching Custom Objects');
    const urls = Object.values(coQueryConfigs).map((conf) => {
      return conf.objectUrl;
    }).filter(this.utils.onlyUnique);
    const entities = Object.values(coQueryConfigs).map((conf) => {
      return conf.entityName;
    }).filter(this.utils.onlyUnique);
    const promiseList = [];

    urls.forEach((objUrl) => {
      const urlObjects = Object.values(coQueryConfigs).filter((coQueryConfig) => {
        return coQueryConfig.objectUrl === objUrl;
      });

      entities.forEach((entity) => {
        const entityObjects = urlObjects.filter((entityObjConfig) => {
          return entityObjConfig.entityName === entity;
        });

        if (entityObjects.length) {
          const fields = [ 'id', 'objectNumber' ];
          const additionalFields = [];
          const whereQueries = [];

          for (const entityObj of entityObjects) {
            let entityQuery = '';

            if ([ 'UserCustomObject', 'JobOrderCustomObject' ].includes(objUrl)) {
              entityQuery = `(type = '${this.getCoTypeFromEntityName(entity)}' AND objectNumber = ${entityObj.objectInstance}`;
              if (!additionalFields.length) {
                additionalFields.push('type');
              }
            } else {
              entityQuery = `(objectNumber = ${entityObj.objectInstance}`;
            }

            whereQueries.push(entityQuery);
          }

          const finalWhereQuery = `${whereQueries.join(') OR ')})`;
          const entityType = this.getEntityType(objUrl);

          promiseList.push(this.fetchCustomObjectFieldInteractionData(entityType, finalWhereQuery, [ ...fields, ...additionalFields ].join(','), entity));
        }
      });
    });

    return Promise.allSettled(promiseList).then((results) => {
      return results.map((result) => {
        return result.value.data;
      }).flat();
    });
  }

  /**
   * Retrieves custom object attributes (fields) for configured custom objects
   * @param {Object} coQueryConfigs - Configuration object mapping custom objects
   * @returns {Promise<Array>} Flattened array of custom object attribute data
   */
  getCustomObjectAttributes(coQueryConfigs) {
    this.logger.coFiData('Fetching Custom Object Attributes');
    const urls = Object.values(coQueryConfigs).map((conf) => {
      return conf.objectUrl;
    }).filter(this.utils.onlyUnique);
    const entities = Object.values(coQueryConfigs).map((conf) => {
      return conf.entityName;
    }).filter(this.utils.onlyUnique);
    const promiseList = [];

    urls.forEach((objUrl) => {
      const whereQueries = [];
      const objUrlConfigs = Object.values(coQueryConfigs).filter((coQueryConfig) => {
        return coQueryConfig.objectUrl === objUrl;
      });

      entities.forEach((entity) => {
        const entityObjects = objUrlConfigs.filter((entityObjConfig) => {
          return entityObjConfig.entityName === entity;
        });

        if (entityObjects.length) {
          for (const object of entityObjects) {
            let entityQuery = `(customObject.id = ${object.objectId} AND `;
            const fieldQueries = [];

            for (const field of object.fields) {
              fieldQueries.push(`(columnName = '${field.fieldName}'`);
            }

            entityQuery += fieldQueries.join(') OR ');
            entityQuery += ')';
            whereQueries.push(entityQuery);
          }
          const finalWhereQuery = `${whereQueries.join(') OR ')})`;
          const entityType = this.getEntityType(objUrl, 'A');
          const fields = 'id,customObject(id),columnName';

          promiseList.push(this.fetchCustomObjectFieldInteractionData(entityType, finalWhereQuery, fields, entity));
        }
      });
    });

    return Promise.allSettled(promiseList).then((results) => {
      return results.map((result) => {
        return result.value.data;
      }).flat();
    });
  }

  /**
   * Retrieves custom object attribute interactions for configured custom objects
   * @param {Object} coQueryConfigs - Configuration object mapping custom objects with field interactions
   * @returns {Promise<Array>} Flattened array of custom object attribute interaction data
   */
  getCustomObjectAttributeInteractions(coQueryConfigs) {
    this.logger.coFiData('Fetching Custom Object Attribute Interactions');
    const urls = Object.values(coQueryConfigs).map((conf) => {
      return conf.objectUrl;
    }).filter(this.utils.onlyUnique);
    const entities = Object.values(coQueryConfigs).map((conf) => {
      return conf.entityName;
    }).filter(this.utils.onlyUnique);
    const promiseList = [];

    urls.forEach((objUrl) => {
      const objUrlConfigs = Object.values(coQueryConfigs).filter((coQueryConfig) => {
        return coQueryConfig.objectUrl === objUrl;
      });

      entities.forEach((entity) => {
        const entityObjects = objUrlConfigs.filter((entityObjConfig) => {
          return entityObjConfig.entityName === entity;
        });

        if (entityObjects.length) {
          let whereQueries = [];

          entityObjects.forEach((object) => {
            whereQueries = whereQueries.concat(object.fields.map((field) => {
              return `(attribute.id = ${field.fieldMapId} AND name in ('${field.fieldInteractionNames.join('\',\'')}'))`;
            }));
          });

          const finalWhereQuery = `${whereQueries.join(' OR ')}`;
          const entityType = this.getEntityType(objUrl, 'AI');
          const fields = 'id,attribute(id),name';

          promiseList.push(this.fetchCustomObjectFieldInteractionData(entityType, finalWhereQuery, fields, entity));
        }
      });
    });

    return Promise.allSettled(promiseList).then((results) => {
      return Promise.resolve(results.map((result) => {
        return result.value.data;
      }).flat());
    });
  }

  /**
   * Retrieves all custom object attribute interactions for a specific user
   * @param {string} entity - Entity name
   * @param {string} objUrl - Custom object URL endpoint
   * @param {string} username - Username to filter interactions by
   * @returns {Promise<Object>} Object containing entity, url, and array of interactions
   */
  getAllCustomObjectAttributeInteractions(entity, objUrl, username) {
    let where = `modifyingUser.username='${username}'`;

    if ([ 'UserCustomObject', 'JobOrderCustomObject' ].includes(objUrl)) {
      where += `AND attribute.customObject.type='${this.getCoTypeFromEntityName(entity)}'`;
    }

    const entityType = this.getEntityType(objUrl, 'AI');
    const fields = 'id,name,attribute(columnName,customObject(objectNumber))';

    return this.apiClient.queryAll(entityType, where, fields)
      .then((result) => {
        this.logger.coFiData(`Query Custom Object Attribute Interaction url: query/${entityType}, where: ${where}, fields: ${fields}`);
        this.logger.coFiData(`Query Custom Object Attribute Interaction response: ${JSON.stringify(result)}`);

        return Promise.resolve({ entity: entity, url: objUrl, coFIs: result.data });
      }).catch((error) => {
        this.logger.error(chalk.red(error));
      });
  }

  /**
   * Adds a new custom object attribute interaction to Bullhorn
   * @param {Object} FI - Field interaction configuration object
   * @param {string} entity - Entity name
   * @param {string} customObject - Custom object name
   * @param {string} fieldName - Field name for the interaction
   * @param {number} fieldMapId - Field map ID to associate with
   * @param {string} interactionName - Name of the interaction
   * @param {string} objUrl - Custom object URL endpoint
   * @returns {Promise<Object>} Result object containing status and response
   */
  addCustomObjectAttributeInteraction(FI, entity, customObject, fieldName, fieldMapId, interactionName, objUrl) {
    FI.attribute = { id: fieldMapId };
    this.logger.debug(`Adding Custom Object Attribute Interaction: name: '${interactionName}', FI: (${JSON.stringify(FI)})`);
    const entityType = this.getEntityType(objUrl, 'AI');
    let resCode;

    return this.apiClient.insertEntity(entityType, FI).then((response) => {
      resCode = response.status;

      return response.json();
    }).then((result) => {
      const formattedResponse = JSON.stringify(result);
      this.logger.coFiData(`Add Custom Object Attribute Interaction url: entity/${entityType}`);
      this.logger.coFiData(`Add Custom Object Attribute Interaction payload: ${JSON.stringify(FI)}`);
      this.logger.coFiData(`Add Custom Object Attribute Interaction response: ${formattedResponse}`);

      return Promise.resolve(this.resultsSvc.createCOFIAddResult(entity, customObject, fieldName, interactionName, resCode, formattedResponse));
    }).catch((error) => {
      this.logger.error(chalk.red(error));

      return Promise.reject(new Error(`Fail to make Insert Custom Object Attribute Interaction call with error: ${error}`));
    });
  }

  /**
   * Updates an existing custom object attribute interaction in Bullhorn
   * @param {Object} extensionFI - Updated field interaction configuration
   * @param {string} entity - Entity name
   * @param {string} customObject - Custom object name
   * @param {string} fieldName - Field name for the interaction
   * @param {Object} toUpdateFI - Existing interaction object with id and name
   * @param {string} objUrl - Custom object URL endpoint
   * @returns {Promise<Object>} Result object containing status and response
   */
  updateCustomObjectAttributeInteraction(extensionFI, entity, customObject, fieldName, toUpdateFI, objUrl) {
    this.logger.debug(`Updating Custom Object Attribute Interaction: #${toUpdateFI.id}, name: '${toUpdateFI.name}', toUpdateFI: (${JSON.stringify(toUpdateFI)})`);

    const entityType = this.getEntityType(objUrl, 'AI');
    let resCode;

    return this.apiClient.updateEntity(entityType, toUpdateFI.id, extensionFI).then((response) => {
      resCode = response.status;

      return response.json();
    }).then((result) => {
      const formattedResponse = JSON.stringify(result);
      this.logger.coFiData(`Update Custom Object Attribute Interaction url: entity/${entityType}/${toUpdateFI.id}`);
      this.logger.coFiData(`Update Custom Object Attribute Interaction payload: ${JSON.stringify(extensionFI)}`);
      this.logger.coFiData(`Update Custom Object Attribute Interaction response: ${formattedResponse}`);

      return Promise.resolve(this.resultsSvc.createCOFIUpdateResult(entity, customObject, fieldName, toUpdateFI, resCode, formattedResponse));
    }).catch((error) => {
      this.logger.error(chalk.red(error));

      return Promise.reject(new Error(`Fail to make Update Custom Object Attribute Interaction call with error: ${error}`));
    });
  }

  /**
   * Deletes a custom object attribute interaction from Bullhorn
   * @param {string} objUrl - Custom object URL endpoint
   * @param {number} id - Interaction ID to delete
   * @param {string} entity - Entity name
   * @param {number} objectNum - Custom object number
   * @param {string} fieldName - Field name for the interaction
   * @param {string} interactionName - Name of the interaction being deleted
   * @returns {Promise<Object>} Result object containing status and response
   */
  deleteCustomObjectAttributeInteraction(objUrl, id, entity, objectNum, fieldName, interactionName) {
    this.logger.debug(`Deleting Custom Object Attribute Interaction: #${id}, name: '${interactionName}'`);
    const entityType = this.getEntityType(objUrl, 'AI');
    let resCode;

    return this.apiClient.deleteEntity(entityType, id).then((response) => {
      resCode = response.status;

      return response.json();
    }).then((result) => {
      const formattedResponse = JSON.stringify(result);
      this.logger.coFiData(`Delete Custom Object Attribute Interaction url: entity/${entityType}/${id}`);
      this.logger.coFiData(`Delete Custom Object Attribute Interaction response: ${formattedResponse}`);

      return Promise.resolve(this.resultsSvc.createCOFIDeleteResult(entity, objectNum, fieldName, { name: interactionName, id: id }, resCode, formattedResponse));
    }).catch((error) => {
      this.logger.error(chalk.red(error));

      return Promise.reject(new Error(`Fail to make Delete Custom Object Attribute Interaction call with error: ${error}`));
    });
  }

  /**
   * Constructs the entity type string based on object URL and type suffix
   * @param {string} objUrl - Custom object URL endpoint
   * @param {string} [type=''] - Type suffix ('A' for Attribute, 'AI' for AttributeInteraction, 'CO' for CustomObject)
   * @returns {string} Constructed entity type string
   */
  getEntityType(objUrl, type = '') {
    switch (type) {
    case 'A':
      return `${objUrl}Attribute`;
    case 'AI':
      return `${objUrl}AttributeInteraction`;
    case 'CO':
      return `${objUrl}`;
    default:
      return `${objUrl}${type}`;
    }
  }

  /**
   * Maps entity name to custom object type identifier
   * @param {string} entityName - Entity name to map
   * @returns {string} Custom object type identifier
   */
  getCoTypeFromEntityName(entityName) {
    switch (entityName) {
    case ('Candidate/Client/Lead'):
      return 'ALL';
    default:
      return `${entityName}`;
    }
  }
}

module.exports = CustomObjectInteractionsCrudService;
