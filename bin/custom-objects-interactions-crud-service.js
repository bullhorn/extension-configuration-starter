const fs = require('fs');
const fetch = require('node-fetch');
const resultsSvc = require('./results-service');
const winston = require('winston');
const utils = require('./utils');


const logger = winston.createLogger({
  levels: utils.loggingLevels.levels,
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: './deploy-logs/error.log', level: 'error', format: winston.format.simple(), options: { flags: 'w' } }),
    new winston.transports.File({ filename: './deploy-logs/combined.log', level: 'debug', format: winston.format.simple(), options: { flags: 'w' } }),
    new winston.transports.File({ filename: './deploy-logs/rest-responses/custom-object-field-interactions.log', level: 'data', format: winston.format.json(), options: { flags: 'w' } }),
    new winston.transports.File({ filename: './deploy-logs/results/custom-object-field-interactions.log', level: 'data', format: winston.format.simple(), options: { flags: 'w' } }),
    new winston.transports.File({ filename: './deploy-logs/dev-logs.log', level: 'dev', format: winston.format.simple(), options: { flags: 'w' } })

  ],
});



let restUrl = ''
let restToken = ''

function setUpService(debug, rest) {
  if (debug) {
    logger.level = 'debug';
  }
  restUrl = rest.url;
  restToken = rest.token
  resultsSvc.setUpService(debug);
}

function fecthCustomObjectData(url, params, entity) {
  return fetch(url, {
    method: 'POST',
    body: JSON.stringify(params),
  }).then(response => response.json())
    .then(result => {
      logger.data(`get Custom Object Data ${url}`);
      logger.data(`get Custom Object Data response: ${JSON.stringify(result)}`);
      if (result.data && result.data.length) {
        result.data.forEach(data => data.type = entity);
      }
      return Promise.resolve(result);
    }).catch(error => {
      logger.error(chalk.red(error));
    });
}

function getCustomObjectInstances(coQueryConfigs) {
  logger.debug('Fetching CO instances');
  const urls = Object.values(coQueryConfigs).map(conf => conf.objectUrl).filter(utils.onlyUnique);
  const entities = Object.values(coQueryConfigs).map(conf => conf.entityName).filter(utils.onlyUnique);
  const promiseList = [];
  urls.forEach(objUrl => {
    const urlObjcts = Object.values(coQueryConfigs).filter(coQueryConfig => coQueryConfig.objectUrl === objUrl);
    entities.forEach(entity => {
      const entityObjects = urlObjcts.filter(entityObjConfig => entityObjConfig.entityName === entity);
      if (entityObjects.length) {
        let whereQueries = [];
        for (const entityObj of entityObjects) {
          let entityQuery = ''
          if (objUrl === 'UserCustomObject') {
            entityQuery = `(type = '${entity}' AND objectNumber = ${entityObj.objectInstance}`;
          } else {
            entityQuery = `(objectNumber = ${entityObj.objectInstance}`
          }
          whereQueries.push(entityQuery);
        }
        const finalWhereQuery = `${whereQueries.join(') OR ')})`;
        const params = {
          where: finalWhereQuery,
          fields: 'id,objectNumber',
          orderBy: 'id',
          start: 0,
          count: 500
        }
        promiseList.push(fecthCustomObjectData(`${restUrl}/query/${objUrl}?BhRestToken=${restToken}`, params, entity));
      }
    });
  });
  return Promise.allSettled(promiseList).then(results => results.map(result => result.value.data).flat());
}


function getCustomObjectsFields(coQueryConfigs) {
  logger.debug('Fetching CO Fields');
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
        const params = {
          fields: 'id,customObject(id),columnName',
          where: finalWhereQuery,
          orderBy: 'id',
          start: '0',
          count: '500'
        }
        promiseList.push(fecthCustomObjectData(`${restUrl}/query/${objUrl}Attribute?BhRestToken=${restToken}`, params, entity));
      }
    });
  });
  return Promise.allSettled(promiseList).then(results => results.map(result => result.value.data).flat());
}



function getCustomObjectFieldInteractions(coQueryConfigs) {
  logger.debug('Fetching CO FIs');
  const urls = Object.values(coQueryConfigs).map(conf => conf.objectUrl).filter(utils.onlyUnique);
  const entities = Object.values(coQueryConfigs).map(conf => conf.entityName).filter(utils.onlyUnique);
  const promiseList = [];
  urls.forEach(objUrl => {
    const objUrlConfigs = Object.values(coQueryConfigs).filter(coQueryConfig => coQueryConfig.objectUrl === objUrl);
    entities.forEach(entity => {
      const entityObjects = objUrlConfigs.filter(entityObjConfig => entityObjConfig.entityName === entity);
      if (entityObjects.length) {
        let whereQueries = [];
        entityObjects.forEach(objt => {
          whereQueries = whereQueries.concat(objt.fields.map(field => {
            return `(attribute.id = ${field.fieldMapId} AND name in ('${field.fieldInteractionNames.join('\',\'')}'))`
          }));
        });
        const finalWhereQuery = `${whereQueries.join(' OR ')}`;
        const params = {
          where: finalWhereQuery,
          fields: 'id,attribute(id),name',
          orderBy: 'id',
          start: 0,
          count: 500
        }
        promiseList.push(fecthCustomObjectData(`${restUrl}/query/${objUrl}AttributeInteraction?BhRestToken=${restToken}`, params, entity));
      }
    });
  });
  return Promise.allSettled(promiseList).then(results => Promise.resolve(results.map(result => result.value.data).flat()));
}

function updateFieldInteraction(extensionFI, entity, customObject, fieldName, toUpdateFI, objUrl) {
  logger.debug('updating CO FI: ', toUpdateFI)
  const url = `${restUrl}/entity/${objUrl}AttributeInteraction/${toUpdateFI.id}?BhRestToken=${restToken}`
  let resCode
  return fetch(url, {
    method: 'POST',
    body: JSON.stringify(extensionFI)
  }).then(response => {
    resCode = response.status;
    return response.json()
  }).then(result => {
    logger.data(`update Field Interaction: ${url}`);
    logger.data(`payload: ${JSON.stringify(extensionFI)}`);
    logger.data(`update Field Interaction response: ${JSON.stringify(result)}`);
    logger.dev(`update result: ${JSON.stringify(resultsSvc.createCOFIUpdateResult(entity, customObject, fieldName, toUpdateFI, resCode))}`);
    return Promise.resolve(resultsSvc.createCOFIUpdateResult(entity, customObject, fieldName, toUpdateFI, resCode));
  })
    .catch(error => {
      logger.error(chalk.red(error));
      return Promise.reject(`Fail to make Update Field Interaction call with error: ${error}`);
    });
}

function AddFieldInteraction(FI, entity, customObject, fieldName, FieldMapId, interactionName, objUrl) {
  logger.debug('Adding CO FI: ', interactionName)
  const url = `${restUrl}/entity/${objUrl}AttributeInteraction?BhRestToken=${restToken}`;
  FI.attribute = { id: FieldMapId };
  let resCode
  return fetch(url, {
    method: 'PUT',
    body: JSON.stringify(FI)
  }).then(response => {
    resCode = response.status;
    return response.json()
  }).then(result => {
    logger.data(`add CO Field Interaction: ${url}`);
    logger.data(`payload: ${JSON.stringify(FI)}`);
    logger.data(`add CO Field Interaction response: ${JSON.stringify(result)}`);
    return Promise.resolve(resultsSvc.createCOFIAddResult(entity, customObject, fieldName, interactionName, resCode));
  })
    .catch(error => {
      logger.error(chalk.red(error));
      return Promise.reject(`Fail to make Insert Field Interaction call with error: ${error}`);
    });
}


module.exports = {
  getCustomObjectInstances,
  getCustomObjectsFields,
  getCustomObjectFieldInteractions,
  updateFieldInteraction,
  AddFieldInteraction,
  setUpService
};
