#!/usr/bin/env node
'use strict';

var program = require('commander');
var wrt = require('./lib/wrt-core');

var words = [];
program
  .version(wrt.VERSION)
  .option(
    '-c, --config-file <config-file>',
    'Path to config file. Defaults to ~/.wrt.json',
    String,
    wrt.DEFAULT_CONFIG_PATH
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
  .arguments('<words...>')
  .action(function(cliWords) {
    words = cliWords;
  })
  .parse(process.argv);

wrt.handleRawInput(
  {
    configFile: program.configFile,
    date: program.date,
    editorCmd: program.editorCmd
  },
  words
);
