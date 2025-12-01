const logger = require('./logger');
const chalk = require("chalk");

class ConfigValidator {
  constructor() {
    this.logger = logger;
  }

  hasClientIdAndClientSecret(config) {
    return config.clientId && config.clientSecret;
  }

  hasUsernameAndPassword(config) {
    return config.username && config.password;
  }

  hasUsers(config) {
    if (Array.isArray(config.users) && config.users.length > 0) {
      const invalidUsers = config.users.filter(user => !user.username || !user.password || !user.privateLabelId);

      return invalidUsers.length === 0;
    }

    return false;
  }

  validateConfiguration(configuration) {
    if (!configuration || (!this.hasClientIdAndClientSecret(configuration))) {
      this.logger.error(chalk.red('Configuration should have clientId and clientSecret for the authorization'));
      return false;
    }

    if (!this.hasUsernameAndPassword(configuration) && !this.hasUsers(configuration)) {
      this.logger.error(chalk.red('Configuration should have either a username or password, or an array of users that each have a username, password, and privateLabelId'));
      return false;
    }

    return true;
  }

  normalizeUsers(configuration) {
    const users = [];

    if (configuration.username && configuration.password && !Array.isArray(configuration.users)) {
      this.logger.debug('Only one user found');
      users.push({ username: configuration.username, password: configuration.password });
    } else if (configuration.users && Array.isArray(configuration.users) && configuration.users.length > 0) {
      users.push(...configuration.users);
    } else {
      this.logger.error(chalk.red('No users found, aborting upload. Please check your environment file and add at least one user'));
      return null;
    }

    return users;
  }
}

// Backward compatible module-level interface
let serviceInstance;

function initService() {
  if (!serviceInstance) {
    serviceInstance = new ConfigValidator();
  }
  return serviceInstance;
}

function validateConfiguration(configuration) {
  const service = initService();
  return service.validateConfiguration(configuration);
}

function normalizeUsers(configuration) {
  const service = initService();
  return service.normalizeUsers(configuration);
}

module.exports = {
  ConfigValidator,
  validateConfiguration,
  normalizeUsers,
};
