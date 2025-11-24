const chalk = require('chalk');
const logger = require('./lib/logger');
const resultsSvc = require('./results-service');

let apiClient;

function setUpService(restApiClient) {
  apiClient = restApiClient;
}

function fetchPageInteractionData(entityType, where, fields) {
  return apiClient.queryAll(entityType, where, fields)
    .then(result => {
      logger.piData(`Query ${entityType}: where: ${where}, fields: ${fields}`);
      logger.piData(`Query ${entityType} response: ${JSON.stringify(result)}`);

      return Promise.resolve(result);
    }).catch(error => {
      logger.error(chalk.red(error));
    });
}

function getPageInteractions(selectivePIActions) {
  const promiseList = [];

  Object.entries(selectivePIActions).forEach(([piKey, piVal]) => {
    const where = `(action = '${piKey}' AND name in ('${piVal.join('\', \'')}'))`
    const fields = 'id,name,action';

    promiseList.push(fetchPageInteractionData('PageInteraction', where, fields));
  });

  return Promise.allSettled(promiseList).then(results => results.map(result => result.value.data).flat());
}

function getAllPageInteractions(username) {
  const where = `modifyingUser.username='${username}'`;
  const fields = 'id,name,action';

  return apiClient.queryAll('PageInteraction', where, fields)
    .then(result => {
      logger.piData(`Query Page Interaction url: query/PageInteraction, where: ${where}, fields: ${fields}`);
      logger.piData(`Query Page Interaction response: ${JSON.stringify(result)}`);

      return Promise.resolve(result.data);
    }).catch(error => {
      logger.error(chalk.red(error));
    });
}

function addPageInteraction(PI, action, pageInteraction) {
  logger.debug(`Adding Page Interaction: name: '${pageInteraction}', PI: ${JSON.stringify(PI)}`);
  let resCode;

  return apiClient.insertEntity('PageInteraction', PI).then(response => {
    resCode = response.status;

    return response.json()
  }).then(result => {
    const formattedResponse = JSON.stringify(result);
    logger.piData(`Add Page Interaction url: entity/PageInteraction`);
    logger.piData(`Add Page Interaction payload: ${JSON.stringify(PI)}`);
    logger.piData(`Add Page Interaction result: ${formattedResponse}`);

    return Promise.resolve(resultsSvc.createPIAddResult(action, pageInteraction, resCode, formattedResponse));
  }).catch(error => {
    logger.error(chalk.red(error));

    return Promise.reject(new Error(`Fail to make Insert Page Interaction call with error: ${error}`));
  });
}

function updatePageInteraction(PI, action, pageInteraction) {
  logger.debug(`Updating Page Interaction: #${pageInteraction.id}, name: ${pageInteraction.name}, pageInteraction: ${JSON.stringify(pageInteraction)}`);
  let resCode;

  return apiClient.updateEntity('PageInteraction', pageInteraction.id, PI).then(response => {
    resCode = response.status;

    return response.json()
  }).then(result => {
    const formattedResponse = JSON.stringify(result);
    logger.piData(`Update Page Interaction url: entity/PageInteraction/${pageInteraction.id}`);
    logger.piData(`Update Page Interaction payload: ${JSON.stringify(PI)}`);
    logger.piData(`Update Page Interaction result: ${formattedResponse}`);

    return Promise.resolve(resultsSvc.createPIUpdateResult(action, pageInteraction, resCode, formattedResponse));
  }).catch(error => {
    logger.error(chalk.red(error));

    return Promise.reject(new Error(`Fail to make Update Page Interaction call with error: ${error}`));
  });
}

function deletePageInteraction(id, action, interactionName) {
  logger.debug(`Deleting Page Interaction #${id}, name: '${interactionName}'`);
  let resCode;

  return apiClient.deleteEntity('PageInteraction', id).then(response => {
    resCode = response.status;

    return response.json()
  }).then(result => {
    const formattedResponse = JSON.stringify(result);
    logger.piData(`Delete Page Interaction url: entity/PageInteraction/${id}`);
    logger.piData(`Delete Page Interaction  response: ${formattedResponse}`);
    return Promise.resolve(resultsSvc.createPIDeleteResult(action, {name: interactionName, id: id}, resCode, formattedResponse));
  }).catch(error => {
    logger.error(chalk.red(error));

    return Promise.reject(new Error(`Fail to make delete Page Interaction  call with error: ${error}`));
  });
}

module.exports = {
  getPageInteractions,
  updatePageInteraction,
  addPageInteraction,
  getAllPageInteractions,
  deletePageInteraction,
  setUpService
};
