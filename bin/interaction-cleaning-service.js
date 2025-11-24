const fs = require('fs');
const jsonfile = require('jsonfile');
const logger = require('./lib/logger');
const fieldIntRestSvc = require('./field-interactions-crud-service');
const coFieldIntRestSvc = require('./custom-objects-interactions-crud-service');
const pageIntRestSvc = require('./page-interactions-crud-service');
const chalk = require("chalk");

const entityNameMapFileName = `./entityNameMap.json`;
const entityNameMap = JSON.parse(fs.readFileSync(entityNameMapFileName, 'UTF-8'));
const extensionsFileName = `./output/extension.json`;

function setUpService(restApiClient) {
  fieldIntRestSvc.setUpService(restApiClient);
  coFieldIntRestSvc.setUpService(restApiClient);
  pageIntRestSvc.setUpService(restApiClient);
}

function runEnvCleanRoutine(username, deployFiOnly) {
  logger.multiLog('Cleaning env before full deploy...', logger.multiLogLevels.infoIntData);
  const results = {};

  return cleanFieldInteractions(username).then(fiResults => {
    results.fieldInteractions = fiResults;

    return cleanCustomObjectFieldInteractions(username, deployFiOnly).then(coResults => {
      results.customObjectFIs = coResults;

      return cleanPageInteractionResults(username, deployFiOnly).then(piResults => {
        results.pageInteractions = piResults;

        return results;
      });
    });
  });
}

function cleanFieldInteractions(username) {
  logger.multiLog(`Deleting Field Interactions for ${chalk.green(username)} ...`, logger.multiLogLevels.debugFiData);

  return fieldIntRestSvc.getAllFieldInteractions(username).then(allFIsResponse => {
    const allFieldInteractions = allFIsResponse.flat();
    const promiseList = [];

    allFieldInteractions.forEach(fieldInteraction => {
      promiseList.push(fieldIntRestSvc.deleteFieldInteraction(fieldInteraction.id, fieldInteraction.entity, fieldInteraction.fieldName, fieldInteraction.name))
    });

    return Promise.allSettled(promiseList).then(responses => {
      const responseValues = responses.map(response => response.value);

      return responseValues.flat();
    });
  });
}

function cleanCustomObjectFieldInteractions(username, deployFiOnly) {
  if (deployFiOnly) {
    logger.multiLog(chalk.yellow(`Skipping delete Custom Object Field Interactions because they were already deployed within first user and do not need clean up / re-deploy for ${chalk.green(username)}`), logger.multiLogLevels.warnCoFiData);

    return Promise.resolve([]);
  }

  logger.multiLog(`Deleting Custom Object Field Interactions for ${chalk.green(username)} ...`, logger.multiLogLevels.debugCoFiData);
  const coConfigs = [];

  Object.entries(entityNameMap).forEach(([key, val]) => {
    if (val.customObjectURL) {
      coConfigs.push({entity: key, url: val.customObjectURL});
    }
  });

  const getPromiseList = [];

  coConfigs.forEach(conf => {
    getPromiseList.push(coFieldIntRestSvc.getAllCustomObjectAttributeInteractions(conf.entity, conf.url, username));
  });

  return Promise.allSettled(getPromiseList).then(responses => {
    const delPromiseList = [];

    responses.forEach(response => {
      const data = response.value;
      const objUrl = data.url;
      const entity = data.entity;

      data.coFIs.flat().forEach(coInteraction => {
        delPromiseList.push(coFieldIntRestSvc.deleteCustomObjectAttributeInteraction(objUrl,
          coInteraction.id,
          entity,
          coInteraction.attribute.customObject.objectNumber,
          coInteraction.attribute.columnName,
          coInteraction.name));
      });
    });

    return Promise.allSettled(delPromiseList).then(responses => {
      const responseValues = responses.map(response => response.value);

      return responseValues.flat();
    });
  });
}

function cleanPageInteractionResults(username, deployFiOnly) {
  if (deployFiOnly) {
    logger.multiLog(chalk.yellow('Skipping Page Interactions because they were already deployed within first user'), logger.multiLogLevels.warnPiData);

    return Promise.resolve([]);
  }

  logger.multiLog(`Deleting Page Interactions for ${chalk.green(username)} ...`, logger.multiLogLevels.debugPiData);

  return pageIntRestSvc.getAllPageInteractions(username).then(allPIsResponse => {
    const allPageInteractions = allPIsResponse.flat();
    const promiseList = [];

    allPageInteractions.forEach(pageInteraction => {
      promiseList.push(pageIntRestSvc.deletePageInteraction(pageInteraction.id, pageInteraction.action, pageInteraction.name))
    });

    return Promise.allSettled(promiseList).then(responses => {
      const responseValues = responses.map(response => response.value);

      return responseValues.flat();
    });
  });
}

function removeUnnecessaryFieldInteractions(extensions, privateLabelId, callback) {
  if (extensions.fieldInteractions) {
    Object.keys(extensions.fieldInteractions).forEach(entity => {

      if (extensions.fieldInteractions[entity]) {
        for (let index = extensions.fieldInteractions[entity].length - 1; index >= 0; index--) {
          if (extensions.fieldInteractions[entity][index].privateLabelIds && !extensions.fieldInteractions[entity][index].privateLabelIds.includes(privateLabelId)) {
            logger.multiLog(`Removed unnecessary field interactions for Private Label #${privateLabelId} at index ${index}`, logger.multiLogLevels.debugFiData);

            extensions.fieldInteractions[entity].splice(index, 1);
          }
        }
      }
    });
  }

  logger.multiLog(`Successfully removed all unnecessary field interactions for Private Label #${privateLabelId} before auth and upload`, logger.multiLogLevels.debugFiData);

  jsonfile.writeFileSync(extensionsFileName, extensions, {
    spaces: 2,
  });

  callback(extensions);
}

module.exports = {
  setUpService,
  runEnvCleanRoutine,
  removeUnnecessaryFieldInteractions
};
