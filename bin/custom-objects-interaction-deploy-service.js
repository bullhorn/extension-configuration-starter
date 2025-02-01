const fs = require('fs');
const custObjInteRestSvc = require('./custom-objects-interactions-crud-service');
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

const entityCustomObjectsMapFileName = `./customObjectEntityMap.json`;
const entityNameMapFileName = `./entityNameMap.json`;
const entityCustomObjectsMap = JSON.parse(fs.readFileSync(entityCustomObjectsMapFileName, 'UTF-8'));
const entityNameMap = JSON.parse(fs.readFileSync(entityNameMapFileName, 'UTF-8'));

function setUpService(debug, rest) {
  if (debug) {
    logger.level = 'debug';
  }
  custObjInteRestSvc.setUpService(debug, rest);
  resultsSvc.setUpService(debug);
}




function deploySelectedCOFieldInteractions(selectiveExtensions, extensions) {
  if(!selectiveExtensions.customObjectsFieldInteractions) {
    return Promise.resolve([]);
  }
  const selectedCOInteraction = selectiveExtensions.customObjectsFieldInteractions;
  logger.debug('Selective Custom Objects Interactions deploy');
  Object.entries(selectedCOInteraction).forEach(([selCOkey, selCOVal]) => {
    Object.entries(entityCustomObjectsMap).forEach(([key, val] = entry) => {
      coConfig = val.find(co => co.extensionName === selCOkey);
      if (coConfig) {
        selCOVal.entityName = key;
        selCOVal.objectInstance = coConfig.objectNumber;
        selCOVal.customObjctName = selCOkey;
      }
    });
    if (selCOVal.entityName && selCOVal.objectInstance) {
      const entityConfig = entityNameMap[selCOVal.entityName]
      if (entityConfig && entityConfig.entityName && entityConfig.customObjectURL) {
        selCOVal.entityName = entityConfig.entityName;
        selCOVal.objectUrl = entityConfig.customObjectURL;
      } else {
        logger.warn(chalk.yellow(`Could not find ${selCOkey} in entity config or this entity is missing an entityName / customObjectURL this object will not be deployed.`));
        logger.warn(chalk.yellow('Please check entityNameMap.json to see if your custom object is there and has a valid entityName / customObjectURL'));
        delete selectedCOInteraction.selectCOkey;
      }
    } else {
      logger.warn(chalk.yellow(`Could not find ${selCOkey} in entity custom object map or it was missing an object number this object will not be deployed.`));
      logger.warn(chalk.yellow('Please check customObjectEntityMap.json to see if your custom object is there and has a valid object number'));
      delete selectedCOInteraction.selectCOkey;
    }
  });
  if(!Object.keys(selectedCOInteraction).length) {
    return Promise.resolve([]);
  }
  return custObjInteRestSvc.getCustomObjectInstances(selectedCOInteraction)
    .then(customObjects => {
      if (!customObjects || !customObjects.length ) {
        logger.warn(chalk.yellow('Could not find custom objects for custom object interactions deploy please check rest logs'));
        logger.warn(chalk.yellow('Custom Objects will be skipped'));
        return Promise.resolve([]);
      }
      const allSelectedObjects = [];
      Object.keys(selectedCOInteraction).forEach(extensionCO => {
        const selectiveCustomObject = selectedCOInteraction[extensionCO];
        selectiveCustomObject.objectId = customObjects.find(customObject => customObject.type === selectedCOInteraction[extensionCO].entityName
          && customObject.objectNumber === selectedCOInteraction[extensionCO].objectInstance).id;
        allSelectedObjects.push(selectiveCustomObject);
      });
      return custObjInteRestSvc.getCustomObjectsFields(allSelectedObjects).then(customObjectFields => {
        if (!customObjectFields) {
          logger.warn(chalk.yellow('Could not find custom objects fields for custom object interactions deploy please check rest logs'));
          logger.warn(chalk.yellow('Custom Objects will be skipped'));
          return Promise.resolve([]);
        }
        allSelectedObjects.forEach(selectiveCO => {
          selectiveCO.fields.forEach(selCOField => {
            selCOField.fieldMapId = customObjectFields.find(resField => resField.customObject.id === selectiveCO.objectId && resField.columnName.toLowerCase() === selCOField.fieldName.toLowerCase()).id;
          });
        });
        return custObjInteRestSvc.getCustomObjectFieldInteractions(allSelectedObjects).then(resultFI => {
          if (resultFI) {
            const uploadConfig = createUploadConfig(resultFI, allSelectedObjects);
            logger.dev(`Custom Object Field interaction uploadConfig:  ${JSON.stringify(uploadConfig)}`);
            const promiseList = [];
            const results = []
            if (extensions.customObjectFieldInteractions) {
              Object.keys(uploadConfig).forEach(extentionCO => {
                if (extensions.customObjectFieldInteractions[extentionCO]) {
                  const entity = uploadConfig[extentionCO].entity
                  const objectUrl = uploadConfig[extentionCO].objectUrl;
                  logger.debug(`Updating Custom Object Field Interactions for ${extentionCO} - ${entity}`);
                  if (uploadConfig[extentionCO].toUpdate) {
                    Object.keys(uploadConfig[extentionCO].toUpdate).forEach(fieldKey => {
                      logger.debug('Updating Custom Object Field Interactions for field: ', uploadConfig[extentionCO].toUpdate[fieldKey]);
                      uploadConfig[extentionCO].toUpdate[fieldKey].interactionNameID.forEach(interaction => {
                        const extensionFI = extensions.customObjectFieldInteractions[extentionCO].find(fi => interaction.name === fi.name && fieldKey.toLowerCase() === fi.fieldName.toLowerCase());
                        if (extensionFI) {
                          const {privateLabelIds} = extensionFI;
                          promiseList.push(custObjInteRestSvc.updateFieldInteraction(extensionFI, entity, extentionCO, fieldKey, interaction, objectUrl));
                        } else {
                          logger.warn(chalk.yellow(`Can't find '${interaction.name}' for '${extentionCO} - ${fieldKey}' in extentions file Field interaction will not be deployed!`));
                          results.push(resultsSvc.handleUpdateCOFIFail(entity, extentionCO, fieldKey, interactionName,
                            `could not find ${interaction.name} in ${extentionCO}.${fieldKey} in extention file`));
                          logger.data(JSON.stringify(results));
                        }
                      });
                    });
                  }
                  if (uploadConfig[extentionCO].toAdd) {
                    logger.debug(`Adding Custom Object Field Interactions for ${extentionCO} - ${entity}`);
                    Object.keys(uploadConfig[extentionCO].toAdd).forEach(fieldKey => {
                      logger.debug('Adding Custom Object Field Interactions for field: ', uploadConfig[extentionCO].toAdd[fieldKey]);
                      uploadConfig[extentionCO].toAdd[fieldKey].interactionNames.forEach(interactionName => {
                        const extensionFI = extensions.customObjectFieldInteractions[extentionCO].find(fi => interactionName === fi.name && fieldKey.toLowerCase() === fi.fieldName.toLowerCase());
                        extensions.customObjectFieldInteractions[extentionCO]
                        if (extensionFI) {
                          const {privateLabelIds} = extensionFI;
                          promiseList.push(custObjInteRestSvc.AddFieldInteraction(extensionFI, entity, extentionCO, fieldKey, uploadConfig[extentionCO].toAdd[fieldKey].fieldMapId, interactionName, objectUrl));
                        } else {
                          logger.warn(chalk.yellow(`Can't find '${interactionName}' for '${fieldKey}' in extentions file Field interaction will not be deployed!`));
                          results.push(resultsSvc.handleAddCOFIFail(entity, extentionCO, fieldKey, interactionName,
                            `could not find ${interactionName} in ${extentionCO}.${fieldKey} in extention file`));
                          logger.data(JSON.stringify(results));
                        }
                      });
                    });
                  }
                } else {
                  logger.warn(chalk.yellow(`Can't find '${extentionCO}' in extentions file, Custom Object Field interactions for '${extentionCO}' will not be deployed!`));
                }
              });
            } else {
              logger.warn(chalk.yellow('Can\'t find any Custom Object Field Interaction in extentions file! All Field interactions won\'t be deployed!'));
              results.push(resultsSvc.handleFIExtentionsFail(uploadConfig));
              logger.data(`No field interactions found in exention file the following won't be deployed`)
              logger.data(JSON.stringify(results));
            }
            return Promise.allSettled(promiseList).then(repsonses => {
              const responseValues = repsonses.map(repsonse => repsonse.value);
              logger.data('Returned Custom Object Field Interaction Response Values')
              responseValues.forEach(value => {
                logger.data(JSON.stringify(value));
              });
              return results.concat(responseValues).flat();
            });
          } else {
            logger.dev('hello');
          }
        });
      });
    });
}


function deployAllCOFieldInteractions(extensions) {
  const fullCOConfig = {};
  if (!extensions.customObjectFieldInteractions) {
    logger.warn(chalk.yellow('no custom object interactions in extention file skipping'));
    return Promise.resolve([]);
  }
  logger.debug('Full Custom Objects Interactions deploy');
  Object.keys(entityCustomObjectsMap).forEach(key => {
    if (!entityNameMap[key] || !entityNameMap[key].entityName || !entityNameMap[key].customObjectURL) {
      logger.warn(chalk.yellow(`Could not find ${key} in enity map COs or this CO is missing entity name / object URL. This will be skipped this entity`));
    } else {
      entityCustomObjectsMap[key].forEach(co => {
        fullCOConfig[co.extensionName] = {entityName: entityNameMap[key].entityName, objectInstance: co.objectNumber, objectUrl: entityNameMap[key].customObjectURL};
      })
    }
  });
  return custObjInteRestSvc.getCustomObjectInstances(fullCOConfig)
    .then(resultCOs => {
      if (!resultCOs|| !resultCOs.length) {
        logger.warn(chalk.yellow('Could not find custom objects for full custom object interactions deploy please check rest logs'));
        logger.warn(chalk.yellow('Custom Objects will be skipped'));
        return Promise.resolve([]);
      }
      allObjectsWithId = []
      Object.keys(fullCOConfig).forEach(configCo => {
        if(extensions.customObjectFieldInteractions[configCo]) {
          const coExtfields =  extensions.customObjectFieldInteractions[configCo].map(fi => fi.fieldName.toLowerCase()).filter(utils.onlyUnique);
          const configFields = [];
          coExtfields.forEach(extfield => {
            const fieldFIs = extensions.customObjectFieldInteractions[configCo].filter(extFI => extFI.fieldName.toLowerCase() === extfield.toLowerCase());
            if(fieldFIs && fieldFIs.length) {
              configFields.push({fieldName: extfield, fieldInteractionNames: fieldFIs.map(fi => fi.name)});
            }
          });
            if (configFields && configFields.length) {
              fullCOConfig[configCo].fields = configFields;
            }
          if (resultCOs.find(resultCO => resultCO.type === fullCOConfig[configCo].entityName && resultCO.objectNumber === fullCOConfig[configCo].objectInstance)) {
            fullCOConfig[configCo].objectId = resultCOs.find(resultCO => resultCO.type === fullCOConfig[configCo].entityName && resultCO.objectNumber === fullCOConfig[configCo].objectInstance).id;
            fullCOConfig[configCo].customObjctName = configCo;
            if (fullCOConfig[configCo].fields && fullCOConfig[configCo].fields.length){
              allObjectsWithId.push(fullCOConfig[configCo]);
            }
          } else {
            logger.warn(chalk.yellow(`Could not find object id for ${configCo}`));
          }
        } else {
          logger.warn(chalk.yellow(`Could not  ${configCo} in extentions this will be skipped`));
        }
      });

      return custObjInteRestSvc.getCustomObjectsFields(allObjectsWithId).then(resultCOFields => {
        if (!resultCOFields || !resultCOFields.length) {
          logger.warn(chalk.yellow('Could not find custom objects fields for custom object interactions deploy please check rest logs'));
          logger.warn(chalk.yellow('Custom Objects will be skipped'));
          return []
        }
        allObjectsWithId.forEach(selectiveCO => {
          selectiveCO.fields.forEach(selCOField => {
            const resultCOField = resultCOFields.find(resField => resField.customObject.id === selectiveCO.objectId && resField.columnName.toLowerCase() === selCOField.fieldName.toLowerCase());
            if (resultCOField) {
              selCOField.fieldMapId = resultCOField.id
            } else {
              logger.warn(chalk.yellow(`Could not find Custom object field id for ${selectiveCO.customObjctName} for ${selCOField.fieldName}`));
              selectiveCO.fields = selectiveCO.fields.filter(field => field.fieldName !==  selCOField.fieldName);
            }
          });
        });
        return custObjInteRestSvc.getCustomObjectFieldInteractions(allObjectsWithId).then(resultFI => {
          if (resultFI) {
            const uploadConfig = createUploadConfig(resultFI, allObjectsWithId);
            // logger.dev(`Custom Object Field interaction uploadConfig:  ${JSON.stringify(uploadConfig)}`);
            const results = []
            const promiseList = [];
            if (extensions.customObjectFieldInteractions) {
              Object.keys(uploadConfig).forEach(extentionCO => {
                if (extensions.customObjectFieldInteractions[extentionCO]) {
                  const entity = uploadConfig[extentionCO].entity;
                  const objectUrl = uploadConfig[extentionCO].objectUrl;
                  logger.debug(`Updating Custom Object Field Interactions for ${extentionCO} - ${entity}`);
                  if (uploadConfig[extentionCO].toUpdate) {
                    Object.keys(uploadConfig[extentionCO].toUpdate).forEach(fieldKey => {
                      logger.debug('Updating Custom Object Field Interactions for field: ', uploadConfig[extentionCO].toUpdate[fieldKey]);
                      uploadConfig[extentionCO].toUpdate[fieldKey].interactionNameID.forEach(interaction => {
                        const extensionFI = extensions.customObjectFieldInteractions[extentionCO].find(fi => interaction.name === fi.name && fieldKey.toLowerCase() === fi.fieldName.toLowerCase());
                        if (extensionFI) {
                          const {privateLabelIds} = extensionFI;
                          if (!privateLabelIds || privateLabelIds.includes(privateLabelId.toString())) {
                            promiseList.push(custObjInteRestSvc.updateFieldInteraction(extensionFI, entity, extentionCO, fieldKey, interaction, objectUrl));
                          } else {
                            logger.info(`Field Interaction ${interaction.name} skipped for Private Label ID ${privateLabelId}`);
                          }
                        } else {
                          logger.warn(chalk.yellow(`Can't find '${interaction.name}' for '${extentionCO} - ${fieldKey}' in extentions file Field interaction will not be deployed!`));
                          results.push(resultsSvc.handleUpdateCOFIFail(entity, extentionCO, fieldKey, interactionName,
                            `could not find ${interaction.name} in ${extentionCO}.${fieldKey} in extention file`));
                          logger.data(JSON.stringify(results));
                        }
                      });
                    });
                  }
                  if (uploadConfig[extentionCO].toAdd) {
                    logger.debug(`Adding Custom Object Field Interactions for ${extentionCO} - ${entity}`);
                    Object.keys(uploadConfig[extentionCO].toAdd).forEach(fieldKey => {
                      logger.debug('Adding Custom Object Field Interactions for field: ', uploadConfig[extentionCO].toAdd[fieldKey]);
                      uploadConfig[extentionCO].toAdd[fieldKey].interactionNames.forEach(interactionName => {
                        const extensionFI = extensions.customObjectFieldInteractions[extentionCO].find(fi => interactionName === fi.name && fieldKey.toLowerCase() === fi.fieldName.toLowerCase());
                        extensions.customObjectFieldInteractions[extentionCO]
                        if (extensionFI) {
                          const {privateLabelIds} = extensionFI;
                          if (!privateLabelIds || privateLabelIds.includes(privateLabelId.toString())) {
                            promiseList.push(custObjInteRestSvc.AddFieldInteraction(extensionFI, entity, extentionCO, fieldKey, uploadConfig[extentionCO].toAdd[fieldKey].fieldMapId, interactionName, objectUrl));
                          } else {
                            logger.info(`Field Interaction ${interaction.name} skipped for Private Label ID ${privateLabelId}`);
                          }
                        } else {
                          logger.warn(chalk.yellow(`Can't find '${interactionName}' for '${fieldKey}' in extentions file Field interaction will not be deployed!`));
                          results.push(resultsSvc.handleAddCOFIFail(entity, extentionCO, fieldKey, interactionName,
                            `could not find ${interactionName} in ${extentionCO}.${fieldKey} in extention file`));
                          logger.data(JSON.stringify(results));
                        }
                      });
                    });
                  }
                } else {
                  logger.warn(chalk.yellow(`Can't find '${extentionCO}' in extentions file, Custom Object Field interactions for '${extentionCO}' will not be deployed!`));
                }
              });
            } else {
              logger.warn(chalk.yellow('Can\'t find any Custom Object Field Interaction in extentions file! All Field interactions won\'t be deployed!'));
            }
            return Promise.allSettled(promiseList).then(repsonses => {
              const responseValues = repsonses.map(repsonse => repsonse.value);
              logger.data('Returned Custom Object Field Interaction Response Values')
              responseValues.forEach(value => {
                logger.data(JSON.stringify(value));
              });
              return results.concat(responseValues).flat();
            });
          }
        });
      });
    });
}



function removeEntity(interactions, entity) {
  logger.debug(`removing '${entity}' from input field interaction`);
  delete interactions[entity];
  return interactions
}

function createUploadConfig(fiData, customObjectFIs) {
  const uploadConfig = {};
  for (const customObject of customObjectFIs) {
    uploadConfig[customObject.customObjctName] = { entity: customObject.entityName, objectUrl:  customObject.objectUrl};
    for (const customObjectField of customObject.fields) {
      const toUpdateNameID = [];
      const toAddNames = [];
      for (const fiName of customObjectField.fieldInteractionNames) {
        if (fiData.find(fi => fi.attribute.id === customObjectField.fieldMapId && fi.name === fiName)) {
          const id = fiData.find(fi => fi.attribute.id === customObjectField.fieldMapId && fi.name === fiName).id
          toUpdateNameID.push({ name: fiName, id: id });
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
module.exports = {
  deploySelectedCOFieldInteractions,
  deployAllCOFieldInteractions,
  setUpService
};
