const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const glob = require('glob');
const jsonfile = require('jsonfile');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console({format: winston.format.simple()}),
    new winston.transports.File({ filename: './deploy-logs/error.log', level: 'error', format: winston.format.simple() , options: { flags: 'w' } }),
    new winston.transports.File({ filename: './deploy-logs/combined.log', level: 'debug', format: winston.format.simple(), options: { flags: 'w' } }),
    // new winston.transports.File({ filename: './deploy-logs/extract-extention.log', level: 'verbose', format: winston.format.simple(), options: { flags: 'w' } }),
  ],
});

function setUpService(debug) {
  if (debug) {
    logger.level = 'debug';
  }
}

function cleanUpScriptString(script) {
  return script.replace(/((?:function)?\s?\((\w+[,]?\s?)+\)\s?(?:=>)?\s?{((.|\n|\r)*(?=}))})?/, '$3').trim();
}

const extract = (callback) => {
  // Check for "extension.json" file
  if (!fs.existsSync('./extension.json')) {
    logger.error(chalk.red('Cannot find "extension.json" at the root level...'));
    logger.error(chalk.red('Please make sure you are in an extension repo and you have an "extension.json" definition file'));
    return;
  }

  logger.info(chalk.blue('Extracting extension points from "extension.json"'));

  // Load configuration
  const configuration = JSON.parse(fs.readFileSync('extension.json', 'utf-8'));

  // Check for name
  if (!configuration || !configuration.name) {
    logger.error(chalk.red('"extension.json" must contain a "name" property...'));
  }

  // Create output object
  let output = {
    name: configuration.name,
    description: configuration.description,
  };

  // If configuration has these, then make objects on output
  if (configuration.fieldInteractions) {
    output.fieldInteractions = {};
  }
  if (configuration.customObjectFieldInteractions) {
    output.customObjectFieldInteractions = {};
  }
  if (configuration.pageInteractions) {
    output.pageInteractions = [];
  }
  if (configuration.bots) {
    output.bots = [];
  }

  logger.debug(chalk.blue('Extracting extension points...'));

  if (configuration.fieldInteractions) {
    logger.debug(chalk.blue('  Extracting field interactions...'));
    Object.keys(configuration.fieldInteractions).forEach(key => {
      configuration.fieldInteractions[key].forEach(interaction => {
        let matches = glob.sync(interaction);
        matches.forEach(file => {
          if (file.endsWith('.js')) {
            // logger.verbose(chalk.blue(`    ${file}`));
            let interactionConfig = require(path.join(process.cwd(), file)).default;
            interactionConfig.script = cleanUpScriptString(interactionConfig.script.toString());
            if (!output.fieldInteractions[key]) {
              output.fieldInteractions[key] = [];
            }
            output.fieldInteractions[key].push(interactionConfig);
          }
        });
      });
    });
  }

  if (configuration.customObjectFieldInteractions) {
    logger.debug(chalk.blue('  Extracting custom object field interactions...'));
    Object.keys(configuration.customObjectFieldInteractions).forEach(key => {
      configuration.customObjectFieldInteractions[key].forEach(interaction => {
        let matches = glob.sync(interaction);
        matches.forEach(file => {
          if (file.endsWith('.js')) {
            // logger.verbose(chalk.blue(`    ${file}`));
            let interactionConfig = require(path.join(process.cwd(), file)).default;
            interactionConfig.script = cleanUpScriptString(interactionConfig.script.toString());
            if (!output.customObjectFieldInteractions[key]) {
              output.customObjectFieldInteractions[key] = [];
            }
            output.customObjectFieldInteractions[key].push(interactionConfig);
          }
        });
      });
    });
  }

  if (configuration.pageInteractions) {
    logger.debug(chalk.blue('  Extracting page interactions...'));
    configuration.pageInteractions.forEach(interaction => {
      let matches = glob.sync(interaction);
      matches.forEach(file => {
        if (file.endsWith('.js')) {
          // logger.verbose(chalk.blue(`    ${interaction}`));
          let interactionConfig = require(path.join(process.cwd(), interaction)).default;
          interactionConfig.script = cleanUpScriptString(interactionConfig.script.toString());
          output.pageInteractions.push(interactionConfig);
        }
      });
    });
  }

  if (configuration.bots) {
    logger.debug(chalk.blue('  Extracting bot configurations...'));
    configuration.bots.forEach(bot => {
      let matches = glob.sync(bot);
      matches.forEach(file => {
        if (file.endsWith('.js')) {
          logger.verbose(chalk.blue(`    ${bot}`));
          let botConfig = require(path.join(process.cwd(), bot)).default;
          // todo: modify bot if needed
          output.bots.push(botConfig);
        }
      });
    });
  }

  console.log(chalk.blue(`Extraction complete! File being written to config.json`));

  let file = `./output/extension.json`;

  if (!fs.existsSync('./output')) {
    fs.mkdirSync('./output');
  }

  jsonfile.writeFileSync(file, output, {
    spaces: 3,
  });

  console.log(chalk.blue('Write file complete! Enjoy!'));

  callback();
};

// Export all methods
module.exports = {
  extract,
  setUpService
};
