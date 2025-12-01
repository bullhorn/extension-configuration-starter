const chalk = require('chalk');
const logger = require('./lib/logger');
const resultsSvc = require('./results-service');

class FieldInteractionsCrudService {
  constructor(restApiClient) {
    this.apiClient = restApiClient;
    this.logger = logger;
    this.resultsSvc = resultsSvc;
  }

  fetchFieldInteractionData(entityType, where, fields, entity) {
    return this.apiClient.queryAll(entityType, where, fields)
      .then((result) => {
        this.logger.fiData(`Query ${entityType} for entity: ${entity}, where: ${where}, fields: ${fields}`);
        this.logger.fiData(`Query ${entityType} response: ${JSON.stringify(result)}`);

        if (result.data && result.data.length) {
          result.data.forEach(data => data.type = entity);
        }

        return Promise.resolve(result);
      }).catch((error) => {
        this.logger.error(chalk.red(error));
      });
  }

  getFieldMapInstances(fieldInteractions, privateLabelId) {
    const promiseList = [];

    for (const entity of Object.values(fieldInteractions)) {
      let where = `(entity = '${entity.entityName}' AND (`;
      const fieldQueries = [];

      for (const field of entity.fields) {
        fieldQueries.push(`(columnName = '${field.fieldName}'`);
      }

      where += fieldQueries.join(') OR ');
      where += `))) AND privateLabel = ${privateLabelId}`;

      promiseList.push(this.fetchFieldInteractionData('FieldMapInstance', where, 'id,entity,columnName', entity.entityName));
    }

    return Promise.allSettled(promiseList).then(results => results.map(result => result.value.data).flat());
  }

  getFieldInteractions(fieldInteractions, privateLabelId) {
    const promiseList = [];

    for (const entity of Object.values(fieldInteractions)) {
      let where = '(';
      where += entity.fields.map(field => `(fieldMapID = ${field.fieldMapId} AND name in ('${field.fieldInteractionNames.join('\',\'')}')`).join(') OR ');
      where += `)) AND privateLabelID = ${privateLabelId}`;

      promiseList.push(this.fetchFieldInteractionData('FieldMapInteraction', where, 'id,name,fieldMapID,fieldName,entity', entity.entityName));
    }

    return Promise.allSettled(promiseList).then(results => results.map(result => result.value.data).flat());
  }

  getAllFieldInteractions(username) {
    const where = `modifyingUser.username='${username}'`;
    const fields = 'id,name,fieldName,entity';

    return this.apiClient.queryAll('FieldMapInteraction', where, fields)
      .then((result) => {
        this.logger.fiData(`Query Field Map Interaction url: query/FieldMapInteraction, where: ${where}, fields: ${fields}`);
        this.logger.fiData(`Query Field Map Interaction response: ${JSON.stringify(result)}`);

        return Promise.resolve(result.data);
      }).catch((error) => {
        this.logger.error(chalk.red(error));
      });
  }

  addFieldInteraction(FI, entity, fieldName, fieldMapId, interactionName) {
    this.logger.debug(`Adding Field Interaction: name: '${interactionName}' , FI: ${JSON.stringify(FI)}`);
    FI.fieldMapID = fieldMapId;
    let resCode;

    return this.apiClient.insertEntity('FieldMapInteraction', FI).then((response) => {
      resCode = response.status;

      return response.json();
    }).then((result) => {
      const formattedResponse = JSON.stringify(result);
      this.logger.fiData('Add Field Map Interaction url: entity/FieldMapInteraction');
      this.logger.fiData(`Add Field Map Interaction payload: ${JSON.stringify(FI)}`);
      this.logger.fiData(`Add Field Map Interaction response: ${formattedResponse}`);

      return Promise.resolve(this.resultsSvc.createFIAddResult(entity, fieldName, interactionName, resCode, formattedResponse));
    }).catch((error) => {
      this.logger.error(chalk.red(error));

      return Promise.reject(new Error(`Fail to make Insert Field Interaction call with error: ${error}`));
    });
  }

  updateFieldInteraction(extensionFI, entity, fieldName, toUpdateFI) {
    this.logger.debug(`Updating Field Map Interaction: #${toUpdateFI.id}, name: '${toUpdateFI.name}', toUpdateFI: ${JSON.stringify(toUpdateFI)}`);
    let resCode;

    return this.apiClient.updateEntity('FieldMapInteraction', toUpdateFI.id, extensionFI).then((response) => {
      resCode = response.status;

      return response.json();
    }).then((result) => {
      const formattedResponse = JSON.stringify(result);
      this.logger.fiData(`Update Field Map Interaction url: entity/FieldMapInteraction/${toUpdateFI.id}`);
      this.logger.fiData(`Update Field Map Interaction payload: ${JSON.stringify(extensionFI)}`);
      this.logger.fiData(`Update Field Map Interaction response: ${formattedResponse}`);

      return Promise.resolve(this.resultsSvc.createFIUpdateResult(entity, fieldName, toUpdateFI, resCode, formattedResponse));
    }).catch((error) => {
      this.logger.error(chalk.red(error));

      return Promise.reject(new Error(`Fail to make Update Field Interaction call with error: ${error}`));
    });
  }

  deleteFieldInteraction(id, entity, fieldName, interactionName) {
    this.logger.debug(`Deleting Field Map Interaction #${id}, name: '${interactionName}'`);
    let resCode;

    return this.apiClient.deleteEntity('FieldMapInteraction', id).then((response) => {
      resCode = response.status;

      return response.json();
    }).then((result) => {
      const formattedResponse = JSON.stringify(result);
      this.logger.fiData(`Delete Field Map Interaction url: entity/FieldMapInteraction/${id}`);
      this.logger.fiData(`Delete Field Map Interaction response: ${formattedResponse}`);

      return Promise.resolve(this.resultsSvc.createFIDeleteResult(entity, fieldName, { name: interactionName, id: id }, resCode, formattedResponse));
    }).catch((error) => {
      this.logger.error(chalk.red(error));

      return Promise.reject(new Error(`Fail to make delete Field Interaction call with error: ${error}`));
    });
  }
}

module.exports = FieldInteractionsCrudService;
