const fs = require('fs');
const fieldInteRestSvc = require('./field-interactions-crud-service');
const chalk = require('chalk');
const resultsSvc = require('./results-service');
const winston = require('winston');
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

const entityNameMapFileName = `./entityNameMap.json`;
const entityNameMap = JSON.parse(fs.readFileSync(entityNameMapFileName, 'UTF-8'));

function setUpService(debug, rest) {
  if (debug) {
    logger.level = 'debug';
  }
  fieldInteRestSvc.setUpService(debug, rest);
  resultsSvc.setUpService(debug);
}


function deploySelectedFieldInteractions(selectiveExtensions, privateLabelId, extensions) {
  if (!selectiveExtensions.fieldInteractions) {
    return Promise.resolve([]);
  }
  const selectedFieldInteraction = selectiveExtensions.fieldInteractions;
  logger.debug('Selective Field Interactions deploy');
  Object.entries(selectedFieldInteraction).forEach(([selKey, selVal]) => {
    if (entityNameMap[selKey]) {
      selVal.entityName = entityNameMap[selKey].entityName;
    } else {
      logger.warn(chalk.yellow(`Could not ${selKey} in entityNameMap this entity will be skipped`));
      logger.warn(chalk.yellow('please check the selective-extension.json to ensure all the field interaction entities are in the entityNameMap.json'));
    }
  });
  return fieldInteRestSvc.getFieldMapInstances(selectedFieldInteraction, privateLabelId)
    .then(fieldMapInstnaces => {
      if (!fieldMapInstnaces || !fieldMapInstnaces.length) {
        return Promise.resolve([]);
      }
      for (const selctiveConfig of Object.values(selectedFieldInteraction)) {
        const entityFieldMaps = fieldMapInstnaces.filter(entityFieldMap => entityFieldMap.entity === selctiveConfig.entityName);
        for (const selConfField of selctiveConfig.fields) {
          const fieldMapInstance = entityFieldMaps.find(fieldMap => fieldMap.columnName.toLowerCase() === selConfField.fieldName.toLowerCase());
          if (fieldMapInstance) {
            selConfField.fieldMapId = fieldMapInstance.id;
          } else {
            logger.debug(chalk.red(`Can't find field map for: ${selConfField.fieldName}`));
            selctiveConfig.fields = selctiveConfig.fields.filter(filterField => filterField.fieldName.toLowerCase() !== selConfField.fieldName.toLowerCase());
          }
        }
      }
      return fieldInteRestSvc.getFieldInteractions(selectedFieldInteraction, privateLabelId).then(fiData => {
        if (fiData) {
          const uploadConfig = createUploadConfig(fiData, selectedFieldInteraction);
          logger.debug(`Field interaction uploadConfig for ${privateLabelId}:  ${JSON.stringify(uploadConfig)}`);
          const promiseList = [];
          const results = []
          if (extensions.fieldInteractions) {
            Object.keys(uploadConfig).forEach(entity => {
              logger.debug('Updating Field Interactions for Entity: ', entity);
              if (extensions.fieldInteractions[entity]) {
                if (uploadConfig[entity].toUpdate) {
                  Object.keys(uploadConfig[entity].toUpdate).forEach(fieldKey => {
                    logger.debug('Updating Field Interactions for field: ', uploadConfig[entity].toUpdate[fieldKey]);
                    uploadConfig[entity].toUpdate[fieldKey].interactionNameID.forEach(interaction => {
                      const extensionFI = extensions.fieldInteractions[entity].find(fi => interaction.name === fi.name && fieldKey === fi.fieldName);
                      if (extensionFI) {
                        const {privateLabelIds} = extensionFI;
                        if (!privateLabelIds || privateLabelIds.includes(privateLabelId.toString())) {
                          promiseList.push(fieldInteRestSvc.updateFieldInteraction(extensionFI, entity, fieldKey, interaction));
                        } else {
                          logger.info(`Field Interaction ${interaction.name} skipped for Private Label ID ${privateLabelId}`);
                        }
                      } else {
                        logger.warn(chalk.yellow(`Can't find '${interaction.name}' for '${fieldKey}' in extentions file Field interaction will not be deployed!`));
                        results.push(resultsSvc.handleUpdateFIFail(entity, fieldKey, interactionName,
                          `could not find ${interaction.name} in ${entity}.${fieldKey} in extention file`));
                      }
                    });
                  });
                }
                if (uploadConfig[entity].toAdd) {
                  logger.debug('Adding Field Interactions for Entity: ', entity);
                  Object.keys(uploadConfig[entity].toAdd).forEach(fieldKey => {
                    logger.debug('Adding Field Interactions for field: ', uploadConfig[entity].toAdd[fieldKey]);
                    uploadConfig[entity].toAdd[fieldKey].interactionNames.forEach(interactionName => {
                      const extensionFI = extensions.fieldInteractions[entity].find(fi => interactionName === fi.name && fieldKey === fi.fieldName);
                      if (extensionFI) {
                        const {privateLabelIds} = extensionFI;
                        if (!privateLabelIds || privateLabelIds.includes(privateLabelId.toString())) {
                          promiseList.push(fieldInteRestSvc.AddFieldInteraction(extensionFI, entity, fieldKey, uploadConfig[entity].toAdd[fieldKey].fieldMapId, interactionName));
                        } else {
                          logger.info(`Field Interaction ${interaction.name} skipped for Private Label ID ${privateLabelId}`);
                        }
                      } else {
                        logger.warn(chalk.yellow(`Can't find '${interactionName}' for '${fieldKey}' in extentions file Field interaction will not be deployed!`));
                        results.push(resultsSvc.handleAddFIFail(entity, fieldKey, interactionName,
                          `could not find ${interactionName} in ${entity}.${fieldKey} in extention file`));
                      }
                    });
                  });
                }
              } else {
                logger.warn(chalk.yellow(`Can't find '${entity}' in extentions file, Field interactions for '${entity}' will not be deployed!`));
                results.push(resultsSvc.handleFIEntityFail(entity, uploadConfig[entity], `Unable to find entity '${entity}' in extentions`));
              }
            });
          } else {
            logger.warn(chalk.yellow('Can\'t find any Field Interaction in extentions file! All Field interactions won\'t be deployed!'));
            results.push(resultsSvc.handleFIExtentionsFail(uploadConfig));
          }
          return Promise.allSettled(promiseList).then(repsonses => {
            const responseValues = repsonses.map(repsonse => repsonse.value);
            return results.concat(responseValues).flat();
          });
        }
      });
    });
}


function deployAllFieldInteractions(privateLabelId, extensions) {
  const fullCOConfig = {};
  logger.debug('Full Field Interactions deploy');
  if (extensions.fieldInteractions) {
    Object.entries(extensions.fieldInteractions).forEach(([extKey, extval]) => {
      if (entityNameMap[extKey]) {
        fullCOConfig[extKey] = {entityName: entityNameMap[extKey].entityName, fields: []};
        const fields =  extval.map(fi => fi.fieldName.toLowerCase()).filter(utils.onlyUnique);
        fields.forEach(field => {
          const fieldFIs = extval.filter(extFI => extFI.fieldName.toLowerCase() === field.toLowerCase()).map(extFI => extFI.name);
          fullCOConfig[extKey].fields.push({fieldName: field, fieldInteractionNames: fieldFIs});
        });
      } else {
        logger.warn(chalk.yellow(`Could not ${extKey} in entityNameMap this entity will be skipped`));
        logger.warn(chalk.yellow('please check the extentions.json to ensure all the field interaction entities are in the entityNameMap.json'));
      }
    });
  } else {
    logger.warn(chalk.yellow(`Could not  field interactions in extentions field interactions will be skipped`));
    return Promise.resolve([]);
  }
  return fieldInteRestSvc.getFieldMapInstances(fullCOConfig, privateLabelId)
    .then(fieldMapInstnaces => {
      if (!fieldMapInstnaces) {
        logger.warn(chalk.yellow('Could not find field map instances for field interactions deploy please check rest logs'));
        logger.warn(chalk.yellow('field interactions will be skipped'));
        return Promise.resolve([]);
      }
      Object.values(fullCOConfig).forEach(fcVal => {
        const entityFieldMaps = fieldMapInstnaces.filter(entityFieldMap => entityFieldMap.entity === fcVal.entityName);
        for (const fcfield of fcVal.fields) {
          const fieldMapIntance = entityFieldMaps.find(fieldMap => fieldMap.columnName.toLowerCase() === fcfield.fieldName.toLowerCase()) 
          if (fieldMapIntance) {
            fcfield.fieldMapId = fieldMapIntance.id;
          } else {
            logger.debug(chalk.yellow(`Can't find field map for: ${fcfield.fieldName}!`));
            logger.debug(chalk.yellow(`Interactions for ${fcfield.fieldName} for ${fcVal.entityName} will not be deployed!`));
            fcVal.fields = fcVal.fields.filter(filtField => filtField.fieldName.toLowerCase() !==  fcfield.fieldName.toLowerCase());
          }
        }
      });
      return fieldInteRestSvc.getFieldInteractions(fullCOConfig, privateLabelId).then(fiData => {
        if (fiData) {
          const uploadConfig = createUploadConfig(fiData, fullCOConfig);
          logger.dev(`upload config: ${JSON.stringify(uploadConfig)}`);
          const promiseList = [];
          const results = []
          if (extensions.fieldInteractions) {
            Object.keys(uploadConfig).forEach(entity => {
              logger.debug('Updating Field Interactions for Entity: ', entity);
              if (extensions.fieldInteractions[entity]) {
                if (uploadConfig[entity].toUpdate) {
                  Object.keys(uploadConfig[entity].toUpdate).forEach(fieldKey => {
                    logger.debug('Updating Field Interactions for field: ', uploadConfig[entity].toUpdate[fieldKey]);
                    uploadConfig[entity].toUpdate[fieldKey].interactionNameID.forEach(interaction => {
                      const extensionFI = extensions.fieldInteractions[entity].find(fi => interaction.name === fi.name && fieldKey.toLowerCase() === fi.fieldName.toLowerCase());
                      if (extensionFI) {
                        if (!privateLabelIds || privateLabelIds.includes(privateLabelId.toString())) {
                          promiseList.push(fieldInteRestSvc.updateFieldInteraction(extensionFI, entity, fieldKey, interaction));
                        } else {
                          logger.info(`Field Interaction ${interaction.name} skipped for Private Label ID ${privateLabelId}`);
                        }
                      } else {
                        logger.warn(chalk.yellow(`Can't find '${interaction.name}' for '${fieldKey}' in extentions file Field interaction will not be deployed!`));
                        results.push(resultsSvc.handleUpdateFIFail(entity, fieldKey, interaction.name,
                          `could not find ${interaction.name} in ${entity}.${fieldKey} in extention file`));
                      }
                    });
                  });
                }
                if (uploadConfig[entity].toAdd) {
                  logger.debug('Adding Field Interactions for Entity: ', entity);
                  Object.keys(uploadConfig[entity].toAdd).forEach(fieldKey => {
                    logger.debug('Adding Field Interactions for field: ', uploadConfig[entity].toAdd[fieldKey]);
                    uploadConfig[entity].toAdd[fieldKey].interactionNames.forEach(interactionName => {
                      const extensionFI = extensions.fieldInteractions[entity].find(fi => interactionName === fi.name && fieldKey.toLowerCase() === fi.fieldName.toLowerCase());
                      if (extensionFI) {
                        if (!privateLabelIds || privateLabelIds.includes(privateLabelId.toString())) {
                          promiseList.push(fieldInteRestSvc.AddFieldInteraction(extensionFI, entity, fieldKey, uploadConfig[entity].toAdd[fieldKey].fieldMapId, interactionName));
                        } else {
                          logger.info(`Field Interaction ${interaction.name} skipped for Private Label ID ${privateLabelId}`);
                        }
                      } else {
                        logger.warn(chalk.yellow(`Can't find '${interactionName}' for '${fieldKey}' in extentions file Field interaction will not be deployed!`));
                        results.push(resultsSvc.handleAddFIFail(entity, fieldKey, interactionName,
                          `could not find ${interactionName} in ${entity}.${fieldKey} in extention file`));
                      }
                    });
                  });
                }
              } else {
                logger.warn(chalk.yellow(`Can't find '${entity}' in extentions file, Field interactions for '${entity}' will not be deployed!`));
                results.push(resultsSvc.handleFIEntityFail(entity, uploadConfig[entity], `Unable to find entity '${entity}' in extentions`));
              }
            });
          } else {
            logger.warn(chalk.yellow('Can\'t find any Field Interaction in extentions file! All Field interactions won\'t be deployed!'));
            results.push(resultsSvc.handleFIExtentionsFail(uploadConfig));
          }
          return Promise.allSettled(promiseList).then(repsonses => {
            const responseValues = repsonses.map(repsonse => repsonse.value);
            return results.concat(responseValues).flat();
          });
        }
      });
    });
}


function removeInvalidEntities(interactions) {
  for (const entity of Object.keys(interactions)) {
    if (!Array.isArray(interactions[entity])) {
      logger.warn(chalk.yellow(`The entity '${entity}' is not an array and will be skipped.`));
      interactions = removeEntity(interactions, entity);
      continue;
    }
    if (!interactions[entity].length) {
      logger.warn(chalk.yellow(`The entity '${entity}' in selective-extension has no Field interactions to deploy and will be skipped.`));
      interactions = removeEntity(interactions, entity);
      continue;
    }
    if (interactions[entity].some(field => (!field.fieldName || !field.fieldName.length)
      || (!field.fieldInteractionNames || !Array.isArray(field.fieldInteractionNames) || !field.fieldInteractionNames.length))) {
      logger.warn(chalk.yellow(`The entity '${entity}' has bad fields and will be skipped. Please ensure all field objects have the following`));
      logger.warn(chalk.yellow('\'fieldName\' with a valid field name'));
      logger.warn(chalk.yellow('\'fieldInteractionNames\' with an array of a least one interaction name'));
      interactions = removeEntity(interactions, entity);
      continue;
    }
  };
  return interactions;
}

function removeEntity(interactions, entity) {
  logger.debug(`removing '${entity}' from input field interaction`);
  delete interactions[entity];
  return interactions
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
          toUpdateNameID.push({ name: fiName, id: id });
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
  deployAllFieldInteractions,
  deploySelectedFieldInteractions,
  setUpService
};
