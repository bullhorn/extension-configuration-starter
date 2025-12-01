const chalk = require('chalk');
const fs = require('fs');
const CustomObjectInteractionsCrudService = require('./custom-objects-interactions-crud-service');
const logger = require('./lib/logger');
const resultsSvc = require('./results-service');
const utils = require('./utils');

const entityCustomObjectsMapFileName = './customObjectEntityMap.json';
const entityNameMapFileName = './entityNameMap.json';
const entityCustomObjectsMap = JSON.parse(fs.readFileSync(entityCustomObjectsMapFileName, 'UTF-8'));
const entityNameMap = JSON.parse(fs.readFileSync(entityNameMapFileName, 'UTF-8'));

class CustomObjectInteractionDeployService {
  constructor(_crudService, _entityCustomObjectsMap, _entityNameMap, _resultsSvc, _utils) {
    this.crudService = _crudService;
    this.entityCustomObjectsMap = _entityCustomObjectsMap;
    this.entityNameMap = _entityNameMap;
    this.resultsSvc = _resultsSvc;
    this.utils = _utils;
    this.logger = logger;
  }

  buildSelectedConfig(selectiveExtensions) {
    const selectedCOInteraction = selectiveExtensions.customObjectFieldInteractions;

    Object.entries(selectedCOInteraction).forEach(([ selCoKey, selCoVal ]) => {
      Object.entries(this.entityCustomObjectsMap).forEach(([ key, val ]) => {
        const coConfig = val.find((co) => {
          return co.extensionName === selCoKey;
        });

        if (coConfig) {
          selCoVal.entityName = key;
          selCoVal.objectInstance = coConfig.objectNumber;
          selCoVal.customObjctName = selCoKey;
        }
      });

      if (selCoVal.entityName && selCoVal.objectInstance) {
        const entityConfig = this.entityNameMap[selCoVal.entityName];

        if (entityConfig && entityConfig.entityName && entityConfig.customObjectURL) {
          selCoVal.entityName = entityConfig.entityName;
          selCoVal.objectUrl = entityConfig.customObjectURL;
        } else {
          this.logger.multiLog(chalk.yellow(`Could not find ${selCoKey} in entity config or this entity is missing an entityName / customObjectURL. This object will not be deployed!`), this.logger.multiLogLevels.warnCoFiData);
          this.logger.multiLog(chalk.yellow('Please check "entityNameMap.json" to see if your Custom Object is there and has a valid entityName / customObjectURL'), this.logger.multiLogLevels.warnCoFiData);
          delete selectedCOInteraction.selectCOkey;
        }
      } else {
        this.logger.multiLog(chalk.yellow(`Could not find ${selCoKey} in entity Custom Object map or it was missing an object number. This object will not be deployed!`), this.logger.multiLogLevels.warnCoFiData);
        this.logger.multiLog(chalk.yellow('Please check \'customObjectEntityMap.json\' to see if your Custom Object is there and has a valid object number'), this.logger.multiLogLevels.warnCoFiData);
        delete selectedCOInteraction.selectCOkey;
      }
    });

    return selectedCOInteraction;
  }

  buildFullConfig() {
    const fullCOConfig = {};

    Object.keys(this.entityCustomObjectsMap).forEach((key) => {
      if (!this.entityNameMap[key] || !this.entityNameMap[key].entityName || !this.entityNameMap[key].customObjectURL) {
        this.logger.multiLog(chalk.yellow(`Could not find ${key} in entity config or this entity is missing an entityName / customObjectURL. This object will not be deployed!`), this.logger.multiLogLevels.warnCoFiData);
        this.logger.multiLog(chalk.yellow('Please check "entityNameMap.json" to see if your Custom Object is there and has a valid entityName / customObjectURL'), this.logger.multiLogLevels.warnCoFiData);
      } else {
        this.entityCustomObjectsMap[key].forEach((co) => {
          fullCOConfig[co.extensionName] = { entityName: this.entityNameMap[key].entityName, objectInstance: co.objectNumber, objectUrl: this.entityNameMap[key].customObjectURL };
        });
      }
    });

    return fullCOConfig;
  }

  processUploadConfig(uploadConfig, extensions) {
    const promiseList = [];
    const results = [];

    if (!extensions.customObjectFieldInteractions) {
      this.logger.multiLog(chalk.yellow('Could not find any Custom Object Field Interactions in extensions file! All Custom Object Field Interactions will not be deployed!'), this.logger.multiLogLevels.warnCoFiData);
      results.push(this.resultsSvc.handleFIExtensionsFail(uploadConfig));
      return { promiseList, results };
    }

    Object.keys(uploadConfig).forEach((extensionCO) => {
      if (!extensions.customObjectFieldInteractions[extensionCO]) {
        this.logger.multiLog(chalk.yellow(`Could not find '${extensionCO}' in extensions file, Custom Object Field Interactions for '${extensionCO}' will not be deployed!`), this.logger.multiLogLevels.warnCoFiData);
        return;
      }

      const entity = uploadConfig[extensionCO].entity;
      const objectUrl = uploadConfig[extensionCO].objectUrl;
      this.logger.multiLog(`Updating Custom Object Field Interactions for ${extensionCO} - ${entity}`, this.logger.multiLogLevels.debugCoFiData);

      if (uploadConfig[extensionCO].toUpdate) {
        Object.keys(uploadConfig[extensionCO].toUpdate).forEach((fieldKey) => {
          this.logger.multiLog(`Updating Custom Object Field Interactions for field: ${fieldKey}`, this.logger.multiLogLevels.debugCoFiData);

          uploadConfig[extensionCO].toUpdate[fieldKey].interactionNameID.forEach((interaction) => {
            const extensionFI = extensions.customObjectFieldInteractions[extensionCO].find((fi) => {
              return interaction.name === fi.name && fieldKey.toLowerCase() === fi.fieldName.toLowerCase();
            });

            if (extensionFI) {
              const wrappedPromise = this.crudService.updateCustomObjectAttributeInteraction(extensionFI, entity, extensionCO, fieldKey, interaction, objectUrl)
                .catch((error) => {
                  return this.resultsSvc.handleUpdateCOFIFail(entity, extensionCO, fieldKey, interaction.name, `API call failed: ${error.message}`);
                });
              promiseList.push(wrappedPromise);
            } else {
              this.logger.multiLog(chalk.yellow(`Could not find '${interaction.name}' for '${extensionCO} - ${fieldKey}' in extensions file. Custom Object Field Interaction will not be deployed!`), this.logger.multiLogLevels.warnCoFiData);
              results.push(this.resultsSvc.handleUpdateCOFIFail(entity, extensionCO, fieldKey, interaction.name, `Could not not find ${interaction.name} in ${extensionCO}.${fieldKey} in extension file`));
            }
          });
        });
      }

      if (uploadConfig[extensionCO].toAdd) {
        this.logger.multiLog(`Adding Custom Object Field Interactions for ${extensionCO} - ${entity}`, this.logger.multiLogLevels.debugCoFiData);

        Object.keys(uploadConfig[extensionCO].toAdd).forEach((fieldKey) => {
          this.logger.multiLog(`Adding Custom Object Field Interactions for field: ${fieldKey}`, this.logger.multiLogLevels.debugCoFiData);

          uploadConfig[extensionCO].toAdd[fieldKey].interactionNames.forEach((interactionName) => {
            const extensionFI = extensions.customObjectFieldInteractions[extensionCO].find((fi) => {
              return interactionName === fi.name && fieldKey.toLowerCase() === fi.fieldName.toLowerCase();
            });

            if (extensionFI) {
              const wrappedPromise = this.crudService.addCustomObjectAttributeInteraction(extensionFI, entity, extensionCO, fieldKey, uploadConfig[extensionCO].toAdd[fieldKey].fieldMapId, interactionName, objectUrl)
                .catch((error) => {
                  return this.resultsSvc.handleAddCOFIFail(entity, extensionCO, fieldKey, interactionName, `API call failed: ${error.message}`);
                });
              promiseList.push(wrappedPromise);
            } else {
              this.logger.multiLog(chalk.yellow(`Could not find '${interactionName}' for '${fieldKey}' in extensions file. Custom Object Field Interaction will not be deployed!`), this.logger.multiLogLevels.warnCoFiData);
              results.push(this.resultsSvc.handleAddCOFIFail(entity, extensionCO, fieldKey, interactionName, `Could not find ${interactionName} in ${extensionCO}.${fieldKey} in extension file`));
            }
          });
        });
      }
    });

    return { promiseList, results };
  }

  async deployCustomObjectFieldInteractions(coConfig, extensions, isFullDeploy) {
    if (!coConfig || Object.keys(coConfig).length === 0) {
      return [];
    }

    const customObjects = await this.crudService.getCustomObjects(coConfig);

    if (!customObjects || !customObjects.length) {
      const deployType = isFullDeploy ? 'Full' : 'Selective';
      this.logger.multiLog(chalk.yellow(`Could not find Custom Objects for ${deployType} Custom Object Field Interactions deploy. Please check rest logs!`), this.logger.multiLogLevels.warnCoFiData);
      this.logger.multiLog(chalk.yellow('Custom Object Field Interactions will be skipped!'), this.logger.multiLogLevels.warnCoFiData);
      return [];
    }

    const allObjectsWithId = [];

    if (isFullDeploy) {
      Object.keys(coConfig).forEach((configCo) => {
        if (extensions.customObjectFieldInteractions[configCo]) {
          const coExtFields = extensions.customObjectFieldInteractions[configCo].map((fi) => {
            return fi.fieldName.toLowerCase();
          }).filter(this.utils.onlyUnique);
          const configFields = [];

          coExtFields.forEach((extField) => {
            const fieldFIs = extensions.customObjectFieldInteractions[configCo].filter((extFI) => {
              return extFI.fieldName.toLowerCase() === extField.toLowerCase();
            });
            if (fieldFIs && fieldFIs.length) {
              configFields.push({
                fieldName: extField,
                fieldInteractionNames: fieldFIs.map((fi) => {
                  return fi.name;
                }),
              });
            }
          });

          if (configFields && configFields.length) {
            coConfig[configCo].fields = configFields;
          }

          if (customObjects.find((resultCO) => {
            return resultCO.type === coConfig[configCo].entityName && resultCO.objectNumber === coConfig[configCo].objectInstance;
          })) {
            coConfig[configCo].objectId = customObjects.find((resultCO) => {
              return resultCO.type === coConfig[configCo].entityName && resultCO.objectNumber === coConfig[configCo].objectInstance;
            }).id;
            coConfig[configCo].customObjctName = configCo;

            if (coConfig[configCo].fields && coConfig[configCo].fields.length) {
              allObjectsWithId.push(coConfig[configCo]);
            }
          } else {
            this.logger.multiLog(chalk.yellow(`Could not find Custom Object for ${configCo}`), this.logger.multiLogLevels.warnCoFiData);
          }
        } else {
          this.logger.multiLog(chalk.yellow(`Could not find '${configCo}' in extensions file, Custom Object Field Interactions for '${configCo}' will not be deployed!`), this.logger.multiLogLevels.warnCoFiData);
        }
      });
    } else {
      Object.keys(coConfig).forEach((extensionCO) => {
        const selectiveCustomObject = coConfig[extensionCO];
        selectiveCustomObject.objectId = customObjects.find((customObject) => {
          return customObject.type === coConfig[extensionCO].entityName && customObject.objectNumber === coConfig[extensionCO].objectInstance;
        }).id;
        allObjectsWithId.push(selectiveCustomObject);
      });
    }

    const customObjectFields = await this.crudService.getCustomObjectAttributes(allObjectsWithId);

    if (!customObjectFields || !customObjectFields.length) {
      const deployType = isFullDeploy ? 'Full' : 'Selective';
      this.logger.multiLog(chalk.yellow(`Could not find Custom Objects Attributes for ${deployType} Custom Object Field Interactions deploy. Please check rest logs!`), this.logger.multiLogLevels.warnCoFiData);
      this.logger.multiLog(chalk.yellow('Custom Object Field Interactions will be skipped!'), this.logger.multiLogLevels.warnCoFiData);
      return [];
    }

    allObjectsWithId.forEach((selectiveCO) => {
      selectiveCO.fields.forEach((selCOField) => {
        const resultCOField = customObjectFields.find((resField) => {
          return resField.customObject.id === selectiveCO.objectId && resField.columnName.toLowerCase() === selCOField.fieldName.toLowerCase();
        });

        if (resultCOField) {
          selCOField.fieldMapId = resultCOField.id;
        } else {
          this.logger.multiLog(chalk.yellow(`Could not find Custom Objects Attribute for ${selectiveCO.customObjctName} for ${selCOField.fieldName}`));
          selectiveCO.fields = selectiveCO.fields.filter((field) => {
            return field.fieldName !== selCOField.fieldName;
          });
        }
      });
    });

    const resultFI = await this.crudService.getCustomObjectAttributeInteractions(allObjectsWithId);

    if (!resultFI) {
      return [];
    }

    const uploadConfig = this.createUploadConfig(resultFI, allObjectsWithId);
    this.logger.multiLog(`Custom Object Field Interactions uploadConfig: ${JSON.stringify(uploadConfig)}`, this.logger.multiLogLevels.debugCoFiData);

    const { promiseList, results } = this.processUploadConfig(uploadConfig, extensions);

    const responses = await Promise.allSettled(promiseList);
    const responseValues = responses.map((response) => {
      return response.value;
    });

    return results.concat(responseValues).flat();
  }

  deploySelectedCustomObjectFieldInteractions(selectiveExtensions, extensions, deployFiOnly) {
    if (deployFiOnly) {
      this.logger.multiLog(chalk.yellow('Skipping deploy Custom Object Field Interactions because they were already deployed within first user'), this.logger.multiLogLevels.warnCoFiData);
      return [];
    }

    if (!selectiveExtensions.customObjectFieldInteractions || Object.keys(selectiveExtensions.customObjectFieldInteractions).length === 0) {
      this.logger.multiLog(chalk.yellow('Could not find Custom Object Field Interactions in "selective-extension.json" file. Custom Object Field Interactions will be skipped!'), this.logger.multiLogLevels.warnCoFiData);
      return [];
    }

    this.logger.multiLog('Selective Custom Objects Field Interactions deploy', this.logger.multiLogLevels.debugCoFiData);
    const config = this.buildSelectedConfig(selectiveExtensions);

    if (!Object.keys(config).length) {
      this.logger.multiLog(chalk.yellow('Could not find valid Custom Object Field Interactions mapping to entityNameMap.json / customObjectEntityMap.json files. Custom Object Field Interactions will be skipped!'), this.logger.multiLogLevels.warnCoFiData);
      return [];
    }

    return this.deployCustomObjectFieldInteractions(config, extensions, false);
  }

  deployAllCustomObjectFieldInteractions(extensions, deployFiOnly) {
    if (deployFiOnly) {
      this.logger.multiLog(chalk.yellow('Skipping deploy Custom Object Field Interactions because they were already deployed within first user'), this.logger.multiLogLevels.warnCoFiData);
      return [];
    }

    if (!extensions.customObjectFieldInteractions || Object.keys(extensions.customObjectFieldInteractions).length === 0) {
      this.logger.multiLog(chalk.yellow('Could not find Custom Object Field Interactions in "extension.json" file. Custom Object Field Interactions will be skipped!'), this.logger.multiLogLevels.warnCoFiData);
      return [];
    }

    this.logger.multiLog('Full Custom Objects Field Interactions deploy', this.logger.multiLogLevels.debugCoFiData);
    const config = this.buildFullConfig();

    return this.deployCustomObjectFieldInteractions(config, extensions, true);
  }

  createUploadConfig(fiData, customObjectFIs) {
    const uploadConfig = {};

    for (const customObject of customObjectFIs) {
      uploadConfig[customObject.customObjctName] = { entity: customObject.entityName, objectUrl: customObject.objectUrl };

      for (const customObjectField of customObject.fields) {
        const toUpdateNameID = [];
        const toAddNames = [];

        for (const fiName of customObjectField.fieldInteractionNames) {
          if (fiData.find((fi) => {
            return fi.attribute.id === customObjectField.fieldMapId && fi.name === fiName;
          })) {
            const id = fiData.find((fi) => {
              return fi.attribute.id === customObjectField.fieldMapId && fi.name === fiName;
            }).id;
            toUpdateNameID.push({ name: fiName, id: id });
          } else {
            toAddNames.push(fiName);
          }
        }

        if (toUpdateNameID.length) {
          if (!uploadConfig[customObject.customObjctName].toUpdate) {
            uploadConfig[customObject.customObjctName].toUpdate = {};
          }
          uploadConfig[customObject.customObjctName].toUpdate[customObjectField.fieldName] = {};
          uploadConfig[customObject.customObjctName].toUpdate[customObjectField.fieldName].interactionNameID = toUpdateNameID;
        }
        if (toAddNames.length) {
          if (!uploadConfig[customObject.customObjctName].toAdd) {
            uploadConfig[customObject.customObjctName].toAdd = {};
          }
          uploadConfig[customObject.customObjctName].toAdd[customObjectField.fieldName] = {};
          uploadConfig[customObject.customObjctName].toAdd[customObjectField.fieldName].fieldMapId = customObjectField.fieldMapId;
          uploadConfig[customObject.customObjctName].toAdd[customObjectField.fieldName].interactionNames = toAddNames;
        }
      }
    }

    return uploadConfig;
  }
}

// Backward compatible module-level interface
let serviceInstance;

function setUpService(restApiClient) {
  const crudService = new CustomObjectInteractionsCrudService(restApiClient);
  serviceInstance = new CustomObjectInteractionDeployService(crudService, entityCustomObjectsMap, entityNameMap, resultsSvc, utils);
}

function deploySelectedCustomObjectFieldInteractions(selectiveExtensions, extensions, deployFiOnly) {
  return serviceInstance.deploySelectedCustomObjectFieldInteractions(selectiveExtensions, extensions, deployFiOnly);
}

function deployAllCustomObjectFieldInteractions(extensions, deployFiOnly) {
  return serviceInstance.deployAllCustomObjectFieldInteractions(extensions, deployFiOnly);
}

module.exports = {
  CustomObjectInteractionDeployService,
  setUpService,
  deploySelectedCustomObjectFieldInteractions,
  deployAllCustomObjectFieldInteractions,
};
