const chalk = require('chalk');
const fieldIntRestSvc = require('./field-interactions-crud-service');
const fs = require('fs');
const logger = require('./lib/logger');
const resultsSvc = require('./results-service');
const utils = require('./utils');

const entityNameMapFileName = `./entityNameMap.json`;
const entityNameMap = JSON.parse(fs.readFileSync(entityNameMapFileName, 'UTF-8'));

function setUpService(restApiClient) {
  fieldIntRestSvc.setUpService(restApiClient);
}

function deploySelectedFieldInteractions(selectiveExtensions, privateLabelId, extensions) {
  if (!selectiveExtensions.fieldInteractions || Object.keys(selectiveExtensions.fieldInteractions).length === 0) {
    logger.multiLog(chalk.yellow('Could not find Field Interactions in "selective-extension.json" file. Field Interactions will be skipped!'), logger.multiLogLevels.warnFiData);

    return Promise.resolve([]);
  }

  const selectedFieldInteraction = selectiveExtensions.fieldInteractions;
  logger.multiLog('Selective Field Interactions deploy', logger.multiLogLevels.debugFiData);

  Object.entries(selectedFieldInteraction).forEach(([selKey, selVal]) => {
    if (entityNameMap[selKey]) {
      selVal.entityName = entityNameMap[selKey].entityName;
    } else {
      logger.multiLog(chalk.yellow(`Could not ${selKey} in 'entityNameMap.json'. This entity will be skipped!`), logger.multiLogLevels.warnFiData);
      logger.multiLog(chalk.yellow(`Please check the 'selective-extension.json' to ensure all the Field Interaction entities are in the 'entityNameMap.json'`), logger.multiLogLevels.warnFiData);
    }
  });

  return fieldIntRestSvc.getFieldMapInstances(selectedFieldInteraction, privateLabelId).then(fieldMapInstances => {
    if (!fieldMapInstances || !fieldMapInstances.length) {
      return Promise.resolve([]);
    }

    for (const selectiveConfig of Object.values(selectedFieldInteraction)) {
      const entityFieldMaps = fieldMapInstances.filter(entityFieldMap => entityFieldMap.entity === selectiveConfig.entityName);

      for (const selConfField of selectiveConfig.fields) {
        const fieldMapInstance = entityFieldMaps.find(fieldMap => fieldMap.columnName.toLowerCase() === selConfField.fieldName.toLowerCase());

        if (fieldMapInstance) {
          selConfField.fieldMapId = fieldMapInstance.id;
        } else {
          logger.multiLog(chalk.red(`Could not find field map for: ${selConfField.fieldName}`), logger.multiLogLevels.debugFiData);
          selectiveConfig.fields = selectiveConfig.fields.filter(filterField => filterField.fieldName.toLowerCase() !== selConfField.fieldName.toLowerCase());
        }
      }
    }

    return fieldIntRestSvc.getFieldInteractions(selectedFieldInteraction, privateLabelId).then(fiData => {
      if (fiData) {
        const uploadConfig = createUploadConfig(fiData, selectedFieldInteraction);
        logger.multiLog(`Field Interactions uploadConfig for ${privateLabelId}:  ${JSON.stringify(uploadConfig)}`, logger.multiLogLevels.debugFiData);
        const promiseList = [];
        const results = []

        if (extensions.fieldInteractions) {
          Object.keys(uploadConfig).forEach(entity => {
            if (extensions.fieldInteractions[entity]) {
              if (uploadConfig[entity].toUpdate) {
                logger.multiLog(`Updating Field Interactions for entity: ${entity}`, logger.multiLogLevels.debugFiData);

                Object.keys(uploadConfig[entity].toUpdate).forEach(fieldKey => {
                  logger.multiLog(`Updating Field Interactions for field: ${fieldKey}`, logger.multiLogLevels.debugFiData);

                  uploadConfig[entity].toUpdate[fieldKey].interactionNameID.forEach(interaction => {
                    const extensionFI = extensions.fieldInteractions[entity].find(fi => interaction.name === fi.name && fieldKey === fi.fieldName);

                    if (extensionFI) {
                      const {privateLabelIds} = extensionFI;

                      if (!privateLabelIds || privateLabelIds.includes(privateLabelId.toString())) {
                        promiseList.push(fieldIntRestSvc.updateFieldInteraction(extensionFI, entity, fieldKey, interaction));
                      } else {
                        logger.multiLog(`Field Interaction ${interaction.name} skipped for Private Label #${privateLabelId}`, logger.multiLogLevels.infoFiData);
                      }
                    } else {
                      logger.multiLog(chalk.yellow(`Could not find '${interaction.name}' for '${fieldKey}' in extensions file. Field Interaction will not be deployed!`), logger.multiLogLevels.warnFiData);
                      results.push(resultsSvc.handleUpdateFIFail(entity, fieldKey, interaction.name, `Could not find ${interaction.name} in ${entity}.${fieldKey} in extension file`));
                    }
                  });
                });
              }

              if (uploadConfig[entity].toAdd) {
                logger.multiLog(`Adding Field Interactions for entity: ${entity}`, logger.multiLogLevels.debugFiData);

                Object.keys(uploadConfig[entity].toAdd).forEach(fieldKey => {
                  logger.multiLog(`Adding Field Interactions for field: ${fieldKey}`, logger.multiLogLevels.debugFiData);

                  uploadConfig[entity].toAdd[fieldKey].interactionNames.forEach(interactionName => {
                    const extensionFI = extensions.fieldInteractions[entity].find(fi => interactionName === fi.name && fieldKey === fi.fieldName);

                    if (extensionFI) {
                      const {privateLabelIds} = extensionFI;

                      if (!privateLabelIds || privateLabelIds.includes(privateLabelId.toString())) {
                        promiseList.push(fieldIntRestSvc.addFieldInteraction(extensionFI, entity, fieldKey, uploadConfig[entity].toAdd[fieldKey].fieldMapId, interactionName));
                      } else {
                        logger.multiLog(`Field Interaction ${interactionName} skipped for Private Label #${privateLabelId}`, logger.multiLogLevels.infoFiData);
                      }
                    } else {
                      logger.multiLog(chalk.yellow(`Could not find '${interactionName}' for '${fieldKey}' in extensions file. Field Interaction will not be deployed!`), logger.multiLogLevels.warnFiData);
                      results.push(resultsSvc.handleAddFIFail(entity, fieldKey, interactionName, `Could not find ${interactionName} in ${entity}.${fieldKey} in extension file`));
                    }
                  });
                });
              }
            } else {
              logger.multiLog(chalk.yellow(`Could not find '${entity}' in extensions file, Field Interactions for '${entity}' will not be deployed!`), logger.multiLogLevels.warnFiData);
              results.push(resultsSvc.handleFIEntityFail(entity, uploadConfig[entity], `Unable to find entity '${entity}' in extensions file`));
            }
          });
        } else {
          logger.multiLog(chalk.yellow('Could not find any Field Interaction in extensions file! All Field Interactions will not be deployed!'), logger.multiLogLevels.warnFiData);
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
}

function deployAllFieldInteractions(privateLabelId, extensions) {
  const fullCOConfig = {};
  logger.multiLog('Full Field Interactions deploy', logger.multiLogLevels.debugFiData);

  if (extensions.fieldInteractions && Object.keys(extensions.fieldInteractions).length > 0) {
    Object.entries(extensions.fieldInteractions).forEach(([extKey, extVal]) => {
      if (entityNameMap[extKey]) {
        fullCOConfig[extKey] = {entityName: entityNameMap[extKey].entityName, fields: []};
        const fields = extVal.map(fi => fi.fieldName.toLowerCase()).filter(utils.onlyUnique);

        fields.forEach(field => {
          const fieldFIs = extVal.filter(extFI => extFI.fieldName.toLowerCase() === field.toLowerCase()).map(extFI => extFI.name);
          fullCOConfig[extKey].fields.push({fieldName: field, fieldInteractionNames: fieldFIs});
        });
      } else {
        logger.multiLog(chalk.yellow(`Could not find ${extKey} in 'entityNameMap.json'. This entity will be skipped!`), logger.multiLogLevels.warnFiData);
        logger.multiLog(chalk.yellow(`Please check the 'extensions.json' to ensure all the Field Interaction entities are in the 'entityNameMap.json'`), logger.multiLogLevels.warnFiData);
      }
    });
  } else {
    logger.warn(chalk.yellow(`Could not find Field Interactions in "extension.json" file. Field Interactions will be skipped!`));

    return Promise.resolve([]);
  }

  return fieldIntRestSvc.getFieldMapInstances(fullCOConfig, privateLabelId).then(fieldMapInstances => {
    if (!fieldMapInstances) {
      logger.multiLog(chalk.yellow('Could not find Field Map Instances for Field Interactions deploy. Please check rest logs!'), logger.multiLogLevels.warnFiData);
      logger.multiLog(chalk.yellow('Field Interactions will be skipped!'), logger.multiLogLevels.warnFiData);

      return Promise.resolve([]);
    }

    Object.values(fullCOConfig).forEach(fcVal => {
      const entityFieldMaps = fieldMapInstances.filter(entityFieldMap => entityFieldMap.entity === fcVal.entityName);

      for (const fcField of fcVal.fields) {
        const fieldMapInstance = entityFieldMaps.find(fieldMap => fieldMap.columnName.toLowerCase() === fcField.fieldName.toLowerCase())

        if (fieldMapInstance) {
          fcField.fieldMapId = fieldMapInstance.id;
        } else {
          logger.multiLog(chalk.yellow(`Could not find field map for: ${fcField.fieldName}!`), logger.multiLogLevels.debugFiData);
          logger.multiLog(chalk.yellow(`Field Interactions for ${fcField.fieldName} for ${fcVal.entityName} will not be deployed!`), logger.multiLogLevels.debugFiData);
          fcVal.fields = fcVal.fields.filter(filterField => filterField.fieldName.toLowerCase() !== fcField.fieldName.toLowerCase());
        }
      }
    });

    return fieldIntRestSvc.getFieldInteractions(fullCOConfig, privateLabelId).then(fiData => {
      if (fiData) {
        const uploadConfig = createUploadConfig(fiData, fullCOConfig);
        logger.multiLog(`Field Interactions uploadConfig for ${privateLabelId}:  ${JSON.stringify(uploadConfig)}`, logger.multiLogLevels.debugFiData);
        const promiseList = [];
        const results = []

        if (extensions.fieldInteractions) {
          Object.keys(uploadConfig).forEach(entity => {
            if (extensions.fieldInteractions[entity]) {
              if (uploadConfig[entity].toUpdate) {
                logger.multiLog(`Updating Field Interactions for entity: ${entity}`, logger.multiLogLevels.debugFiData);

                Object.keys(uploadConfig[entity].toUpdate).forEach(fieldKey => {
                  logger.multiLog(`Updating Field Interactions for field: ${fieldKey}`, logger.multiLogLevels.debugFiData);

                  uploadConfig[entity].toUpdate[fieldKey].interactionNameID.forEach(interaction => {
                    const extensionFI = extensions.fieldInteractions[entity].find(fi => interaction.name === fi.name && fieldKey.toLowerCase() === fi.fieldName.toLowerCase());

                    if (extensionFI) {
                      const {privateLabelIds} = extensionFI;

                      if (!privateLabelIds || privateLabelIds.includes(privateLabelId.toString())) {
                        promiseList.push(fieldIntRestSvc.updateFieldInteraction(extensionFI, entity, fieldKey, interaction));
                      } else {
                        logger.multiLog(`Field Interaction ${interaction.name} skipped for Private Label #${privateLabelId}`, logger.multiLogLevels.infoFiData);
                      }
                    } else {
                      logger.multiLog(chalk.yellow(`Could not find '${interaction.name}' for '${fieldKey}' in extensions file. Field Interaction will not be deployed!`), logger.multiLogLevels.warnFiData);
                      results.push(resultsSvc.handleUpdateFIFail(entity, fieldKey, interaction.name, `Could not find ${interaction.name} in ${entity}.${fieldKey} in extension file`));
                    }
                  });
                });
              }

              if (uploadConfig[entity].toAdd) {
                logger.multiLog(`Adding Field Interactions for entity: ${entity}`, logger.multiLogLevels.debugFiData);

                Object.keys(uploadConfig[entity].toAdd).forEach(fieldKey => {
                  logger.multiLog(`Adding Field Interactions for field: ${fieldKey}`, logger.multiLogLevels.debugFiData);

                  uploadConfig[entity].toAdd[fieldKey].interactionNames.forEach(interactionName => {
                    const extensionFI = extensions.fieldInteractions[entity].find(fi => interactionName === fi.name && fieldKey.toLowerCase() === fi.fieldName.toLowerCase());

                    if (extensionFI) {
                      const {privateLabelIds} = extensionFI;

                      if (!privateLabelIds || privateLabelIds.includes(privateLabelId.toString())) {
                        promiseList.push(fieldIntRestSvc.addFieldInteraction(extensionFI, entity, fieldKey, uploadConfig[entity].toAdd[fieldKey].fieldMapId, interactionName));
                      } else {
                        logger.multiLog(`Field Interaction ${interactionName} skipped for Private Label #${privateLabelId}`, logger.multiLogLevels.infoFiData);
                      }
                    } else {
                      logger.multiLog(chalk.yellow(`Could not find '${interactionName}' for '${fieldKey}' in extensions file Field interaction will not be deployed!`), logger.multiLogLevels.warnFiData);
                      results.push(resultsSvc.handleAddFIFail(entity, fieldKey, interactionName, `Could not find ${interactionName} in ${entity}.${fieldKey} in extension file`));
                    }
                  });
                });
              }
            } else {
              logger.multiLog(chalk.yellow(`Could not find '${entity}' in extensions file, Field Interactions for '${entity}' will not be deployed!`), logger.multiLogLevels.warnFiData);
              results.push(resultsSvc.handleFIEntityFail(entity, uploadConfig[entity], `Unable to find entity '${entity}' in extensions file`));
            }
          });
        } else {
          logger.multiLog(chalk.yellow('Could not find any Field Interaction in extensions file! All Field Interactions will not be deployed!'), logger.multiLogLevels.warnFiData);
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
}

function createUploadConfig(fiData, fieldInteractions) {
  const uploadConfig = {};

  for (const entity of Object.keys(fieldInteractions)) {
    const entityObj = fieldInteractions[entity];
    uploadConfig[entity] = {};

    for (const selectiveFI of entityObj.fields) {
      const toUpdateNameID = [];
      const toAddNames = [];

      for (const fiName of selectiveFI.fieldInteractionNames) {
        if (fiData.find(fi => fi && fi.fieldMapID === selectiveFI.fieldMapId && fi.name === fiName)) {
          const id = fiData.find(fi => fi && fi.fieldMapID === selectiveFI.fieldMapId && fi.name === fiName).id
          toUpdateNameID.push({name: fiName, id: id});
        } else {
          toAddNames.push(fiName);
        }
      }

      if (toUpdateNameID.length) {
        if (!uploadConfig[entity].toUpdate) {
          uploadConfig[entity].toUpdate = {}
        }

        uploadConfig[entity].toUpdate[selectiveFI.fieldName] = {}
        uploadConfig[entity].toUpdate[selectiveFI.fieldName].interactionNameID = toUpdateNameID;
      }

      if (toAddNames.length) {
        if (!uploadConfig[entity].toAdd) {
          uploadConfig[entity].toAdd = {}
        }

        uploadConfig[entity].toAdd[selectiveFI.fieldName] = {}
        uploadConfig[entity].toAdd[selectiveFI.fieldName].fieldMapId = selectiveFI.fieldMapId;
        uploadConfig[entity].toAdd[selectiveFI.fieldName].interactionNames = toAddNames;
      }
    }
  }

  return uploadConfig;
}

module.exports = {
  setUpService,
  deploySelectedFieldInteractions,
  deployAllFieldInteractions
};
