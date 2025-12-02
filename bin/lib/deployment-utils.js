const chalk = require('chalk');
const spawn = require('child_process').spawn;
const logger = require('./logger');
const { createRestApiClient } = require('./rest-api-client');

const cmdSuffix = /^win/.test(process.platform) ? '.cmd' : '';
const lineBreaks = /(?:\r\n|\r|\n)/g;

class DeploymentUtils {
  constructor() {
    this.logger = logger;
    this.cmdSuffix = cmdSuffix;
    this.lineBreaks = lineBreaks;
  }

  print(command, args) {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, { shell: true });

      this.logger.debug(childProcess.spawnargs.join(' '));

      childProcess.stdout.on('data', (data) => {
        this.logger.debug(data.toString().replace(this.lineBreaks, ''));
      });

      childProcess.stderr.on('data', (data) => {
        this.logger.error(data.toString().replace(this.lineBreaks, ''));
      });

      childProcess.on('exit', (code) => {
        if (code !== 0) {
          const error = new Error(`Error performing process: exited with code ${code}`);
          this.logger.error(error.message);
          reject(error);
        } else {
          resolve();
        }
      });

      childProcess.on('error', (error) => {
        this.logger.error(`Process error: ${error.message}`);
        reject(error);
      });
    });
  }

  async clean() {
    return this.print(`rimraf${this.cmdSuffix}`, [ 'output', 'dist' ]);
  }

  async build() {
    return this.print(`tsc${this.cmdSuffix}`, []);
  }

  async authenticate(clientId, clientSecret, username, password) {
    const restApiClient = await createRestApiClient({
      clientId: clientId,
      clientSecret: clientSecret,
      username: username,
      password: password,
    });

    if (!restApiClient) {
      this.logger.error(chalk.red('Authentication failed. Aborting deployment...'));
      process.exit();
    }

    return restApiClient;
  }
}

// Backward compatible module-level interface
let serviceInstance;

function initService() {
  if (!serviceInstance) {
    serviceInstance = new DeploymentUtils();
  }
  return serviceInstance;
}

function clean() {
  const service = initService();
  return service.clean();
}

function build() {
  const service = initService();
  return service.build();
}

function authenticate(clientId, clientSecret, username, password) {
  const service = initService();
  return service.authenticate(clientId, clientSecret, username, password);
}

module.exports = {
  DeploymentUtils,
  clean,
  build,
  authenticate,
};
