const chalk = require('chalk');
const fs = require('fs');
const logger = require('./lib/logger');
const extractExtension = require('./extract-extension-service');
const injectionSvc = require('./injection-service');
const intCleanSvc = require('./interaction-cleaning-service');
const fieldIntDeploySvc = require('./field-interaction-deploy-service');
const coIntDeploySvc = require('./custom-objects-interaction-deploy-service');
const pageIntDeploySvc = require('./page-interaction-deploy-service');
const resultsSvc = require('./results-service');
const { validateConfiguration, normalizeUsers } = require('./lib/config-validator.js');
const { clean, build } = require('./lib/deployment-utils.js');
const { uploadForUsers } = require('./lib/upload-orchestrator.js');

const MIN_ARGS_LENGTH = 3;

class FullBuildAndUploadCommand {
  constructor() {
    this.logger = logger;
    this.minArgsLength = MIN_ARGS_LENGTH;
    this.extractExtension = extractExtension;
    this.injectionSvc = injectionSvc;
    this.intCleanSvc = intCleanSvc;
    this.fieldIntDeploySvc = fieldIntDeploySvc;
    this.coIntDeploySvc = coIntDeploySvc;
    this.pageIntDeploySvc = pageIntDeploySvc;
    this.resultsSvc = resultsSvc;
    this.validateConfiguration = validateConfiguration;
    this.normalizeUsers = normalizeUsers;
    this.clean = clean;
    this.build = build;
    this.uploadForUsers = uploadForUsers;
  }

  validateArgs(args) {
    if (args.length < this.minArgsLength) {
      this.logger.error('Please pass an environment argument to build.');
      return false;
    }
    return true;
  }

  loadConfiguration(environment) {
    const fileName = `./environments/environment.${environment}.json`;

    if (!fs.existsSync(fileName)) {
      this.logger.error(`Environment file with name ${fileName} does not exist...`);
      return null;
    }

    return JSON.parse(fs.readFileSync(fileName, 'UTF-8'));
  }

  loadEntityMaps() {
    const entityCustomObjectsMapFileName = './customObjectEntityMap.json';
    const entityNameMapFileName = './entityNameMap.json';

    const entityCustomObjectsMap = JSON.parse(fs.readFileSync(entityCustomObjectsMapFileName, 'UTF-8'));
    const entityNameMap = JSON.parse(fs.readFileSync(entityNameMapFileName, 'UTF-8'));

    return { entityCustomObjectsMap: entityCustomObjectsMap, entityNameMap: entityNameMap };
  }

  setupDebugMode(configuration) {
    if (configuration.deployDebug) {
      this.logger.multiLog(chalk.yellow('Deploying in debug mode'), this.logger.multiLogLevels.debugIntData);
      this.logger.level = 'debug';
    }
  }

  async execute(args) {
    if (!this.validateArgs(args)) {
      process.exit();
    }

    const environment = args[2];
    const configuration = this.loadConfiguration(environment);

    if (!configuration) {
      process.exit();
    }

    const { entityCustomObjectsMap, entityNameMap } = this.loadEntityMaps();

    if (!this.validateConfiguration(configuration)) {
      process.exit();
    }

    this.setupDebugMode(configuration);

    try {
      const users = this.normalizeUsers(configuration);

      if (!users) {
        process.exit(0);
      }

      await this.uploadForUsers({
        users: users,
        configuration: configuration,
        clean: this.clean,
        build: this.build,
        extractExtension: this.extractExtension,
        injectionSvc: this.injectionSvc,
        uploadType: 'full',
        services: {
          intCleanSvc: this.intCleanSvc,
          fieldIntDeploySvc: this.fieldIntDeploySvc,
          coIntDeploySvc: this.coIntDeploySvc,
          pageIntDeploySvc: this.pageIntDeploySvc,
        },
        resultsSvc: this.resultsSvc,
        validatePrerequisites: () => entityCustomObjectsMap && entityNameMap,
        preprocessExtensions: async (extensions, privateLabelId) => {
          return this.intCleanSvc.removeUnnecessaryFieldInteractions(extensions, privateLabelId);
        },
      });

      this.logger.info('Deployment complete please view the results for each user above');
      this.logger.printSeparator();
    } catch (error) {
      this.logger.error(chalk.red('Error occurred during full-build-and-upload', error));
      process.exit(0);
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const command = new FullBuildAndUploadCommand();
  command.execute(process.argv);
}

module.exports = {
  FullBuildAndUploadCommand,
};
