'use strict';

var chrono = require('chrono-node');
var jsonFile = require('jsonfile');
var moment = require('moment');
var Promise = require('bluebird');
var path = require('path');
var untildify = require('untildify');
Promise.promisifyAll(jsonFile);

exports.VERSION = '0.0.1';
exports.DEFAULT_CONFIG_PATH = path.join('~', '.wrt.json');

/** The format of the date in the file name, as used by moment. */
exports.DATE_FORMAT = 'YYYY-MM-DD';
/** The delimeter between title words in the file name. */
exports.TITLE_WORDS_DELIMITER = '-';
/** The delimeter between date and title in the file name. */
exports.DATE_TITLE_DELIMITER = '_';
/** The default text in the title if none is given. */
exports.DEFAULT_NAME_NO_TITLE = 'daily';
/** The default file suffix. */
exports.DEFAULT_FILE_SUFFIX = '.md';

/**
 * @param {Object} config basic JSON object representing the contents of a
 * configuration file
 * @param {Date} date date the entry is about
 * @param {Array.<string>} words the words from the command line that will
 * represent the title. Zero length array indicates no words submitted.
 */
exports.handleRawInput = function(configPath, date, words) {
  return new Promise(function(resolve, reject) {
    if (date) {
      // They've specified a date at the command line. Use it.
      date = chrono.parseDate(date);
    } else {
      date = exports.getNow();
    }

    exports.getConfig(configPath)
    .then(config => {
      exports.handleValidatedInput(config, date, words);
      resolve();
    })
    .catch(err => {
      exports.failAndQuit(err);
      reject(err);
    });
  });
};

/**
 * Log the error and exit.
 *
 * @param {Error} err
 */
exports.failAndQuit = function(err) {
  console.error(err);
  process.exit(1);
};

/**
 * @return Date Date representing now
 */
exports.getNow = function() {
  return new Date();
};

/*
 * @param {Object} config basic JSON object representing the contents of a
 * configuration file
 * @param {Date} date date the entry is about
 * @param {Array.<string>} words the words from the command line that will
 * represent the title. Zero length array indicates no words submitted.
 */
exports.handleValidatedInput = function(config, date, words) {

  console.log(config, date, words);
};

/**
 * @param {Object} notebook notebook object as represented in the config file.
 * All paths must be fully resolved.
 * @param {Date} date date of the entry
 * @param {Array.<string>} words words that represent the title. 0 length
 * indicates to use the custom entry.
 *
 * @return string the absolute path to the entry
 */
exports.getEntryPath = function(notebook, date, words) {
  var datem = moment(date);
  var yearStr = '' + datem.year();
  var dateName = datem.format(exports.DATE_FORMAT);
  
  var text = words.join(exports.TITLE_WORDS_DELIMITER);
  if (text.length === 0) {
    text = exports.DEFAULT_NAME_NO_TITLE;
  }
  text += exports.DEFAULT_FILE_SUFFIX;
  
  var fileName = dateName + exports.DATE_TITLE_DELIMITER + text;

  var result = path.join(notebook.path, yearStr, fileName);
  return result;
};

/**
 * @param {string} configPath the path to the config file. Does not have to be
 * resolved.
 *
 * @return Promise.<Object, Error> Error if the file does not exist.
 */
exports.getConfig = function(configPath) {
  configPath = untildify(configPath);
  return jsonFile.readFileAsync(configPath);
};

/**
 * @param {Object} config the config object stored in .wrt.json
 *
 * @return {Object} an object mapping notebook name to the notebook object. All
 * paths are resolved, and aliases map to the same notebook object.
 */
exports.getNotebooks = function(config) {
  var result = {};
  Object.keys(config.notebooks).forEach(notebookName => {
    var resolvedNb = {};
    var rawNb = config.notebooks[notebookName];
    resolvedNb.path = untildify(rawNb.path);

    result[notebookName] = resolvedNb;
    if (rawNb.aliases) {
      rawNb.aliases.forEach(alias => {
        result[alias] = resolvedNb;
      });
    }
  });
  return result;
};
