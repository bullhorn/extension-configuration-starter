const chalk = require('chalk');
const fs = require('fs');
const glob = require('glob');
const jsonfile = require('jsonfile');
const path = require('path');
const logger = require('./lib/logger');

const SCRIPT_REGEX = /((?:function)?(?:script)?\s?\((\w+[,]?\s?)+\)\s?(?:=>)?\s?{((.|\n|\r)*(?=}))})?/;
const SCRIPT_REPLACE_INDEX = 3;

class ExtractExtensionService {
  constructor() {
    this.logger = logger;
    this.scriptRegex = SCRIPT_REGEX;
    this.scriptReplaceIndex = SCRIPT_REPLACE_INDEX;
  }

  cleanUpScriptString(script) {
    return script.replace(this.scriptRegex, `$${this.scriptReplaceIndex}`).trim();
  }

  async extract() {
    if (!fs.existsSync('./extension.json')) {
      this.logger.error(chalk.red('Cannot find "extension.json" at the root level...'));
      this.logger.error(chalk.red('Please make sure you are in an extension repo and you have an "extension.json" definition file'));
      throw new Error('extension.json not found');
    }

    this.logger.multiLog('Extracting extension points from "extension.json"', this.logger.multiLogLevels.infoIntData);

    const configuration = JSON.parse(fs.readFileSync('extension.json', 'utf-8'));

    if (!configuration || !configuration.name) {
      this.logger.error(chalk.red('"extension.json" must contain a "name" property...'));
      throw new Error('extension.json must contain a "name" property');
    }

    const output = {
      name: configuration.name,
      description: configuration.description,
    };

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

    this.logger.multiLog('Extracting extension points...', this.logger.multiLogLevels.infoIntData);

    if (configuration.fieldInteractions) {
      this.logger.multiLog('  Extracting field interactions...', this.logger.multiLogLevels.infoFiData);

      Object.keys(configuration.fieldInteractions).forEach((key) => {
        configuration.fieldInteractions[key].forEach((interaction) => {
          const matches = glob.sync(interaction);

          matches.forEach((file) => {
            if (file.endsWith('.js')) {
              const interactionConfig = require(path.join(process.cwd(), file)).default;
              interactionConfig.script = this.cleanUpScriptString(interactionConfig.script.toString());

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
      this.logger.multiLog('  Extracting custom object field interactions...', this.logger.multiLogLevels.infoCoFiData);

      Object.keys(configuration.customObjectFieldInteractions).forEach((key) => {
        configuration.customObjectFieldInteractions[key].forEach((interaction) => {
          const matches = glob.sync(interaction);

          matches.forEach((file) => {
            if (file.endsWith('.js')) {
              const interactionConfig = require(path.join(process.cwd(), file)).default;
              interactionConfig.script = this.cleanUpScriptString(interactionConfig.script.toString());

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
      this.logger.multiLog('  Extracting Page Interactions...', this.logger.multiLogLevels.infoPiData);

      configuration.pageInteractions.forEach((interaction) => {
        const matches = glob.sync(interaction);

        matches.forEach((file) => {
          if (file.endsWith('.js')) {
            const interactionConfig = require(path.join(process.cwd(), interaction)).default;
            interactionConfig.script = this.cleanUpScriptString(interactionConfig.script.toString());
            output.pageInteractions.push(interactionConfig);
          }
        });
      });
    }

    if (configuration.bots) {
      this.logger.info('  Extracting bot configurations...');

      configuration.bots.forEach((bot) => {
        const matches = glob.sync(bot);

        matches.forEach((file) => {
          if (file.endsWith('.js')) {
            this.logger.debug(`    ${bot}`);
            const botConfig = require(path.join(process.cwd(), bot)).default;
            output.bots.push(botConfig);
          }
        });
      });
    }

    this.logger.multiLog('Extraction complete! File being written to "./output/extension.json" ...', this.logger.multiLogLevels.infoIntData);

    const file = './output/extension.json';

    if (!fs.existsSync('./output')) {
      fs.mkdirSync('./output');
    }

    jsonfile.writeFileSync(file, output, {
      spaces: 2,
    });

    this.logger.multiLog('Write file complete! Enjoy!', this.logger.multiLogLevels.infoIntData);

    return output;
  }
}

// Backward compatible module-level interface
let serviceInstance;

function initService() {
  if (!serviceInstance) {
    serviceInstance = new ExtractExtensionService();
  }
  return serviceInstance;
}

function extract() {
  const service = initService();
  return service.extract();
}

module.exports = {
  ExtractExtensionService,
  extract,
};
