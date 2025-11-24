const chalk = require('chalk');
const fs = require('fs');
const glob = require('glob');
const jsonfile = require('jsonfile');
const path = require('path');
const logger = require('./lib/logger');

function cleanUpScriptString(script) {
  return script.replace(/((?:function)?(?:script)?\s?\((\w+[,]?\s?)+\)\s?(?:=>)?\s?{((.|\n|\r)*(?=}))})?/, '$3').trim();
}

const extract = (callback) => {
  // Check for "extension.json" file
  if (!fs.existsSync('./extension.json')) {
    logger.error(chalk.red('Cannot find "extension.json" at the root level...'));
    logger.error(chalk.red('Please make sure you are in an extension repo and you have an "extension.json" definition file'));
    return;
  }

  logger.multiLog('Extracting extension points from "extension.json"', logger.multiLogLevels.infoIntData);

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

  logger.multiLog('Extracting extension points...', logger.multiLogLevels.infoIntData);

  if (configuration.fieldInteractions) {
    logger.multiLog('  Extracting field interactions...', logger.multiLogLevels.infoFiData);

    Object.keys(configuration.fieldInteractions).forEach(key => {
      configuration.fieldInteractions[key].forEach(interaction => {
        let matches = glob.sync(interaction);

        matches.forEach(file => {
          if (file.endsWith('.js')) {
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
    logger.multiLog('  Extracting custom object field interactions...', logger.multiLogLevels.infoCoFiData);

    Object.keys(configuration.customObjectFieldInteractions).forEach(key => {
      configuration.customObjectFieldInteractions[key].forEach(interaction => {
        let matches = glob.sync(interaction);

        matches.forEach(file => {
          if (file.endsWith('.js')) {
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
    logger.multiLog('  Extracting Page Interactions...', logger.multiLogLevels.infoPiData);

    configuration.pageInteractions.forEach(interaction => {
      let matches = glob.sync(interaction);

      matches.forEach(file => {
        if (file.endsWith('.js')) {
          let interactionConfig = require(path.join(process.cwd(), interaction)).default;
          interactionConfig.script = cleanUpScriptString(interactionConfig.script.toString());
          output.pageInteractions.push(interactionConfig);
        }
      });
    });
  }

  if (configuration.bots) {
    logger.info('  Extracting bot configurations...');

    configuration.bots.forEach(bot => {
      let matches = glob.sync(bot);

      matches.forEach(file => {
        if (file.endsWith('.js')) {
          logger.debug(`    ${bot}`);
          let botConfig = require(path.join(process.cwd(), bot)).default;
          // todo: modify bot if needed
          output.bots.push(botConfig);
        }
      });
    });
  }

  logger.multiLog('Extraction complete! File being written to "./output/extension.json" ...', logger.multiLogLevels.infoIntData);

  let file = './output/extension.json';

  if (!fs.existsSync('./output')) {
    fs.mkdirSync('./output');
  }

  jsonfile.writeFileSync(file, output, {
    spaces: 2,
  });

  logger.multiLog('Write file complete! Enjoy!', logger.multiLogLevels.infoIntData);

  callback(output);
};

// Export all methods
module.exports = {
  extract
};
