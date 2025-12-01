const fs = require('fs');
const jsonfile = require('jsonfile');
const chalk = require('chalk');
const logger = require('./lib/logger');
const FieldInteractionsCrudService = require('./field-interactions-crud-service');
const CustomObjectInteractionsCrudService = require('./custom-objects-interactions-crud-service');
const PageInteractionsCrudService = require('./page-interactions-crud-service');

const entityNameMapFileName = './entityNameMap.json';
const entityNameMap = JSON.parse(fs.readFileSync(entityNameMapFileName, 'UTF-8'));
const extensionsFileName = './output/extension.json';

class InteractionCleaningService {
  constructor(_fieldIntRestSvc, _coFieldIntRestSvc, _pageIntRestSvc, _entityNameMap) {
    this.fieldIntRestSvc = _fieldIntRestSvc;
    this.coFieldIntRestSvc = _coFieldIntRestSvc;
    this.pageIntRestSvc = _pageIntRestSvc;
    this.entityNameMap = _entityNameMap;
    this.logger = logger;
  }

  async runEnvCleanRoutine(username, deployFiOnly) {
    this.logger.multiLog('Cleaning env before full deploy...', this.logger.multiLogLevels.infoIntData);
    const results = {};

    const fiResults = await this.cleanFieldInteractions(username);
    results.fieldInteractions = fiResults;

    const coResults = await this.cleanCustomObjectFieldInteractions(username, deployFiOnly);
    results.customObjectFIs = coResults;

    const piResults = await this.cleanPageInteractionResults(username, deployFiOnly);
    results.pageInteractions = piResults;

    return results;
  }

  async cleanFieldInteractions(username) {
    this.logger.multiLog(`Deleting Field Interactions for ${chalk.green(username)} ...`, this.logger.multiLogLevels.debugFiData);

    const allFIsResponse = await this.fieldIntRestSvc.getAllFieldInteractions(username);
    const allFieldInteractions = allFIsResponse.flat();
    const promiseList = [];

    allFieldInteractions.forEach((fieldInteraction) => {
      promiseList.push(this.fieldIntRestSvc.deleteFieldInteraction(fieldInteraction.id, fieldInteraction.entity, fieldInteraction.fieldName, fieldInteraction.name));
    });

    const responses = await Promise.allSettled(promiseList);
    const responseValues = responses.map((response) => {
      return response.value;
    });

    return responseValues.flat();
  }

  async cleanCustomObjectFieldInteractions(username, deployFiOnly) {
    if (deployFiOnly) {
      this.logger.multiLog(chalk.yellow('Skipping delete Custom Object Field Interactions because they were already deployed within first user and do not need clean up'), this.logger.multiLogLevels.warnCoFiData);

      return [];
    }

    this.logger.multiLog(`Deleting Custom Object Field Interactions for ${chalk.green(username)} ...`, this.logger.multiLogLevels.debugCoFiData);
    const coConfigs = [];

    Object.entries(this.entityNameMap).forEach(([ key, val ]) => {
      if (val.customObjectURL) {
        coConfigs.push({ entity: key, url: val.customObjectURL });
      }
    });

    const getPromiseList = [];

    coConfigs.forEach((conf) => {
      getPromiseList.push(this.coFieldIntRestSvc.getAllCustomObjectAttributeInteractions(conf.entity, conf.url, username));
    });

    const responses = await Promise.allSettled(getPromiseList);
    const delPromiseList = [];

    responses.forEach((response) => {
      const data = response.value;
      const objUrl = data.url;
      const entity = data.entity;

      data.coFIs.flat().forEach((coInteraction) => {
        delPromiseList.push(this.coFieldIntRestSvc.deleteCustomObjectAttributeInteraction(objUrl,
          coInteraction.id,
          entity,
          coInteraction.attribute.customObject.objectNumber,
          coInteraction.attribute.columnName,
          coInteraction.name));
      });
    });

    const delResponses = await Promise.allSettled(delPromiseList);
    const responseValues = delResponses.map((response) => {
      return response.value;
    });

    return responseValues.flat();
  }

  async cleanPageInteractionResults(username, deployFiOnly) {
    if (deployFiOnly) {
      this.logger.multiLog(chalk.yellow('Skipping delete Page Interactions because they were already deployed within first user and do not need clean up'), this.logger.multiLogLevels.warnPiData);

      return [];
    }

    this.logger.multiLog(`Deleting Page Interactions for ${chalk.green(username)} ...`, this.logger.multiLogLevels.debugPiData);

    const allPIsResponse = await this.pageIntRestSvc.getAllPageInteractions(username);
    const allPageInteractions = allPIsResponse.flat();
    const promiseList = [];

    allPageInteractions.forEach((pageInteraction) => {
      promiseList.push(this.pageIntRestSvc.deletePageInteraction(pageInteraction.id, pageInteraction.action, pageInteraction.name));
    });

    const responses = await Promise.allSettled(promiseList);
    const responseValues = responses.map((response) => {
      return response.value;
    });

    return responseValues.flat();
  }

  async removeUnnecessaryFieldInteractions(extensions, privateLabelId) {
    if (extensions.fieldInteractions) {
      Object.keys(extensions.fieldInteractions).forEach((entity) => {
        if (extensions.fieldInteractions[entity]) {
          // eslint-disable-next-line no-plusplus
          for (let index = extensions.fieldInteractions[entity].length - 1; index >= 0; index--) {
            if (extensions.fieldInteractions[entity][index].privateLabelIds && !extensions.fieldInteractions[entity][index].privateLabelIds.includes(privateLabelId)) {
              this.logger.multiLog(`Removed unnecessary field interactions for Private Label #${privateLabelId} at index ${index}`, this.logger.multiLogLevels.debugFiData);

              extensions.fieldInteractions[entity].splice(index, 1);
            }
          }
        }
      });
    }

    this.logger.multiLog(`Successfully removed all unnecessary field interactions for Private Label #${privateLabelId} before auth and upload`, this.logger.multiLogLevels.debugFiData);

    jsonfile.writeFileSync(extensionsFileName, extensions, {
      spaces: 2,
    });

    return extensions;
  }
}

// Backward compatible module-level interface
let serviceInstance;

function setUpService(restApiClient) {
  const fieldIntRestSvc = new FieldInteractionsCrudService(restApiClient);
  const coFieldIntRestSvc = new CustomObjectInteractionsCrudService(restApiClient);
  const pageIntRestSvc = new PageInteractionsCrudService(restApiClient);
  serviceInstance = new InteractionCleaningService(fieldIntRestSvc, coFieldIntRestSvc, pageIntRestSvc, entityNameMap);
}

function runEnvCleanRoutine(username, deployFiOnly) {
  return serviceInstance.runEnvCleanRoutine(username, deployFiOnly);
}

function removeUnnecessaryFieldInteractions(extensions, privateLabelId) {
  // This method doesn't need CRUD services, so we can create a standalone instance
  const standaloneService = new InteractionCleaningService(null, null, null, entityNameMap);
  return standaloneService.removeUnnecessaryFieldInteractions(extensions, privateLabelId);
}

module.exports = {
  InteractionCleaningService,
  setUpService,
  runEnvCleanRoutine,
  removeUnnecessaryFieldInteractions,
};
