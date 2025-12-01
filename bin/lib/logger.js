const chalk = require('chalk');
const winston = require('winston');

const loggingLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    dev: 4,
    fiData: 5,
    piData: 6,
    coFiData: 7,
  },
};

const filterOnly = level => winston.format(info => (level.includes(info.level) ? info : false))();

const logger = winston.createLogger({
  levels: loggingLevels.levels,
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: './deploy-logs/error.log', level: 'error', format: winston.format.simple(), options: { flags: 'w' },
    }),
    new winston.transports.File({
      filename: './deploy-logs/combined.log', level: 'debug', format: winston.format.simple(), options: { flags: 'w' },
    }),
    new winston.transports.File({
      filename: './deploy-logs/dev-logs.log', level: 'dev', format: winston.format.simple(), options: { flags: 'w' },
    }),
    new winston.transports.File({
      filename: './deploy-logs/rest-responses/field-interactions.log', level: 'fiData', format: winston.format.combine(filterOnly([ 'error', 'fiData' ]), winston.format.json()), options: { flags: 'w' },
    }),
    new winston.transports.File({
      filename: './deploy-logs/results/field-interactions.log', level: 'fiData', format: winston.format.combine(filterOnly([ 'error', 'fiData' ]), winston.format.simple()), options: { flags: 'w' },
    }),
    new winston.transports.File({
      filename: './deploy-logs/rest-responses/page-interactions.log', level: 'piData', format: winston.format.combine(filterOnly([ 'error', 'piData' ]), winston.format.json()), options: { flags: 'w' },
    }),
    new winston.transports.File({
      filename: './deploy-logs/results/page-interactions.log', level: 'piData', format: winston.format.combine(filterOnly([ 'error', 'piData' ]), winston.format.simple()), options: { flags: 'w' },
    }),
    new winston.transports.File({
      filename: './deploy-logs/rest-responses/custom-object-field-interactions.log', level: 'coFiData', format: winston.format.combine(filterOnly([ 'error', 'coFiData' ]), winston.format.json()), options: { flags: 'w' },
    }),
    new winston.transports.File({
      filename: './deploy-logs/results/custom-object-field-interactions.log', level: 'coFiData', format: winston.format.combine(filterOnly([ 'error', 'coFiData' ]), winston.format.simple()), options: { flags: 'w' },
    }),
  ],
});

logger.multiLogLevels = {
  infoIntData: [ 'info', 'fiData', 'coFiData', 'piData' ],
  debugIntData: [ 'debug', 'fiData', 'coFiData', 'piData' ],
  warnFiData: [ 'warn', 'fiData' ],
  infoFiData: [ 'info', 'fiData' ],
  debugFiData: [ 'debug', 'fiData' ],
  warnCoFiData: [ 'warn', 'coFiData' ],
  infoCoFiData: [ 'info', 'coFiData' ],
  debugCoFiData: [ 'debug', 'coFiData' ],
  warnPiData: [ 'warn', 'piData' ],
  infoPiData: [ 'info', 'piData' ],
  debugPiData: [ 'debug', 'piData' ],
};

logger.multiLog = (message, levels = [ 'info' ]) => {
  levels.forEach((level) => {
    if (logger.levels[level] !== undefined) {
      logger.log({ level, message });
    } else {
      logger.warn(chalk.yellow(`Unknown log level: ${level} for ${message}`));
    }
  });
};

logger.printSeparator = () => {
  logger.info('---------------------------------------------------------------------------------------------------');
};

module.exports = logger;
