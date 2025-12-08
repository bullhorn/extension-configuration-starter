const chalk = require('chalk');
const logger = require('./lib/logger');
const utils = require('./utils');

const ADD = 'add';
const UPDATE = 'update';
const DELETE = 'delete';

class ResultsService {
  constructor() {
    this.logger = logger;
    this.utils = utils;
    this.ADD = ADD;
    this.UPDATE = UPDATE;
    this.DELETE = DELETE;
  }

  handleFIExtensionsFail(uploadConfig) {
    const results = [];
    this.logger.info(`Creating results for failed FI upload due to no Field Interactions in extension file for ${JSON.stringify(uploadConfig)}`);
    Object.keys(uploadConfig).forEach((entity) => {
      results.push(this.handleFIEntityFail(entity, uploadConfig[entity], 'no Field Interactions in extensions file'));
    });
    return results;
  }

  handleFIEntityFail(entityName, entity, reason) {
    const results = [];

    this.logger.info(`Creating results for failed FI entity for ${JSON.stringify(entity)} due to ${reason}`);

    Object.keys(entity).forEach((config) => {
      if (config === 'toUpdate') {
        Object.keys(entity[config]).forEach((field) => {
          entity[config][field].interactionNameID.forEach((fi) => {
            this.logger.info(`fi name = ${fi.name} and id = ${fi.id}`);
            results.push(this.handleUpdateFIFail(entityName, field, fi, reason));
          });
        });
      }

      if (config === 'toAdd') {
        Object.keys(entity[config]).forEach((field) => {
          entity[config][field].interactionNames.forEach((fi) => {
            results.push(this.handleAddFIFail(entityName, field, fi, reason));
          });
        });
      }
    });

    return results;
  }

  handleUpdateFIFail(entity, field, fi, reason) {
    return {
      entity: entity, field: field, name: fi.name, operation: this.UPDATE, id: fi.id, success: false, reason: reason,
    };
  }

  handleAddFIFail(entity, field, fi, reason) {
    return {
      entity: entity, field: field, name: fi, operation: this.ADD, id: 'n/a', success: false, reason: reason,
    };
  }

  handleUpdateCOFIFail(entity, customObject, field, fi, reason) {
    return {
      entity: entity, customObject: customObject, field: field, name: fi.name, operation: this.UPDATE, id: fi.id, success: false, reason: reason,
    };
  }

  handleAddCOFIFail(entity, customObject, field, fi, reason) {
    return {
      entity: entity, customObject: customObject, field: field, name: fi, operation: this.ADD, id: 'n/a', success: false, reason: reason,
    };
  }

  handleUpdatePIFail(action, pi, reason) {
    return {
      action: action, name: pi.name, operation: this.UPDATE, id: pi.id, success: false, reason: reason,
    };
  }

  handleAddPIFail(action, pi, reason) {
    return {
      action: action, name: pi, operation: this.ADD, id: '', success: false, reason: reason,
    };
  }

  createFIUpdateResult(entity, fieldName, toUpdateFI, responseCode, restLog) {
    const isSuccess = this.isSuccessful(responseCode);
    const result = {
      entity: entity,
      field: fieldName,
      name: toUpdateFI.name,
      operation: this.UPDATE,
      id: toUpdateFI.id,
      success: isSuccess,
      reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`,
    };

    return result;
  }

  createFIAddResult(entity, fieldName, toUpdateFI, responseCode, restLog) {
    const isSuccess = this.isSuccessful(responseCode);
    const result = {
      entity: entity,
      field: fieldName,
      name: toUpdateFI,
      operation: this.ADD,
      id: '',
      success: isSuccess,
      reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`,
    };

    return result;
  }

  createFIDeleteResult(entity, fieldName, toDeleteFI, responseCode, restLog) {
    const isSuccess = this.isSuccessful(responseCode);
    const result = {
      entity: entity,
      field: fieldName,
      name: toDeleteFI.name,
      operation: this.DELETE,
      id: toDeleteFI.id,
      success: isSuccess,
      reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`,
    };

    return result;
  }

  createCOFIUpdateResult(entity, customObject, fieldName, toUpdateFI, responseCode, restLog) {
    const isSuccess = this.isSuccessful(responseCode);
    const result = {
      entity: entity,
      customObject: customObject,
      field: fieldName,
      name: toUpdateFI.name,
      operation: this.UPDATE,
      id: toUpdateFI.id,
      success: isSuccess,
      reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`,
    };

    return result;
  }

  createCOFIAddResult(entity, customObject, fieldName, toUpdateFI, responseCode, restLog) {
    const isSuccess = this.isSuccessful(responseCode);
    const result = {
      entity: entity,
      customObject: customObject,
      field: fieldName,
      name: toUpdateFI,
      operation: this.ADD,
      id: '',
      success: isSuccess,
      reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`,
    };

    return result;
  }

  createCOFIDeleteResult(entity, customObject, fieldName, toDeleteFI, responseCode, restLog) {
    const isSuccess = this.isSuccessful(responseCode);
    const result = {
      entity: entity,
      customObject: customObject,
      field: fieldName,
      name: toDeleteFI.name,
      operation: this.DELETE,
      id: toDeleteFI.id,
      success: isSuccess,
      reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`,
    };

    return result;
  }

  createPIUpdateResult(action, pi, responseCode, restLog) {
    const isSuccess = this.isSuccessful(responseCode);
    const result = {
      action: action,
      name: pi.name,
      operation: this.UPDATE,
      id: pi.id,
      success: isSuccess,
      reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`,
    };

    return result;
  }

  createPIAddResult(action, pi, responseCode, restLog) {
    const isSuccess = this.isSuccessful(responseCode);
    const result = {
      action: action,
      name: pi,
      operation: this.ADD,
      id: '',
      success: isSuccess,
      reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`,
    };

    return result;
  }

  createPIDeleteResult(action, pi, responseCode, restLog) {
    const isSuccess = this.isSuccessful(responseCode);
    const result = {
      action: action,
      name: pi.name,
      operation: this.DELETE,
      id: pi.id,
      success: isSuccess,
      reason: isSuccess ? '' : `call failed with ${responseCode}, response: ${restLog}`,
    };

    return result;
  }

  isSuccessful(responseCode) {
    return responseCode < 300;
  }

  printResults(results, privateLabel) {
    this.logger.info(' _________');
    this.logger.info('| RESULTS |');
    this.logger.info(' ‾‾‾‾‾‾‾‾‾');
    this.logger.info(`Deployment Complete for Private Label: ${privateLabel} with the following results`);

    const failures = {};

    if (results.deleted && results.deleted) {
      failures.delete = this.printDeletedResults(results.deleted);
    }

    failures.deploy = {};

    if (results.fieldInteractions && results.fieldInteractions.length) {
      failures.deploy.fieldInteractions = this.printFieldInteractionResults(results.fieldInteractions);
    }

    if (results.customObjectFIs && results.customObjectFIs.length) {
      failures.deploy.customObjectFIs = this.printCOFieldInteractionResults(results.customObjectFIs);
    }

    if (results.pageInteractions && results.pageInteractions.length) {
      failures.deploy.pageInteractions = this.printPageInteractionResults(results.pageInteractions);
    }

    this.logger.printSeparator();
    this.printFailures(failures);
    this.printCounts(results);
  }

  printDeletedResults(results) {
    this.logger.info('Deleted Interactions');

    const failures = {};

    if (results.fieldInteractions && results.fieldInteractions.length) {
      failures.fieldInteractions = this.printFieldInteractionResults(results.fieldInteractions);
    }

    if (results.customObjectFIs && results.customObjectFIs.length) {
      failures.customObjectFIs = this.printCOFieldInteractionResults(results.customObjectFIs);
    }

    if (results.pageInteractions && results.pageInteractions.length) {
      failures.pageInteractions = this.printPageInteractionResults(results.pageInteractions);
    }

    return failures;
  }

  printFieldInteractionResults(results) {
    this.logger.printSeparator();

    this.logger.info('Field Interactions');

    const failures = [];
    const allEntities = results.map((result) => {
      return result.entity;
    }).filter(this.utils.onlyUnique);

    allEntities.forEach((entity) => {
      this.fillToSeparate(` Entity: ${entity} `, '<<', '>>', 75);
      const entityFields = results.filter((fiEntity) => {
        return fiEntity.entity === entity;
      }).map((fiField) => {
        return fiField.field;
      }).filter(this.utils.onlyUnique);
      entityFields.forEach((field) => {
        this.fillToSeparate(` Field: ${field} `, '<', '>', 35);
        results.filter((fi) => {
          return fi.entity === entity && fi.field === field;
        }).forEach((result) => {
          if (!result.success) {
            failures.push(result);
          } else {
            if (result.operation === this.UPDATE) {
              this.logger.info(chalk.blue(`- ${result.name} - UPDATED`));
            }

            if (result.operation === this.ADD) {
              this.logger.info(chalk.green(`- ${result.name} - ADDED`));
            }

            if (result.operation === this.DELETE) {
              this.logger.info(chalk.magenta(`- ${result.name} - DELETED`));
            }
          }
        });
      });
    });

    return failures;
  }

  printCOFieldInteractionResults(results) {
    this.logger.printSeparator();

    this.logger.info('Custom Object Field Interactions');

    const failures = [];
    const allCustomObjects = results.map((result) => {
      return result.customObject;
    }).filter(this.utils.onlyUnique);

    allCustomObjects.forEach((customObject) => {
      const allCOEntities = results.filter((coEntity) => {
        return coEntity.entity && coEntity.customObject === customObject;
      }).map((entity) => {
        return entity.entity;
      }).filter(this.utils.onlyUnique);

      allCOEntities.forEach((coEntity) => {
        this.fillToSeparate(` Custom Object: ${customObject} (${coEntity}) `, '<<', '>>', 75);
        const coFields = results.filter((coField) => {
          return coField.entity === coEntity && coField.customObject === customObject;
        }).map((fiField) => {
          return fiField.field;
        }).filter(this.utils.onlyUnique);

        coFields.forEach((field) => {
          this.fillToSeparate(` Field: ${field} `, '<', '>', 35);
          results.filter((fi) => {
            return fi.entity === coEntity && fi.field === field && fi.customObject === customObject;
          }).forEach((result) => {
            if (!result.success) {
              failures.push(result);
            } else {
              if (result.operation === this.UPDATE) {
                this.logger.info(chalk.blue(`- ${result.name} - UPDATED`));
              }

              if (result.operation === this.ADD) {
                this.logger.info(chalk.green(`- ${result.name} - ADDED`));
              }

              if (result.operation === this.DELETE) {
                this.logger.info(chalk.magenta(`- ${result.name} - DELETED`));
              }
            }
          });
        });
      });
    });

    return failures;
  }

  printPageInteractionResults(results) {
    this.logger.printSeparator();

    this.logger.info('Page Interactions');

    const failures = [];
    const allActions = results.map((result) => {
      return result.action;
    }).filter(this.utils.onlyUnique);

    allActions.forEach((action) => {
      this.fillToSeparate(` Action: ${action}`, '<<', '>>', 75);
      results.filter((pi) => {
        return pi.action === action;
      }).forEach((result) => {
        if (!result.success) {
          failures.push(result);
        } else {
          if (result.operation === this.UPDATE) {
            this.logger.info(chalk.blue(`- ${result.name} - UPDATED`));
          }
          if (result.operation === this.ADD) {
            this.logger.info(chalk.green(`- ${result.name} - ADDED`));
          }
          if (result.operation === this.DELETE) {
            this.logger.info(chalk.magenta(`- ${result.name} - DELETED`));
          }
        }
      });
    });

    return failures;
  }

  printFailures(failures) {
    if (failures && failures.delete) {
      const deleteFailures = failures.delete;

      if (Object.values(deleteFailures).flat().length) {
        if (deleteFailures && deleteFailures.fieldInteractions && deleteFailures.fieldInteractions.length) {
          this.logger.info('The following field interactions failed to be deleted');
          this.printFieldInteractionFails(deleteFailures.fieldInteractions);
          this.logger.printSeparator();
        }

        if (deleteFailures && deleteFailures.customObjectFIs && deleteFailures.customObjectFIs.length) {
          this.logger.info('The following custom object interactions failed to be deleted');
          this.printCOInteractionFails(deleteFailures.customObjectFIs);
          this.logger.printSeparator();
        }

        if (deleteFailures && deleteFailures.pageInteractions && deleteFailures.pageInteractions.length) {
          this.logger.info('The following Page Interactions failed to be deleted');
          this.printPageInteractionFails(deleteFailures.pageInteractions);
          this.logger.printSeparator();
        }
      }
    }

    if (failures && failures.deploy) {
      const deployFailures = failures.deploy;

      if (Object.values(deployFailures).flat().length) {
        this.logger.info(chalk.red('The following interactions failed to be deployed'));

        if (deployFailures && deployFailures.fieldInteractions && deployFailures.fieldInteractions.length) {
          this.logger.info('The following Field Interactions failed to be deployed');
          this.printFieldInteractionFails(deployFailures.fieldInteractions);
          this.logger.printSeparator();
        }

        if (deployFailures && deployFailures.customObjectFIs && deployFailures.customObjectFIs.length) {
          this.logger.info('The following Custom Object Field Interactions failed to be deployed');
          this.printCOInteractionFails(deployFailures.customObjectFIs);
          this.logger.printSeparator();
        }

        if (deployFailures && deployFailures.pageInteractions && deployFailures.pageInteractions.length) {
          this.logger.info('The following Page Interactions failed to be deployed');
          this.printPageInteractionFails(deployFailures.pageInteractions);
          this.logger.printSeparator();
        }
      }
    }
  }

  printFieldInteractionFails(fails) {
    const allEntities = fails.map((result) => {
      return result.entity;
    }).filter(this.utils.onlyUnique);

    allEntities.forEach((entity) => {
      this.fillToSeparate(` Entity: ${entity} `, '<<', '>>', 75);
      const entityFields = fails.filter((fiEntity) => {
        return fiEntity.entity === entity;
      }).map((fiField) => {
        return fiField.field;
      }).filter(this.utils.onlyUnique);

      entityFields.forEach((field) => {
        this.fillToSeparate(` Field: ${field} `, '<', '>', 35);
        fails.filter((fi) => {
          return fi.entity === entity && fi.field === field;
        }).forEach((result) => {
          this.logger.info(chalk.red(`--- ${result.name} - Reason: ${result.reason}`));
        });
      });
    });
  }

  printCOInteractionFails(fails) {
    const allCustomObjects = fails.map((result) => {
      return result.customObject;
    }).filter(this.utils.onlyUnique);

    allCustomObjects.forEach((customObject) => {
      const allCOEntities = fails.filter((coEntity) => {
        return coEntity.entity && coEntity.customObject === customObject;
      }).map((entity) => {
        return entity.entity;
      }).filter(this.utils.onlyUnique);

      allCOEntities.forEach((coEntity) => {
        this.fillToSeparate(` Custom Object: ${customObject} (${coEntity}) `, '<<', '>>', 75);
        const coFields = fails.filter((coField) => {
          return coField.entity === coEntity && coField.customObject === customObject;
        }).map((fiField) => {
          return fiField.field;
        }).filter(this.utils.onlyUnique);

        coFields.forEach((field) => {
          this.fillToSeparate(` Field: ${field} `, '<', '>', 35);
          fails.filter((fi) => {
            return fi.entity === coEntity && fi.field === field && fi.customObject === customObject;
          }).forEach((result) => {
            this.logger.info(chalk.red(`- ${result.name} - Reason: ${result.reason}`));
          });
        });
      });
    });
  }

  printPageInteractionFails(fails) {
    const allActions = fails.map((result) => {
      return result.action;
    }).filter(this.utils.onlyUnique);

    allActions.forEach((action) => {
      this.fillToSeparate(` Action: ${action}`, '<<', '>>', 75);
      fails.filter((pi) => {
        return pi.action === action;
      }).forEach((result) => {
        this.logger.info(chalk.red(`- ${result.name} - Reason: ${result.reason}`));
      });
    });
  }

  printCounts(results) {
    this.logger.info('Deploy Summary \n');
    const deployedInteractions = results.fieldInteractions.concat(results.customObjectFIs, results.pageInteractions);
    const totalDeployed = deployedInteractions.filter((result) => {
      return result.success;
    }).length;
    this.logger.info(chalk.blue(`Total interactions deployed: ${totalDeployed} \n`));
    const deletedInteractions = results.deleted ? results.deleted : [];
    const totalDeleted = Object.values(deletedInteractions).flat().filter((result) => {
      return result.success;
    }).length;
    this.logger.info(chalk.magenta(`Total interactions deleted: ${totalDeleted} \n`));
    const totalFails = deployedInteractions.filter((result) => {
      return !result.success;
    }).length + Object.values(deletedInteractions).flat().filter((result) => {
      return !result.success;
    }).length;

    if (totalFails > 0) {
      this.logger.info(chalk.red(`Total Failures: ${totalFails} \n`));
      this.logger.info('Deploy Complete');
      this.logger.info(chalk.bgRed('FAILURES DETECTED PLEASE REVIEW ABOVE'));
    } else {
      this.logger.info('Deploy Complete');
      this.logger.info(chalk.green('No Failures Detected'));
    }

    this.logger.printSeparator();
  }

  fillToSeparate(text, beginSym, endSym, size) {
    const totalSize = size - (text.length + beginSym.length + endSym.length);

    if (totalSize < -2) {
      this.logger.info(text);
    } else {
      let sep = beginSym;
      const halfSize = Math.floor(totalSize / 2);

      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < halfSize; i++) {
        sep += '-';
      }
      sep += text;

      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < halfSize; i++) {
        sep += '-';
      }
      sep += endSym;
      this.logger.info(sep);
    }
  }
}

// Backward compatible module-level interface
let serviceInstance;

function initService() {
  if (!serviceInstance) {
    serviceInstance = new ResultsService();
  }
  return serviceInstance;
}

function handleFIExtensionsFail(uploadConfig) {
  const service = initService();
  return service.handleFIExtensionsFail(uploadConfig);
}

function handleFIEntityFail(entityName, entity, reason) {
  const service = initService();
  return service.handleFIEntityFail(entityName, entity, reason);
}

function handleUpdateFIFail(entity, field, fi, reason) {
  const service = initService();
  return service.handleUpdateFIFail(entity, field, fi, reason);
}

function handleAddFIFail(entity, field, fi, reason) {
  const service = initService();
  return service.handleAddFIFail(entity, field, fi, reason);
}

function handleUpdateCOFIFail(entity, customObject, field, fi, reason) {
  const service = initService();
  return service.handleUpdateCOFIFail(entity, customObject, field, fi, reason);
}

function handleAddCOFIFail(entity, customObject, field, fi, reason) {
  const service = initService();
  return service.handleAddCOFIFail(entity, customObject, field, fi, reason);
}

function createFIUpdateResult(entity, fieldName, toUpdateFI, responseCode, restLog) {
  const service = initService();
  return service.createFIUpdateResult(entity, fieldName, toUpdateFI, responseCode, restLog);
}

function createFIAddResult(entity, fieldName, toUpdateFI, responseCode, restLog) {
  const service = initService();
  return service.createFIAddResult(entity, fieldName, toUpdateFI, responseCode, restLog);
}

function createFIDeleteResult(entity, fieldName, toDeleteFI, responseCode, restLog) {
  const service = initService();
  return service.createFIDeleteResult(entity, fieldName, toDeleteFI, responseCode, restLog);
}

function createCOFIUpdateResult(entity, customObject, fieldName, toUpdateFI, responseCode, restLog) {
  const service = initService();
  return service.createCOFIUpdateResult(entity, customObject, fieldName, toUpdateFI, responseCode, restLog);
}

function createCOFIAddResult(entity, customObject, fieldName, toUpdateFI, responseCode, restLog) {
  const service = initService();
  return service.createCOFIAddResult(entity, customObject, fieldName, toUpdateFI, responseCode, restLog);
}

function createCOFIDeleteResult(entity, customObject, fieldName, toDeleteFI, responseCode, restLog) {
  const service = initService();
  return service.createCOFIDeleteResult(entity, customObject, fieldName, toDeleteFI, responseCode, restLog);
}

function handleUpdatePIFail(action, pi, reason) {
  const service = initService();
  return service.handleUpdatePIFail(action, pi, reason);
}

function handleAddPIFail(action, pi, reason) {
  const service = initService();
  return service.handleAddPIFail(action, pi, reason);
}

function createPIUpdateResult(action, pi, responseCode, restLog) {
  const service = initService();
  return service.createPIUpdateResult(action, pi, responseCode, restLog);
}

function createPIAddResult(action, pi, responseCode, restLog) {
  const service = initService();
  return service.createPIAddResult(action, pi, responseCode, restLog);
}

function createPIDeleteResult(action, pi, responseCode, restLog) {
  const service = initService();
  return service.createPIDeleteResult(action, pi, responseCode, restLog);
}

function printResults(results, privateLabel) {
  const service = initService();
  return service.printResults(results, privateLabel);
}

module.exports = {
  ResultsService,
  handleFIExtensionsFail,
  handleFIEntityFail,
  handleUpdateFIFail,
  handleAddFIFail,
  handleUpdateCOFIFail,
  handleAddCOFIFail,
  createFIUpdateResult,
  createFIAddResult,
  createFIDeleteResult,
  createCOFIUpdateResult,
  createCOFIAddResult,
  createCOFIDeleteResult,
  handleUpdatePIFail,
  handleAddPIFail,
  createPIUpdateResult,
  createPIAddResult,
  createPIDeleteResult,
  printResults,
};
