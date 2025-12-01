const chalk = require('chalk');
const logger = require('./logger');
const { authenticate } = require('./deployment-utils');

class UploadOrchestrator {
  constructor() {
    this.logger = logger;
  }

  async setupServices(restApiClient, services) {
    services.forEach(service => {
      if (service && service.setUpService) {
        service.setUpService(restApiClient);
      }
    });
  }

  async executeUpload(config) {
    const {
      restApiClient,
      username,
      privateLabelId,
      extensions,
      deployFiOnly,
      uploadType,
      services,
      selectiveExtensions,
      resultsSvc,
    } = config;

    const isFullUpload = uploadType === 'full';
    this.logger.multiLog(`${isFullUpload ? 'Full' : 'Selective'} uploading...`, this.logger.multiLogLevels.infoIntData);

    await this.setupServices(restApiClient, Object.values(services));

    const results = {};

    if (isFullUpload && services.intCleanSvc) {
      results.deleted = await services.intCleanSvc.runEnvCleanRoutine(username, deployFiOnly);
    }

    if (services.fieldIntDeploySvc) {
      if (isFullUpload) {
        results.fieldInteractions = await services.fieldIntDeploySvc.deployAllFieldInteractions(privateLabelId, extensions);
      } else {
        results.fieldInteractions = await services.fieldIntDeploySvc.deploySelectedFieldInteractions(selectiveExtensions, privateLabelId, extensions);
      }
    }

    if (services.coIntDeploySvc) {
      if (isFullUpload) {
        results.customObjectFIs = await services.coIntDeploySvc.deployAllCustomObjectFieldInteractions(extensions, deployFiOnly);
      } else {
        results.customObjectFIs = await services.coIntDeploySvc.deploySelectedCustomObjectFieldInteractions(selectiveExtensions, extensions, deployFiOnly);
      }
    }

    if (services.pageIntDeploySvc) {
      if (isFullUpload) {
        results.pageInteractions = await services.pageIntDeploySvc.deployAllPageInteractions(extensions, deployFiOnly);
      } else {
        results.pageInteractions = await services.pageIntDeploySvc.deploySelectedPageInteractions(selectiveExtensions, extensions, deployFiOnly);
      }
    }

    if (resultsSvc && resultsSvc.printResults) {
      resultsSvc.printResults(results, privateLabelId);
    }

    return results;
  }

  async authAndUpload(config) {
    const { clientId, clientSecret, username, password } = config.authConfig;
    const restApiClient = await authenticate(clientId, clientSecret, username, password);

    return this.executeUpload({
      ...config,
      restApiClient: restApiClient,
    });
  }

  async uploadForUsers(config) {
    const {
      users,
      configuration,
      clean,
      build,
      extractExtension,
      injectionSvc,
      uploadType,
      validatePrerequisites,
      preprocessExtensions,
      deployFiOnly = false,
    } = config;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const isFirstUser = i === 0;
      const shouldDeployFiOnly = !isFirstUser || deployFiOnly;

      this.logger.multiLog(`Uploading for ${chalk.green(user.username)}`, this.logger.multiLogLevels.infoIntData);
      this.logger.multiLog(`Private Label --> ${chalk.green(user.privateLabelId)}`, this.logger.multiLogLevels.infoIntData);

      await clean();
      await build();

      const extensions = await extractExtension.extract();
      const injectExtensions = await injectionSvc.inject(configuration, extensions);

      this.logger.dev(`extensions --> ${JSON.stringify(injectExtensions)}`);

      if (!validatePrerequisites()) {
        const errorMsg = uploadType === 'full'
          ? 'No "entityNameMap.json" and/or "customObjectEntityMap.json" file. Aborting deployment...'
          : 'No "selective-extension.json" file. Aborting deployment...';
        this.logger.error(chalk.red(errorMsg));
        process.exit(0);
      }

      const processedExtensions = preprocessExtensions
        ? await preprocessExtensions(injectExtensions, user.privateLabelId)
        : injectExtensions;

      await this.authAndUpload({
        ...config,
        authConfig: {
          clientId: configuration.clientId,
          clientSecret: configuration.clientSecret,
          username: user.username,
          password: user.password,
        },
        username: user.username,
        privateLabelId: user.privateLabelId,
        extensions: processedExtensions,
        deployFiOnly: shouldDeployFiOnly,
      });
    }
  }
}

// Backward compatible module-level interface
let serviceInstance;

function initService() {
  if (!serviceInstance) {
    serviceInstance = new UploadOrchestrator();
  }
  return serviceInstance;
}

function executeUpload(config) {
  const service = initService();
  return service.executeUpload(config);
}

function authAndUpload(config) {
  const service = initService();
  return service.authAndUpload(config);
}

function uploadForUsers(config) {
  const service = initService();
  return service.uploadForUsers(config);
}

module.exports = {
  UploadOrchestrator,
  executeUpload,
  authAndUpload,
  uploadForUsers,
};
