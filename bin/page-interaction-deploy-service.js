const chalk = require('chalk');
const logger = require('./lib/logger');
const pageIntRestSvc = require('./page-interactions-crud-service');
const resultsSvc = require('./results-service');
const utils = require('./utils');

function setUpService(restApiClient) {
  pageIntRestSvc.setUpService(restApiClient);
}

function deploySelectedPageInteractions(selectiveExtensions, extensions, deployFiOnly) {
  if (deployFiOnly) {
    logger.multiLog(chalk.yellow('Skipping Page Interactions because they were already deployed within first user'), logger.multiLogLevels.warnPiData);

    return Promise.resolve([]);
  }

  if (!selectiveExtensions.pageInteractions || Object.keys(selectiveExtensions.pageInteractions).length === 0) {
    logger.multiLog(chalk.yellow('Could not find Page Interactions in "selective-extension.json" file. Page Interactions will be skipped!'), logger.multiLogLevels.warnPiData);

    return Promise.resolve([]);
  }

  const selectivePageInteractions = selectiveExtensions.pageInteractions;
  logger.multiLog('Selective Page Interactions deploy', logger.multiLogLevels.debugPiData);

  return pageIntRestSvc.getPageInteractions(selectivePageInteractions).then(data => {
    if (data) {
      const uploadConfig = createPageInteractionsUploadConfig(data, selectivePageInteractions);
      logger.multiLog(`Page Interactions uploadConfig: ${JSON.stringify(uploadConfig)}`, logger.multiLogLevels.debugPiData);
      const promiseList = [];
      const results = [];

      Object.keys(uploadConfig).forEach(action => {
        if (uploadConfig[action].toUpdate) {
          logger.multiLog(`Updating Page Interactions for action: ${action}`, logger.multiLogLevels.debugPiData);

          uploadConfig[action].toUpdate.forEach(pageInteraction => {
            logger.multiLog(`Updating Page Interaction: '${pageInteraction.name}'`, logger.multiLogLevels.debugPiData);
            const extensionsPI = extensions.pageInteractions.find(pi => pageInteraction.name === pi.name && action === pi.action);

            if (extensionsPI) {
              promiseList.push(pageIntRestSvc.updatePageInteraction(extensionsPI, action, pageInteraction));
            } else {
              logger.multiLog(chalk.yellow(`Could not find '${pageInteraction.name}' for '${action}' in extensions file. Page Interaction will not be deployed!`), logger.multiLogLevels.warnPiData);
              results.push(resultsSvc.handleUpdatePIFail(action, pageInteraction, `Could not find ${pageInteraction.name} for ${action} in extension file`));
            }
          });
        }

        if (uploadConfig[action].toAdd) {
          logger.multiLog(`Adding Page Interactions for action: ${action}`, logger.multiLogLevels.debugPiData);

          uploadConfig[action].toAdd.forEach(pageInteraction => {
            logger.multiLog(`Adding Page Interaction: '${pageInteraction}'`, logger.multiLogLevels.debugPiData);
            const extensionsPI = extensions.pageInteractions.find(pi => pageInteraction === pi.name && action === pi.action);

            if (extensionsPI) {
              promiseList.push(pageIntRestSvc.addPageInteraction(extensionsPI, action, pageInteraction));
            } else {
              logger.multiLog(chalk.yellow(`Could not find '${pageInteraction}' for '${action}' in extensions file. Page interaction will not be deployed!`), logger.multiLogLevels.warnPiData);
              results.push(resultsSvc.handleAddPIFail(action, pageInteraction, `Could not find ${pageInteraction} for ${action} in extension file`));
            }
          });
        }
      });

      return Promise.allSettled(promiseList).then(responses => {
        const responseValues = responses.map(response => response.value);

        return results.concat(responseValues).flat();
      });
    }

    return Promise.resolve([]);
  });
}

function deployAllPageInteractions(extensions, deployFiOnly) {
  if (deployFiOnly) {
    logger.multiLog(chalk.yellow('Skipping Page Interactions because they were already deployed within first user'), logger.multiLogLevels.warnPiData);

    return Promise.resolve([]);
  }

  const fullConfig = {};

  if (extensions.pageInteractions && extensions.pageInteractions.length > 0) {
    const actions = extensions.pageInteractions.map(piAction => piAction.action).filter(utils.onlyUnique);

    actions.forEach(action => {
      fullConfig[action] = extensions.pageInteractions.filter(piAction => piAction.action === action).map(piName => piName.name);
    });
  } else {
    logger.multiLog(chalk.yellow(`Could not find Page Interactions in "extension.json" file. Page Interactions will be skipped!`), logger.multiLogLevels.warnPiData);

    return Promise.resolve([]);
  }
  logger.multiLog('Full Page Interactions deploy', logger.multiLogLevels.debugPiData);

  return pageIntRestSvc.getPageInteractions(fullConfig).then(piData => {
    if (piData) {
      const uploadConfig = createPageInteractionsUploadConfig(piData, fullConfig);
      logger.multiLog(`Page Interactions uploadConfig: ${JSON.stringify(uploadConfig)}`, logger.multiLogLevels.debugPiData);
      const promiseList = [];
      const results = [];

      Object.keys(uploadConfig).forEach(action => {
        if (uploadConfig[action].toUpdate) {
          logger.debug(`Updating Page Interactions for action: ${action}`);

          uploadConfig[action].toUpdate.forEach(pageInteraction => {
            logger.multiLog(`Updating Page Interaction: '${pageInteraction.name}'`, logger.multiLogLevels.debugPiData);
            const extensionsPI = extensions.pageInteractions.find(pi => pageInteraction.name === pi.name && action === pi.action);

            if (extensionsPI) {
              promiseList.push(pageIntRestSvc.updatePageInteraction(extensionsPI, action, pageInteraction));
            } else {
              logger.multiLog(chalk.yellow(`Could not find '${pageInteraction.name}' for '${action}' in extensions file. Page Interaction will not be deployed!`), logger.multiLogLevels.warnPiData);
              results.push(resultsSvc.handleUpdatePIFail(action, pageInteraction, `Could not find ${pageInteraction.name} for ${action} in extension file`));
            }
          });
        }

        if (uploadConfig[action].toAdd) {
          logger.multiLog(`Adding Page Interactions for action: ${action}`, logger.multiLogLevels.debugPiData);

          uploadConfig[action].toAdd.forEach(pageInteraction => {
            logger.multiLog(`Adding Page Interaction: ${pageInteraction}`, logger.multiLogLevels.debugPiData);
            const extensionsPI = extensions.pageInteractions.find(pi => pageInteraction === pi.name && action === pi.action);

            if (extensionsPI) {
              promiseList.push(pageIntRestSvc.addPageInteraction(extensionsPI, action, pageInteraction));
            } else {
              logger.multiLog(chalk.yellow(`Could not find '${pageInteraction}' for '${action}' in extensions file. Page Interaction will not be deployed!`), logger.multiLogLevels.warnPiData);
              results.push(resultsSvc.handleAddPIFail(action, pageInteraction, `Could not find ${pageInteraction} for ${action} in extension file`));
            }
          });
        }
      });

      return Promise.allSettled(promiseList).then(responses => {
        const responseValues = responses.map(response => response.value);

        return results.concat(responseValues).flat();
      });
    }

    return Promise.resolve([]);
  });
}

function createPageInteractionsUploadConfig(piData, pageInteractions) {
  const uploadConfig = {};

  Object.keys(pageInteractions).forEach(action => {
    uploadConfig[action] = {};
    const toUpdateNameID = [];
    const toAddNames = [];

    for (const selectivePI of pageInteractions[action]) {
      if (piData.find(pi => pi.action === action && pi.name === selectivePI)) {
        const id = piData.find(pi => pi.action === action && pi.name === selectivePI).id
        toUpdateNameID.push({name: selectivePI, id: id});
      } else {
        toAddNames.push(selectivePI);
      }
    }

    if (toUpdateNameID.length) {
      if (!uploadConfig[action].toUpdate) {
        uploadConfig[action].toUpdate = {}
      }

      uploadConfig[action].toUpdate = toUpdateNameID;
    }

    if (toAddNames.length) {
      if (!uploadConfig[action].toAdd) {
        uploadConfig[action].toAdd = {}
      }

      uploadConfig[action].toAdd = toAddNames;
    }
  });

  return uploadConfig;
}

module.exports = {
  setUpService,
  deploySelectedPageInteractions,
  deployAllPageInteractions
};
