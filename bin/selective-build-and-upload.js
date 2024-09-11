const fs = require('fs');
const spawn = require('child_process').spawn;
const jsonfile = require('jsonfile');
const fetch = require('node-fetch');
const { isAuthorized } = require('@bullhorn/bullhorn-cli/lib/auth');
const chalk = require('chalk');
const extractExtension = require('./extract-extension');
const fieldInterDeploySvc = require('./field-interaction-deploy-service');
const coInterDeploySvc = require('./custom-objects-interaction-deploy-service');
const pageInterDeploySvc = require('./page-interaction-deploy-service');
const resultsSvc = require('./results-service');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: './deploy-logs/error.log', level: 'error', format: winston.format.simple(), options: { flags: 'w' } }),
    new winston.transports.File({ filename: './deploy-logs/combined.log', level: 'debug', format: winston.format.simple(), options: { flags: 'w' } }), ,
  ],
});

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
  if (!fs.existsSync(selectiveFileName) ) {
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

if (!configuration || (!hasUsernameAndPassword(configuration) && !hasUsers(configuration))) {
  logger.error(`Configuration should have either a username or password, or an array of users that each have a username, password, and privateLabelId`, configuration);

  process.exit();
}

if (configuration.deployDebug) {
  logger.level = 'debug';
  extractExtension.setUpService(true);
  resultsSvc.setUpService(true);
}

const cmdSuffix = /^win/.test(process.platform) ? '.cmd' : '';
const extensionsFileName = `./output/extension.json`;
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

function getExtensionFile() {
  if (!fs.existsSync(extensionsFileName)) {
    logger.error('Error performing extract command; cannot remove page interactions');

    process.exit(1);
  }

  return fs.readFileSync(extensionsFileName, 'utf-8');
}

function clean(callback) {
  print(`rimraf${cmdSuffix}`, ['output', 'dist'], callback);
}

function build(callback) {
  print(`tsc${cmdSuffix}`, [], callback);
}



function injectScript(configuration, script) {
  Object.keys(configuration).forEach((propertyName) => {
    if (Array.isArray(script)) {
      script = script.map(function (x) { return x.replace(new RegExp(`\\$\{${propertyName}\}`, 'g'), configuration[propertyName]); });
    }
    else {
      script = script.replace(new RegExp(`\\$\{${propertyName}\}`, 'g'), configuration[propertyName]);
    }
  });

  return script;
}


function inject(configuration, callback) {
  const file = getExtensionFile();
  const extensions = JSON.parse(file);

  if (extensions.fieldInteractions) {
    Object.keys(extensions.fieldInteractions).forEach((entity) => {
      if (extensions.fieldInteractions[entity]) {
        for (let index = 0; index < extensions.fieldInteractions[entity].length; index++) {
          extensions.fieldInteractions[entity][index].script = injectScript(configuration, extensions.fieldInteractions[entity][index].script);

          if (extensions.fieldInteractions[entity][index].privateLabelIds) {
            extensions.fieldInteractions[entity][index].privateLabelIds = injectScript(configuration, extensions.fieldInteractions[entity][index].privateLabelIds);
          }
        }
      }
    });
  }
  if (extensions.customObjectFieldInteractions) {
    Object.keys(extensions.customObjectFieldInteractions).forEach((entity) => {
      if (extensions.customObjectFieldInteractions[entity]) {
        for (let index = 0; index < extensions.customObjectFieldInteractions[entity].length; index++) {
          extensions.customObjectFieldInteractions[entity][index].script = injectScript(configuration, extensions.customObjectFieldInteractions[entity][index].script);

          if (extensions.customObjectFieldInteractions[entity][index].privateLabelIds) {
            extensions.customObjectFieldInteractions[entity][index].privateLabelIds = injectScript(configuration, extensions.customObjectFieldInteractions[entity][index].privateLabelIds);
          }
        }
      }
    });
  }

  if (extensions.pageInteractions) {
    for (let index = 0; index < extensions.pageInteractions.length; index++) {
      extensions.pageInteractions[index].script = injectScript(configuration, extensions.pageInteractions[index].script);
    }
  }

  console.log('Successfully injected environment variables');
  callback(extensions);

}


function auth(username, password, callback) {
  const auth = print(`bullhorn${cmdSuffix}`, ['auth', 'login', `--username=${username}`, `--password=${password}`], callback);

  auth.stdout.on('data', (data) => {
    const content = data.toString().replace(lineBreaks, '');

    if (content.toLowerCase().indexOf('error') !== -1) {
      logger.error('Error occurred during authorization, exiting.');

      process.exit(1);
    }
  });
}

function selectiveUpload(privateLabelId, extensions, callback) {
  logger.info(`Selective uploading...`);
  return isAuthorized()
    .then((credentials) => {
      const rest = credentials.sessions.find(s => s.name === 'rest').value;
      const restConfig = { url: rest.endpoint, token: rest.token };
      fieldInterDeploySvc.setUpService(configuration.deployDebug, restConfig);
      coInterDeploySvc.setUpService(configuration.deployDebug, restConfig);
      pageInterDeploySvc.setUpService(configuration.deployDebug, restConfig);
      return fieldInterDeploySvc.deploySelectedFieldInteractions(selectiveExtensions, privateLabelId, extensions)
        .then(fiResults => {
          return coInterDeploySvc.deploySelectedCOFieldInteractions(selectiveExtensions, extensions).then(coFIResults => {
            return pageInterDeploySvc.deploySelectedPageInteractions(selectiveExtensions, extensions)
            .then(piResults => ({ fieldInteractions: fiResults, customObjectFIs: coFIResults, pageInteractions: piResults })).then(results => {
              resultsSvc.printResults(results, privateLabelId);
              return callback();
            });
          });
        });
    });
}


function authAndSelectiveUpload(username, password, privateLabelId, extensions,callback) {
  return auth(username, password, () => {
    return selectiveUpload(privateLabelId, extensions,callback)
  });
}

function getExtensionId() {
  const file = getExtensionFile();
  const extensions = JSON.parse(file);

  return extensions.name;
}

function uploadForUsers(users, callback) {
  logger.info('Upoading for ' + users[0].username);
  logger.info('Private Label --> ' + users[0].privateLabelId);
  clean(() => {
    build(() => {
      extractExtension.extract(() => {
        inject(configuration, (extensions) => {
          if (selectiveExtensions) {

            return authAndSelectiveUpload(users[0].username, users[0].password, users[0].privateLabelId, extensions,(results) => {
              const nextUsers = users.slice(1)
              if (nextUsers.length) {
                uploadForUsers(users.slice(1), callback);
              } else {
                return callback();
              }
            });
          } else {
            process.exit(1);
          }
        });
      })
    });
  });
}

try {
  let users = []
  if (configuration.username && configuration.password && !Array.isArray(configuration.users)) {
    console.debug('Only one user Found');
    users.push({ username: configuration.username, password: configuration.password });
  } else if (configuration.users && Array.isArray(configuration.users) && configuration.users.length > 0) {
    users = configuration.users
  } else {
    logger.error('No Users Found, aborting upload. Please check your environment File and add at least one user');
    process.exit(1);
  }
  uploadForUsers(users, () => {
    logger.info('Deployment complete please view the results above');
  });

} catch (error) {
  logger.error(chalk.red('Error occured during build-and-upload', error));
  process.exit(1);
}