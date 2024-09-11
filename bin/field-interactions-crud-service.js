const fs = require('fs');
const fetch = require('node-fetch');
const resultsSvc = require('./results-service');
const chalk = require('chalk');
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
    new winston.transports.File({ filename: './deploy-logs/rest-responses/field-interactions.log', level: 'data', format: winston.format.json(), options: { flags: 'w' } }),
    new winston.transports.File({ filename: './deploy-logs/results/field-interactions.log', level: 'data', format: winston.format.simple(), options: { flags: 'w' } }),
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

function fecthFieldInteractionData(url, entity) {
  return fetch(url, {
    method: 'GET'
  }).then(response => response.json())
    .then(result => {
      logger.data(`FieldInteraction Data url: ${url}`);
      logger.data(`FieldInteraction Data response: ${JSON.stringify(result)}`);
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
    let entityQuery = `(entity = '${entity.entityName}' AND (`;
    let fieldQueries = [];
    for (const field of entity.fields) {
      fieldQueries.push(`(columnName = '${field.fieldName}'`);
    }
    entityQuery += fieldQueries.join(') OR ');
    entityQuery += `))) AND privateLabel = ${privateLabelId}` ;
    const url = `${restUrl}/query/FieldMapInstance?BhRestToken=${restToken}&fields=id,entity,columnName&where=${entityQuery}&orderBy=id&start=0&count=500`;
    promiseList.push(fecthFieldInteractionData(url, entity.entityName));
  }
  return Promise.allSettled(promiseList).then(results => results.map(result => result.value.data).flat());
}

function getFieldInteractions(fieldInteractions, privateLabelId) {
  const promiseList = [];
  for (const entity of Object.values(fieldInteractions)) {
    let fieldQueries = '('
    fieldQueries += entity.fields.map(field =>`(fieldMapID = ${field.fieldMapId} AND name in ('${field.fieldInteractionNames.join('\',\'')}')`).join(') OR ');
    fieldQueries += `)) AND privateLabelID = ${privateLabelId}`;
    const url = `${restUrl}/query/FieldMapInteraction?BhRestToken=${restToken}&fields=id,name,fieldMapID,fieldName,entity&where=${fieldQueries}&orderBy=id&start=0&count=500`;    
    promiseList.push(fecthFieldInteractionData(url, entity.entityName));
  }
  return Promise.allSettled(promiseList).then(results => results.map(result => result.value.data).flat());
}

function updateFieldInteraction(extensionFI, entity, fieldName, toUpdateFI) {
  logger.debug('updating FI: ', toUpdateFI)
  const url = `${restUrl}/entity/FieldMapInteraction/${toUpdateFI.id}?BhRestToken=${restToken}`
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
      return Promise.resolve(resultsSvc.createFIUpdateResult(entity, fieldName, toUpdateFI, resCode));
    })
    .catch(error => {
      logger.error(chalk.red(error));
      return Promise.reject(`Fail to make Update Field Interaction call with error: ${error}`);
    });
}

function AddFieldInteraction(FI, entity, fieldName, FieldMapId, interactionName) {
  logger.debug('Adding FI: ', interactionName)
  const url = `${restUrl}/entity/FieldMapInteraction?BhRestToken=${restToken}`;
  FI.fieldMapID = FieldMapId
  let resCode
  return fetch(url, {
    method: 'PUT',
    body: JSON.stringify(FI)
  }).then(response => {
      resCode = response.status;
      return response.json()
    }).then(result => {
      logger.data(`add Field Interaction: ${url}`);
      logger.data(`payload: ${JSON.stringify(FI)}`);
      logger.data(`add Field Interaction response: ${JSON.stringify(result)}`);
      return Promise.resolve(resultsSvc.createFIAddResult(entity, fieldName, interactionName, resCode));
    })
    .catch(error => {
      logger.error(chalk.red(error));
      return Promise.reject(`Fail to make Insert Field Interaction call with error: ${error}`);
    });
}


module.exports = {
  getFieldMapInstances,
  getFieldInteractions,
  updateFieldInteraction,
  AddFieldInteraction,
  setUpService
};