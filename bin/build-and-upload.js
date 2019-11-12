const os = require('os');
const path = require('path');

const fs = require('fs');
const spawn = require('child_process').spawn;
const jsonfile = require('jsonfile');

if(process.argv.length < 3) {
  console.log('Please pass an environment argument to build.');

  process.exit();
}

const environment = process.argv[2];
const fileName = `./environments/environment.${environment}.json`;

if(!fs.existsSync(fileName)) {
  console.log(`Environment file with name ${fileName} does not exist...`);

  process.exit();
}

const configuration = JSON.parse(fs.readFileSync(fileName, 'UTF-8'));

function hasUsernameAndPassword(configuration) {
  return configuration.username && configuration.password;
}

function hasUsers(configuration) {
  if(Array.isArray(configuration.users) && configuration.users.length > 0) {
    const invalidUsers = configuration.users.filter(user => {
      return !user.username || !user.password || !user.privateLabelId;
    });

    return invalidUsers.length === 0;
  }

  return false;
}

if(!configuration || (!hasUsernameAndPassword(configuration) && !hasUsers(configuration))) {
  console.log(`Configuration should have either a username or password, or an array of users that each have a username, password, and privateLabelId`, configuration);

  process.exit();
}

const cmdSuffix = /^win/.test(process.platform) ? '.cmd' : '';
const extensionsFileName = `./output/extension.json`;
const lineBreaks = /(?:\r\n|\r|\n)/g;

function print(command, arguments, callback) {
  const process = spawn(command, arguments);

  console.log(process.spawnargs.join(' '));

  process.stdout.on('data', (data) => {
    console.log(data.toString().replace(lineBreaks, ''));
  });

  process.stderr.on('data', (data) => {
    console.error(data.toString().replace(lineBreaks, ''));
  });

  process.on('exit', ( code ) => {
    if(code !== 0) {
      console.error('Error performing process: exited with code ' + code);
    } else {
      callback();
    }
  });

  return process;
}

function getExtensionFile() {
  if(!fs.existsSync(extensionsFileName)) {
    console.error('Error performing extract command; cannot remove page interactions');

    process.exit(1);
  }

  return fs.readFileSync(extensionsFileName, 'utf-8');
}

function clearCredentials() {
  const homedir = os.homedir();
  const authFile = path.join(homedir, '.bullhorn/credentials');

  try {
    fs.unlinkSync(authFile);

    console.log('Successfully deleted credentials file');
  } catch (err) {
    console.log('No credentials file found')
  }
}

function clean(callback) {
  print(`rimraf${cmdSuffix}`, [ 'output', 'dist' ], callback);
}

function build(callback) {
  print(`tsc${cmdSuffix}`, [], callback);
}

function extract(callback) {
  print(`bullhorn${cmdSuffix}`, [ 'extensions', 'extract' ], callback);
}

function injectScript(configuration, script) {
  Object.keys(configuration).forEach( propertyName => {
    script = script.replace(new RegExp(`\\$\{${propertyName}\}`, 'g'), configuration[propertyName]);
  });

  return script;
}

function inject(configuration, callback) {
  const file = getExtensionFile();
  const extensions = JSON.parse(file);

  if(extensions.fieldInteractions) {
    Object.keys(extensions.fieldInteractions).forEach( entity => {
      if(extensions.fieldInteractions[entity]) {
        for(let index = 0; index < extensions.fieldInteractions[entity].length; index++) {
          extensions.fieldInteractions[entity][index].script = injectScript(configuration, extensions.fieldInteractions[entity][index].script);
        }
      }
    });
  }

  if(extensions.pageInteractions) {
    for(let index = 0; index < extensions.pageInteractions.length; index++) {
      extensions.pageInteractions[index].script = injectScript(configuration, extensions.pageInteractions[index].script);
    }
  }

  jsonfile.writeFileSync(extensionsFileName, extensions, {
    spaces: 2,
  });

  console.log('Successfully injected environment variables');

  callback();
}

function auth(username, password, callback) {
  const auth = print(`bullhorn${cmdSuffix}`,  [ 'auth', 'login', `--username=${username}`, `--password=${password}` ], callback);

  auth.stdout.on('data', (data) => {
    const content = data.toString().replace(lineBreaks, '');

    if(content.toLowerCase().indexOf('error') !== -1) {
      console.log('Error occurred during authorization, exiting.');

      process.exit(1);
    }
  });
}

function upload(callback) {
  print(`bullhorn${cmdSuffix}`,  [ 'extensions', 'upload', '--force=true', '--skip=true' ], callback);
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

  if(extensionId.indexOf('-interactions') > 0) {
    const name = extensionId.substring(0, extensionId.indexOf('-interactions'));

    newExtensionId = `${name}-${privateLabelId}-interactions`;
  }

  extensions.name = newExtensionId;

  console.log(`Updating extensions name to ${newExtensionId} before auth and upload`);

  jsonfile.writeFileSync(extensionsFileName, extensions, {
    spaces: 2,
  });
}

function stripPageInteractions(callback) {
  const file = getExtensionFile();
  const extensions = JSON.parse(file);

  if(extensions.pageInteractions) {
    extensions.pageInteractions = [];
  }

  jsonfile.writeFileSync(extensionsFileName, extensions, {
    spaces: 2,
  });

  console.log('Successfully removed page interactions for additional deploy');

  callback();
}

function handleMultipleUsers(users, extensionId, callback) {
  if(users.length === 0) {
    callback();

    return;
  }

  updatePrivateLabelId(extensionId, users[0].privateLabelId);

  authAndUpload(users[0].username, users[0].password, () => {
    console.log('Successfully uploaded field interactions for user ' + users[0].username);

    handleMultipleUsers(users.slice(1), extensionId, callback);
  });
}

try {
  clearCredentials();

  clean(() => {
    build(() => {
      extract(() => {
        inject(configuration, () => {
          if(configuration.username && configuration.password) {
            authAndUpload(configuration.username, configuration.password, () => {
              console.log('Successfully uploaded!');
            });
          } else if(configuration.users && Array.isArray(configuration.users) && configuration.users.length > 0) {
            const extensionId = getExtensionId();

            updatePrivateLabelId(extensionId, configuration.users[0].privateLabelId);

            authAndUpload(configuration.users[0].username, configuration.users[0].password, () => {
              console.log('Successfully uploaded all interactions for user ' + configuration.users[0].username);

              const additionalUsers = configuration.users.slice(1);

              if(additionalUsers && additionalUsers.length > 0) {
                stripPageInteractions(() => {
                  handleMultipleUsers(additionalUsers, extensionId, () => {
                    console.log('Successfully uploaded for all users.');
                  });
                });
              }
            });
          }
        });
      })
    });
  });
} catch(error) {
  console.error('Error occured during build-and-upload', error);

  process.exit(1);
}
