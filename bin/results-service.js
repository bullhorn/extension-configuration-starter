const chalk = require('chalk');
const logger = require('./lib/logger');
const utils = require('./utils');

const ADD = 'add';
const UPDATE = 'update';
const DELETE = 'delete';

function handleFIExtensionsFail(uploadConfig) {
  const results = []
  logger.info(`Creating results for failed FI upload due to no Field Interactions in extension file for ${JSON.stringify(uploadConfig)}`);
  Object.keys(uploadConfig).forEach(entity => {
    results.push(handleFIEntityFail(entity, uploadConfig[entity], 'no Field Interactions in extensions file'));
  });
  return results;
}

function handleFIEntityFail(entityName, entity, reason) {
  const results = [];

  logger.info(`Creating results for failed FI entity for ${JSON.stringify(entity)} due to ${reason}`);

  Object.keys(entity).forEach(config => {
    if (config === 'toUpdate') {
      Object.keys(entity[config]).forEach(field => {
        entity[config][field].interactionNameID.forEach(fi => {
          logger.info(`fi name = ${fi.name} and id = ${fi.id}`);
          results.push(handleUpdateFIFail(entityName, field, fi, reason));
        });
      });
    }

    if (config === 'toAdd') {
      Object.keys(entity[config]).forEach(field => {
        entity[config][field].interactionNames.forEach(fi => {
          results.push(handleAddFIFail(entityName, field, fi, reason));
        });
      });
    }
  });

  return results;
}

function handleUpdateFIFail(entity, field, fi, reason) {
  return {entity: entity, field: field, name: fi.name, operation: UPDATE, id: fi.id, success: false, reason: reason};
}

function handleAddFIFail(entity, field, fi, reason) {
  return {entity: entity, field: field, name: fi, operation: ADD, id: 'n/a', success: false, reason: reason};
}

function handleUpdateCOFIFail(entity, customObject, field, fi, reason) {
  return {entity: entity, customObject: customObject, field: field, name: fi.name, operation: UPDATE, id: fi.id, success: false, reason: reason};
}

function handleAddCOFIFail(entity, customObject, field, fi, reason) {
  return {entity: entity, customObject: customObject, field: field, name: fi, operation: ADD, id: 'n/a', success: false, reason: reason};
}

function handleUpdatePIFail(action, pi, reason) {
  return {action: action, name: pi.name, operation: UPDATE, id: pi.id, success: false, reason: reason};
}

function handleAddPIFail(action, pi, reason) {
  return {action: action, name: pi, operation: ADD, id: '', success: false, reason: reason};
}


function createFIUpdateResult(entity, fieldName, toUpdateFI, responseCode, restLog) {
  const isSuccess = isSuccessful(responseCode);
  const result = {
    entity: entity,
    field: fieldName,
    name: toUpdateFI.name,
    operation: UPDATE,
    id: toUpdateFI.id,
    success: isSuccess, reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`
  }

  return result;
}

function createFIAddResult(entity, fieldName, toUpdateFI, responseCode, restLog) {
  const isSuccess = isSuccessful(responseCode);
  const result = {
    entity: entity,
    field: fieldName,
    name: toUpdateFI,
    operation: ADD,
    id: '',
    success: isSuccess, reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`
  }

  return result;
}

function createFIDeleteResult(entity, fieldName, toDeleteFI, responseCode, restLog) {
  const isSuccess = isSuccessful(responseCode);
  const result = {
    entity: entity,
    field: fieldName,
    name: toDeleteFI.name,
    operation: DELETE,
    id: toDeleteFI.id,
    success: isSuccess, reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`
  }

  return result;
}

function createCOFIUpdateResult(entity, customObject, fieldName, toUpdateFI, responseCode, restLog) {
  const isSuccess = isSuccessful(responseCode);
  const result = {
    entity: entity,
    customObject: customObject,
    field: fieldName,
    name: toUpdateFI.name,
    operation: UPDATE,
    id: toUpdateFI.id,
    success: isSuccess, reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`
  }

  return result;
}

function createCOFIAddResult(entity, customObject, fieldName, toUpdateFI, responseCode, restLog) {
  const isSuccess = isSuccessful(responseCode);
  const result = {
    entity: entity,
    customObject: customObject,
    field: fieldName,
    name: toUpdateFI,
    operation: ADD,
    id: '',
    success: isSuccess, reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`
  }

  return result;
}

function createCOFIDeleteResult(entity, customObject, fieldName, toDeleteFI, responseCode, restLog) {
  const isSuccess = isSuccessful(responseCode);
  const result = {
    entity: entity,
    customObject: customObject,
    field: fieldName,
    name: toDeleteFI.name,
    operation: DELETE,
    id: toDeleteFI.id,
    success: isSuccess, reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`
  }

  return result;
}


function createPIUpdateResult(action, pi, responseCode, restLog) {
  const isSuccess = isSuccessful(responseCode);
  const result = {
    action: action,
    name: pi.name,
    operation: UPDATE,
    id: pi.id,
    success: isSuccess, reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`
  }

  return result;
}

function createPIAddResult(action, pi, responseCode, restLog) {
  const isSuccess = isSuccessful(responseCode);
  const result = {
    action: action,
    name: pi,
    operation: ADD,
    id: '',
    success: isSuccess, reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`
  }

  return result;
}

function createPIDeleteResult(action, pi, responseCode, restLog) {
  const isSuccess = isSuccessful(responseCode);
  const result = {
    action: action,
    name: pi.name,
    operation: DELETE,
    id: pi.id,
    success: isSuccess, reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`
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

  const failures = {};

  if (results.deleted && results.deleted) {
    failures.delete = printDeletedResults(results.deleted);
  }

  failures.deploy = {};

  if (results.fieldInteractions && results.fieldInteractions.length) {
    failures.deploy.fieldInteractions = printFieldInteractionResults(results.fieldInteractions);
  }

  if (results.customObjectFIs && results.customObjectFIs.length) {
    failures.deploy.customObjectFIs = printCOFieldInteractionResults(results.customObjectFIs);
  }

  if (results.pageInteractions && results.pageInteractions.length) {
    failures.deploy.pageInteractions = printPageInteractionResults(results.pageInteractions);
  }

  logger.printSeparator();
  printFailures(failures);
  printCounts(results);
}

function printDeletedResults(results) {
  logger.info('Deleted Interactions');

  const failures = {};

  if (results.fieldInteractions && results.fieldInteractions.length) {
    failures.fieldInteractions = printFieldInteractionResults(results.fieldInteractions);
  }

  if (results.customObjectFIs && results.customObjectFIs.length) {
    failures.customObjectFIs = printCOFieldInteractionResults(results.customObjectFIs);
  }

  if (results.pageInteractions && results.pageInteractions.length) {
    failures.pageInteractions = printPageInteractionResults(results.pageInteractions);
  }

  return failures;
}

function printFieldInteractionResults(results) {
  logger.printSeparator();

  logger.info('Field Interactions');

  const failures = [];
  const allEntities = results.map(result => result.entity).filter(utils.onlyUnique);

  allEntities.forEach(entity => {
    fillToSeparate(` Entity: ${entity} `, '<<', '>>', 75);
    const entityFields = results.filter(fiEntity => fiEntity.entity === entity).map(fiField => fiField.field).filter(utils.onlyUnique);
    entityFields.forEach(field => {
      fillToSeparate(` Field: ${field} `, '<', '>', 35);
      results.filter(fi => fi.entity === entity && fi.field === field).forEach(result => {
        if (!result.success) {
          failures.push(result);
        } else {
          if (result.operation === UPDATE) {
            logger.info(chalk.blue(`- ${result.name} - UPDATED`));
          }

          if (result.operation === ADD) {
            logger.info(chalk.green(`- ${result.name} - ADDED`));
          }

          if (result.operation === DELETE) {
            logger.info(chalk.magenta(`- ${result.name} - DELETED`));
          }
        }
      });
    });
  });

  return failures;
}

function printCOFieldInteractionResults(results) {
  logger.printSeparator();

  logger.info('Custom Object Field Interactions');

  const failures = [];
  const allCustomObjects = results.map(result => result.customObject).filter(utils.onlyUnique);

  allCustomObjects.forEach(customObject => {
    const allCOEntities = results.filter(coEntity => coEntity.entity && coEntity.customObject === customObject).map(entity => entity.entity).filter(utils.onlyUnique);

    allCOEntities.forEach(coEntity => {
      fillToSeparate(` Custom Object: ${customObject} (${coEntity}) `, '<<', '>>', 75);
      const coFields = results.filter(coField => coField.entity === coEntity && coField.customObject === customObject).map(fiField => fiField.field).filter(utils.onlyUnique);

      coFields.forEach(field => {
        fillToSeparate(` Field: ${field} `, '<', '>', 35);
        results.filter(fi => fi.entity === coEntity && fi.field === field && fi.customObject === customObject).forEach(result => {
          if (!result.success) {
            failures.push(result);
          } else {

            if (result.operation === UPDATE) {
              logger.info(chalk.blue(`- ${result.name} - UPDATED`));
            }

            if (result.operation === ADD) {
              logger.info(chalk.green(`- ${result.name} - ADDED`));
            }

            if (result.operation === DELETE) {
              logger.info(chalk.magenta(`- ${result.name} - DELETED`));
            }
          }
        });
      });
    });
  })

  return failures;
}

function printPageInteractionResults(results) {
  logger.printSeparator();

  logger.info('Page Interactions');

  const failures = [];
  const allActions = results.map(result => result.action).filter(utils.onlyUnique);

  allActions.forEach(action => {
    fillToSeparate(` Action: ${action}`, '<<', '>>', 75);
    results.filter(pi => pi.action === action).forEach(result => {
      if (!result.success) {
        failures.push(result)
      } else {
        if (result.operation === UPDATE) {
          logger.info(chalk.blue(`- ${result.name} - UPDATED`));
        }
        if (result.operation === ADD) {
          logger.info(chalk.green(`- ${result.name} - ADDED`));
        }
        if (result.operation === DELETE) {
          logger.info(chalk.magenta(`- ${result.name} - DELETED`));
        }
      }
    });
  });

  return failures;
}

function printFailures(failures) {
  if (failures && failures.delete) {
    const deleteFailures = failures.delete;

    if (Object.values(deleteFailures).flat().length) {
      if (deleteFailures && deleteFailures.fieldInteractions && deleteFailures.fieldInteractions.length) {
        logger.info(`The following field interactions failed to be deleted`);
        printFieldInteractionFails(deleteFailures.fieldInteractions);
        logger.printSeparator();
      }

      if (deleteFailures && deleteFailures.customObjectFIs && deleteFailures.customObjectFIs.length) {
        logger.info(`The following custom object interactions failed to be deleted`);
        printCOInteractionFails(deleteFailures.customObjectFIs);
        logger.printSeparator();
      }

      if (deleteFailures && deleteFailures.pageInteractions && deleteFailures.pageInteractions.length) {
        logger.info(`The following Page Interactions failed to be deleted`);
        printPageInteractionFails(deleteFailures.pageInteractions);
        logger.printSeparator();
      }
    }
  }

  if (failures && failures.deploy) {
    const deployFailures = failures.deploy;

    if (Object.values(deployFailures).flat().length) {
      logger.info(chalk.red('The following interactions failed to be deployed'));

      if (deployFailures && deployFailures.fieldInteractions && deployFailures.fieldInteractions.length) {
        logger.info(`The following Field Interactions failed to be deployed`);
        printFieldInteractionFails(deployFailures.fieldInteractions);
        logger.printSeparator();
      }

      if (deployFailures && deployFailures.customObjectFIs && deployFailures.customObjectFIs.length) {
        logger.info(`The following Custom Object Field Interactions failed to be deployed`);
        printCOInteractionFails(deployFailures.customObjectFIs);
        logger.printSeparator();
      }

      if (deployFailures && deployFailures.pageInteractions && deployFailures.pageInteractions.length) {
        logger.info(`The following Page Interactions failed to be deployed`);
        printPageInteractionFails(deployFailures.pageInteractions);
        logger.printSeparator();
      }
    }
  }
}

function printFieldInteractionFails(fails) {
  const allEntities = fails.map(result => result.entity).filter(utils.onlyUnique);

  allEntities.forEach(entity => {
    fillToSeparate(` Entity: ${entity} `, '<<', '>>', 75);
    const entityFields = fails.filter(fiEntity => fiEntity.entity === entity).map(fiField => fiField.field).filter(utils.onlyUnique);

    entityFields.forEach(field => {
      fillToSeparate(` Field: ${field} `, '<', '>', 35);
      fails.filter(fi => fi.entity === entity && fi.field === field).forEach(result => {
        logger.info(chalk.red(`--- ${result.name} - Reason: ${result.reason}`));
      });
    });
  });
}

function printCOInteractionFails(fails) {
  const allCustomObjects = fails.map(result => result.customObject).filter(utils.onlyUnique);

  allCustomObjects.forEach(customObject => {
    const allCOEntities = fails.filter(coEntity => coEntity.entity && coEntity.customObject === customObject).map(entity => entity.entity).filter(utils.onlyUnique);

    allCOEntities.forEach(coEntity => {
      fillToSeparate(` Custom Object: ${customObject} (${coEntity}) `, '<<', '>>', 75);
      const coFields = fails.filter(coField => coField.entity === coEntity && coField.customObject === customObject).map(fiField => fiField.field).filter(utils.onlyUnique);

      coFields.forEach(field => {
        fillToSeparate(` Field: ${field} `, '<', '>', 35);
        fails.filter(fi => fi.entity === coEntity && fi.field === field && fi.customObject === customObject).forEach(result => {
          logger.info(chalk.red(`- ${result.name} - Reason: ${result.reason}`));
        });
      });
    });
  })
}

function printPageInteractionFails(fails) {
  const allActions = fails.map(result => result.action).filter(utils.onlyUnique);

  allActions.forEach(action => {
    fillToSeparate(` Action: ${action}`, '<<', '>>', 75);
    fails.filter(pi => pi.action === action).forEach(result => {
      logger.info(chalk.red(`- ${result.name} - Reason: ${result.reason}`));
    });
  });
}

function printCounts(results) {
  logger.info('Deploy Summary \n');
  const deployedInteractions = results.fieldInteractions.concat(results.customObjectFIs, results.pageInteractions);
  const totalDeployed = deployedInteractions.filter(result => result.success).length;
  logger.info(chalk.blue(`Total interactions deployed: ${totalDeployed} \n`))
  const deletedInteractions = results.deleted ? results.deleted : [];
  const totalDeleted = Object.values(deletedInteractions).flat().filter(result => result.success).length;
  logger.info(chalk.magenta(`Total interactions deleted: ${totalDeleted} \n`))
  const totalFails = deployedInteractions.filter(result => !result.success).length + Object.values(deletedInteractions).flat().filter(result => !result.success).length;

  if (totalFails > 0) {
    logger.info(chalk.red(`Total Failures: ${totalFails} \n`));
    logger.info('Deploy Complete');
    logger.info(chalk.bgRed('FAILURES DETECTED PLEASE REVIEW ABOVE'));
  } else {
    logger.info('Deploy Complete');
    logger.info(chalk.green('No Failures Detected'));
  }

  logger.printSeparator();
}

function fillToSeparate(text, beginSym, endSym, size) {
  const totalSize = size - (text.length + beginSym.length + endSym.length);

  if (totalSize < -2) {
    logger.info(text);
  } else {
    let sep = beginSym;
    const halfSize = Math.floor(totalSize / 2);

    for (let i = 0; i < halfSize; i++) {
      sep += '-'
    }
    sep += text;

    for (let i = 0; i < halfSize; i++) {
      sep += '-'
    }
    sep += endSym
    logger.info(sep);
  }
}


module.exports = {
  handleFIExtensionsFail,
  handleFIEntityFail,
  handleUpdateFIFail,
  handleAddFIFail,
  handleUpdateCOFIFail,
  handleAddCOFIFail,
  createFIUpdateResult,
  createFIAddResult,
  createFIDeleteResult,
  createCOFIUpdateResult,
  createCOFIAddResult,
  createCOFIDeleteResult,
  handleUpdatePIFail,
  handleAddPIFail,
  createPIUpdateResult,
  createPIAddResult,
  createPIDeleteResult,
  printResults
};
