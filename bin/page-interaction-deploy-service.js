const chalk = require('chalk');
const logger = require('./lib/logger');
const PageInteractionsCrudService = require('./page-interactions-crud-service');
const resultsSvc = require('./results-service');
const utils = require('./utils');

class PageInteractionDeployService {
  constructor(crudService, resultsSvc, utils) {
    this.crudService = crudService;
    this.resultsSvc = resultsSvc;
    this.utils = utils;
    this.logger = logger;
  }

  buildSelectedConfig(selectiveExtensions) {
    return selectiveExtensions.pageInteractions;
  }

  buildFullConfig(extensions) {
    const fullConfig = {};

    if (extensions.pageInteractions && extensions.pageInteractions.length > 0) {
      const actions = extensions.pageInteractions.map(piAction => piAction.action).filter(this.utils.onlyUnique);

      actions.forEach((action) => {
        fullConfig[action] = extensions.pageInteractions.filter(piAction => piAction.action === action).map(piName => piName.name);
      });
    }

    return fullConfig;
  }

  processUploadConfig(uploadConfig, extensions) {
    const promiseList = [];
    const results = [];

    Object.keys(uploadConfig).forEach((action) => {
      if (uploadConfig[action].toUpdate) {
        this.logger.multiLog(`Updating Page Interactions for action: ${action}`, this.logger.multiLogLevels.debugPiData);

        uploadConfig[action].toUpdate.forEach((pageInteraction) => {
          this.logger.multiLog(`Updating Page Interaction: '${pageInteraction.name}'`, this.logger.multiLogLevels.debugPiData);
          const extensionsPI = extensions.pageInteractions.find(pi => pageInteraction.name === pi.name && action === pi.action);

          if (extensionsPI) {
            const wrappedPromise = this.crudService.updatePageInteraction(extensionsPI, action, pageInteraction)
              .catch((error) => {
                return this.resultsSvc.handleUpdatePIFail(action, pageInteraction, `API call failed: ${error.message}`);
              });
            promiseList.push(wrappedPromise);
          } else {
            this.logger.multiLog(chalk.yellow(`Could not find '${pageInteraction.name}' for '${action}' in extensions file. Page Interaction will not be deployed!`), this.logger.multiLogLevels.warnPiData);
            results.push(this.resultsSvc.handleUpdatePIFail(action, pageInteraction, `Could not find ${pageInteraction.name} for ${action} in extension file`));
          }
        });
      }

      if (uploadConfig[action].toAdd) {
        this.logger.multiLog(`Adding Page Interactions for action: ${action}`, this.logger.multiLogLevels.debugPiData);

        uploadConfig[action].toAdd.forEach((pageInteraction) => {
          this.logger.multiLog(`Adding Page Interaction: ${pageInteraction}`, this.logger.multiLogLevels.debugPiData);
          const extensionsPI = extensions.pageInteractions.find(pi => pageInteraction === pi.name && action === pi.action);

          if (extensionsPI) {
            const wrappedPromise = this.crudService.addPageInteraction(extensionsPI, action, pageInteraction)
              .catch((error) => {
                return this.resultsSvc.handleAddPIFail(action, pageInteraction, `API call failed: ${error.message}`);
              });
            promiseList.push(wrappedPromise);
          } else {
            this.logger.multiLog(chalk.yellow(`Could not find '${pageInteraction}' for '${action}' in extensions file. Page Interaction will not be deployed!`), this.logger.multiLogLevels.warnPiData);
            results.push(this.resultsSvc.handleAddPIFail(action, pageInteraction, `Could not find ${pageInteraction} for ${action} in extension file`));
          }
        });
      }
    });

    return { promiseList, results };
  }

  async deployPageInteractions(pageInteractionsConfig, extensions) {
    if (!pageInteractionsConfig || Object.keys(pageInteractionsConfig).length === 0) {
      return [];
    }

    const piData = await this.crudService.getPageInteractions(pageInteractionsConfig);

    if (!piData) {
      return [];
    }

    const uploadConfig = this.createPageInteractionsUploadConfig(piData, pageInteractionsConfig);
    this.logger.multiLog(`Page Interactions uploadConfig: ${JSON.stringify(uploadConfig)}`, this.logger.multiLogLevels.debugPiData);

    const { promiseList, results } = this.processUploadConfig(uploadConfig, extensions);

    const responses = await Promise.allSettled(promiseList);
    const responseValues = responses.map(response => response.value);

    return results.concat(responseValues).flat();
  }

  deploySelectedPageInteractions(selectiveExtensions, extensions, deployFiOnly) {
    if (deployFiOnly) {
      this.logger.multiLog(chalk.yellow('Skipping deploy Page Interactions because they were already deployed within first user'), this.logger.multiLogLevels.warnPiData);
      return [];
    }

    if (!selectiveExtensions.pageInteractions || Object.keys(selectiveExtensions.pageInteractions).length === 0) {
      this.logger.multiLog(chalk.yellow('Could not find Page Interactions in "selective-extension.json" file. Page Interactions will be skipped!'), this.logger.multiLogLevels.warnPiData);
      return [];
    }

    this.logger.multiLog('Selective Page Interactions deploy', this.logger.multiLogLevels.debugPiData);
    const config = this.buildSelectedConfig(selectiveExtensions);
    return this.deployPageInteractions(config, extensions);
  }

  deployAllPageInteractions(extensions, deployFiOnly) {
    if (deployFiOnly) {
      this.logger.multiLog(chalk.yellow('Skipping deploy Page Interactions because they were already deployed within first user'), this.logger.multiLogLevels.warnPiData);
      return [];
    }

    const config = this.buildFullConfig(extensions);

    if (!config || Object.keys(config).length === 0) {
      this.logger.multiLog(chalk.yellow('Could not find Page Interactions in "extension.json" file. Page Interactions will be skipped!'), this.logger.multiLogLevels.warnPiData);
      return [];
    }

    this.logger.multiLog('Full Page Interactions deploy', this.logger.multiLogLevels.debugPiData);
    return this.deployPageInteractions(config, extensions);
  }

  createPageInteractionsUploadConfig(piData, pageInteractions) {
    const uploadConfig = {};

    Object.keys(pageInteractions).forEach((action) => {
      uploadConfig[action] = {};
      const toUpdateNameID = [];
      const toAddNames = [];

      for (const selectivePI of pageInteractions[action]) {
        if (piData.find(pi => pi.action === action && pi.name === selectivePI)) {
          const id = piData.find(pi => pi.action === action && pi.name === selectivePI).id;
          toUpdateNameID.push({ name: selectivePI, id: id });
        } else {
          toAddNames.push(selectivePI);
        }
      }

      if (toUpdateNameID.length) {
        if (!uploadConfig[action].toUpdate) {
          uploadConfig[action].toUpdate = {};
        }

        uploadConfig[action].toUpdate = toUpdateNameID;
      }

      if (toAddNames.length) {
        if (!uploadConfig[action].toAdd) {
          uploadConfig[action].toAdd = {};
        }

        uploadConfig[action].toAdd = toAddNames;
      }
    });

    return uploadConfig;
  }
}

// Backward compatible module-level interface
let serviceInstance;

function setUpService(restApiClient) {
  const crudService = new PageInteractionsCrudService(restApiClient);
  serviceInstance = new PageInteractionDeployService(crudService, resultsSvc, utils);
}

function deploySelectedPageInteractions(selectiveExtensions, extensions, deployFiOnly) {
  return serviceInstance.deploySelectedPageInteractions(selectiveExtensions, extensions, deployFiOnly);
}

function deployAllPageInteractions(extensions, deployFiOnly) {
  return serviceInstance.deployAllPageInteractions(extensions, deployFiOnly);
}

module.exports = {
  PageInteractionDeployService,
  setUpService,
  deploySelectedPageInteractions,
  deployAllPageInteractions,
};
