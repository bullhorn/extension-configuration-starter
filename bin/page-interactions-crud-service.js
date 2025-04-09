const fetch = require('node-fetch');
const winston = require('winston');
const chalk = require('chalk');
const utils = require('./utils');

const resultsSvc = require('./results-service');


const logger = winston.createLogger({
  levels: utils.loggingLevels.levels,
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: './deploy-logs/error.log', level: 'error', format: winston.format.simple(), options: { flags: 'w' } }),
    new winston.transports.File({ filename: './deploy-logs/combined.log', level: 'debug', format: winston.format.simple(), options: { flags: 'w' } }),
    new winston.transports.File({ filename: './deploy-logs/rest-responses/page-interactions.log', level: 'data', format: winston.format.json(), options: { flags: 'w' } }),
    new winston.transports.File({ filename: './deploy-logs/results/page-interactions.log', level: 'data', format: winston.format.simple(), options: { flags: 'w' } }),
    new winston.transports.File({ filename: './deploy-logs/dev-logs.log', level: 'dev', format: winston.format.simple(), options: { flags: 'w' } })
  ],
});

let restUrl = ''
let restToken = ''

function setUpService(debug, rest) {
  if (debug) {
    logger.level = 'debug';
  }
  restUrl = rest.url;
  restToken = rest.token
  resultsSvc.setUpService(debug);
}

function fecthPageInteractionData(url, params) {
  return fetch(url, {
    method: 'POST',
    body: JSON.stringify(params),
  }).then(response => response.json())
    .then(result => {
      logger.data(`PageInteraction Data url: ${url}`);
      logger.data(`PageInteraction Data response: ${JSON.stringify(result)}`);
      return Promise.resolve(result);
    }).catch(error => {
      logger.error(chalk.red(error));
    });
}


function getPageinteractions(selectivePIActions) {
  logger.debug(`selectivePIActions:  ${selectivePIActions}`)
  const promiseList = [];
  Object.entries(selectivePIActions).forEach(([piKey, piVal]) => {
    piQuery = `(action = '${piKey}' AND name in ('${piVal.join('\', \'')}'))`
    const url = `${restUrl}/query/PageInteraction?BhRestToken=${restToken}&fields=id,name,action&where=${piQuery}&orderBy=id&start=0&count=500`;
    const params = {
      where: piQuery,
      fields: 'id,name,action',
      orderBy: 'id',
      start: 0,
      count: 500
    }
    promiseList.push(fecthPageInteractionData(url, params));
  });
  return Promise.allSettled(promiseList).then(results => results.map(result => result.value.data).flat());
}

function updatePageInteraction(PI, action, pageInteraction) {
  logger.debug(`updating PI: ${pageInteraction}`)
  const url = `${restUrl}/entity/PageInteraction/${pageInteraction.id}?BhRestToken=${restToken}`;
  let resCode
  return fetch(url, {
    method: 'POST',
    body: JSON.stringify(PI)
  })
    .then(response => {
      resCode = response.status;
      return response.json();
    }).then(result => {
      logger.data(`update PI: ${url}`);
      logger.data(`payload: ${JSON.stringify(PI)}`);
      logger.data(`update PI result: ${JSON.stringify(result)}`);
      return Promise.resolve(resultsSvc.createPIUpdateResult(action, pageInteraction, resCode));
    })
    .catch(error => {
      logger.error(chalk.red(error));
      return Promise.reject(`Fail to make Insert Page Interaction call with error: ${error}`);
    });
}

function AddPageInteraction(PI, action, pageInteraction) {
  logger.debug('adding PI: ', pageInteraction)
  const url = `${restUrl}/entity/PageInteraction?BhRestToken=${restToken}`;
  let resCode
  return fetch(url, {
    method: 'PUT',
    body: JSON.stringify(PI)
  })
    .then(response => {
      resCode = response.status;
      return response.json();
    })
    .then(result => {
      logger.data(`insert PI: ${url}`);
      logger.data(`payload: ${JSON.stringify(PI)}`);
      logger.data(`insert PI result: ${JSON.stringify(result)}`);
      return Promise.resolve(resultsSvc.createPIAddResult(action, pageInteraction, resCode));
    })
    .catch(error => {
      return Promise.reject(`Fail to make Insert Page Interaction call with error: ${error}`);
    });
}

module.exports = {
  getPageinteractions,
  updatePageInteraction,
  AddPageInteraction,
  setUpService
};
