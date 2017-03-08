'use strict';

var jsonFile = require('jsonfile');
var Promise = require('bluebird');
var path = require('path');
var untildify = require('untildify');
Promise.promisifyAll(jsonFile);

var util = require('./util');

exports.resolveConfig = function(configPath) {
  console.log(configPath);
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
 * Returns the first truthy element in the array.
 *
 * @param {Array.<any>} arr return the first truthy value
 *
 * @return {any|null} the first truthy value in arr or null if no values are
 * truthy.
 */
exports.resolvePriority = function(arr) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i]) {
      return arr[i];
    }
  }
  return null;
};

/**
 * @param {string} clArg the command line editor argument
 * 
 * @return {string} the resolved editor command. If no editor command can be
 * found, fails and quits the program.
 */
exports.getEditorCmd = function(clArg) {
  // We want precedence of command line, config, VISUAL, EDITOR, as with git.
  var result = exports.resolvePriority([
    clArg, process.env.VISUAL, process.env.EDITOR
  ]);

  if (!result) {
    util.failAndQuit(
      new Error('Could not find an editor. Set in .wrt.json or VISUAL')
    );
  }

  return result;
};
