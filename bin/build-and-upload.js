const fs = require('fs');
const spawn = require('child_process').spawn;
const execSync = require('child_process').execSync;
const jsonfile = require('jsonfile');
const os = require('os');
const path=require('path');

if (process.argv.length < 3) {
  console.log('Please pass an environment argument to build.');

  process.exit();
}

const cmdSuffix = /^win/.test(process.platform) ? '.cmd' : '';
const extensionsFileName = `./output/extension.json`;
const lineBreaks = /(?:\r\n|\r|\n)/g;
const PROD_BRANCH = "master"
const PROD_ENVIRONMENT = "prod"

const environment = process.argv[2];
const fileName = `./environments/environment.${environment}.json`;

if (!fs.existsSync(fileName)) {
  console.log(`Environment file with name ${fileName} does not exist...`);

  process.exit();
}

const configuration = JSON.parse(fs.readFileSync(fileName, 'UTF-8'));

function hasUsernameAndPassword(configuration) {
  return configuration.username && configuration.password;
}

function hasUsers(configuration) {
  if (Array.isArray(configuration.users) && configuration.users.length > 0) {
    const invalidUsers = configuration.users.filter(user => {
      return !user.username || !user.password || !user.privateLabelId;
    });

    return invalidUsers.length === 0;
  }

  return false;
}

if (!configuration || (!hasUsernameAndPassword(configuration) && !hasUsers(configuration))) {
  console.log(`Configuration should have either a username or password, or an array of users that each have a username, password, and privateLabelId`, configuration);

  process.exit();
}

/**
 * If deploying to production, verifies that the working directory is on the master branch.
 */
function prodDeployChecks() {
  const gitBranchResult = execSync('git branch --show-current');
  const currentBranch = gitBranchResult.toString().replace(lineBreaks, '');

  if (currentBranch !== PROD_BRANCH) {
    console.error(`ERROR: Only allowed to deploy to production when on master branch. Current Branch => "${currentBranch}"`);
    process.exit();
  }

  console.log('Git Checks for production passed!');
}

function print(command, arguments, callback) {
  const process = spawn(command, arguments);

  console.log(process.spawnargs.join(' '));

  process.stdout.on('data', (data) => {
    console.log(data.toString().replace(lineBreaks, ''));
  });

  process.stderr.on('data', (data) => {
    console.error(data.toString().replace(lineBreaks, ''));
  });

  process.on('exit', (code) => {
    if (code !== 0) {
      console.error('Error performing process: exited with code ' + code);
    } else {
      callback();
    }
  });

  return process;
}

function getExtensionFile() {
  if (!fs.existsSync(extensionsFileName)) {
    console.error('Error performing extract command; cannot remove page interactions');

    process.exit(1);
  }

  return fs.readFileSync(extensionsFileName, 'utf-8');
}

function clean(callback) {
  print(`rimraf${cmdSuffix}`, ['output', 'dist'], callback);
}

function build(callback) {
  print(`tsc${cmdSuffix}`, [], callback);
}

function extract(callback) {
  print(`bullhorn${cmdSuffix}`, ['extensions', 'extract'], callback);
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

function auth(username, password, callback) {
  const auth = print(`bullhorn${cmdSuffix}`, ['auth', 'login', `--username=${username}`, `--password=${password}`], callback);

  auth.stdout.on('data', (data) => {
    const content = data.toString().replace(lineBreaks, '');

    if (content.toLowerCase().indexOf('error') !== -1) {
      console.log('Error occurred during authorization, exiting.');

      process.exit(1);
    }
  });
}

function upload(callback) {
  print(`bullhorn${cmdSuffix}`, ['extensions', 'upload', '--force=true', '--skip=true'], callback);
}

function authAndUpload(username, password, callback) {
  auth(username, password, () => {
    upload(callback)
  });
}

function getExtensionId() {
  const file = getExtensionFile();
  const extensions = JSON.parse(file);

  return extensions.name;
}

function updatePrivateLabelId(extensionId, privateLabelId) {
  const file = getExtensionFile();
  const extensions = JSON.parse(file);

  let newExtensionId = `${privateLabelId}-interactions`;

  if (extensionId.indexOf('-interactions') > 0) {
    const name = extensionId.substring(0, extensionId.indexOf('-interactions'));

    newExtensionId = `${name}-${privateLabelId}-interactions`;
  }

  extensions.name = newExtensionId;

  console.log(`Updating extensions name to ${newExtensionId} before auth and upload`);

  jsonfile.writeFileSync(extensionsFileName, extensions, {
    spaces: 2,
  });
}

function removeUnnecessaryFieldInteractions(extensions, privateLabelId, callback) {
  if (extensions.fieldInteractions) {
    Object.keys(extensions.fieldInteractions).forEach(entity => {
      if (extensions.fieldInteractions[entity]) {
        for (var index = extensions.fieldInteractions[entity].length - 1; index >= 0; index--) {
          if (extensions.fieldInteractions[entity][index].privateLabelIds && !extensions.fieldInteractions[entity][index].privateLabelIds.includes(privateLabelId)) {
            console.log(`Removed unnecessary field interactions for PL ID ${privateLabelId} at index ${index}`);

            extensions.fieldInteractions[entity].splice(index, 1);
          }
        }
      }
    });
  }

  console.log(`Successfully Removed All unnecessary field interactions for PL ID ${privateLabelId} before auth and upload`);

  jsonfile.writeFileSync(extensionsFileName, extensions, {
    spaces: 2,
  });

  callback(extensions);
}

function removeUnnecessaryCustomObjectInteractions(extensions, privateLabelId, callback) {
  if (extensions.manuallyDeployed) {
    Object.keys(extensions.manuallyDeployed).forEach(entity => {
      if (extensions.manuallyDeployed[entity]) {
        for (var index = extensions.manuallyDeployed[entity].length - 1; index >= 0; index--) {
          if (extensions.manuallyDeployed[entity][index].privateLabelIds && !extensions.manuallyDeployed[entity][index].privateLabelIds.includes(privateLabelId)) {
            console.log(`Removed unnecessary custom Object field interactions for PL ID ${privateLabelId} at index ${index}`);

            extensions.manuallyDeployed[entity].splice(index, 1);
          }
        }
      }
    });
  }

  jsonfile.writeFileSync(extensionsFileName, extensions, {
    spaces: 2,
  });

  callback();
}

function stripPageInteractions(callback) {
  const file = getExtensionFile();
  const extensions = JSON.parse(file);

  if (extensions.pageInteractions) {
    extensions.pageInteractions = [];
  }

  jsonfile.writeFileSync(extensionsFileName, extensions, {
    spaces: 2,
  });

  console.log('Successfully removed page interactions for additional deploy');

  callback();
}

function handleMultipleUsers(users, doUploadPageInteraction, callback) {
  if (users.length === 0) {
    callback();

    return;
  }

  console.log('Upoading for ' + users[0].privateLabelId);

  clean(() => {
    build(() => {
      extract(() => {
        const extensionId = getExtensionId();

        inject(configuration, (extensions) => {
          console.log('Private Label --> ' + users[0].privateLabelId);

          removeUnnecessaryFieldInteractions(extensions, users[0].privateLabelId, (extensions) => {
            removeUnnecessaryCustomObjectInteractions(extensions, users[0].privateLabelId, () => {

              if (doUploadPageInteraction) {
                console.log('Deploy first PL with Page Interactions');
                updatePrivateLabelId(extensionId, users[0].privateLabelId);


                authAndUpload(users[0].username, users[0].password, () => {
                  console.log('Successfully uploaded all interactions for user ' + users[0].username);

                  handleMultipleUsers(users.slice(1), false, callback);
                });

              } else {
                console.log('Deploy the rest PL without Page Interactions');
                stripPageInteractions(() => {
                  updatePrivateLabelId(extensionId, users[0].privateLabelId);

                  authAndUpload(users[0].username, users[0].password, () => {
                    console.log('Successfully uploaded all interactions for user ' + users[0].username);

                    handleMultipleUsers(users.slice(1), false, callback);
                  });
                });
              }
            });
          });

        });
      })
    });
  });

}

try {
  if (environment === PROD_ENVIRONMENT) {
    prodDeployChecks();
  }
  if (configuration.username && configuration.password && !Array.isArray(configuration.users)) {
    console.log('Only one user Found');
    clean(() => {
      build(() => {
        extract(() => {
          inject(configuration, () => {
            authAndUpload(configuration.username, configuration.password, () => {
              console.log('Successfully uploaded!');
            });
          });
        })
      });
    });
  } else if (configuration.users && Array.isArray(configuration.users) && configuration.users.length > 0) {
    console.log('A list of Users found');

    handleMultipleUsers(configuration.users, true, () => {
      console.log('Successfully uploaded for all users.');
    });


  }
} catch (error) {
  console.error('Error occured during build-and-upload', error);

  process.exit(1);
}
