const chalk = require('chalk');
const winston = require('winston');
const utils = require('./utils');

const ADD = 'add';
const UPDATE = 'update';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: './deploy-logs/error.log', level: 'error', format: winston.format.simple(), options: { flags: 'w' } }),
    new winston.transports.File({ filename: './deploy-logs/combined.log', level: 'debug', format: winston.format.simple(), options: { flags: 'w' } })
  ],
});

function setUpService(debug) {
  if (debug) {
    logger.level = 'debug';
  }
}

function handleFIExtentionsFail(uploadConfig) {
  results = []
  logger.debug(`Creating results for failed FI upload due to no Field Interactions in extention file for ${JSON.stringify(uploadConfig)}`);
  Object.keys(uploadConfig).forEach(entity => {
    results.push(handleFIEntityFail(entity, uploadConfig[entity], 'no Field Interactions in Extentions file'));
  });
  return results;
}

function handleFIEntityFail(entityName, entity, reason) {
  results = [];
  logger.debug(`Creating results for failed FI entity for  for ${JSON.stringify(entity)} due to ${reason}`);
  Object.keys(entity).forEach(config => {
    if (config === 'toUpdate') {
      Object.keys(entity[config]).forEach(field => {
        entity[config][field].interactionNameID.forEach(fi => {
          logger.debug(`fi name = ${fi.name} and id = ${fi.id}`);
          results.push(handleUpdateFIFail(entityName, field, fi, reason));
        });
      });
    }
    if (config === 'toAdd') {
      Object.keys(entity[config]).forEach(field => {
        entity[config][field].fieldName.forEach(fi => {
          results.push(handleAddFIFail(entityName, field, fi, reason));
        });
      });
    }
  });
  return results;
}

function handleUpdateFIFail(entity, field, fi, reason) {
  return { entity: entity, field: field, name: fi.name, operation: UPDATE, id: fi.id, success: false, reason: reason };
}

function handleAddFIFail(entity, field, fi, reason) {
  return { entity: entity, field: field, name: fi, operation: ADD, id: 'n/a', success: false, reason: reason };
}

function handleUpdateCOFIFail(entity, customObject, field, fi, reason) {
  return { entity: entity, customObject: customObject, field: field, name: fi.name, operation: UPDATE, id: fi.id, success: false, reason: reason };
}

function handleAddCOFIFail(entity, customObject, field, fi, reason) {
  return { entity: entity, customObject: customObject, field: field, name: fi, operation: ADD, id: 'n/a', success: false, reason: reason };
}

function handleUpdatePIFail(action, pi, reason) {
  return { action: action, name: pi.name, operation: UPDATE, id: pi.id, success: false, reason: reason };
}

function handleAddPIFail(action, pi, reason) {
  return { action: action, name: pi, operation: ADD, id: '', success: false, reason: reason };
}


function createFIUpdateResult(entity, fieldName, toUpdateFI, responseCode) {
  const isSuccess = isSuccessful(responseCode);
  const result = {
    entity: entity,
    field: fieldName,
    name: toUpdateFI.name,
    operation: UPDATE,
    id: toUpdateFI.id,
    success: isSuccess, reason: isSuccess ? '' : `call failed with ${responseCode}, please check rest logs`
  }
  return result;
}
function createFIAddResult(entity, fieldName, toUpdateFI, responseCode) {
  const isSuccess = isSuccessful(responseCode);
  const result = {
    entity: entity,
    field: fieldName,
    name: toUpdateFI,
    operation: ADD,
    id: '',
    success: isSuccess, reason: isSuccess ? '' : `call failed with ${responseCode}, please check rest logs`
  }
  return result;
}

function createCOFIUpdateResult(entity, customObject, fieldName, toUpdateFI, responseCode) {
  const isSuccess = isSuccessful(responseCode);
  const result = {
    entity: entity,
    customObject: customObject,
    field: fieldName,
    name: toUpdateFI.name,
    operation: UPDATE,
    id: toUpdateFI.id,
    success: isSuccess, reason: isSuccess ? '' : `call failed with ${responseCode}, please check rest logs`
  }
  return result;
}
function createCOFIAddResult(entity, customObject, fieldName, toUpdateFI, responseCode) {
  const isSuccess = isSuccessful(responseCode);
  const result = {
    entity: entity,
    customObject: customObject,
    field: fieldName,
    name: toUpdateFI,
    operation: ADD,
    id: '',
    success: isSuccess, reason: isSuccess ? '' : `call failed with ${responseCode}, please check rest logs`
  }
  return result;
}


function createPIUpdateResult(action, pi, responseCode) {
  const isSuccess = isSuccessful(responseCode);
  const result = {
    action: action,
    name: pi.name,
    operation: UPDATE,
    id: pi.id,
    success: isSuccess, reason: isSuccess ? '' : `call failed with ${responseCode}, please check rest logs`
  }
  return result;
}
function createPIAddResult(action, pi, responseCode) {
  const isSuccess = isSuccessful(responseCode);
  const result = {
    action: action,
    name: pi,
    operation: ADD,
    id: '',
    success: isSuccess, reason: isSuccess ? '' : `call failed with ${responseCode}, please check rest logs`
  }
  return result;
}

function isSuccessful(responseCode) {
  return responseCode < 300;
}

function printResults(results, privateLabel) {
  logger.info(' _________');
  logger.info('| RESULTS |');
  logger.info(' ‾‾‾‾‾‾‾‾‾');
  logger.info(`Deployment Complete for Private Label: ${privateLabel} with the following results`);
  if (results.fieldInteractions && results.fieldInteractions.length) {
    printFieldInteractionResults(results.fieldInteractions);
  }
  if (results.customObjectFIs && results.customObjectFIs.length) {
    printCOFieldInteractionResults(results.customObjectFIs);
  }
  if (results.pageInteractions && results.pageInteractions.length) {
    printPageInteractionResults(results.pageInteractions);
  }
  printSeparator();
}

function printFieldInteractionResults(results) {
  printSeparator();
  logger.info('Field Interactions');
  const allEntities = results.map(result => result.entity).filter(utils.onlyUnique);
  allEntities.forEach(entity => {
    logger.info(`- Entity: ${entity}`);
    const entityFields = results.filter(fiEntity => fiEntity.entity === entity).map(fiField => fiField.field).filter(utils.onlyUnique);
    entityFields.forEach(field => {
      logger.info(`-- Field: ${field}`);
      results.filter(fi => fi.entity === entity && fi.field === field).forEach(result => {
        if (!result.success) {
          logger.info(chalk.red(`--- ${result.name} - FAILED - ${result.reason}`));
        } else {
          if (result.operation === UPDATE) {
            logger.info(chalk.blue(`--- ${result.name} - UPDATED`));
          }
          if (result.operation === ADD) {
            logger.info(chalk.green(`--- ${result.name} - ADDED`));
          }
        }
      });
    });
  })
}

function printCOFieldInteractionResults(results) {
  printSeparator();
  logger.info('Custom Object Field Interactions');
  const allCustomObjects = results.map(result => result.customObject).filter(utils.onlyUnique);
  allCustomObjects.forEach(customObject => {
    const allCOEntities = results.filter(coEntity => coEntity.entity && coEntity.customObject === customObject).map(entity => entity.entity).filter(utils.onlyUnique);
    allCOEntities.forEach(coEntity => {
      logger.info(`- Custom Object: ${customObject} (${coEntity})`);
      const coFields = results.filter(coField => coField.entity === coEntity && coField.customObject === customObject).map(fiField => fiField.field).filter(utils.onlyUnique);
      coFields.forEach(field => {
        logger.info(`-- Field: ${field}`);
        results.filter(fi => fi.entity === coEntity && fi.field === field && fi.customObject === customObject).forEach(result => {
          if (!result.success) {
            logger.info(chalk.red(`--- ${result.name} - FAILED - ${result.reason}`));
          } else {
            if (result.operation === UPDATE) {
              logger.info(chalk.blue(`--- ${result.name} - UPDATED`));
            }
            if (result.operation === ADD) {
              logger.info(chalk.green(`--- ${result.name} - ADDED`));
            }
          }
        });
      });
    });
  })
}

function printPageInteractionResults(results) {
  printSeparator();
  logger.info('Page Interactions');
  const allActions = results.map(result => result.action).filter(utils.onlyUnique);
  allActions.forEach(action => {
    logger.info(`- Action: ${action}`);
    results.filter(pi => pi.action === action).forEach(result => {
      if (!result.success) {
        logger.info(chalk.red(`-- ${result.name} - FAILED - ${result.reason}`));
      } else {
        if (result.operation === UPDATE) {
          logger.info(chalk.blue(`-- ${result.name} - UPDATED`));
        }
        if (result.operation === ADD) {
          logger.info(chalk.green(`-- ${result.name} - ADDED`));
        }
      }
    });
  });
}

function printSeparator() {
  logger.info('------------------------------------------------------------------------------------------');
}



module.exports = {
  setUpService,
  handleFIExtentionsFail,
  handleFIEntityFail,
  handleUpdateFIFail,
  handleAddFIFail,
  handleUpdateCOFIFail,
  handleAddCOFIFail,
  createFIUpdateResult,
  createFIAddResult,
  createCOFIUpdateResult,
  createCOFIAddResult,
  handleUpdatePIFail,
  handleAddPIFail,
  createPIUpdateResult,
  createPIAddResult,
  printResults
};