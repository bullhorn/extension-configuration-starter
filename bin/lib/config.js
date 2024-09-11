const fs = require('fs');
const chalk = require('chalk');
const loadJsonFile = require('load-json-file');
const writeJsonFile = require('write-json-file');
const homedir = require('os').homedir();
const path = require('path');

const confFile = path.join(homedir, '.bullhorn/config');

const defaults = {
  environment: 'https://universal.bullhornstaffing.com',
};

const getConfig = () => {
  if (!fs.existsSync(confFile)) {
    // console.log(chalk.yellow('Cannot find your "config", using defaults...'));
    return Promise.resolve(defaults);
  }
  return loadJsonFile(confFile);
};

const getConfigValue = setting => getConfig().then(settings => settings[setting]);

const setConfig = settings => writeJsonFile(confFile, settings);

const setConfigValue = (setting, value) => getConfig().then((settings) => {
  settings[setting] = value;
  return setConfig(settings);
});

// Export all methods
module.exports = {
  getConfig,
  getConfigValue,
  setConfig,
  setConfigValue,
};
