#!/usr/bin/env node
'use strict';

const program = require('commander');
const core = require('./lib/core');

let words = [];
program
  .version(core.VERSION)
  .option(
    '-c, --config-file <config-file>',
    'Path to config file. Defaults to ~/.tanager.json',
    String,
    core.DEFAULT_CONFIG_PATH
  )
  .option(
    '-d, --date <date>',
    'Date of the entry. Yesterday, dec5, "dec 5", etc'
  )
  .option(
    '-e, --editor-cmd <editor-cmd>',
    'Editor used to edit. Defaults to config.editor, $VISUAL, then $EDITOR',
    String
  )
  .option(
    '-r, --recent',
    'Edit the most recently modified file in a notebook (same as --last)'
  )
  .option(
    '-l, --last',
    'Edit the most last modified file in a notebook (same as --recent)'
  )
  .option(
    '--pwd',
    'Print the path to the notebook'
  )
  .arguments('<words...>')
  .action(function(cliWords) {
    words = cliWords;
  })
  .parse(process.argv);

core.handleRawInput(
  {
    editRecent: program.recent || program.last,
    pwd: program.pwd,
    configFile: program.configFile,
    date: program.date,
    editorCmd: program.editorCmd
  },
  words
);
