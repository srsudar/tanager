'use strict';

var path = require('path');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var tape = require('tape');
require('sinon-as-promised');

var core = require('../../lib/core');

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

tape('handleRawInput parses given date and calls next', function(t) {
  var path = 'path/to/config';
  var date = new Date('2016-03-05T20:00:00.000Z');
  var dateArg = 'yesterday';
  var parseDateStub = sinon.stub().withArgs(dateArg).returns(date);
  var config = { config: 'much value' };
  var words = ['foo', 'bar'];

  var cliArgs = createaCliArgs(path, date, null);

  proxyquireCore({
    'chrono-node': { parseDate: parseDateStub },
    './config': {
      resolveConfig: sinon.stub().withArgs(cliArgs).returns(config)
    }
  }, true);
  core.handleValidatedInput = sinon.stub();

  core.handleRawInput(cliArgs, words);
  t.deepEqual(core.handleValidatedInput.args[0], [config, date, words]);
  end(t);
});

tape('handleRawInput gets now if no date given', function(t) {
  var path = 'path/to/config';
  var date = new Date('2015-03-05T20:00:00.000Z');
  var dateArg = null;
  var config = { config: 'much value' };
  var words = ['foo', 'bar'];

  var cliArgs = createaCliArgs(path, dateArg, null);

  proxyquireCore({
    './config': {
      resolveConfig: sinon.stub().withArgs(cliArgs).returns(config)
    }
  }, true);
  core.getConfig = sinon.stub().withArgs(path).resolves(config);
  core.handleValidatedInput = sinon.stub();
  core.getNow = sinon.stub().returns(date);

  core.handleRawInput(cliArgs, words);
  t.deepEqual(core.handleValidatedInput.args[0], [config, date, words]);
  end(t);
});

tape('handleRawInput calls fail and quit on err', function(t) {
  var expected = { err: 'trouble' };

  proxyquireCore({
    './config': {
      resolveConfig: sinon.stub().throws(expected)
    }
  }, true);

  var shouldThrow = function() {
    core.handleRawInput({});
  };

  t.throws(shouldThrow, expected);
  end(t);
});

tape('handleValidatedInput opens editor', function(t) {
  var notebook = { path: '/path/to/notebook' };
  var entryPath = path.join(
    notebook.path, '2016', '2016-03-05_lame-meeting.md'
  );
  var words = ['lame', 'meeting'];
  var config = { editorCmd: 'vim -e' };
  var date = new Date();

  var editStub = sinon.stub();
  core.editEntry = editStub;

  core.getNotebook = sinon.stub().withArgs(config, words).returns(notebook);
  core.getEntryPath = sinon.stub().withArgs(notebook, date, words)
    .returns(entryPath);

  core.handleValidatedInput(config, date, words);
  t.deepEqual(editStub.args[0], [config.editorCmd, entryPath]);
  t.equal(core.getNotebook.callCount, 1);
  t.equal(core.getEntryPath.callCount, 1);
  end(t);
});

tape('handleValidatedInput calls editLastModifiedFile', function(t) {
  var notebook = 'notebook';
  var config = { editRecent: true };
  var words = ['foo', 'bar'];

  var getNotebookStub = sinon.stub().withArgs(config, words).returns(notebook);
  var editLastStub = sinon.stub();
  var editEntryStub = sinon.stub();

  core.getNotebook = getNotebookStub;
  core.editLastModifiedFile = editLastStub;
  core.editEntry = editEntryStub;

  core.handleValidatedInput(config, null, words);
  
  t.deepEqual(editLastStub.args[0], [config, notebook]);
  t.equal(editEntryStub.callCount, 0);
  end(t);
});

tape('handleValidatedInput handles pwd', function(t) {
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

tape('editLastModifiedFile calls fail and rejects if error', function(t) {
  var expected = { err: 'trubs' };
  var getFileStub = sinon.stub().rejects(expected);

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

tape('editLastModifiedFile calls editEntry with last file', function(t) {
  var notebook = { path: '/Users/cersei/cute-joff' };
  var config = { editorCmd: 'word' };  // Cersei seems like a Word user

  var entryPath = '/Users/cersei/cute-joff/ten-years-later-first-entry.md';

  var getFileStub = sinon.stub().withArgs(notebook.path, ['.md'])
    .resolves(entryPath);
  var editEntryStub = sinon.stub();

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

tape('editLastModifiedFile does nothing if no files', function(t) {
  var getFileStub = sinon.stub().resolves(null);
  var editEntryStub = sinon.stub();
  var failAndQuitStub = sinon.stub();

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

tape('editEntry calls spawn', function(t) {
  var spawnSpy = sinon.stub();
  proxyquireCore({
    'child_process': {
      spawn: spawnSpy
    }
  });

  var editorCmd = 'MacDown';
  var entryPath = '/path/to/file.md';

  core.editEntry(editorCmd, entryPath);
  t.deepEqual(
    spawnSpy.args[0],
    [editorCmd, [entryPath], { stdio: 'inherit' }]
  );
  end(t);
});

tape('getNotebook gets named notebook', function(t) {
  var notebooks = {
    journal: { path: '/path/j' },
    notes: { path: '/path/n' }
  };
  var expected = notebooks.journal;

  var config = { notebooks: notebooks };
  core.getNotebooks = sinon.stub().withArgs(config).returns(notebooks);

  var actual = core.getNotebook(config, ['journal']);
  t.deepEqual(actual, expected);
  end(t);
});

tape('getNotebook gets default notebook', function(t) {
  var notebooks = {
    journal: { path: '/path/j' },
    notes: { path: '/path/n' },
    mostUsed: {
      path: '/path/m',
      default: true
    }
  };
  var expected = notebooks.mostUsed;
  var config = { notebooks: notebooks };
  core.getNotebooks = sinon.stub().withArgs(config).returns(notebooks);

  var actual = core.getNotebook(config, ['what', 'a', 'great', 'day']);
  t.deepEqual(actual, expected);

  actual = core.getNotebook(config, []);
  t.deepEqual(actual, expected);

  end(t);
});

tape('getNotebook throws if no default', function(t) {
  var notebooks = {
    journal: { path: '/path/j' },
    notes: { path: '/path/n' }
  };

  var config = { notebooks: notebooks };
  core.getNotebooks = sinon.stub().withArgs(config).returns(notebooks);
  var expected = new Error('Cannot find notebook. Check name or set default.');

  var shouldThrow = function() {
    core.getNotebook(config, []);
  };

  t.throws(shouldThrow, expected);
  end(t);
});

tape('getEntryPath correct when given title', function(t) {
  var notebook = { path: '/path/to/notebook' };
  // TODO: These tests are machine-dependent when it comes to time zone. Going
  // to let this slide for now, but should be fixed.
  var date = new Date('2016-03-05T20:00:00.000Z');
  var words = ['meeting', 'with', 'vip'];

  var mkdirpStub = sinon.stub();
  proxyquireCore({
    'mkdirp': {
      sync: mkdirpStub
    }
  });
  
  var expected = path.join(
    notebook.path, '2016', '2016-03-05_meeting-with-vip.md'
  );

  var actual = core.getEntryPath(notebook, date, words);
  t.equal(actual, expected);
  t.deepEqual(mkdirpStub.args[0], [path.join(notebook.path, '2016')]);
  end(t);
});

tape('getEntryPath correct for no title and default notebook', function(t) {
  var notebook = { path: '/path/to/notebook' };
  var date = new Date('2016-12-25T20:00:00.000Z');
  var words = [];
  
  proxyquireCore({
    'mkdirp': {
      sync: sinon.stub()
    }
  });

  var expected = path.join(
    notebook.path, '2016', '2016-12-25_daily.md'
  );

  var actual = core.getEntryPath(notebook, date, words);
  t.equal(actual, expected);
  end(t);
});

tape('getEntryTitleWords correct for default notebook, no title', function(t) {
  var notebook = {
    _name: 'journal',
    default: true
  };
  var words = [];

  var expected = core.DEFAULT_NAME_NO_TITLE;
  var actual = core.getEntryTitleWords(notebook, words);

  t.equal(actual, expected);
  end(t);
});

tape('getEntryTitleWords correct for default notebook, title in config',
    function(t) {
  var notebook = {
    _name: 'journal',
    default: true,
    defaultTitle: 'title-son'
  };
  var words = [];

  var expected = notebook.defaultTitle;
  var actual = core.getEntryTitleWords(notebook, words);

  t.equal(actual, expected);
  end(t);
});

tape('getEntryTitleWords correct for default notebook set title', function(t) {
  var notebook = {
    _name: 'journal',
    default: true
  };
  var words = ['meeting', 'with', 'tyrion'];

  var expected = 'meeting-with-tyrion';
  var actual = core.getEntryTitleWords(notebook, words);

  t.equal(actual, expected);
  end(t);
});

tape('getEntryTitleWords correct for custom notebook, no title', function(t) {
  var notebook = {
    _name: 'notes',
    default: false
  };
  var words = [];

  var expected = core.DEFAULT_NAME_NO_TITLE;
  var actual = core.getEntryTitleWords(notebook, words);

  t.equal(actual, expected);
  end(t);
});

tape('getEntryTitleWords correct for custom notebook set title', function(t) {
  var notebook = {
    _name: 'journal',
    default: false
  };
  var words = ['notes', 'on', 'winterfell'];

  var expected = 'notes-on-winterfell';
  var actual = core.getEntryTitleWords(notebook, words);

  t.equal(actual, expected);
  end(t);
});

tape('getNotebooks resolves paths and adds aliases', function(t) {
  var config = {
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

  var expectedJournal = {
    path: '/abs/path/to/journal',
    aliases: config.notebooks.journal.aliases,
    otherVal: config.notebooks.journal.otherVal,
    default: config.notebooks.journal.default,
    _name: 'journal'
  };
  var expectedNotes = {
    path: '/abs/path/to/notes',
    _name: 'notes'
  };

  var untildifyStub = sinon.stub();
  untildifyStub.withArgs(config.notebooks.journal.path)
    .returns(expectedJournal.path);
  untildifyStub.withArgs(config.notebooks.notes.path)
    .returns(expectedNotes.path);

  proxyquireCore({ 'untildify': untildifyStub });

  var expected = {
    journal: expectedJournal,
    j: expectedJournal,
    jrnl: expectedJournal,
    notes: expectedNotes
  };

  var actual = core.getNotebooks(config);

  t.deepEqual(actual, expected);
  end(t);
});
