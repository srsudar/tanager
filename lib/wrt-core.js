'use strict';

var childProcess = require('child_process');
var chrono = require('chrono-node');
var mkdirp = require('mkdirp');
var moment = require('moment');
var path = require('path');
var untildify = require('untildify');

var config = require('./config');

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
 * @param {Object} args arguments from the command line. Fully specified is:
 * {
 *   configFile: String,
 *   date: String,
 *   editorCmd: String
 * }
 * @param {Array.<string>} words the words from the command line that will
 * represent the title. Zero length array indicates no words submitted.
 */
exports.handleRawInput = function(args, words) {
  var date = args.date;
  if (date) {
    // They've specified a date at the command line. Use it.
    date = chrono.parseDate(date);
  } else {
    date = exports.getNow();
  }

  var cfg = config.resolveConfig(args);
  exports.handleValidatedInput(cfg, date, words);
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
  var notebook = exports.getNotebook(config, words);
  var entryPath = exports.getEntryPath(notebook, date, words); 
  var editorCmd = config.editorCmd;

  exports.editEntry(editorCmd, entryPath);
};

exports.editEntry = function(entryPath) {
  childProcess.spawn(process.env.VISUAL, [entryPath], { stdio: 'inherit' });
};

/**
 * Returns the notebook to write into based on the user input.
 */
exports.getNotebook = function(config, words) {
  var notebooks = exports.getNotebooks(config);
  var notebook = null;

  if (words.length > 0 && notebooks.hasOwnProperty(words[0])) {
    notebook = notebooks[words[0]];
  } else {
    Object.keys(notebooks).forEach(key => {
      var nb = notebooks[key];
      if (nb.default) {
        notebook = nb;
      }
    });
  }

  if (!notebook) {
    throw new Error('Cannot find notebook. Check name or set default.');
  }
  return notebook;
};

/**
 * Get the absolute path to the entry. All parent directories to the entry are
 * created before returning.
 *
 * @param {Object} notebook notebook object as represented in the config file.
 * All paths must be fully resolved.
 * @param {Date} date date of the entry
 * @param {Array.<string>} words words that represent the title. 0 length
 * indicates to use the custom entry.
 *
 * @return string the absolute path to the entry. When returns, directories to
 * the file all will exist.
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

  var dir = path.join(notebook.path, yearStr);
  mkdirp.sync(dir);

  var result = path.join(dir, fileName);
  return result;
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
    var rawNb = config.notebooks[notebookName];
    // Don't mutate the config object. No real reason to be careful of this
    // other than trying to prevent side effects.
    var resolvedNb = JSON.parse(JSON.stringify(rawNb));
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
