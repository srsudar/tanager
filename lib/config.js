'use strict';

var jsonFile = require('jsonfile');
var Promise = require('bluebird');
var merge = require('merge');
var untildify = require('untildify');
Promise.promisifyAll(jsonFile);

var util = require('./util');

/**
 * Module for handling configuration. A config object contains information
 * known to the system, including notebooks and various arguments. It can be
 * saved to a JSON file and might look like:
 * {
 *   "editorCmd": "vim -e",
 *   "notebooks": {
 *     "journal": {
 *       "path": "~/writing/journal/",
 *       "aliases": ["j"],
 *       "default": true
 *     },
 *     "notes": {
 *       "path": "~/Documents/notes"
 *     }
 *   }
 * }
 */

/**
 * @param {Object} cliArgs arguments from the command line
 *
 * @return {Promise.<Object, Error>} the resolved config object, or rejects
 * with an Error if something goes wrong. All paths in the returned config are
 * fully resolved.
 */
exports.resolveConfig = function(cliArgs) {
  // Our general order here is command line, file, defaults.
  var configFromDefaults = exports.getDefaultConfig();
  var configFromCli = exports.getCliConfig(cliArgs);
  var configFromFile = exports.getFileConfig(cliArgs.configFile);

  var resolvedConfig = merge(
    true, configFromDefaults, configFromFile, configFromCli
  );    

  exports.validateConfig(resolvedConfig);
  exports.expandConfigPaths(resolvedConfig);

  return resolvedConfig;
};

/**
 * @return {Object} a config object based solely on defaults
 */
exports.getDefaultConfig = function() {
  var result = exports.buildConfig(
    exports.getEditorCmdFromEnv()
  );
  return result;
};

/**
 * @param {Object} cliArgs arguments from the command line
 *
 * @return Object a config object based on the command line arguments
 */
exports.getCliConfig = function(cliArgs) {
  var result = exports.buildConfig(cliArgs.editorCmd);
  return result;
};

/**
 * @param {string} configPath the path to the config file. Does not have to be
 * resolved.
 *
 * @return Object
 */
exports.getFileConfig = function(configPath) {
  configPath = untildify(configPath);
  return jsonFile.readFileSync(configPath);
};

/**
 * Validate that the config contains enough information to function.
 *
 * If it does not, the program prints an error and exits.
 *
 * @param {Object} config a resolved config object
 */
exports.validateConfig = function(config) {
  if (!config.editorCmd) {
    util.failAndQuit(
      new Error('Could not find editor. Try setting $VISUAL.')
    );
  } else if (!config.notebooks) {
    util.failAndQuit(
      new Error('No notebooks found. Set in .tanager.json.')
    );
  } else {
    Object.keys(config.notebooks).forEach(nbName => {
      var notebook = config.notebooks[nbName];
      if (!notebook.path) {
        util.failAndQuit(
          new Error('Notebook missing a path in .tanager.json, failing fast.')
        );
      }
    });
  }
  // All good!
};

/**
 * Expand every path in the config. The config is altered in-place.
 *
 * @param {Object} config
 */
exports.expandConfigPaths = function(config) {
  Object.keys(config.notebooks).forEach(nbName => {
    var notebook = config.notebooks[nbName];
    var expandedPath = untildify(notebook.path);
    notebook.path = expandedPath;
  });
};

/**
 * Return a rudimentary config object. Convenience method for sparing null
 * checking.
 *
 * @param {string} editorCmd the editor command. If not truthy, is not added to
 * the result.
 *
 * @return {Object} a config object
 */
exports.buildConfig = function(editorCmd) {
  var result = {};
  if (editorCmd) {
    result.editorCmd = editorCmd;
  }
  return result;
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
 * @return {string} the default editor command from the environment
 */
exports.getEditorCmdFromEnv = function() {
  // We want precedence of command line, config, VISUAL, EDITOR, as with git.
  var result = exports.resolvePriority([
    process.env.VISUAL, process.env.EDITOR
  ]);
  return result;
};
