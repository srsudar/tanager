'use strict';

var jsonFile = require('jsonfile');
var Promise = require('bluebird');
var untildify = require('untildify');
var path = require('path');
Promise.promisifyAll(jsonFile);

exports.VERSION = '0.0.1';
exports.DEFAULT_CONFIG_PATH = path.join('~', '.wrt.json');

/**
 * @param {Object} config basic JSON object representing the contents of a
 * configuration file
 * @param {Date} date date the entry is about
 * @param {Array.<String>} words the words from the command line that will
 * represent the title. Zero length array indicates no words submitted.
 */
exports.handleInput = function(config, date, words) {
  console.log(config, date, words);
};

/**
 * @param {Object} notebook notebook object as represented in the config file
 * @param {Date} date date of the entry
 * @param {Array.<String>} words words that represent the title. 0 length
 * indicates to use the custom entry.
 */
exports.getEntryName = function(notebook, date, words) {
  console.log(notebook, date, words);
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
