const winston = require('winston');

const loggingLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    dev: 4,
    data: 5,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'white',
    debug: 'white',
    dev: 'blue',
    data: 'white'
  }
};

class dataTransport extends winston.Transport {
  constructor(options) {
    super(options);
    this.name = 'dataLogger';
    this.level = options && options.level || 'data';
    this.levelOnly = options && options.levelOnly;
    this.levels = options && options.levels || [];
  }

  log(level, msg, meta, callback) {
    if (!this.levelOnly || this.levels.indexOf(level) > -1) {
      mainLogger[level](msg, meta);
    }
    callback(null, true);
  }
}

function onlyUnique(value, index, array) {
  return array.indexOf(value) === index;
}



module.exports = {
  loggingLevels,
  dataTransport,
  onlyUnique
};