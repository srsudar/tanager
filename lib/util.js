'use strict';

/**
 * Log the error and exit.
 *
 * @param {Error} err
 */
exports.failAndQuit = function(err) {
  console.error(err);
  process.exit(1);
};
