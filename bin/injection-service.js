function inject(configuration, callback) {
  const file = getExtensionFile();
  const extensions = JSON.parse(file);

  if (extensions.fieldInteractions) {
    Object.keys(extensions.fieldInteractions).forEach(entity => {
      if (extensions.fieldInteractions[entity]) {
        for (let index = 0; index < extensions.fieldInteractions[entity].length; index++) {
          extensions.fieldInteractions[entity][index].script = injectScript(configuration, extensions.fieldInteractions[entity][index].script);

          if (extensions.fieldInteractions[entity][index].privateLabelIds) {
            extensions.fieldInteractions[entity][index].privateLabelIds = injectScript(configuration, extensions.fieldInteractions[entity][index].privateLabelIds);
          }
        }
      }
      if (entity.indexOf('CustomObject') !== -1 && extensions.fieldInteractions[entity]) {
        if (!extensions.manuallyDeployed) {
          extensions.manuallyDeployed = {};
        }

        extensions.manuallyDeployed[entity] = extensions.fieldInteractions[entity];
        for (let index = 0; index < extensions.manuallyDeployed[entity].length; index++) {
          extensions.manuallyDeployed[entity][index].script = injectScript(configuration, extensions.manuallyDeployed[entity][index].script);

          if (extensions.manuallyDeployed[entity][index].privateLabelIds) {
            extensions.manuallyDeployed[entity][index].privateLabelIds = injectScript(configuration, extensions.manuallyDeployed[entity][index].privateLabelIds);
          }
        }
        delete extensions.fieldInteractions[entity];
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

function injectScript(configuration, script) {
  Object.keys(configuration).forEach(propertyName => {
    if (Array.isArray(script)) {
      script = script.map(function (x) { return x.replace(new RegExp(`\\$\{${propertyName}\}`, 'g'), configuration[propertyName]); });
    }
    else {
      script = script.replace(new RegExp(`\\$\{${propertyName}\}`, 'g'), configuration[propertyName]);
    }

  });

  return script;
}