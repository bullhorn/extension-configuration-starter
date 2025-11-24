const chalk = require('chalk');
const fs = require('fs');
const custObjIntRestSvc = require('./custom-objects-interactions-crud-service');
const logger = require('./lib/logger');
const resultsSvc = require('./results-service');
const utils = require('./utils');

const entityCustomObjectsMapFileName = `./customObjectEntityMap.json`;
const entityNameMapFileName = `./entityNameMap.json`;
const entityCustomObjectsMap = JSON.parse(fs.readFileSync(entityCustomObjectsMapFileName, 'UTF-8'));
const entityNameMap = JSON.parse(fs.readFileSync(entityNameMapFileName, 'UTF-8'));

function setUpService(restApiClient) {
  custObjIntRestSvc.setUpService(restApiClient);
}

function deploySelectedCustomObjectFieldInteractions(selectiveExtensions, extensions, deployFiOnly) {
  if (deployFiOnly) {
    logger.multiLog(chalk.yellow('Skipping Custom Object Field Interactions because they were already deployed within first user'), logger.multiLogLevels.warnCoFiData);

    return Promise.resolve([]);
  }

  if (!selectiveExtensions.customObjectFieldInteractions || Object.keys(selectiveExtensions.customObjectFieldInteractions).length === 0) {
    logger.multiLog(chalk.yellow('Could not find Custom Object Field Interactions in "selective-extension.json" file. Custom Object Field Interactions will be skipped!'), logger.multiLogLevels.warnCoFiData);

    return Promise.resolve([]);
  }

  const selectedCOInteraction = selectiveExtensions.customObjectFieldInteractions;
  logger.multiLog('Selective Custom Objects Field Interactions deploy', logger.multiLogLevels.debugCoFiData);

  Object.entries(selectedCOInteraction).forEach(([selCoKey, selCoVal]) => {
    Object.entries(entityCustomObjectsMap).forEach(([key, val] = entry) => {
      const coConfig = val.find(co => co.extensionName === selCoKey);

      if (coConfig) {
        selCoVal.entityName = key;
        selCoVal.objectInstance = coConfig.objectNumber;
        selCoVal.customObjctName = selCoKey;
      }
    });

    if (selCoVal.entityName && selCoVal.objectInstance) {
      const entityConfig = entityNameMap[selCoVal.entityName]

      if (entityConfig && entityConfig.entityName && entityConfig.customObjectURL) {
        selCoVal.entityName = entityConfig.entityName;
        selCoVal.objectUrl = entityConfig.customObjectURL;
      } else {
        logger.multiLog(chalk.yellow(`Could not find ${selCoKey} in entity config or this entity is missing an entityName / customObjectURL. This object will not be deployed!`), logger.multiLogLevels.warnCoFiData);
        logger.multiLog(chalk.yellow('Please check "entityNameMap.json" to see if your Custom Object is there and has a valid entityName / customObjectURL'), logger.multiLogLevels.warnCoFiData);
        delete selectedCOInteraction.selectCOkey;
      }
    } else {
      logger.multiLog(chalk.yellow(`Could not find ${selCoKey} in entity Custom Object map or it was missing an object number. This object will not be deployed!`), logger.multiLogLevels.warnCoFiData);
      logger.multiLog(chalk.yellow(`Please check 'customObjectEntityMap.json' to see if your Custom Object is there and has a valid object number`), logger.multiLogLevels.warnCoFiData);
      delete selectedCOInteraction.selectCOkey;
    }
  });

  if (!Object.keys(selectedCOInteraction).length) {
    logger.multiLog(chalk.yellow('Could not find valid Custom Object Field Interactions mapping to entityNameMap.json / customObjectEntityMap.json files. Custom Object Field Interactions will be skipped!'), logger.multiLogLevels.warnCoFiData);

    return Promise.resolve([]);
  }

  return custObjIntRestSvc.getCustomObjects(selectedCOInteraction)
    .then(customObjects => {
      if (!customObjects || !customObjects.length) {
        logger.multiLog(chalk.yellow('Could not find Custom Objects for Selective Custom Object Field Interactions deploy. Please check rest logs!'), logger.multiLogLevels.warnCoFiData);
        logger.multiLog(chalk.yellow('Custom Object Field Interactions will be skipped!'), logger.multiLogLevels.warnCoFiData);

        return Promise.resolve([]);
      }
      const allSelectedObjects = [];

      Object.keys(selectedCOInteraction).forEach(extensionCO => {
        const selectiveCustomObject = selectedCOInteraction[extensionCO];
        selectiveCustomObject.objectId = customObjects.find(customObject => customObject.type === selectedCOInteraction[extensionCO].entityName && customObject.objectNumber === selectedCOInteraction[extensionCO].objectInstance).id;
        allSelectedObjects.push(selectiveCustomObject);
      });

      return custObjIntRestSvc.getCustomObjectAttributes(allSelectedObjects).then(customObjectFields => {
        if (!customObjectFields || !customObjectFields.length) {
          logger.multiLog(chalk.yellow('Could not find Custom Objects Attributes for Selective Custom Object Field Interactions deploy. Please check rest logs!'), logger.multiLogLevels.warnCoFiData);
          logger.multiLog(chalk.yellow('Custom Object Field Interactions will be skipped!'), logger.multiLogLevels.warnCoFiData);

          return Promise.resolve([]);
        }

        allSelectedObjects.forEach(selectiveCO => {
          selectiveCO.fields.forEach(selCOField => {
            selCOField.fieldMapId = customObjectFields.find(resField => resField.customObject.id === selectiveCO.objectId && resField.columnName.toLowerCase() === selCOField.fieldName.toLowerCase()).id;
          });
        });

        return custObjIntRestSvc.getCustomObjectAttributeInteractions(allSelectedObjects).then(resultFI => {
          if (resultFI) {
            const uploadConfig = createUploadConfig(resultFI, allSelectedObjects);
            logger.multiLog(`Custom Object Field Interactions uploadConfig: ${JSON.stringify(uploadConfig)}`, logger.multiLogLevels.debugCoFiData);
            const promiseList = [];
            const results = []

            if (extensions.customObjectFieldInteractions) {
              Object.keys(uploadConfig).forEach(extensionCO => {
                if (extensions.customObjectFieldInteractions[extensionCO]) {
                  const entity = uploadConfig[extensionCO].entity
                  const objectUrl = uploadConfig[extensionCO].objectUrl;
                  logger.multiLog(`Updating Custom Object Field Interactions for ${extensionCO} - ${entity}`, logger.multiLogLevels.debugCoFiData);

                  if (uploadConfig[extensionCO].toUpdate) {
                    Object.keys(uploadConfig[extensionCO].toUpdate).forEach(fieldKey => {
                      logger.multiLog(`Updating Custom Object Field Interactions for field: ${fieldKey}`, logger.multiLogLevels.debugCoFiData);

                      uploadConfig[extensionCO].toUpdate[fieldKey].interactionNameID.forEach(interaction => {
                        const extensionFI = extensions.customObjectFieldInteractions[extensionCO].find(fi => interaction.name === fi.name && fieldKey.toLowerCase() === fi.fieldName.toLowerCase());

                        if (extensionFI) {
                          promiseList.push(custObjIntRestSvc.updateCustomObjectAttributeInteraction(extensionFI, entity, extensionCO, fieldKey, interaction, objectUrl));
                        } else {
                          logger.multiLog(chalk.yellow(`Could not find '${interaction.name}' for '${extensionCO} - ${fieldKey}' in extensions file. Custom Object Field Interaction will not be deployed!`), logger.multiLogLevels.warnCoFiData);
                          results.push(resultsSvc.handleUpdateCOFIFail(entity, extensionCO, fieldKey, interaction.name, `Could not not find ${interaction.name} in ${extensionCO}.${fieldKey} in extension file`));
                        }
                      });
                    });
                  }

                  if (uploadConfig[extensionCO].toAdd) {
                    logger.multiLog(`Adding Custom Object Field Interactions for ${extensionCO} - ${entity}`, logger.multiLogLevels.debugCoFiData);

                    Object.keys(uploadConfig[extensionCO].toAdd).forEach(fieldKey => {
                      logger.multiLog(`Adding Custom Object Field Interactions for field: ${fieldKey}`, logger.multiLogLevels.debugCoFiData);

                      uploadConfig[extensionCO].toAdd[fieldKey].interactionNames.forEach(interactionName => {
                        const extensionFI = extensions.customObjectFieldInteractions[extensionCO].find(fi => interactionName === fi.name && fieldKey.toLowerCase() === fi.fieldName.toLowerCase());

                        if (extensionFI) {
                          promiseList.push(custObjIntRestSvc.addCustomObjectAttributeInteraction(extensionFI, entity, extensionCO, fieldKey, uploadConfig[extensionCO].toAdd[fieldKey].fieldMapId, interactionName, objectUrl));
                        } else {
                          logger.multiLog(chalk.yellow(`Could not find '${interactionName}' for '${fieldKey}' in extensions file. Custom Object Field Interaction will not be deployed!`), logger.multiLogLevels.warnCoFiData);
                          results.push(resultsSvc.handleAddCOFIFail(entity, extensionCO, fieldKey, interactionName, `Could not find ${interactionName} in ${extensionCO}.${fieldKey} in extension file`));
                        }
                      });
                    });
                  }
                } else {
                  logger.multiLog(chalk.yellow(`Could not find '${extensionCO}' in extensions file, Custom Object Field Interactions for '${extensionCO}' will not be deployed!`), logger.multiLogLevels.warnCoFiData);
                }
              });
            } else {
              logger.multiLog(chalk.yellow('Could not find any Custom Object Field Interactions in extensions file! All Custom Object Field Interactions will not be deployed!'), logger.multiLogLevels.warnCoFiData);
              results.push(resultsSvc.handleFIExtensionsFail(uploadConfig));
            }

            return Promise.allSettled(promiseList).then(responses => {
              const responseValues = responses.map(response => response.value);

              return results.concat(responseValues).flat();
            });
          }

          return Promise.resolve([]);
        });
      });
    });
}

function deployAllCustomObjectFieldInteractions(extensions, deployFiOnly) {
  if (deployFiOnly) {
    logger.multiLog(chalk.yellow('Skipping Custom Object Field Interactions because they were already deployed within first user'), logger.multiLogLevels.warnCoFiData);

    return Promise.resolve([]);
  }

  const fullCOConfig = {};

  if (!extensions.customObjectFieldInteractions || Object.keys(extensions.customObjectFieldInteractions).length === 0) {
    logger.multiLog(chalk.yellow('Could not find Custom Object Field Interactions in "extension.json" file. Custom Object Field Interactions will be skipped!'), logger.multiLogLevels.warnCoFiData);

    return Promise.resolve([]);
  }

  logger.multiLog('Full Custom Objects Field Interactions deploy', logger.multiLogLevels.debugCoFiData);

  Object.keys(entityCustomObjectsMap).forEach(key => {
    if (!entityNameMap[key] || !entityNameMap[key].entityName || !entityNameMap[key].customObjectURL) {
      logger.multiLog(chalk.yellow(`Could not find ${key} in entity config or this entity is missing an entityName / customObjectURL. This object will not be deployed!`), logger.multiLogLevels.warnCoFiData);
      logger.multiLog(chalk.yellow('Please check "entityNameMap.json" to see if your Custom Object is there and has a valid entityName / customObjectURL'), logger.multiLogLevels.warnCoFiData);
    } else {
      entityCustomObjectsMap[key].forEach(co => {
        fullCOConfig[co.extensionName] = {entityName: entityNameMap[key].entityName, objectInstance: co.objectNumber, objectUrl: entityNameMap[key].customObjectURL};
      });
    }
  });

  return custObjIntRestSvc.getCustomObjects(fullCOConfig)
    .then(resultCOs => {
      if (!resultCOs || !resultCOs.length) {
        logger.multiLog(chalk.yellow('Could not find Custom Objects for Full Custom Object Field Interactions deploy. Please check rest logs!'), logger.multiLogLevels.warnCoFiData);
        logger.multiLog(chalk.yellow('Custom Object Field Interactions will be skipped!'), logger.multiLogLevels.warnCoFiData);

        return Promise.resolve([]);
      }

      const allObjectsWithId = [];

      Object.keys(fullCOConfig).forEach(configCo => {
        if (extensions.customObjectFieldInteractions[configCo]) {
          const coExtFields = extensions.customObjectFieldInteractions[configCo].map(fi => fi.fieldName.toLowerCase()).filter(utils.onlyUnique);
          const configFields = [];

          coExtFields.forEach(extField => {
            const fieldFIs = extensions.customObjectFieldInteractions[configCo].filter(extFI => extFI.fieldName.toLowerCase() === extField.toLowerCase());
            if (fieldFIs && fieldFIs.length) {
              configFields.push({fieldName: extField, fieldInteractionNames: fieldFIs.map(fi => fi.name)});
            }
          });

          if (configFields && configFields.length) {
            fullCOConfig[configCo].fields = configFields;
          }

          if (resultCOs.find(resultCO => resultCO.type === fullCOConfig[configCo].entityName && resultCO.objectNumber === fullCOConfig[configCo].objectInstance)) {
            fullCOConfig[configCo].objectId = resultCOs.find(resultCO => resultCO.type === fullCOConfig[configCo].entityName && resultCO.objectNumber === fullCOConfig[configCo].objectInstance).id;
            fullCOConfig[configCo].customObjctName = configCo;

            if (fullCOConfig[configCo].fields && fullCOConfig[configCo].fields.length) {
              allObjectsWithId.push(fullCOConfig[configCo]);
            }
          } else {
            logger.multiLog(chalk.yellow(`Could not find Custom Object for ${configCo}`), logger.multiLogLevels.warnCoFiData);
          }
        } else {
          logger.multiLog(chalk.yellow(`Could not find '${configCo}' in extensions file, Custom Object Field Interactions for '${configCo}' will not be deployed!`), logger.multiLogLevels.warnCoFiData);
        }
      });

      return custObjIntRestSvc.getCustomObjectAttributes(allObjectsWithId).then(resultCOFields => {
        if (!resultCOFields || !resultCOFields.length) {
          logger.multiLog(chalk.yellow('Could not find Custom Objects Attributes for Full Custom Object Field Interactions deploy. Please check rest logs!'), logger.multiLogLevels.warnCoFiData);
          logger.multiLog(chalk.yellow('Custom Object Field Interactions will be skipped!'), logger.multiLogLevels.warnCoFiData);

          return Promise.resolve([]);
        }

        allObjectsWithId.forEach(selectiveCO => {
          selectiveCO.fields.forEach(selCOField => {
            const resultCOField = resultCOFields.find(resField => resField.customObject.id === selectiveCO.objectId && resField.columnName.toLowerCase() === selCOField.fieldName.toLowerCase());

            if (resultCOField) {
              selCOField.fieldMapId = resultCOField.id;
            } else {
              logger.multiLog(chalk.yellow(`Could not find Custom Objects Attribute for ${selectiveCO.customObjctName} for ${selCOField.fieldName}`));
              selectiveCO.fields = selectiveCO.fields.filter(field => field.fieldName !== selCOField.fieldName);
            }
          });
        });

        return custObjIntRestSvc.getCustomObjectAttributeInteractions(allObjectsWithId).then(resultFI => {
          if (resultFI) {
            const uploadConfig = createUploadConfig(resultFI, allObjectsWithId);
            logger.multiLog(`Custom Object Field Interactions uploadConfig: ${JSON.stringify(uploadConfig)}`, logger.multiLogLevels.debugCoFiData);
            const results = []
            const promiseList = [];

            if (extensions.customObjectFieldInteractions) {
              Object.keys(uploadConfig).forEach(extensionCO => {
                if (extensions.customObjectFieldInteractions[extensionCO]) {
                  const entity = uploadConfig[extensionCO].entity;
                  const objectUrl = uploadConfig[extensionCO].objectUrl;
                  logger.multiLog(`Updating Custom Object Field Interactions for ${extensionCO} - ${entity}`, logger.multiLogLevels.debugCoFiData);

                  if (uploadConfig[extensionCO].toUpdate) {
                    Object.keys(uploadConfig[extensionCO].toUpdate).forEach(fieldKey => {
                      logger.multiLog(`Updating Custom Object Field Interactions for field: ${fieldKey}`, logger.multiLogLevels.debugCoFiData);

                      uploadConfig[extensionCO].toUpdate[fieldKey].interactionNameID.forEach(interaction => {
                        const extensionFI = extensions.customObjectFieldInteractions[extensionCO].find(fi => interaction.name === fi.name && fieldKey.toLowerCase() === fi.fieldName.toLowerCase());

                        if (extensionFI) {
                          promiseList.push(custObjIntRestSvc.updateCustomObjectAttributeInteraction(extensionFI, entity, extensionCO, fieldKey, interaction, objectUrl));
                        } else {
                          logger.multiLog(chalk.yellow(`Could not find '${interaction.name}' for '${extensionCO} - ${fieldKey}' in extensions file. Custom Object Field Interaction will not be deployed!`), logger.multiLogLevels.warnCoFiData);
                          results.push(resultsSvc.handleUpdateCOFIFail(entity, extensionCO, fieldKey, interaction.name, `Could not not find ${interaction.name} in ${extensionCO}.${fieldKey} in extension file`));
                        }
                      });
                    });
                  }

                  if (uploadConfig[extensionCO].toAdd) {
                    logger.multiLog(`Adding Custom Object Field Interactions for ${extensionCO} - ${entity}`, logger.multiLogLevels.debugCoFiData);

                    Object.keys(uploadConfig[extensionCO].toAdd).forEach(fieldKey => {
                      logger.multiLog(`Adding Custom Object Field Interactions for field: ${fieldKey}`, logger.multiLogLevels.debugCoFiData);

                      uploadConfig[extensionCO].toAdd[fieldKey].interactionNames.forEach(interactionName => {
                        const extensionFI = extensions.customObjectFieldInteractions[extensionCO].find(fi => interactionName === fi.name && fieldKey.toLowerCase() === fi.fieldName.toLowerCase());

                        if (extensionFI) {
                          promiseList.push(custObjIntRestSvc.addCustomObjectAttributeInteraction(extensionFI, entity, extensionCO, fieldKey, uploadConfig[extensionCO].toAdd[fieldKey].fieldMapId, interactionName, objectUrl));
                        } else {
                          logger.multiLog(chalk.yellow(`Could not find '${interactionName}' for '${fieldKey}' in extensions file. Custom Object Field Interaction will not be deployed!`), logger.multiLogLevels.warnCoFiData);
                          results.push(resultsSvc.handleAddCOFIFail(entity, extensionCO, fieldKey, interactionName, `Could not find ${interactionName} in ${extensionCO}.${fieldKey} in extension file`));
                        }
                      });
                    });
                  }
                } else {
                  logger.multiLog(chalk.yellow(`Could not find '${extensionCO}' in extensions file, Custom Object Field Interactions for '${extensionCO}' will not be deployed!`), logger.multiLogLevels.warnCoFiData);
                }
              });
            } else {
              logger.multiLog(chalk.yellow('Could not find any Custom Object Field Interactions in extensions file! All Custom Object Field Interactions will not be deployed!'), logger.multiLogLevels.warnCoFiData);
              results.push(resultsSvc.handleFIExtensionsFail(uploadConfig));
            }
            return Promise.allSettled(promiseList).then(responses => {
              const responseValues = responses.map(response => response.value);

              return results.concat(responseValues).flat();
            });
          }

          return Promise.resolve([]);
        });
      });
    });
}

function createUploadConfig(fiData, customObjectFIs) {
  const uploadConfig = {};

  for (const customObject of customObjectFIs) {
    uploadConfig[customObject.customObjctName] = {entity: customObject.entityName, objectUrl: customObject.objectUrl};

    for (const customObjectField of customObject.fields) {
      const toUpdateNameID = [];
      const toAddNames = [];

      for (const fiName of customObjectField.fieldInteractionNames) {
        if (fiData.find(fi => fi.attribute.id === customObjectField.fieldMapId && fi.name === fiName)) {
          const id = fiData.find(fi => fi.attribute.id === customObjectField.fieldMapId && fi.name === fiName).id
          toUpdateNameID.push({name: fiName, id: id});
        } else {
          toAddNames.push(fiName);
        }
      }

      if (toUpdateNameID.length) {
        if (!uploadConfig[customObject.customObjctName].toUpdate) {
          uploadConfig[customObject.customObjctName].toUpdate = {}
        }
        uploadConfig[customObject.customObjctName].toUpdate[customObjectField.fieldName] = {}
        uploadConfig[customObject.customObjctName].toUpdate[customObjectField.fieldName].interactionNameID = toUpdateNameID;
      }
      if (toAddNames.length) {
        if (!uploadConfig[customObject.customObjctName].toAdd) {
          uploadConfig[customObject.customObjctName].toAdd = {}
        }
        uploadConfig[customObject.customObjctName].toAdd[customObjectField.fieldName] = {}
        uploadConfig[customObject.customObjctName].toAdd[customObjectField.fieldName].fieldMapId = customObjectField.fieldMapId;
        uploadConfig[customObject.customObjctName].toAdd[customObjectField.fieldName].interactionNames = toAddNames;
      }
    }
  }

  return uploadConfig;
}

module.exports = {
  setUpService,
  deploySelectedCustomObjectFieldInteractions,
  deployAllCustomObjectFieldInteractions
};
