'use strict';

const merge = require('merge');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');
require('sinon-as-promised');

let config = require('../../lib/config');

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
  const cfg = {
    editorCmd: 'vim -e',
    notebooks: {
      journal: {
        path: '/path/to/jrnl'
      }
    }
  };
  return cfg;
}

test('resolveConfig relies on default', function(t) {
  const cliArgs = {
    configFile: '/path/to/config/file',
    editorCmd: 'vim -e'
  };

  const defaultConfig = {
    defOnly: 'from default',
    fileRules: 'from default',
    cliRules: 'from default',
    template: 'default template',
    defaultTitle: 'default title',
  };

  const fileConfig = {
    fileOnly: 'from file',
    fileRules: 'from file',
    cliRules: 'from file',
    template: 'template from file',
  };

  const cliConfig = {
    cliOnly: 'from cli',
    cliRules: 'from cli'
  };

  const expected = {
    defOnly: defaultConfig.defOnly,
    fileOnly: fileConfig.fileOnly,
    cliOnly: cliConfig.cliOnly,
    fileRules: fileConfig.fileRules,
    cliRules: cliConfig.cliRules,
    template: fileConfig.template,
    defaultTitle: defaultConfig.defaultTitle,
  };

  config.getDefaultConfig = sinon.stub().returns(defaultConfig);
  config.getFileConfig = sinon.stub().withArgs(cliArgs.configFile)
    .returns(fileConfig);
  config.getCliConfig = sinon.stub().withArgs(cliArgs).returns(cliConfig);

  config.validateConfig = sinon.stub();
  config.expandConfigPaths = sinon.stub();

  const actual = config.resolveConfig(cliArgs);
  t.deepEqual(actual, expected);
  t.deepEqual(config.validateConfig.args[0], [actual]);
  t.deepEqual(config.expandConfigPaths.args[0], [actual]);
  end(t);
});

test('validateConfig does nothing if all well', function(t) {
  const cfg = getValidConfig();

  const failStub = sinon.stub();
  proxyquireConfig({
    './util': {
      failAndQuit: failStub
    }
  });

  config.validateConfig(cfg);
  t.equal(failStub.callCount, 0);
  end(t);
});

test('validateConfig exits if invalid', function(t) {
  // Start with a valid config and delete things.
  const cfg = {
    editorCmd: 'vim -e',
    notebooks: {
      journal: {
        path: '/path/to/jrnl'
      }
    }
  };

  const failStub = sinon.stub();
  proxyquireConfig({
    './util': {
      failAndQuit: failStub
    }
  });

  // We'll use merge to copy things.
  const noEditor = merge(true, cfg);
  delete(noEditor.editorCmd);
  config.validateConfig(noEditor);
  t.deepEqual(
    failStub.args[0], 
    [new Error('Could not find editor. Try setting $VISUAL.')]
  );

  const noNotebooks = merge(true, cfg);
  delete(noNotebooks.notebooks);
  config.validateConfig(noEditor);
  t.deepEqual(
    failStub.args[1], 
    [new Error('No notebooks found. Set in .tanager.json')]
  );

  const missingPath = merge(true, cfg);
  delete(missingPath.notebooks.journal.path);
  config.validateConfig(missingPath);
  t.deepEqual(
    failStub.args[2], 
    [new Error('Notebook missing a path in .tanager.json, failing fast.')]
  );

  end(t);
});

test('expandConfigPaths expands paths', function(t) {
  const cfg = {
    notebooks: {
      journal: {
        path: '~/a/b/c'
      },
      notes: {
        path: '/abs/notes'
      }
    }
  };

  const absJournalPath = '/abs/path/to/a/b/c';

  const untildifyStub = sinon.stub();
  untildifyStub.withArgs(cfg.notebooks.journal.path).returns(absJournalPath);
  untildifyStub.withArgs(cfg.notebooks.notes.path)
    .returns(cfg.notebooks.notes.path);
  proxyquireConfig({ 'untildify': untildifyStub });

  const expected = merge(true, cfg);
  expected.notebooks.journal.path = absJournalPath;
  // we modify cfg in place
  config.expandConfigPaths(cfg);
  t.deepEqual(cfg, expected);
  end(t);
});

test('buildConfig respects missing args', function(t) {
  const expected = {};
  const actual = config.buildConfig(undefined);
  t.deepEqual(actual, expected);
  end(t);
});

test('buildConfig returns expected', function(t) {
  const cmd = 'vim -e';
  const expected = { editorCmd: cmd };
  const actual = config.buildConfig(cmd);
  t.deepEqual(actual, expected);
  end(t);
});

test('resolvePriority returns first truthy value', function(t) {
  const firstTruthy = ['foo', 'bar'];
  t.equal(config.resolvePriority(firstTruthy), firstTruthy[0]);

  const firstFalsey = [null, undefined, 'vim -e'];
  t.equal(config.resolvePriority(firstFalsey), firstFalsey[2]);

  end(t);
});

test('resolvePriority returns null if no truthy values', function(t) {
  t.equal(config.resolvePriority([null, undefined, false]), null);
  end(t);
});

test('getEditorCmdFromEnv resolves and returns', function(t) {
  const resolvePriorityStub = sinon.stub().returns();
  config.resolvePriority = resolvePriorityStub;

  config.getEditorCmdFromEnv();
  t.equal(resolvePriorityStub.callCount, 1);
  t.deepEqual(
    resolvePriorityStub.args[0][0], 
    [process.env.VISUAL, process.env.EDITOR]
  );
  end(t);
});

test('getFileConfig resolves path and returns contents', function(t) {
  const configPath = '~/path/to/config.json';
  const resolvedPath = '/abs/path';

  const expected = { expected: 'fileContents' };

  const untildifyStub = sinon.stub();
  untildifyStub.withArgs(configPath).returns(resolvedPath);
  const readFileSyncStub = sinon.stub();
  readFileSyncStub.withArgs(resolvedPath).returns(expected);

  proxyquireConfig({
    'untildify': untildifyStub,
    'jsonfile': {
      'readFileSync': readFileSyncStub,
    }
  });

  const actual = config.getFileConfig(configPath);
  t.deepEqual(actual, expected);
  end(t);
});

test('getDefaultConfig returns defaults', function(t) {
  const defaultEditor = 'Marked2';
  config.getEditorCmdFromEnv = sinon.stub().returns(defaultEditor);
  const expected = {
    editorCmd: defaultEditor,
  };
  const actual = config.getDefaultConfig();
  t.deepEqual(actual, expected);
  end(t);
});

test('getCliConfig handles custom params', function(t) {
  const cliEditor = 'emacs';
  const expected = {
    editorCmd: cliEditor,
    editRecent: true,
    pwd: true,
  };
  const actual = config.getCliConfig({
    editorCmd: cliEditor,
    editRecent: true,
    pwd: true,
  });
  t.deepEqual(actual, expected);
  end(t);
});

test('getCliConfig handles defaults', function(t) {
  const expected = {
    editRecent: false,
    pwd: false,
  };
  const actual = config.getCliConfig({});
  t.deepEqual(actual, expected);
  end(t);
});
