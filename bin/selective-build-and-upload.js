const chalk = require('chalk');
const fs = require('fs');
const logger = require('./lib/logger');
const spawn = require('child_process').spawn;
const extractExtension = require('./extract-extension');
const injectionSvc = require('./injection-service');
const fieldIntDeploySvc = require('./field-interaction-deploy-service');
const coIntDeploySvc = require('./custom-objects-interaction-deploy-service');
const pageIntDeploySvc = require('./page-interaction-deploy-service');
const resultsSvc = require('./results-service');
const {createRestApiClient} = require('./lib/rest-api-client.js');


if (process.argv.length < 3) {
  logger.error('Please pass an environment argument to build.');

  process.exit();
}

const environment = process.argv[2];
const fileName = `./environments/environment.${environment}.json`;

if (!fs.existsSync(fileName)) {
  logger.error(`Environment file with name ${fileName} does not exist...`);

  process.exit();
}

const configuration = JSON.parse(fs.readFileSync(fileName, 'UTF-8'));

let selectiveFileName = 'selective-extension.json';

if (process.argv.length == 4) {
  if (!fs.existsSync(selectiveFileName)) {
    logger.error(`Selective extension file with name ${selectiveFileName} does not exist...Looks for it in Jenkins instead...`);

    // if the file is not found, then look for it in Jenkins workspace
    if (environment === 'prod') {
      selectiveFileName = `/home/jenkins/agent/workspace/Release_Engineering/PS_Deploy_Tools/field-interactions-upload-pipeline-NEW-PROD/${selectiveFileName}`;
    } else {
      selectiveFileName = `/home/jenkins/agent/workspace/Release_Engineering/PS_Deploy_Tools/field-interactions-upload-pipeline-NEW-STAGING/${selectiveFileName}`;
    }

    if (!fs.existsSync(selectiveFileName)) {
      logger.error(`Selective extension file with name ${selectiveFileName} does not exist...`);

      process.exit();
    }
  }
}

const selectiveExtensions = JSON.parse(fs.readFileSync(`./${selectiveFileName}`, 'UTF-8'));

function hasClientIdAndClientSecret(configuration) {
  return configuration.clientId && configuration.clientSecret;
}

function hasUsernameAndPassword(configuration) {
  return configuration.username && configuration.password;
}

function hasUsers(configuration) {
  if (Array.isArray(configuration.users) && configuration.users.length > 0) {
    const invalidUsers = configuration.users.filter((user) => {
      return !user.username || !user.password || !user.privateLabelId;
    });

    return invalidUsers.length === 0;
  }

  return false;
}

if (!configuration || (!hasClientIdAndClientSecret(configuration))) {
  logger.error(`Configuration should have clientId and clientSecret for the authorization`, configuration);

  process.exit();
}

if (!hasUsernameAndPassword(configuration) && !hasUsers(configuration)) {
  logger.error(`Configuration should have either a username or password, or an array of users that each have a username, password, and privateLabelId`, configuration);

  process.exit();
}

if (configuration.deployDebug) {
  logger.multiLog(chalk.yellow('Deploying in debug mode'), logger.multiLogLevels.debugIntData);
  logger.level = 'debug';
}

const cmdSuffix = /^win/.test(process.platform) ? '.cmd' : '';
const lineBreaks = /(?:\r\n|\r|\n)/g;

function print(command, arguments, callback) {
  const process = spawn(command, arguments);

  logger.debug(process.spawnargs.join(' '));

  process.stdout.on('data', (data) => {
    logger.debug(data.toString().replace(lineBreaks, ''));
  });

  process.stderr.on('data', (data) => {
    logger.error(data.toString().replace(lineBreaks, ''));
  });

  process.on('exit', (code) => {
    if (code !== 0) {
      logger.error('Error performing process: exited with code ' + code);
    } else {
      callback();
    }
  });

  return process;
}

function clean(callback) {
  print(`rimraf${cmdSuffix}`, ['output', 'dist'], callback);
}

function build(callback) {
  print(`tsc${cmdSuffix}`, [], callback);
}

function auth(clientId, clientSecret, username, password) {
  return createRestApiClient({
    clientId: clientId,
    clientSecret: clientSecret,
    username: username,
    password: password
  }).then(client => {
    return client;
  });
}

function selectiveUpload(restApiClient, privateLabelId, extensions, deployFiOnly, callback) {
  logger.multiLog(`Selective uploading...`, logger.multiLogLevels.infoIntData);

  fieldIntDeploySvc.setUpService(restApiClient);
  coIntDeploySvc.setUpService(restApiClient);
  pageIntDeploySvc.setUpService(restApiClient);

  return fieldIntDeploySvc.deploySelectedFieldInteractions(selectiveExtensions, privateLabelId, extensions).then(fiResults => {
    return coIntDeploySvc.deploySelectedCustomObjectFieldInteractions(selectiveExtensions, extensions, deployFiOnly).then(coFIResults => {
      return pageIntDeploySvc.deploySelectedPageInteractions(selectiveExtensions, extensions, deployFiOnly).then(piResults => ({fieldInteractions: fiResults, customObjectFIs: coFIResults, pageInteractions: piResults}))
        .then(results => {
          resultsSvc.printResults(results, privateLabelId);

          return callback();
        });
    });
  });
}

function authAndSelectiveUpload(configuration, username, password, privateLabelId, extensions, deployFiOnly, callback) {
  return auth(configuration.clientId, configuration.clientSecret, username, password).then(restApiClient => {
    return selectiveUpload(restApiClient, privateLabelId, extensions, deployFiOnly, callback);
  });
}

function uploadForUsers(users, callback, deployFiOnly = false) {
  logger.multiLog(`Uploading for ${chalk.green(users[0].username)}`, logger.multiLogLevels.infoIntData);
  logger.multiLog(`Private Label --> ${chalk.green(users[0].privateLabelId)}`, logger.multiLogLevels.infoIntData);
  clean(() => {
    build(() => {
      extractExtension.extract((extensions) => {
        injectionSvc.inject(configuration, extensions, (extensions) => {
          logger.dev(`extensions --> ${JSON.stringify(extensions)}`);

          if (selectiveExtensions) {
            return authAndSelectiveUpload(configuration, users[0].username, users[0].password, users[0].privateLabelId, extensions, deployFiOnly, () => {
              const nextUsers = users.slice(1);

              if (nextUsers.length) {
                uploadForUsers(users.slice(1), callback, true);
              } else {
                return callback();
              }
            });
          } else {
            logger.error(chalk.red('No "selective-extension.json" file. Aborting deployment...'));
            process.exit(1);
          }
        });
      })
    });
  });
}

try {
  let users = [];

  if (configuration.username && configuration.password && !Array.isArray(configuration.users)) {
    logger.debug('Only one user found');
    users.push({username: configuration.username, password: configuration.password});
  } else if (configuration.users && Array.isArray(configuration.users) && configuration.users.length > 0) {
    users = configuration.users
  } else {
    logger.error('No users found, aborting upload. Please check your environment file and add at least one user');
    process.exit(1);
  }

  uploadForUsers(users, () => {
    logger.info('Deployment complete please view the results for each user above');
    logger.printSeparator();
  });
} catch (error) {
  logger.error(chalk.red('Error occurred during selective-build-and-upload', error));
  process.exit(1);
}
