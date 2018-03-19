'use strict';

const childProcess = require('child_process');
const chrono = require('chrono-node');
const mkdirp = require('mkdirp');
const moment = require('moment');
const path = require('path');
const untildify = require('untildify');

const config = require('./config');
const util = require('./util');

// Also bump in package.json
exports.VERSION = '0.0.3';
exports.DEFAULT_CONFIG_PATH = path.join('~', '.tanager.json');

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
  let date = args.date;
  if (date) {
    // They've specified a date at the command line. Use it.
    date = chrono.parseDate(date);
  } else {
    date = exports.getNow();
  }

  const cfg = config.resolveConfig(args);
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
 * represent the title.
 */
exports.handleValidatedInput = function(config, date, words) {
  const notebook = exports.getNotebook(config, words);

  if (config.editRecent) {
    exports.editLastModifiedFile(config, notebook);
    return;
  }

  if (config.pwd) {
    exports.printNotebookPath(notebook);
    return;
  }

  const entryPath = exports.getEntryPath(notebook, date, words); 
  const editorCmd = config.editorCmd;

  exports.editEntry(editorCmd, entryPath);
};

/**
 * Print the path to the notebook.
 *
 * @param {Object} notebook
 */
exports.printNotebookPath = function(notebook) {
  console.log(notebook.path);
};

/**
 * Edit the most recently modified file in the given notebook.
 *
 * @param {Object} config
 * @param {Object} notebook
 *
 * @return {Promise}
 */
exports.editLastModifiedFile = function(config, notebook) {
  return new Promise(function(resolve, reject) {
    const suffixes = [ exports.DEFAULT_FILE_SUFFIX ];
    util.getLastModifiedFile(notebook.path, suffixes)
    .then(entryPath => {
      if (!entryPath) {
        util.failAndQuit('No files in notebook');
        resolve();
        return;
      }
      exports.editEntry(config.editorCmd, entryPath);
      resolve();
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Edit the given entry
 *
 * @param {string} editorCmd
 * @param {string} entryPath
 */
exports.editEntry = function(editorCmd, entryPath) {
  childProcess.spawn(editorCmd, [entryPath], { stdio: 'inherit' });
};

/**
 * Returns the notebook to write into based on the user input.
 *
 * @param {Object} config the config object as contained in the config file
 * @param {Array.<string>} words the words passed on the command line
 *
 * @return {Object} the notebook object to which this invocation applies
 */
exports.getNotebook = function(config, words) {
  const notebooks = exports.getNotebooks(config);
  let notebook = null;

  if (words.length > 0 && notebooks.hasOwnProperty(words[0])) {
    notebook = notebooks[words[0]];
  } else {
    Object.keys(notebooks).forEach(key => {
      const nb = notebooks[key];
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
 * @param {Array.<string>} words words that represent the title.
 *
 * @return string the absolute path to the entry. When returns, directories to
 * the file all will exist.
 */
exports.getEntryPath = function(notebook, date, words) {
  const datem = moment(date);
  const yearStr = '' + datem.year();
  const dateName = datem.format(exports.DATE_FORMAT);
  
  let text = exports.getEntryTitleWords(notebook, words);
  text += exports.DEFAULT_FILE_SUFFIX;
  
  const fileName = dateName + exports.DATE_TITLE_DELIMITER + text;

  const dir = path.join(notebook.path, yearStr);
  mkdirp.sync(dir);

  const result = path.join(dir, fileName);
  return result;
};

/**
 * Construct the text portion of the title for an entry. This does not include
 * the date but only the text after the date and sparator. In the example
 * '2017-03-27_meeting-with-tyrion.md', this would be responsible for returning
 * 'meeting-with-tyrion'.
 *
 * @param {Object} notebook notebook object as returned by getNotebooks().
 * @param {Array.<string>} words words passed on the command line
 *
 * @return {string} the text portion of the title
 */
exports.getEntryTitleWords = function(notebook, words) {
  // First, protectively copy the words so we can modify them.
  words = words.slice(0, words.length);
  if (words.length > 0 && words[0] === notebook._name) {
    // Remove the name of the journal from the first position.
    words = words.slice(1, words.length);
  }
  if (words.length === 0) {
    if (notebook.defaultTitle) {
      // Use the default value. toString() is only to try and behave upstream
      // if someone sets something wonky in the config file
      return notebook.defaultTitle.toString();
    } else {
    return exports.DEFAULT_NAME_NO_TITLE;
    }
  }
  return words.join(exports.TITLE_WORDS_DELIMITER);
};

/**
 * @param {Object} config the config object stored in .tanager.json
 *
 * @return {Object} an object mapping notebook name to the notebook object. All
 * paths are resolved, and aliases map to the same notebook object. An
 * additional key, '_name', is included in each object that represents the name
 * of the notebook. This is a convenience operation to make things simpler on
 * callers down the line.
 */
exports.getNotebooks = function(config) {
  const result = {};
  Object.keys(config.notebooks).forEach(notebookName => {
    const rawNb = config.notebooks[notebookName];
    // Don't mutate the config object. No real reason to be careful of this
    // other than trying to prevent side effects.
    const resolvedNb = JSON.parse(JSON.stringify(rawNb));
    resolvedNb.path = untildify(rawNb.path);
    // Add the _name key we add for convenience
    resolvedNb._name = notebookName;

    result[notebookName] = resolvedNb;
    if (rawNb.aliases) {
      rawNb.aliases.forEach(alias => {
        result[alias] = resolvedNb;
      });
    }
  });
  return result;
};
