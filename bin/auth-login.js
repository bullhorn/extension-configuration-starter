const chalk = require('chalk');
const { checkLogin } = require('./lib/auth');

const login = (credentials) => {
    console.log(chalk.blue(`Authorizing...`));
    // Push
    return checkLogin(credentials)
      .then((identity) => {
        let rest = credentials.sessions.find(s => s.name === 'rest').value;
        console.log(chalk.green(`Authorization Complete: ${rest.token}`));
      })
      .catch(error => {
        console.log(chalk.red(error));
      });
}

// Export all methods
module.exports = {
  login
};
