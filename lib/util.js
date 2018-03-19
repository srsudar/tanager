'use strict';

const bluebird = require('bluebird');
const fs = require('fs');
const glob = require('glob');

const statPromisified = bluebird.promisify(fs.stat);

/**
 * @return {Promise} promisified version of fs.stat called with path
 */
exports.statPromisified = function(path) {
  return statPromisified(path);
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
 * @param {string} dir path to the directory to search
 * @param {Array.<String>} suffixes an Array of valid file suffixes that are
 * legal to return
 *
 * @return {string|null} the path to the most recently modified file in the
 * directory. If there is more than one most recently modified files, which is
 * returned is undefined. If there are no files in the directory, null is
 * returned.
 */
exports.getLastModifiedFile = function(dir, suffixes) {
  return new Promise(function(resolve, reject) {
    let fileNames = null;
    exports.getFilesInDirectory(dir, suffixes)
    .then(files => {
      if (files.length === 0) {
        resolve(null);
        return;
      }
      fileNames = files;
      const statPromises = [];
      files.forEach(file => {
        statPromises.push(exports.statPromisified(file));
      });

      return Promise.all(statPromises);
    })
    .then(stats => {
      let result = fileNames[0];
      let resultTime = stats[0].mtime;
      for (let i = 0; i < stats.length; i++) {
        const stat = stats[i];
        if (stat.mtime > resultTime) {
          result = fileNames[i];
          resultTime = stat.mtime;
        }
      }
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * @param {string} dir path to the directory to search
 * @param {Array.<String>} suffixes an Array of valid file suffixes that are
 * legal to return
 *
 * @return {Promise.<Array.<string>, Error>} Promise that resolves with an
 * array of absolute paths to all the files in the directory or rejects with an
 * Error.
 */
exports.getFilesInDirectory = function(dir, suffixes) {
  return new Promise(function(resolve, reject) {
    // We want to match recursively all file suffixes. For just .md files, eg,
    // it might be '**/*.md'. For multiple suffixes we want '**/*{.md,.txt}'
    // We don't need to worry about path separators here either, as glob only
    // wants forward slashes for separators.
    // Strangely, **/*.md is not equivalent to **/*{.md}. We will thus only use
    // curly braces when necessary.
    let suffixPattern = '';
    if (suffixes.length === 1) {
      suffixPattern = suffixes[0];
    } else if (suffixes.length > 1) {
      suffixPattern = '{' + suffixes.join(',') + '}';
    }
    const pattern = '**/*' + suffixPattern;
    glob(pattern, { cwd: dir, absolute: true }, function(err, files) {
      if (err) {
        reject(err);
        return;
      }
      resolve(files);
    });
  });
};
