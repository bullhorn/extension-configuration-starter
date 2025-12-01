const logger = require('./lib/logger');

class InjectionService {
  constructor() {
    this.logger = logger;
  }

  injectScript(configuration, script) {
    let modifiedScript = script;
    Object.keys(configuration).forEach((propertyName) => {
      if (Array.isArray(modifiedScript)) {
        modifiedScript = modifiedScript.map((x) => {
          return x.replace(new RegExp(`\\$\{${propertyName}\}`, 'g'), configuration[propertyName]);
        });
      } else {
        modifiedScript = modifiedScript.replace(new RegExp(`\\$\{${propertyName}\}`, 'g'), configuration[propertyName]);
      }
    });

    return modifiedScript;
  }

  async inject(configuration, extensions) {
    if (extensions.fieldInteractions) {
      Object.keys(extensions.fieldInteractions).forEach((entity) => {
        if (extensions.fieldInteractions[entity]) {
          for (let index = 0; index < extensions.fieldInteractions[entity].length; index += 1) {
            extensions.fieldInteractions[entity][index].script = this.injectScript(configuration, extensions.fieldInteractions[entity][index].script);

            if (extensions.fieldInteractions[entity][index].privateLabelIds) {
              extensions.fieldInteractions[entity][index].privateLabelIds = this.injectScript(configuration, extensions.fieldInteractions[entity][index].privateLabelIds);
            }
          }
        }
      });
    }

    if (extensions.customObjectFieldInteractions) {
      Object.keys(extensions.customObjectFieldInteractions).forEach((entity) => {
        if (extensions.customObjectFieldInteractions[entity]) {
          for (let index = 0; index < extensions.customObjectFieldInteractions[entity].length; index += 1) {
            extensions.customObjectFieldInteractions[entity][index].script = this.injectScript(configuration, extensions.customObjectFieldInteractions[entity][index].script);

            if (extensions.customObjectFieldInteractions[entity][index].privateLabelIds) {
              extensions.customObjectFieldInteractions[entity][index].privateLabelIds = this.injectScript(configuration, extensions.customObjectFieldInteractions[entity][index].privateLabelIds);
            }
          }
        }
      });
    }

    if (extensions.pageInteractions) {
      for (let index = 0; index < extensions.pageInteractions.length; index += 1) {
        extensions.pageInteractions[index].script = this.injectScript(configuration, extensions.pageInteractions[index].script);
      }
    }

    this.logger.multiLog('Successfully injected environment variables', this.logger.multiLogLevels.infoIntData);
    return extensions;
  }
}

// Backward compatible module-level interface
let serviceInstance;

function initService() {
  if (!serviceInstance) {
    serviceInstance = new InjectionService();
  }
  return serviceInstance;
}

function inject(configuration, extensions) {
  const service = initService();
  return service.inject(configuration, extensions);
}

module.exports = {
  InjectionService,
  inject,
};
