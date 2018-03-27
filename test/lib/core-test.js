'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');
require('sinon-as-promised');

let core = require('../../lib/core');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function reset() {
  delete require.cache[
    require.resolve('../../lib/core')
  ];
  core = require('../../lib/core');
}

function proxyquireCore(proxies, keepBluebird) {
  if (!keepBluebird) {
    // Don't promisify anything, to permit stubbing.
    proxies.bluebird = { promisifyAll: function() {} };
  }
  core = proxyquire('../../lib/core', proxies);
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  t.end();
  reset();
}

function createaCliArgs(configPath, date, editorCmd) {
  return {
    configFile: configPath,
    date: date,
    editorCmd: editorCmd
  };
}

test('handleRawInput parses given date and calls next', function(t) {
  const path = 'path/to/config';
  const date = new Date('2016-03-05T20:00:00.000Z');
  const dateArg = 'yesterday';
  const parseDateStub = sinon.stub();
  parseDateStub.withArgs(dateArg).returns(date);
  const config = { config: 'much value' };
  const words = ['foo', 'bar'];

  const cliArgs = createaCliArgs(path, dateArg, null);
  const resolveConfigStub = sinon.stub();
  resolveConfigStub.withArgs(cliArgs).returns(config);

  proxyquireCore({
    'chrono-node': { parseDate: parseDateStub },
    './config': {
      resolveConfig: resolveConfigStub,
    }
  }, true);
  core.handleValidatedInput = sinon.stub();

  core.handleRawInput(cliArgs, words);
  t.deepEqual(core.handleValidatedInput.args[0], [config, date, words]);
  end(t);
});

test('handleRawInput gets now if no date given', function(t) {
  const path = 'path/to/config';
  const date = new Date('2015-03-05T20:00:00.000Z');
  const dateArg = null;
  const config = { config: 'much value' };
  const words = ['foo', 'bar'];

  const cliArgs = createaCliArgs(path, dateArg, null);
  const resolveConfigStub = sinon.stub();
  resolveConfigStub.withArgs(cliArgs).returns(config);

  proxyquireCore({
    './config': {
      resolveConfig: resolveConfigStub,
    }
  }, true);
  core.getConfig = sinon.stub();
  core.getConfig.withArgs(path).resolves(config);
  core.handleValidatedInput = sinon.stub();
  core.getNow = sinon.stub().returns(date);

  core.handleRawInput(cliArgs, words);
  t.deepEqual(core.handleValidatedInput.args[0], [config, date, words]);
  end(t);
});

test('handleRawInput calls fail and quit on err', function(t) {
  const expected = { err: 'trouble' };

  proxyquireCore({
    './config': {
      resolveConfig: sinon.stub().throws(expected)
    }
  }, true);

  const shouldThrow = function() {
    core.handleRawInput({});
  };

  t.throws(shouldThrow, expected);
  end(t);
});

test('handleValidatedInput opens editor with default notebook', function(t) {
  // no template or default title
  const notebook = {
    _name: 'lab-notebook',
    path: '/path/to/notebook',
  };
  const date = new Date('2016-03-05T20:00:00.000Z');
  const entryPath = '/path/to/notebook/2016/2016-03-05_lame-meeting.md';
  const words = ['lame', 'meeting'];
  const config = { editorCmd: 'vim -e' };

  const mkdirpStub = sinon.stub();
  proxyquireCore({
    'mkdirp': {
      sync: mkdirpStub
    }
  });

  const editStub = sinon.stub();
  core.editEntry = editStub;

  const getNotebookStub = sinon.stub();
  getNotebookStub.withArgs(config, words).returns(notebook);
  core.getNotebook = getNotebookStub;

  core.handleValidatedInput(config, date, words);
  t.deepEqual(editStub.args[0], [config.editorCmd, entryPath]);
  t.equal(mkdirpStub.callCount, 1);
  t.deepEqual(mkdirpStub.args[0], ['/path/to/notebook/2016']);
  end(t);
});

test('handleValidatedInput opens editor for specified notebook', function(t) {
  const notebook = {
    _name: 'journal',
    path: '/path/to/notebook',
    template: '<YYYY>_<title>.md',
  };
  const date = new Date('2016-03-05T20:00:00.000Z');
  const entryPath = '/path/to/notebook/2016_dear-diary.md';
  // The 0th specifies the name of the notebook.
  const words = ['journal', 'dear', 'diary'];
  const config = { editorCmd: 'vim -e' };

  const mkdirpStub = sinon.stub();
  proxyquireCore({
    'mkdirp': {
      sync: mkdirpStub
    }
  });

  const editStub = sinon.stub();
  core.editEntry = editStub;

  const getNotebookStub = sinon.stub();
  getNotebookStub.withArgs(config, words).returns(notebook);
  core.getNotebook = getNotebookStub;

  core.handleValidatedInput(config, date, words);
  t.deepEqual(editStub.args[0], [config.editorCmd, entryPath]);
  t.equal(mkdirpStub.callCount, 1);
  t.deepEqual(mkdirpStub.args[0], ['/path/to/notebook']);
  end(t);
});

test('handleValidatedInput opens editor for specified alias', function(t) {
  const notebook = {
    _name: 'journal',
    path: '/path/to/notebook',
    template: '<YYYY>_<title>.md',
    aliases: [ 'j', 'jrnl' ],
  };
  const date = new Date('2016-03-05T20:00:00.000Z');
  const entryPath = '/path/to/notebook/2016_dear-diary.md';
  // The 0th is an alias for the notebook
  const words = ['jrnl', 'dear', 'diary'];
  const config = { editorCmd: 'vim -e' };

  const mkdirpStub = sinon.stub();
  proxyquireCore({
    'mkdirp': {
      sync: mkdirpStub
    }
  });

  const editStub = sinon.stub();
  core.editEntry = editStub;

  const getNotebookStub = sinon.stub();
  getNotebookStub.withArgs(config, words).returns(notebook);
  core.getNotebook = getNotebookStub;

  core.handleValidatedInput(config, date, words);
  t.deepEqual(editStub.args[0], [config.editorCmd, entryPath]);
  t.equal(mkdirpStub.callCount, 1);
  t.deepEqual(mkdirpStub.args[0], ['/path/to/notebook']);
  end(t);
});

test('handleValidatedInput handles all defaults', function(t) {
  const notebook = {
    _name: 'lab-notebook',
    path: '/path',
  };
  const date = new Date('2016-03-05T20:00:00.000Z');
  // We expect a default of <YYYY>/<YYYY-MM-DD>_<title>.md.
  const entryPath = '/path/2016/2016-03-05_dear-diary.md';
  // Don't include a notebook name.
  const words = ['dear', 'diary'];
  const config = { editorCmd: 'vim -e' };

  const mkdirpStub = sinon.stub();
  proxyquireCore({
    'mkdirp': {
      sync: mkdirpStub
    }
  });

  const editStub = sinon.stub();
  core.editEntry = editStub;

  const getNotebookStub = sinon.stub();
  getNotebookStub.withArgs(config, words).returns(notebook);
  core.getNotebook = getNotebookStub;

  core.handleValidatedInput(config, date, words);
  t.deepEqual(editStub.args[0], [config.editorCmd, entryPath]);
  t.equal(mkdirpStub.callCount, 1);
  t.deepEqual(mkdirpStub.args[0], ['/path/2016']);
  end(t);
});

test('handleValidatedInput calls editLastModifiedFile', function(t) {
  const notebook = 'notebook';
  const config = { editRecent: true };
  const words = ['foo', 'bar'];

  const getNotebookStub = sinon.stub();
  getNotebookStub.withArgs(config, words).returns(notebook);
  const editLastStub = sinon.stub();
  const editEntryStub = sinon.stub();

  core.getNotebook = getNotebookStub;
  core.editLastModifiedFile = editLastStub;
  core.editEntry = editEntryStub;

  core.handleValidatedInput(config, null, words);
  
  t.deepEqual(editLastStub.args[0], [config, notebook]);
  t.equal(editEntryStub.callCount, 0);
  end(t);
});

test('handleValidatedInput handles pwd', function(t) {
  const notebook = 'notebook';
  const config = { pwd: true };
  const words = ['bar', 'baz'];

  const getNotebookStub = sinon.stub();
  getNotebookStub.withArgs(config, words).returns(notebook);

  const printNotebookPathStub = sinon.stub();
  const editEntryStub = sinon.stub();

  core.getNotebook = getNotebookStub;
  core.printNotebookPath = printNotebookPathStub;
  core.editEntry = editEntryStub;

  core.handleValidatedInput(config, null, words);

  t.deepEqual(printNotebookPathStub.args[0], [notebook]);
  t.equal(editEntryStub.callCount, 0);
  end(t);
});

test('editLastModifiedFile calls fail and rejects if error', function(t) {
  const expected = { err: 'trubs' };
  const getFileStub = sinon.stub().rejects(expected);

  proxyquireCore({ './util':
    { getLastModifiedFile: getFileStub }
  });

  core.editLastModifiedFile({}, {})
  .then(success => {
    t.fail(success);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expected);
    end(t);
  });
});

test('editLastModifiedFile calls editEntry with last file', function(t) {
  const notebook = {
    path: '/Users/cersei/cute-joff',
    template: 'foo.docx',
  };
  const config = { editorCmd: 'word' };  // Cersei seems like a Word user

  const entryPath = '/Users/cersei/cute-joff/ten-years-later-first-entry.docx';

  const getFileStub = sinon.stub();
  getFileStub.withArgs(notebook.path, ['.docx']).resolves(entryPath);
  const editEntryStub = sinon.stub();

  proxyquireCore({ './util':
    { getLastModifiedFile: getFileStub }
  });
  core.editEntry = editEntryStub;

  core.editLastModifiedFile(config, notebook)
  .then(() => {
    t.deepEqual(editEntryStub.args[0], [config.editorCmd, entryPath]);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('editLastModifiedFile does nothing if no files', function(t) {
  const getFileStub = sinon.stub().resolves(null);
  const editEntryStub = sinon.stub();
  const failAndQuitStub = sinon.stub();

  proxyquireCore({ './util':
    {
      getLastModifiedFile: getFileStub,
      failAndQuit: failAndQuitStub
    }
  });
  core.editEntry = editEntryStub;

  core.editLastModifiedFile({}, {})
  .then(() => {
    t.equal(editEntryStub.callCount, 0);
    t.deepEqual(failAndQuitStub.args[0], ['No files in notebook']);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });

});

test('editEntry calls spawn', function(t) {
  const spawnSpy = sinon.stub();
  proxyquireCore({
    'child_process': {
      spawn: spawnSpy
    }
  });

  const editorCmd = 'MacDown';
  const entryPath = '/path/to/file.md';

  core.editEntry(editorCmd, entryPath);
  t.deepEqual(
    spawnSpy.args[0],
    [editorCmd, [entryPath], { stdio: 'inherit' }]
  );
  end(t);
});

test('getNotebook gets named notebook', function(t) {
  const notebooks = {
    journal: { path: '/path/j' },
    notes: { path: '/path/n' }
  };
  const expected = notebooks.journal;

  const config = { notebooks: notebooks };
  core.getNotebooks = sinon.stub();
  core.getNotebooks.withArgs(config).returns(notebooks);

  const actual = core.getNotebook(config, ['journal']);
  t.deepEqual(actual, expected);
  end(t);
});

test('getNotebook gets default notebook', function(t) {
  const notebooks = {
    journal: { path: '/path/j' },
    notes: { path: '/path/n' },
    mostUsed: {
      path: '/path/m',
      default: true
    }
  };
  const expected = notebooks.mostUsed;
  const config = { notebooks: notebooks };
  core.getNotebooks = sinon.stub();
  core.getNotebooks.withArgs(config).returns(notebooks);

  const actualWithWords =
    core.getNotebook(config, ['what', 'a', 'great', 'day']);
  t.deepEqual(actualWithWords, expected);

  const actualNoWords = core.getNotebook(config, []);
  t.deepEqual(actualNoWords, expected);

  end(t);
});

test('getNotebook throws if no default', function(t) {
  const notebooks = {
    journal: { path: '/path/j' },
    notes: { path: '/path/n' }
  };

  const config = { notebooks: notebooks };
  core.getNotebooks = sinon.stub();
  core.getNotebooks.withArgs(config).returns(notebooks);
  const expected = new Error('Cannot find notebook. Check name or set default.');

  const shouldThrow = function() {
    core.getNotebook(config, []);
  };

  t.throws(shouldThrow, expected);
  end(t);
});

test('getEntryPath throws if no <title> in template', function(t) {
  const shouldThrow = function() {
    core.getEntryPath(new Date(), [], '/dir/', 'bad-template.md');
  };

  t.throws(shouldThrow, /Entry template must contain/);
  t.end();
});

test('getEntryPath handles complex parsing', function(t) {
  // TODO: These tests are machine-dependent when it comes to time zone. Going
  // to let this slide for now, but should be fixed.
  const date = new Date('2017-12-25T20:00:00.000Z');

  t.equal(
    core.getEntryPath(date, [], '/path/to/notebook',
      '<YYYY>/<YYYY-MM-DD>_<title>.md', 'daily'),
    '/path/to/notebook/2017/2017-12-25_daily.md'
  );

  t.equal(
    core.getEntryPath(date, ['cat', 'dog'], '/dir/', '<title>', 'foo'),
    '/dir/cat-dog'
  );

  t.equal(
    core.getEntryPath(date, ['cat', 'dog'], '/dir/', '<title>.txt', 'foo'),
    '/dir/cat-dog.txt'
  );

  t.equal(
    core.getEntryPath(date, ['cat', 'dog'], '/dir/',
      '<YYYY>/<MM>/<YYYY-MM-DD>_<title>.md', 'foo'),
    '/dir/2017/12/2017-12-25_cat-dog.md'
  );

  t.equal(
    core.getEntryPath(date, [], '/dir/foo/', '<YYYY>/<title>.md', 'every-day'),
    '/dir/foo/2017/every-day.md'
  );

  // And some weirder moment.js formatting.
  t.equal(
    core.getEntryPath(date, ['this', 'morning'], '/dir/bar/',
      '<dd>/<YYYY><MM><E> <title>.md', 'foo'),
    '/dir/bar/Mo/2017121 this-morning.md'
  );

  t.end();
});

test('getNotebooks resolves paths and adds aliases', function(t) {
  const config = {
    notebooks: {
      journal: {
        path: '~/path/to/journal',
        aliases: [ 'j', 'jrnl' ],
        otherVal: 'oh whoops',
        default: true
      },
      notes: {
        path: '/abs/path/to/notes'
      }
    }
  };

  const expectedJournal = {
    path: '/abs/path/to/journal',
    aliases: config.notebooks.journal.aliases,
    otherVal: config.notebooks.journal.otherVal,
    default: config.notebooks.journal.default,
    _name: 'journal'
  };
  const expectedNotes = {
    path: '/abs/path/to/notes',
    _name: 'notes'
  };

  const untildifyStub = sinon.stub();
  untildifyStub.withArgs(config.notebooks.journal.path)
    .returns(expectedJournal.path);
  untildifyStub.withArgs(config.notebooks.notes.path)
    .returns(expectedNotes.path);

  proxyquireCore({ 'untildify': untildifyStub });

  const expected = {
    journal: expectedJournal,
    j: expectedJournal,
    jrnl: expectedJournal,
    notes: expectedNotes
  };

  const actual = core.getNotebooks(config);

  t.deepEqual(actual, expected);
  end(t);
});

test('getFileSuffixForNotebook returns from template', function(t) {
  const notebook = {
    template: '<YYYY>_<title>.txt',
  };

  t.equal(core.getFileSuffixForNotebook(notebook), '.txt');
  end(t);
});

test('getFileSuffixForNotebook returns default', function(t) {
  t.equal(core.getFileSuffixForNotebook({}), '.md');
  end(t);
});
