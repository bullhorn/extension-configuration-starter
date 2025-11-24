const logger = require('./lib/logger');
const resultsSvc = require('./results-service');
const utils = require('./utils');

let apiClient;

function setUpService(restApiClient) {
  apiClient = restApiClient;
}

function fetchCustomObjectFieldInteractionData(entityType, where, fields, entity) {
  return apiClient.queryAll(entityType, where, fields)
    .then(result => {
      logger.coFiData(`Query ${entityType} for entity: ${entity}, where: ${where}, fields: ${fields}`);
      logger.coFiData(`Query ${entityType} response: ${JSON.stringify(result)}`);

      if (result.data && result.data.length) {
        result.data.forEach(data => data.type = entity);
      }

      return Promise.resolve(result);
    }).catch(error => {
      logger.error(chalk.red(error));
    });
}

function getCustomObjects(coQueryConfigs) {
  logger.coFiData('Fetching Custom Objects');
  const urls = Object.values(coQueryConfigs).map(conf => conf.objectUrl).filter(utils.onlyUnique);
  const entities = Object.values(coQueryConfigs).map(conf => conf.entityName).filter(utils.onlyUnique);
  const promiseList = [];

  urls.forEach(objUrl => {
    const urlObjects = Object.values(coQueryConfigs).filter(coQueryConfig => coQueryConfig.objectUrl === objUrl);

    entities.forEach(entity => {
      const entityObjects = urlObjects.filter(entityObjConfig => entityObjConfig.entityName === entity);

      if (entityObjects.length) {
        const fields = ['id', 'objectNumber'];
        const additionalFields = [];
        let whereQueries = [];

        for (const entityObj of entityObjects) {
          let entityQuery = ''

          if (['UserCustomObject', 'JobOrderCustomObject'].includes(objUrl)) {
            entityQuery = `(type = '${getCoTypeFromEntityName(entity)}' AND objectNumber = ${entityObj.objectInstance}`;
            if (!additionalFields.length) {
              additionalFields.push('type');
            }
          } else {
            entityQuery = `(objectNumber = ${entityObj.objectInstance}`
          }

          whereQueries.push(entityQuery);
        }

        const finalWhereQuery = `${whereQueries.join(') OR ')})`;
        const entityType = getEntityType(objUrl);

        promiseList.push(fetchCustomObjectFieldInteractionData(entityType, finalWhereQuery, [...fields, ...additionalFields].join(','), entity));
      }
    });
  });

  return Promise.allSettled(promiseList).then(results => results.map(result => result.value.data).flat());
}


function getCustomObjectAttributes(coQueryConfigs) {
  logger.coFiData('Fetching Custom Object Attributes');
  const urls = Object.values(coQueryConfigs).map(conf => conf.objectUrl).filter(utils.onlyUnique);
  const entities = Object.values(coQueryConfigs).map(conf => conf.entityName).filter(utils.onlyUnique);
  const promiseList = [];

  urls.forEach(objUrl => {
    let whereQueries = [];
    const objUrlConfigs = Object.values(coQueryConfigs).filter(coQueryConfig => coQueryConfig.objectUrl === objUrl);

    entities.forEach(entity => {
      const entityObjects = objUrlConfigs.filter(entityObjConfig => entityObjConfig.entityName === entity);

      if (entityObjects.length) {
        for (const object of entityObjects) {
          let entityQuery = `(customObject.id = ${object.objectId} AND `;
          let fieldQueries = [];

          for (const field of object.fields) {
            fieldQueries.push(`(columnName = '${field.fieldName}'`);
          }

          entityQuery += fieldQueries.join(') OR ');
          entityQuery += ')';
          whereQueries.push(entityQuery);
        }
        const finalWhereQuery = `${whereQueries.join(') OR ')})`;
        const entityType = getEntityType(objUrl, 'A');
        const fields = 'id,customObject(id),columnName';

        promiseList.push(fetchCustomObjectFieldInteractionData(entityType, finalWhereQuery, fields, entity));
      }
    });
  });

  return Promise.allSettled(promiseList).then(results => results.map(result => result.value.data).flat());
}


function getCustomObjectAttributeInteractions(coQueryConfigs) {
  logger.coFiData('Fetching Custom Object Attribute Interactions');
  const urls = Object.values(coQueryConfigs).map(conf => conf.objectUrl).filter(utils.onlyUnique);
  const entities = Object.values(coQueryConfigs).map(conf => conf.entityName).filter(utils.onlyUnique);
  const promiseList = [];

  urls.forEach(objUrl => {
    const objUrlConfigs = Object.values(coQueryConfigs).filter(coQueryConfig => coQueryConfig.objectUrl === objUrl);

    entities.forEach(entity => {
      const entityObjects = objUrlConfigs.filter(entityObjConfig => entityObjConfig.entityName === entity);

      if (entityObjects.length) {
        let whereQueries = [];

        entityObjects.forEach(object => {
          whereQueries = whereQueries.concat(object.fields.map(field => {
            return `(attribute.id = ${field.fieldMapId} AND name in ('${field.fieldInteractionNames.join('\',\'')}'))`
          }));
        });

        const finalWhereQuery = `${whereQueries.join(' OR ')}`;
        const entityType = getEntityType(objUrl, 'AI');
        const fields = 'id,attribute(id),name';

        promiseList.push(fetchCustomObjectFieldInteractionData(entityType, finalWhereQuery, fields, entity));
      }
    });
  });

  return Promise.allSettled(promiseList).then(results => Promise.resolve(results.map(result => result.value.data).flat()));
}

function getAllCustomObjectAttributeInteractions(entity, objUrl, username) {
  let where = `modifyingUser.username='${username}'`;

  if (['UserCustomObject', 'JobOrderCustomObject'].includes(objUrl)) {
    where += `AND attribute.customObject.type='${getCoTypeFromEntityName(entity)}'`;
  }

  const entityType = getEntityType(objUrl, 'AI');
  const fields = 'id,name,attribute(columnName,customObject(objectNumber))';

  return apiClient.queryAll(entityType, where, fields)
    .then(result => {
      logger.coFiData(`Query Custom Object Attribute Interaction url: query/${entityType}, where: ${where}, fields: ${fields}`);
      logger.coFiData(`Query Custom Object Attribute Interaction response: ${JSON.stringify(result)}`);

      return Promise.resolve({entity: entity, url: objUrl, coFIs: result.data});
    }).catch(error => {
      logger.error(chalk.red(error));
    });
}

function addCustomObjectAttributeInteraction(FI, entity, customObject, fieldName, fieldMapId, interactionName, objUrl) {
  FI.attribute = {id: fieldMapId};
  logger.debug(`Adding Custom Object Attribute Interaction: name: '${interactionName}', FI: (${JSON.stringify(FI)})`);
  const entityType = getEntityType(objUrl, 'AI');
  let resCode;

  return apiClient.insertEntity(entityType, FI).then(response => {
    resCode = response.status;

    return response.json()
  }).then(result => {
    const formattedResponse = JSON.stringify(result);
    logger.coFiData(`Add Custom Object Attribute Interaction url: entity/${entityType}`);
    logger.coFiData(`Add Custom Object Attribute Interaction payload: ${JSON.stringify(FI)}`);
    logger.coFiData(`Add Custom Object Attribute Interaction response: ${formattedResponse}`);

    return Promise.resolve(resultsSvc.createCOFIAddResult(entity, customObject, fieldName, interactionName, resCode, formattedResponse));
  }).catch(error => {
    logger.error(chalk.red(error));

    return Promise.reject(new Error(`Fail to make Insert Custom Object Attribute Interaction call with error: ${error}`));
  });
}

function updateCustomObjectAttributeInteraction(extensionFI, entity, customObject, fieldName, toUpdateFI, objUrl) {
  logger.debug(`Updating Custom Object Attribute Interaction: #${toUpdateFI.id}, name: '${toUpdateFI.name}', toUpdateFI: (${JSON.stringify(toUpdateFI)})`)

  const entityType = getEntityType(objUrl, 'AI');
  let resCode;

  return apiClient.updateEntity(entityType, toUpdateFI.id, extensionFI).then(response => {
    resCode = response.status;

    return response.json()
  }).then(result => {
    const formattedResponse = JSON.stringify(result);
    logger.coFiData(`Update Custom Object Attribute Interaction url: entity/${entityType}/${toUpdateFI.id}`);
    logger.coFiData(`Update Custom Object Attribute Interaction payload: ${JSON.stringify(extensionFI)}`);
    logger.coFiData(`Update Custom Object Attribute Interaction response: ${formattedResponse}`);

    return Promise.resolve(resultsSvc.createCOFIUpdateResult(entity, customObject, fieldName, toUpdateFI, resCode, formattedResponse));
  }).catch(error => {
    logger.error(chalk.red(error));

    return Promise.reject(new Error(`Fail to make Update Custom Object Attribute Interaction call with error: ${error}`));
  });
}

function deleteCustomObjectAttributeInteraction(objUrl, id, entity, objectNum, fieldName, interactionName) {
  logger.debug(`Deleting Custom Object Attribute Interaction: #${id}, name: '${interactionName}'`);
  const entityType = getEntityType(objUrl, 'AI');
  let resCode;

  return apiClient.deleteEntity(entityType, id).then(response => {
    resCode = response.status;

    return response.json()
  }).then(result => {
    const formattedResponse = JSON.stringify(result);
    logger.coFiData(`Delete Custom Object Attribute Interaction url: entity/${entityType}/${id}`);
    logger.coFiData(`Delete Custom Object Attribute Interaction response: ${formattedResponse}`);

    return Promise.resolve(resultsSvc.createCOFIDeleteResult(entity, objectNum, fieldName, {name: interactionName, id: id}, resCode, formattedResponse));
  }).catch(error => {
    logger.error(chalk.red(error));

    return Promise.reject(new Error(`Fail to make Delete Custom Object Attribute Interaction call with error: ${error}`));
  });
}

function getEntityType(objUrl, type = '') {
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

function getCoTypeFromEntityName(entityName) {
  switch (entityName) {
    case ('Candidate/Client/Lead'):
      return 'ALL';
    default:
      return `${entityName}`;
  }
}

module.exports = {
  setUpService,
  getCustomObjects,
  getCustomObjectAttributes,
  getCustomObjectAttributeInteractions,
  getAllCustomObjectAttributeInteractions,
  addCustomObjectAttributeInteraction,
  updateCustomObjectAttributeInteraction,
  deleteCustomObjectAttributeInteraction
};
