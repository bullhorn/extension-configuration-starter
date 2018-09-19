const fs = require('fs');
const spawn = require('child_process').spawn;

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

if(!configuration || !configuration.username || !configuration.password) {
  console.log(`Configuration loaded does not have a username or password`, configuration);
  process.exit();
}

const cmdSuffix = /^win/.test(process.platform) ? '.cmd' : '';
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

function auth(username, password, callback) {
  print(`bullhorn${cmdSuffix}`,  [ 'auth', 'login', `--username=${username}`, `--password=${password}` ], callback);
}

function upload(callback) {
  print(`bullhorn${cmdSuffix}`,  [ 'extensions', 'upload', '--force=true', '--skip=true' ], callback);
}

try {
  clean(() => {
    build(() => {
      extract(() => {
        auth(configuration.username, configuration.password, () => {
          upload(() => {
            console.log('Successfully uploaded!');
          })
        });
      })
    });
  });
} catch(error) {
  console.error('Error occured during build-and-upload', error);
}
