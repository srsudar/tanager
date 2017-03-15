'use strict';

var merge = require('merge');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var tape = require('tape');
require('sinon-as-promised');

var config = require('../../lib/config');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function reset() {
  delete require.cache[
    require.resolve('../../lib/config')
  ];
  config = require('../../lib/config');
}

function proxyquireConfig(proxies, keepBluebird) {
  if (!keepBluebird) {
    // Don't promisify anything, to permit stubbing.
    proxies.bluebird = { promisifyAll: function() {} };
  }
  config = proxyquire('../../lib/config', proxies);
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  t.end();
  reset();
}

function getValidConfig() {
  var cfg = {
    editorCmd: 'vim -e',
    notebooks: {
      journal: {
        path: '/path/to/jrnl'
      }
    }
  };
  return cfg;
}

tape('resolveConfig relies on default', function(t) {
  var cliArgs = {
    configFile: '/path/to/config/file',
    editorCmd: 'vim -e'
  };

  var defaultConfig = {
    defOnly: 'from default',
    fileRules: 'from default',
    cliRules: 'from default'
  };

  var fileConfig = {
    fileOnly: 'from file',
    fileRules: 'from file',
    cliRules: 'from file'
  };

  var cliConfig = {
    cliOnly: 'from cli',
    cliRules: 'from cli'
  };

  var expected = {
    defOnly: defaultConfig.defOnly,
    fileOnly: fileConfig.fileOnly,
    cliOnly: cliConfig.cliOnly,
    fileRules: fileConfig.fileRules,
    cliRules: cliConfig.cliRules
  };

  config.getDefaultConfig = sinon.stub().returns(defaultConfig);
  config.getFileConfig = sinon.stub().withArgs(cliArgs.configFile)
    .returns(fileConfig);
  config.getCliConfig = sinon.stub().withArgs(cliArgs).returns(cliConfig);

  config.validateConfig = sinon.stub();
  config.expandConfigPaths = sinon.stub();

  var actual = config.resolveConfig(cliArgs);
  t.deepEqual(actual, expected);
  t.deepEqual(config.validateConfig.args[0], [actual]);
  t.deepEqual(config.expandConfigPaths.args[0], [actual]);
  end(t);
});

tape('validateConfig does nothing if all well', function(t) {
  var cfg = getValidConfig();

  var failStub = sinon.stub();
  proxyquireConfig({
    './util': {
      failAndQuit: failStub
    }
  });

  config.validateConfig(cfg);
  t.equal(failStub.callCount, 0);
  end(t);
});

tape('validateConfig exits if invalid', function(t) {
  // Start with a valid config and delete things.
  var cfg = {
    editorCmd: 'vim -e',
    notebooks: {
      journal: {
        path: '/path/to/jrnl'
      }
    }
  };

  var failStub = sinon.stub();
  proxyquireConfig({
    './util': {
      failAndQuit: failStub
    }
  });

  // We'll use merge to copy things.
  var noEditor = merge(true, cfg);
  delete(noEditor.editorCmd);
  config.validateConfig(noEditor);
  t.deepEqual(
    failStub.args[0], 
    [new Error('Could not find editor. Try setting $VISUAL.')]
  );

  var noNotebooks = merge(true, cfg);
  delete(noNotebooks.notebooks);
  config.validateConfig(noEditor);
  t.deepEqual(
    failStub.args[1], 
    [new Error('No notebooks found. Set in .tanager.json')]
  );

  var missingPath = merge(true, cfg);
  delete(missingPath.notebooks.journal.path);
  config.validateConfig(missingPath);
  t.deepEqual(
    failStub.args[2], 
    [new Error('Notebook missing a path in .tanager.json, failing fast.')]
  );

  end(t);
});

tape('expandConfigPaths expands paths', function(t) {
  var cfg = {
    notebooks: {
      journal: {
        path: '~/a/b/c'
      },
      notes: {
        path: '/abs/notes'
      }
    }
  };

  var absJournalPath = '/abs/path/to/a/b/c';

  var untildifyStub = sinon.stub();
  untildifyStub.withArgs(cfg.notebooks.journal.path).returns(absJournalPath);
  untildifyStub.withArgs(cfg.notebooks.notes.path)
    .returns(cfg.notebooks.notes.path);
  proxyquireConfig({ 'untildify': untildifyStub });

  var expected = merge(true, cfg);
  expected.notebooks.journal.path = absJournalPath;
  // we modify cfg in place
  config.expandConfigPaths(cfg);
  t.deepEqual(cfg, expected);
  end(t);
});

tape('buildConfig respects nulls', function(t) {
  var expected = {};
  var actual = config.buildConfig(undefined);
  t.deepEqual(actual, expected);
  end(t);
});

tape('buildConfig returns expected', function(t) {
  var cmd = 'vim -e';
  var expected = { editorCmd: cmd };
  var actual = config.buildConfig(cmd);
  t.deepEqual(actual, expected);
  end(t);
});

tape('resolvePriority returns first truthy value', function(t) {
  var arr = ['foo', 'bar'];
  t.equal(config.resolvePriority(arr), arr[0]);

  arr = [null, undefined, 'vim -e'];
  t.equal(config.resolvePriority(arr), arr[2]);

  end(t);
});

tape('resolvePriority returns null if no truthy values', function(t) {
  t.equal(config.resolvePriority([null, undefined, false]), null);
  end(t);
});

tape('getEditorCmdFromEnv resolves and returns', function(t) {
  var resolvePriorityStub = sinon.stub().returns();
  config.resolvePriority = resolvePriorityStub;

  config.getEditorCmdFromEnv();
  t.equal(resolvePriorityStub.callCount, 1);
  t.deepEqual(
    resolvePriorityStub.args[0][0], 
    [process.env.VISUAL, process.env.EDITOR]
  );
  end(t);
});

tape('getFileConfig resolves path and returns contents', function(t) {
  var configPath = '~/path/to/config.json';
  var resolvedPath = '/abs/path';

  var expected = { expected: 'fileContents' };

  proxyquireConfig({
    'untildify': sinon.stub().withArgs(configPath).returns(resolvedPath),
    'jsonfile': {
      'readFileSync': sinon.stub().withArgs(resolvedPath).returns(expected)
    }
  });

  var actual = config.getFileConfig(configPath);
  t.deepEqual(actual, expected);
  end(t);
});

tape('getDefaultConfig returns defaults', function(t) {
  var defaultEditor = 'Marked2';
  config.getEditorCmdFromEnv = sinon.stub().returns(defaultEditor);
  var expected = { editorCmd: defaultEditor };
  var actual = config.getDefaultConfig();
  t.deepEqual(actual, expected);
  end(t);
});

tape('getCliConfig returns from cli', function(t) {
  var cliEditor = 'emacs';
  var expected = {
    editorCmd: cliEditor,
    editRecent: false
  };
  var actual = config.getCliConfig({ editorCmd: cliEditor });
  t.deepEqual(actual, expected);
  end(t);
});

tape('getCliConfig editRecent is false', function(t) {
  var expected = { editRecent: false };
  var actual = config.getCliConfig({});
  t.deepEqual(actual, expected);
  end(t);
});

tape('getCliConfig editRecent is true', function(t) {
  var expected = { editRecent: true };
  var actual = config.getCliConfig({ editRecent: true });
  t.deepEqual(actual, expected);
  end(t);
});
