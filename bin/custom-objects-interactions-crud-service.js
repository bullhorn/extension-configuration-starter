const chalk = require('chalk');
const logger = require('./lib/logger');
const resultsSvc = require('./results-service');
const utils = require('./utils');

class CustomObjectInteractionsCrudService {
  constructor(restApiClient) {
    this.apiClient = restApiClient;
    this.logger = logger;
    this.resultsSvc = resultsSvc;
    this.utils = utils;
  }

  fetchCustomObjectFieldInteractionData(entityType, where, fields, entity) {
    return this.apiClient.queryAll(entityType, where, fields)
      .then((result) => {
        this.logger.coFiData(`Query ${entityType} for entity: ${entity}, where: ${where}, fields: ${fields}`);
        this.logger.coFiData(`Query ${entityType} response: ${JSON.stringify(result)}`);

        if (result.data && result.data.length) {
          result.data.forEach(data => data.type = entity);
        }

        return Promise.resolve(result);
      }).catch((error) => {
        this.logger.error(chalk.red(error));
      });
  }

  getCustomObjects(coQueryConfigs) {
    this.logger.coFiData('Fetching Custom Objects');
    const urls = Object.values(coQueryConfigs).map(conf => conf.objectUrl).filter(this.utils.onlyUnique);
    const entities = Object.values(coQueryConfigs).map(conf => conf.entityName).filter(this.utils.onlyUnique);
    const promiseList = [];

    urls.forEach((objUrl) => {
      const urlObjects = Object.values(coQueryConfigs).filter(coQueryConfig => coQueryConfig.objectUrl === objUrl);

      entities.forEach((entity) => {
        const entityObjects = urlObjects.filter(entityObjConfig => entityObjConfig.entityName === entity);

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

    return Promise.allSettled(promiseList).then(results => results.map(result => result.value.data).flat());
  }

  getCustomObjectAttributes(coQueryConfigs) {
    this.logger.coFiData('Fetching Custom Object Attributes');
    const urls = Object.values(coQueryConfigs).map(conf => conf.objectUrl).filter(this.utils.onlyUnique);
    const entities = Object.values(coQueryConfigs).map(conf => conf.entityName).filter(this.utils.onlyUnique);
    const promiseList = [];

    urls.forEach((objUrl) => {
      const whereQueries = [];
      const objUrlConfigs = Object.values(coQueryConfigs).filter(coQueryConfig => coQueryConfig.objectUrl === objUrl);

      entities.forEach((entity) => {
        const entityObjects = objUrlConfigs.filter(entityObjConfig => entityObjConfig.entityName === entity);

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

    return Promise.allSettled(promiseList).then(results => results.map(result => result.value.data).flat());
  }

  getCustomObjectAttributeInteractions(coQueryConfigs) {
    this.logger.coFiData('Fetching Custom Object Attribute Interactions');
    const urls = Object.values(coQueryConfigs).map(conf => conf.objectUrl).filter(this.utils.onlyUnique);
    const entities = Object.values(coQueryConfigs).map(conf => conf.entityName).filter(this.utils.onlyUnique);
    const promiseList = [];

    urls.forEach((objUrl) => {
      const objUrlConfigs = Object.values(coQueryConfigs).filter(coQueryConfig => coQueryConfig.objectUrl === objUrl);

      entities.forEach((entity) => {
        const entityObjects = objUrlConfigs.filter(entityObjConfig => entityObjConfig.entityName === entity);

        if (entityObjects.length) {
          let whereQueries = [];

          entityObjects.forEach((object) => {
            whereQueries = whereQueries.concat(object.fields.map(field => `(attribute.id = ${field.fieldMapId} AND name in ('${field.fieldInteractionNames.join('\',\'')}'))`));
          });

          const finalWhereQuery = `${whereQueries.join(' OR ')}`;
          const entityType = this.getEntityType(objUrl, 'AI');
          const fields = 'id,attribute(id),name';

          promiseList.push(this.fetchCustomObjectFieldInteractionData(entityType, finalWhereQuery, fields, entity));
        }
      });
    });

    return Promise.allSettled(promiseList).then(results => Promise.resolve(results.map(result => result.value.data).flat()));
  }

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
