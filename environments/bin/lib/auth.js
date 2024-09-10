const fs = require('fs');
const fetch = require('node-fetch');
const chalk = require('chalk');
const loadJsonFile = require('load-json-file');
const writeJsonFile = require('write-json-file');
const { getConfigValue } = require('./config');
const homedir = require('os').homedir();
const path = require('path');

const authFile = path.join(homedir, '.bullhorn/credentials');

const isAuthorized = () => {
  if (!fs.existsSync(authFile)) {
    console.log(chalk.red('Cannot find your "credentials"...'));
    return Promise.reject();
  }
  return loadJsonFile(authFile).then(credentials => checkLogin(credentials));
};

const checkLogin = credentials => getConfigValue('environment').then((environment) => {
  const authUrl = `${environment}/universal-login/session/login`;
    // Generate URL
  const URL = `${authUrl}?username=${credentials.username}&password=${credentials.password}`;
    // Push
  return fetch(URL)
    .then(response => response.json())
    .then(result => writeJsonFile(authFile, Object.assign(credentials, result)))
    .then(() => loadJsonFile(authFile));
});

// Export all methods
module.exports = {
  checkLogin,
  isAuthorized,
};
