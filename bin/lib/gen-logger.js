const chalk = require('chalk');
const winston = require('winston');

const loggingLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
  },
};

const logger = winston.createLogger({
  levels: loggingLevels.levels,
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: './gen-selective-extension.log',
      level: 'info',
      format: winston.format.simple(),
      options: { flags: 'w' },
    }),
  ],
});

logger.multiLogLevels = {
  warnGenExt: [ 'warn' ],
  infoGenExt: [ 'info' ],
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

module.exports = logger;
