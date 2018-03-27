/* jshint loopfunc: true */
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
exports.VERSION = '0.1.0';
exports.DEFAULT_CONFIG_PATH = path.join('~', '.tanager.json');

/** The default template we use for notebooks.  */
exports.DEFAULT_TEMPLATE = '<YYYY>/<YYYY-MM-DD>_<title>.md';
/** The default text in the title if none is given. */
exports.DEFAULT_NAME_NO_TITLE = 'daily';

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

  // Remove the first word if the word refers to the notebook.
  if (words.length > 1) {
    if (notebook._name === words[0] ||
       (notebook.aliases && notebook.aliases.includes(words[0]))) {
      words.shift();
    }
  }

  if (config.editRecent) {
    exports.editLastModifiedFile(config, notebook);
    return;
  }

  if (config.pwd) {
    exports.printNotebookPath(notebook);
    return;
  }

  const entryPath = exports.getEntryPath(date, words, notebook.path,
    notebook.template, notebook.defaultTitle);
  // Assert the necessary directory structure.
  const directory = path.dirname(entryPath);
  mkdirp.sync(directory);

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
    const suffixes = [ exports.getFileSuffixForNotebook(notebook) ];
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
 * Get the the file suffix for files in this notebook. Will include the dot, eg
 * '.md'. Tries to use the template. If that fails, uses the default template.
 *
 * @param {Object} notebook
 *
 * @return {string}
 */
exports.getFileSuffixForNotebook = function(notebook) {
  const template = notebook.template || exports.DEFAULT_TEMPLATE;
  return path.extname(template);
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
 * @param {Date} date date of the entry
 * @param {Array<string>} words words that represent the title.
 * @param {string} baseDir the base directory of the notebook, as contained in
 * tanager.json as notebook.path. Must be fully resolved.
 * @param {string} template the template defining the path to a file relative to
 * the baseDir.
 * @param {string} defaultTitle the default title for the notebook.
 *
 * @return string the absolute path to the entry. When returns, directories to
 * the file all will exist.
 */
exports.getEntryPath = function(date, words, baseDir,
  template = exports.DEFAULT_TEMPLATE,
  defaultTitle = exports.DEFAULT_NAME_NO_TITLE
) {
  // We expect <title> to indicate where the title falls in the template.
  if (template.match(/<title>/) === null) {
    throw new Error('Entry template must contain <title>');
  }

  let title = defaultTitle;
  if (words && words.length > 0) {
    title = words.join('-');
  }

  let templated = template;
  templated = templated.replace(/<title>/, title);

  const datem = moment(date);

  // Replace all <d:YYYY> style brackets.
  const maxIter = 30;
  let iter = 0;
  while (templated.match('<.*>')) {
    if (iter >= maxIter) {
      throw new Error(`Too many interpolotions: ${templated}`);
    }
    // Note .*? to match the smallest possible. /.*/ alone matches the entirety
    // of <YYYY>/<YY-MM>, eg, when we really only want to match <YYYY>.
    templated = templated.replace(/<(.*?)>/, matched => {
      const noCarets = matched.substring(1, matched.length - 1);
      return datem.format(noCarets);
    });
    iter++;
  }

  const result = path.join(baseDir, templated);
  return result;
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
