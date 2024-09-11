const fs = require('fs');
const pageInteRestSvc = require('./page-interactions-crud-service');
const chalk = require('chalk');
const resultsSvc = require('./results-service');
const winston = require('winston');
const { Utils } = require('tslint');
const utils = require('./utils');


const logger = winston.createLogger({
  levels: utils.loggingLevels.levels,
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: './deploy-logs/error.log', level: 'error', format: winston.format.simple(), options: { flags: 'w' } }),
    new winston.transports.File({ filename: './deploy-logs/combined.log', level: 'debug', format: winston.format.simple(), options: { flags: 'w' } }),
    new winston.transports.File({ filename: './deploy-logs/dev-logs.log', level: 'dev', format: winston.format.simple(), options: { flags: 'w' } })
  ],
});

function setUpService(debug, rest) {
  if (debug) {
    logger.level = 'debug';
  }
  pageInteRestSvc.setUpService(debug, rest);
  resultsSvc.setUpService(debug);
}


function deploySelectedPageInteractions(selectiveExtensions, extensions) {
  if(!selectiveExtensions.pageInteractions) {
    return Promise.resolve([]);
  }
  const selectivePageInteractions = selectiveExtensions.pageInteractions;
  logger.debug('Selective Page Interactions deploy');
  return pageInteRestSvc.getPageinteractions(selectivePageInteractions).then(data => {
    if (data) {
      const uploadConfig = createSelectiveUploadConfig(data, selectivePageInteractions);
      logger.debug('piUploadConfig: ', JSON.stringify(uploadConfig));
      promiseList = [];
      results = [];
      Object.keys(uploadConfig).forEach(action => {
        if (uploadConfig[action].toUpdate) {
          logger.debug('Updating Page Interactions for Action: ', action);
          uploadConfig[action].toUpdate.forEach(pageInteraction => {
            logger.debug('Updating Field Interactions for interaction: ', pageInteraction);
            const extensionsPI = extensions.pageInteractions.find(pi => pageInteraction.name === pi.name && action === pi.action);
            if (extensionsPI) {
              promiseList.push(pageInteRestSvc.updatePageInteraction(extensionsPI, action, pageInteraction));
            } else {
              logger.warn(chalk.yellow(`Can't find '${pageInteraction.name}' for '${action}' in extentions file Page interaction will not be deployed!`));
              results.push(resultsSvc.handleUpdatePIFail(action, pageInteraction,
                `could not find ${pageInteraction.name} for ${action} in extention file`));
            }
          });
        }
        if (uploadConfig[action].toAdd) {
          logger.debug('Adding Page Interactions for Action: ', action);
          uploadConfig[action].toAdd.forEach(pageInteraction => {
            logger.debug('Updating Field Interactions for interaction: ', pageInteraction);
            const extensionsPI = extensions.pageInteractions.find(pi => pageInteraction === pi.name && action === pi.action);
            if (extensionsPI) {
              promiseList.push(pageInteRestSvc.AddPageInteraction(extensionsPI, action, pageInteraction));
            } else {
              logger.warn(chalk.yellow(`Can't find '${pageInteraction}' for '${action}' in extentions file Page interaction will not be deployed!`));
              results.push(resultsSvc.handleAddPIFail(action, pageInteraction,
                `could not find ${pageInteraction} for ${action} in extention file`));
            }
          });
        }
      });
      return Promise.allSettled(promiseList).then(repsonses => {
        const responseValues = repsonses.map(repsonse => repsonse.value);
        responseValues.forEach(value => {
        });
        return results.concat(responseValues).flat();
      });
    }
  });
}

function deployAllPageInteractions(extensions) {
  const fullConfig = {};
  if (extensions.pageInteractions) {
      const actions = extensions.pageInteractions.map(piAction => piAction.action).filter(utils.onlyUnique);
      actions.forEach(action => {
        fullConfig[action] = extensions.pageInteractions.filter(piAction => piAction.action === action).map(piName => piName.name);
    });
  } else {
    logger.warn(chalk.yellow(`Could not  field interactions in extentions field interactions will be skipped`));
    return Promise.resolve([]);
  }
  logger.debug('Full Page Interactions deploy');
  return pageInteRestSvc.getPageinteractions(fullConfig).then(piData => {
    if (piData) {
      const uploadConfig = createSelectiveUploadConfig(piData, fullConfig);
      logger.debug('piUploadConfig: ', JSON.stringify(uploadConfig));
      promiseList = [];
      results = [];
      Object.keys(uploadConfig).forEach(action => {
        if (uploadConfig[action].toUpdate) {
          logger.debug('Updating Page Interactions for Action: ', action);
          uploadConfig[action].toUpdate.forEach(pageInteraction => {
            logger.debug('Updating Field Interactions for interaction: ', pageInteraction);
            const extensionsPI = extensions.pageInteractions.find(pi => pageInteraction.name === pi.name && action === pi.action);
            if (extensionsPI) {
              promiseList.push(pageInteRestSvc.updatePageInteraction(extensionsPI, action, pageInteraction));
            } else {
              logger.warn(chalk.yellow(`Can't find '${pageInteraction.name}' for '${action}' in extentions file Page interaction will not be deployed!`));
              results.push(resultsSvc.handleUpdatePIFail(action, pageInteraction,
                `could not find ${pageInteraction.name} for ${action} in extention file`));
              logger.verbose(JSON.stringify(results));
            }
          });
        }
        if (uploadConfig[action].toAdd) {
          logger.debug('Adding Page Interactions for Action: ', action);
          uploadConfig[action].toAdd.forEach(pageInteraction => {
            logger.debug('Updating Field Interactions for interaction: ', pageInteraction);
            const extensionsPI = extensions.pageInteractions.find(pi => pageInteraction === pi.name && action === pi.action);
            if (extensionsPI) {
              promiseList.push(pageInteRestSvc.AddPageInteraction(extensionsPI, action, pageInteraction));
            } else {
              logger.warn(chalk.yellow(`Can't find '${pageInteraction}' for '${action}' in extentions file Page interaction will not be deployed!`));
              results.push(resultsSvc.handleAddPIFail(action, pageInteraction,
                `could not find ${pageInteraction} for ${action} in extention file`));
            }
          });
        }
      });
      return Promise.allSettled(promiseList).then(repsonses => {
        const responseValues = repsonses.map(repsonse => repsonse.value);
        return results.concat(responseValues).flat();
      });
    }
  });
}


function createSelectiveUploadConfig(piData, pageInteractions) {
  const uploadConfig = {};
  Object.keys(pageInteractions).forEach(action => {
    uploadConfig[action] = {};
    logger.debug('createPIUploadConfig pageInteractions: ', pageInteractions)
    const toUpdateNameID = [];
    const toAddNames = [];
    for (const selectivePI of pageInteractions[action]) {
      if (piData.find(pi => pi.action === action && pi.name === selectivePI)) {
        const id = piData.find(pi => pi.action === action && pi.name === selectivePI).id
        toUpdateNameID.push({ name: selectivePI, id: id });
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
  deploySelectedPageInteractions,
  deployAllPageInteractions,
  setUpService
};
