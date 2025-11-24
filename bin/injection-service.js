const logger = require("./lib/logger");

function inject(configuration, extensions, callback) {
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

  logger.multiLog('Successfully injected environment variables', logger.multiLogLevels.infoIntData);
  callback(extensions);
}

function injectScript(configuration, script) {
  Object.keys(configuration).forEach((propertyName) => {
    if (Array.isArray(script)) {
      script = script.map(function (x) {
        return x.replace(new RegExp(`\\$\{${propertyName}\}`, 'g'), configuration[propertyName]);
      });
    } else {
      script = script.replace(new RegExp(`\\$\{${propertyName}\}`, 'g'), configuration[propertyName]);
    }
  });

  return script;
}

module.exports = {
  inject
};
