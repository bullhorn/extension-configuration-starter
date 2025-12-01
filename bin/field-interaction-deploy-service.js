const chalk = require('chalk');
const fs = require('fs');
const FieldInteractionsCrudService = require('./field-interactions-crud-service');
const logger = require('./lib/logger');
const resultsSvc = require('./results-service');
const utils = require('./utils');

const entityNameMapFileName = './entityNameMap.json';
const entityNameMap = JSON.parse(fs.readFileSync(entityNameMapFileName, 'UTF-8'));

/**
 * Service for deploying field interactions to Bullhorn
 */
class FieldInteractionDeployService {
  /**
   * Creates an instance of FieldInteractionDeployService
   * @param {Object} crudService - CRUD service for field interactions
   * @param {Object} entityNameMap - Mapping of entity names
   * @param {Object} resultsSvc - Results service for handling deployment results
   * @param {Object} utils - Utility functions
   */
  constructor(crudService, entityNameMap, resultsSvc, utils) {
    this.crudService = crudService;
    this.entityNameMap = entityNameMap;
    this.resultsSvc = resultsSvc;
    this.utils = utils;
    this.logger = logger;
  }

  /**
   * Validates configuration and logs warning if invalid
   * @param {Object} config - Configuration object to validate
   * @param {string} configName - Name of configuration for logging
   * @returns {boolean} True if valid, false otherwise
   */
  validateConfigOrWarn(config, configName) {
    if (!config || Object.keys(config).length === 0) {
      this.logger.multiLog(chalk.yellow(`Could not find ${configName}. This will be skipped!`), this.logger.multiLogLevels.warnFiData);
      return false;
    }
    return true;
  }

  /**
   * Builds configuration for full deployment from extensions
   * @param {Object} extensions - Extension configuration containing field interactions
   * @returns {Object} Full configuration object
   */
  buildFullConfig(extensions) {
    const fullCOConfig = {};

    if (extensions.fieldInteractions && Object.keys(extensions.fieldInteractions).length > 0) {
      Object.entries(extensions.fieldInteractions).forEach(([ extKey, extVal ]) => {
        if (this.entityNameMap[extKey]) {
          fullCOConfig[extKey] = { entityName: this.entityNameMap[extKey].entityName, fields: [] };
          const fields = extVal.map(fi => fi.fieldName.toLowerCase()).filter(this.utils.onlyUnique);

          fields.forEach((field) => {
            const fieldFIs = extVal.filter(extFI => extFI.fieldName.toLowerCase() === field.toLowerCase()).map(extFI => extFI.name);
            fullCOConfig[extKey].fields.push({ fieldName: field, fieldInteractionNames: fieldFIs });
          });
        } else {
          this.logger.multiLog(chalk.yellow(`Could not find ${extKey} in 'entityNameMap.json'. This entity will be skipped!`), this.logger.multiLogLevels.warnFiData);
          this.logger.multiLog(chalk.yellow('Please check the \'extensions.json\' to ensure all the Field Interaction entities are in the \'entityNameMap.json\''), this.logger.multiLogLevels.warnFiData);
        }
      });
    }

    return fullCOConfig;
  }

  /**
   * Builds configuration for selective deployment
   * @param {Object} selectiveExtensions - Selective extension configuration
   * @returns {Object} Selected configuration object
   */
  buildSelectedConfig(selectiveExtensions) {
    const selectedFieldInteraction = selectiveExtensions.fieldInteractions;

    Object.entries(selectedFieldInteraction).forEach(([ selKey, selVal ]) => {
      if (this.entityNameMap[selKey]) {
        selVal.entityName = this.entityNameMap[selKey].entityName;
      } else {
        this.logger.multiLog(chalk.yellow(`Could not ${selKey} in 'entityNameMap.json'. This entity will be skipped!`), this.logger.multiLogLevels.warnFiData);
        this.logger.multiLog(chalk.yellow('Please check the \'selective-extension.json\' to ensure all the Field Interaction entities are in the \'entityNameMap.json\''), this.logger.multiLogLevels.warnFiData);
      }
    });

    return selectedFieldInteraction;
  }

  processUploadConfig(uploadConfig, extensions, privateLabelId) {
    const promiseList = [];
    const results = [];

    if (!extensions.fieldInteractions) {
      this.logger.multiLog(chalk.yellow('Could not find any Field Interaction in extensions file! All Field Interactions will not be deployed!'), this.logger.multiLogLevels.warnFiData);
      results.push(this.resultsSvc.handleFIExtensionsFail(uploadConfig));
      return { promiseList, results };
    }

    Object.keys(uploadConfig).forEach((entity) => {
      if (!extensions.fieldInteractions[entity]) {
        this.logger.multiLog(chalk.yellow(`Could not find '${entity}' in extensions file, Field Interactions for '${entity}' will not be deployed!`), this.logger.multiLogLevels.warnFiData);
        results.push(this.resultsSvc.handleFIEntityFail(entity, uploadConfig[entity], `Unable to find entity '${entity}' in extensions file`));
        return;
      }

      if (uploadConfig[entity].toUpdate) {
        this.logger.multiLog(`Updating Field Interactions for entity: ${entity}`, this.logger.multiLogLevels.debugFiData);

        Object.keys(uploadConfig[entity].toUpdate).forEach((fieldKey) => {
          this.logger.multiLog(`Updating Field Interactions for field: ${fieldKey}`, this.logger.multiLogLevels.debugFiData);

          uploadConfig[entity].toUpdate[fieldKey].interactionNameID.forEach((interaction) => {
            const extensionFI = extensions.fieldInteractions[entity].find(fi =>
              interaction.name === fi.name && fieldKey.toLowerCase() === fi.fieldName.toLowerCase()
            );

            if (extensionFI) {
              const { privateLabelIds } = extensionFI;

              if (!privateLabelIds || privateLabelIds.includes(privateLabelId.toString())) {
                const wrappedPromise = this.crudService.updateFieldInteraction(extensionFI, entity, fieldKey, interaction)
                  .catch((error) => {
                    return this.resultsSvc.handleUpdateFIFail(entity, fieldKey, interaction.name, `API call failed: ${error.message}`);
                  });
                promiseList.push(wrappedPromise);
              } else {
                this.logger.multiLog(`Field Interaction ${interaction.name} skipped for Private Label #${privateLabelId}`, this.logger.multiLogLevels.infoFiData);
              }
            } else {
              this.logger.multiLog(chalk.yellow(`Could not find '${interaction.name}' for '${fieldKey}' in extensions file. Field Interaction will not be deployed!`), this.logger.multiLogLevels.warnFiData);
              results.push(this.resultsSvc.handleUpdateFIFail(entity, fieldKey, interaction.name, `Could not find ${interaction.name} in ${entity}.${fieldKey} in extension file`));
            }
          });
        });
      }

      if (uploadConfig[entity].toAdd) {
        this.logger.multiLog(`Adding Field Interactions for entity: ${entity}`, this.logger.multiLogLevels.debugFiData);

        Object.keys(uploadConfig[entity].toAdd).forEach((fieldKey) => {
          this.logger.multiLog(`Adding Field Interactions for field: ${fieldKey}`, this.logger.multiLogLevels.debugFiData);

          uploadConfig[entity].toAdd[fieldKey].interactionNames.forEach((interactionName) => {
            const extensionFI = extensions.fieldInteractions[entity].find(fi =>
              interactionName === fi.name && fieldKey.toLowerCase() === fi.fieldName.toLowerCase()
            );

            if (extensionFI) {
              const { privateLabelIds } = extensionFI;

              if (!privateLabelIds || privateLabelIds.includes(privateLabelId.toString())) {
                const wrappedPromise = this.crudService.addFieldInteraction(extensionFI, entity, fieldKey, uploadConfig[entity].toAdd[fieldKey].fieldMapId, interactionName)
                  .catch((error) => {
                    return this.resultsSvc.handleAddFIFail(entity, fieldKey, interactionName, `API call failed: ${error.message}`);
                  });
                promiseList.push(wrappedPromise);
              } else {
                this.logger.multiLog(`Field Interaction ${interactionName} skipped for Private Label #${privateLabelId}`, this.logger.multiLogLevels.infoFiData);
              }
            } else {
              this.logger.multiLog(chalk.yellow(`Could not find '${interactionName}' for '${fieldKey}' in extensions file. Field Interaction will not be deployed!`), this.logger.multiLogLevels.warnFiData);
              results.push(this.resultsSvc.handleAddFIFail(entity, fieldKey, interactionName, `Could not find ${interactionName} in ${entity}.${fieldKey} in extension file`));
            }
          });
        });
      }
    });

    return { promiseList, results };
  }

  /**
   * Deploys field interactions for given configuration
   * @param {Object} fieldInteractionsConfig - Field interactions configuration
   * @param {number} privateLabelId - Private label ID
   * @param {Object} extensions - Extension configuration
   * @returns {Promise<Array>} Array of deployment results
   */
  async deployFieldInteractions(fieldInteractionsConfig, privateLabelId, extensions) {
    if (!fieldInteractionsConfig || Object.keys(fieldInteractionsConfig).length === 0) {
      return [];
    }

    const fieldMapInstances = await this.crudService.getFieldMapInstances(fieldInteractionsConfig, privateLabelId);

    if (!fieldMapInstances || !fieldMapInstances.length) {
      this.logger.multiLog(chalk.yellow('Could not find Field Map Instances for Field Interactions deploy. Please check rest logs!'), this.logger.multiLogLevels.warnFiData);
      this.logger.multiLog(chalk.yellow('Field Interactions will be skipped!'), this.logger.multiLogLevels.warnFiData);
      return [];
    }

    Object.values(fieldInteractionsConfig).forEach((configVal) => {
      const entityFieldMaps = fieldMapInstances.filter(entityFieldMap => entityFieldMap.entity === configVal.entityName);

      for (const configField of configVal.fields) {
        const fieldMapInstance = entityFieldMaps.find(fieldMap => fieldMap.columnName.toLowerCase() === configField.fieldName.toLowerCase());

        if (fieldMapInstance) {
          configField.fieldMapId = fieldMapInstance.id;
        } else {
          this.logger.multiLog(chalk.yellow(`Could not find field map for: ${configField.fieldName}!`), this.logger.multiLogLevels.debugFiData);
          this.logger.multiLog(chalk.yellow(`Field Interactions for ${configField.fieldName} for ${configVal.entityName} will not be deployed!`), this.logger.multiLogLevels.debugFiData);
          configVal.fields = configVal.fields.filter(filterField => filterField.fieldName.toLowerCase() !== configField.fieldName.toLowerCase());
        }
      }
    });

    const fiData = await this.crudService.getFieldInteractions(fieldInteractionsConfig, privateLabelId);

    if (!fiData) {
      return [];
    }

    const uploadConfig = this.createUploadConfig(fiData, fieldInteractionsConfig);
    this.logger.multiLog(`Field Interactions uploadConfig for ${privateLabelId}:  ${JSON.stringify(uploadConfig)}`, this.logger.multiLogLevels.debugFiData);

    const { promiseList, results } = this.processUploadConfig(uploadConfig, extensions, privateLabelId);

    const responses = await Promise.allSettled(promiseList);
    const responseValues = responses.map(response => response.value);

    return results.concat(responseValues).flat();
  }

  /**
   * Deploys selected field interactions based on selective configuration
   * @param {Object} selectiveExtensions - Selective extensions configuration
   * @param {number} privateLabelId - Private label ID
   * @param {Object} extensions - Full extension configuration
   * @returns {Promise<Array>} Array of deployment results
   */
  deploySelectedFieldInteractions(selectiveExtensions, privateLabelId, extensions) {
    if (!selectiveExtensions.fieldInteractions || Object.keys(selectiveExtensions.fieldInteractions).length === 0) {
      this.logger.multiLog(chalk.yellow('Could not find Field Interactions in "selective-extension.json" file. Field Interactions will be skipped!'), this.logger.multiLogLevels.warnFiData);
      return [];
    }

    this.logger.multiLog('Selective Field Interactions deploy', this.logger.multiLogLevels.debugFiData);
    const config = this.buildSelectedConfig(selectiveExtensions);
    return this.deployFieldInteractions(config, privateLabelId, extensions);
  }

  /**
   * Deploys all field interactions from extension configuration
   * @param {number} privateLabelId - Private label ID
   * @param {Object} extensions - Full extension configuration
   * @returns {Promise<Array>} Array of deployment results
   */
  deployAllFieldInteractions(privateLabelId, extensions) {
    this.logger.multiLog('Full Field Interactions deploy', this.logger.multiLogLevels.debugFiData);
    const config = this.buildFullConfig(extensions);

    if (!config || Object.keys(config).length === 0) {
      this.logger.warn(chalk.yellow('Could not find Field Interactions in "extension.json" file. Field Interactions will be skipped!'));
      return [];
    }

    return this.deployFieldInteractions(config, privateLabelId, extensions);
  }

  createUploadConfig(fiData, fieldInteractions) {
    const uploadConfig = {};

    for (const entity of Object.keys(fieldInteractions)) {
      const entityObj = fieldInteractions[entity];
      uploadConfig[entity] = {};

      for (const selectiveFI of entityObj.fields) {
        const toUpdateNameID = [];
        const toAddNames = [];

        for (const fiName of selectiveFI.fieldInteractionNames) {
          if (fiData.find(fi => fi && fi.fieldMapID === selectiveFI.fieldMapId && fi.name === fiName)) {
            const id = fiData.find(fi => fi && fi.fieldMapID === selectiveFI.fieldMapId && fi.name === fiName).id;
            toUpdateNameID.push({ name: fiName, id: id });
          } else {
            toAddNames.push(fiName);
          }
        }

        if (toUpdateNameID.length) {
          if (!uploadConfig[entity].toUpdate) {
            uploadConfig[entity].toUpdate = {};
          }

          uploadConfig[entity].toUpdate[selectiveFI.fieldName] = {};
          uploadConfig[entity].toUpdate[selectiveFI.fieldName].interactionNameID = toUpdateNameID;
        }

        if (toAddNames.length) {
          if (!uploadConfig[entity].toAdd) {
            uploadConfig[entity].toAdd = {};
          }

          uploadConfig[entity].toAdd[selectiveFI.fieldName] = {};
          uploadConfig[entity].toAdd[selectiveFI.fieldName].fieldMapId = selectiveFI.fieldMapId;
          uploadConfig[entity].toAdd[selectiveFI.fieldName].interactionNames = toAddNames;
        }
      }
    }

    return uploadConfig;
  }
}

// Backward compatible module-level interface
let serviceInstance;

function setUpService(restApiClient) {
  const crudService = new FieldInteractionsCrudService(restApiClient);
  serviceInstance = new FieldInteractionDeployService(crudService, entityNameMap, resultsSvc, utils);
}

function deploySelectedFieldInteractions(selectiveExtensions, privateLabelId, extensions) {
  return serviceInstance.deploySelectedFieldInteractions(selectiveExtensions, privateLabelId, extensions);
}

function deployAllFieldInteractions(privateLabelId, extensions) {
  return serviceInstance.deployAllFieldInteractions(privateLabelId, extensions);
}

module.exports = {
  FieldInteractionDeployService,
  setUpService,
  deploySelectedFieldInteractions,
  deployAllFieldInteractions,
};
