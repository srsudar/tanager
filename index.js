#!/usr/bin/env node
'use strict';

var program = require('commander');
var wrt = require('./lib/wrt-core');

var words = null;
program
.version(wrt.VERSION)
.option('-c, --config-file <config-file>', 'Path to config file. Defaults to ~/.wrt.json', String, wrt.DEFAULT_CONFIG_PATH)
.option('-d, --date <date>', 'Date of the entry. Yesterday, dec5, "dec 5", etc')
.arguments('<words...>')
.action(function(cliWords) {
  words = cliWords;
})
.parse(process.argv);

wrt.getConfig(program.configFile)
.then(config => {
  console.log(config);
})
.catch(err => {
  console.error(err);
  process.exit(1);
});

console.log(program.configFile);
console.log(program.date);
console.log(words);
