const chalk = require('chalk');
const logger = require('./lib/logger');
const resultsSvc = require('./results-service');

class PageInteractionsCrudService {
  constructor(restApiClient) {
    this.apiClient = restApiClient;
    this.logger = logger;
    this.resultsSvc = resultsSvc;
  }

  fetchPageInteractionData(entityType, where, fields) {
    return this.apiClient.queryAll(entityType, where, fields)
      .then((result) => {
        this.logger.piData(`Query ${entityType}: where: ${where}, fields: ${fields}`);
        this.logger.piData(`Query ${entityType} response: ${JSON.stringify(result)}`);

        return Promise.resolve(result);
      }).catch((error) => {
        this.logger.error(chalk.red(error));
      });
  }

  getPageInteractions(selectivePIActions) {
    const promiseList = [];

    Object.entries(selectivePIActions).forEach(([ piKey, piVal ]) => {
      const where = `(action = '${piKey}' AND name in ('${piVal.join('\', \'')}'))`;
      const fields = 'id,name,action';

      promiseList.push(this.fetchPageInteractionData('PageInteraction', where, fields));
    });

    return Promise.allSettled(promiseList).then(results => results.map(result => result.value.data).flat());
  }

  getAllPageInteractions(username) {
    const where = `modifyingUser.username='${username}'`;
    const fields = 'id,name,action';

    return this.apiClient.queryAll('PageInteraction', where, fields)
      .then((result) => {
        this.logger.piData(`Query Page Interaction url: query/PageInteraction, where: ${where}, fields: ${fields}`);
        this.logger.piData(`Query Page Interaction response: ${JSON.stringify(result)}`);

        return Promise.resolve(result.data);
      }).catch((error) => {
        this.logger.error(chalk.red(error));
      });
  }

  addPageInteraction(PI, action, pageInteraction) {
    this.logger.debug(`Adding Page Interaction: name: '${pageInteraction}', PI: ${JSON.stringify(PI)}`);
    let resCode;

    return this.apiClient.insertEntity('PageInteraction', PI).then((response) => {
      resCode = response.status;

      return response.json();
    }).then((result) => {
      const formattedResponse = JSON.stringify(result);
      this.logger.piData('Add Page Interaction url: entity/PageInteraction');
      this.logger.piData(`Add Page Interaction payload: ${JSON.stringify(PI)}`);
      this.logger.piData(`Add Page Interaction result: ${formattedResponse}`);

      return Promise.resolve(this.resultsSvc.createPIAddResult(action, pageInteraction, resCode, formattedResponse));
    }).catch((error) => {
      this.logger.error(chalk.red(error));

      return Promise.reject(new Error(`Fail to make Insert Page Interaction call with error: ${error}`));
    });
  }

  updatePageInteraction(PI, action, pageInteraction) {
    this.logger.debug(`Updating Page Interaction: #${pageInteraction.id}, name: ${pageInteraction.name}, pageInteraction: ${JSON.stringify(pageInteraction)}`);
    let resCode;

    return this.apiClient.updateEntity('PageInteraction', pageInteraction.id, PI).then((response) => {
      resCode = response.status;

      return response.json();
    }).then((result) => {
      const formattedResponse = JSON.stringify(result);
      this.logger.piData(`Update Page Interaction url: entity/PageInteraction/${pageInteraction.id}`);
      this.logger.piData(`Update Page Interaction payload: ${JSON.stringify(PI)}`);
      this.logger.piData(`Update Page Interaction result: ${formattedResponse}`);

      return Promise.resolve(this.resultsSvc.createPIUpdateResult(action, pageInteraction, resCode, formattedResponse));
    }).catch((error) => {
      this.logger.error(chalk.red(error));

      return Promise.reject(new Error(`Fail to make Update Page Interaction call with error: ${error}`));
    });
  }

  deletePageInteraction(id, action, interactionName) {
    this.logger.debug(`Deleting Page Interaction #${id}, name: '${interactionName}'`);
    let resCode;

    return this.apiClient.deleteEntity('PageInteraction', id).then((response) => {
      resCode = response.status;

      return response.json();
    }).then((result) => {
      const formattedResponse = JSON.stringify(result);
      this.logger.piData(`Delete Page Interaction url: entity/PageInteraction/${id}`);
      this.logger.piData(`Delete Page Interaction  response: ${formattedResponse}`);
      return Promise.resolve(this.resultsSvc.createPIDeleteResult(action, { name: interactionName, id: id }, resCode, formattedResponse));
    }).catch((error) => {
      this.logger.error(chalk.red(error));

      return Promise.reject(new Error(`Fail to make delete Page Interaction  call with error: ${error}`));
    });
  }
}

module.exports = PageInteractionsCrudService;
