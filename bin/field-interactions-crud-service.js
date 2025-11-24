const chalk = require('chalk');
const logger = require('./lib/logger');
const resultsSvc = require('./results-service');

let apiClient;

function setUpService(restApiClient) {
  apiClient = restApiClient;
}

function fetchFieldInteractionData(entityType, where, fields, entity) {
  return apiClient.queryAll(entityType, where, fields)
    .then(result => {
      logger.fiData(`Query ${entityType} for entity: ${entity}, where: ${where}, fields: ${fields}`);
      logger.fiData(`Query ${entityType} response: ${JSON.stringify(result)}`);

      if (result.data && result.data.length) {
        result.data.forEach(data => data.type = entity);
      }

      return Promise.resolve(result);
    }).catch(error => {
      logger.error(chalk.red(error));
    });
}

function getFieldMapInstances(fieldInteractions, privateLabelId) {
  const promiseList = [];

  for (const entity of Object.values(fieldInteractions)) {
    let where = `(entity = '${entity.entityName}' AND (`;
    let fieldQueries = [];

    for (const field of entity.fields) {
      fieldQueries.push(`(columnName = '${field.fieldName}'`);
    }

    where += fieldQueries.join(') OR ');
    where += `))) AND privateLabel = ${privateLabelId}`;

    promiseList.push(fetchFieldInteractionData('FieldMapInstance', where, 'id,entity,columnName', entity.entityName));
  }

  return Promise.allSettled(promiseList).then(results => results.map(result => result.value.data).flat());
}

function getFieldInteractions(fieldInteractions, privateLabelId) {
  const promiseList = [];

  for (const entity of Object.values(fieldInteractions)) {
    let where = '('
    where += entity.fields.map(field => `(fieldMapID = ${field.fieldMapId} AND name in ('${field.fieldInteractionNames.join('\',\'')}')`).join(') OR ');
    where += `)) AND privateLabelID = ${privateLabelId}`;

    promiseList.push(fetchFieldInteractionData('FieldMapInteraction', where, 'id,name,fieldMapID,fieldName,entity', entity.entityName));
  }

  return Promise.allSettled(promiseList).then(results => results.map(result => result.value.data).flat());
}

function getAllFieldInteractions(username) {
  const where = `modifyingUser.username='${username}'`;
  const fields = 'id,name,fieldName,entity';

  return apiClient.queryAll('FieldMapInteraction', where, fields)
    .then(result => {
      logger.fiData(`Query Field Map Interaction url: query/FieldMapInteraction, where: ${where}, fields: ${fields}`);
      logger.fiData(`Query Field Map Interaction response: ${JSON.stringify(result)}`);

      return Promise.resolve(result.data);
    }).catch(error => {
      logger.error(chalk.red(error));
    });
}

function addFieldInteraction(FI, entity, fieldName, fieldMapId, interactionName) {
  logger.debug(`Adding Field Interaction: name: '${interactionName}' , FI: ${JSON.stringify(FI)}`)
  FI.fieldMapID = fieldMapId;
  let resCode;

  return apiClient.insertEntity('FieldMapInteraction', FI).then(response => {
    resCode = response.status;

    return response.json()
  }).then(result => {
    const formattedResponse = JSON.stringify(result);
    logger.fiData(`Add Field Map Interaction url: entity/FieldMapInteraction`);
    logger.fiData(`Add Field Map Interaction payload: ${JSON.stringify(FI)}`);
    logger.fiData(`Add Field Map Interaction response: ${formattedResponse}`);

    return Promise.resolve(resultsSvc.createFIAddResult(entity, fieldName, interactionName, resCode, formattedResponse));
  }).catch(error => {
    logger.error(chalk.red(error));

    return Promise.reject(new Error(`Fail to make Insert Field Interaction call with error: ${error}`));
  });
}

function updateFieldInteraction(extensionFI, entity, fieldName, toUpdateFI) {
  logger.debug(`Updating Field Map Interaction: #${toUpdateFI.id}, name: '${toUpdateFI.name}', toUpdateFI: ${JSON.stringify(toUpdateFI)}`);
  let resCode;

  return apiClient.updateEntity('FieldMapInteraction', toUpdateFI.id, extensionFI).then(response => {
    resCode = response.status;

    return response.json()
  }).then(result => {
    const formattedResponse = JSON.stringify(result);
    logger.fiData(`Update Field Map Interaction url: entity/FieldMapInteraction/${toUpdateFI.id}`);
    logger.fiData(`Update Field Map Interaction payload: ${JSON.stringify(extensionFI)}`);
    logger.fiData(`Update Field Map Interaction response: ${formattedResponse}`);

    return Promise.resolve(resultsSvc.createFIUpdateResult(entity, fieldName, toUpdateFI, resCode, formattedResponse));
  }).catch(error => {
    logger.error(chalk.red(error));

    return Promise.reject(new Error(`Fail to make Update Field Interaction call with error: ${error}`));
  });
}

function deleteFieldInteraction(id, entity, fieldName, interactionName) {
  logger.debug(`Deleting Field Map Interaction #${id}, name: '${interactionName}'`);
  let resCode;

  return apiClient.deleteEntity('FieldMapInteraction', id).then(response => {
    resCode = response.status;

    return response.json()
  }).then(result => {
    const formattedResponse = JSON.stringify(result);
    logger.fiData(`Delete Field Map Interaction url: entity/FieldMapInteraction/${id}`);
    logger.fiData(`Delete Field Map Interaction response: ${formattedResponse}`);

    return Promise.resolve(resultsSvc.createFIDeleteResult(entity, fieldName, {name: interactionName, id: id}, resCode, formattedResponse));
  }).catch(error => {
    logger.error(chalk.red(error));

    return Promise.reject(new Error(`Fail to make delete Field Interaction call with error: ${error}`));
  });
}

module.exports = {
  setUpService,
  getFieldMapInstances,
  getFieldInteractions,
  getAllFieldInteractions,
  addFieldInteraction,
  updateFieldInteraction,
  deleteFieldInteraction
};
