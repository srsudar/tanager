'use strict';

var path = require('path');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var tape = require('tape');
require('sinon-as-promised');

var wrt = require('../../lib/wrt-core');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function reset() {
  delete require.cache[
    require.resolve('../../lib/wrt-core')
  ];
  wrt = require('../../lib/wrt-core');
}

function proxyquireWrt(proxies, keepBluebird) {
  if (!keepBluebird) {
    // Don't promisify anything, to permit stubbing.
    proxies.bluebird = { promisifyAll: function() {} };
  }
  wrt = proxyquire('../../lib/wrt-core', proxies);
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  t.end();
  reset();
}

tape('handleRawInput parses given date and calls next', function(t) {
  var path = 'path/to/config';
  var date = new Date('2016-03-05T20:00:00.000Z');
  var dateArg = 'yesterday';
  var parseDateStub = sinon.stub().withArgs(dateArg).returns(date);
  var config = { config: 'much value' };
  var words = ['foo', 'bar'];

  proxyquireWrt({
    'chrono-node': { parseDate: parseDateStub }
  }, true);
  wrt.getConfig = sinon.stub().withArgs(path).resolves(config);
  wrt.handleValidatedInput = sinon.stub();

  wrt.handleRawInput(path, dateArg, words)
  .then(actual => {
    t.equal(actual, undefined);
    t.deepEqual(wrt.handleValidatedInput.args[0], [config, date, words]);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

tape('handleRawInput gets now if no date given', function(t) {
  var path = 'path/to/config';
  var date = new Date('2015-03-05T20:00:00.000Z');
  var dateArg = null;
  var config = { config: 'much value' };
  var words = ['foo', 'bar'];

  wrt.getConfig = sinon.stub().withArgs(path).resolves(config);
  wrt.handleValidatedInput = sinon.stub();
  wrt.getNow = sinon.stub().returns(date);

  wrt.handleRawInput(path, dateArg, words)
  .then(actual => {
    t.equal(actual, undefined);
    t.deepEqual(wrt.handleValidatedInput.args[0], [config, date, words]);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

tape('handleRawInput calls fail and quit on err', function(t) {
  var expected = { err: 'trouble' };

  wrt.getConfig = sinon.stub().rejects(expected);
  wrt.failAndQuit = sinon.stub();

  wrt.handleRawInput('path')
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    t.deepEqual(wrt.failAndQuit.args[0], [expected]);
    end(t);
  });
});

tape('getNotebook gets named notebook', function(t) {
  var notebooks = {
    journal: { path: '/path/j' },
    notes: { path: '/path/n' }
  };
  var expected = notebooks.journal;

  var config = { notebooks: notebooks };
  wrt.getNotebooks = sinon.stub().withArgs(config).returns(notebooks);

  var actual = wrt.getNotebook(config, ['journal']);
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
  wrt.getNotebooks = sinon.stub().withArgs(config).returns(notebooks);

  var actual = wrt.getNotebook(config, ['what', 'a', 'great', 'day']);
  t.deepEqual(actual, expected);

  actual = wrt.getNotebook(config, []);
  t.deepEqual(actual, expected);

  end(t);
});

tape('getNotebook throws if no default', function(t) {
  var notebooks = {
    journal: { path: '/path/j' },
    notes: { path: '/path/n' }
  };

  var config = { notebooks: notebooks };
  wrt.getNotebooks = sinon.stub().withArgs(config).returns(notebooks);
  var expected = new Error('Cannot find notebook. Check name or set default.');

  var shouldThrow = function() {
    wrt.getNotebook(config, []);
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
  
  var expected = path.join(
    notebook.path, '2016', '2016-03-05_meeting-with-vip.md'
  );

  var actual = wrt.getEntryPath(notebook, date, words);
  t.equal(actual, expected);
  end(t);
});

tape('getEntryName correct for no title', function(t) {
  var notebook = { path: '/path/to/notebook' };
  var date = new Date('2016-12-25T20:00:00.000Z');
  var words = [];
  
  var expected = path.join(
    notebook.path, '2016', '2016-12-25_daily.md'
  );

  var actual = wrt.getEntryPath(notebook, date, words);
  t.equal(actual, expected);
  end(t);
});

tape('getConfig resolves path and returns contents', function(t) {
  var configPath = '~/path/to/config.json';
  var resolvedPath = '/abs/path';

  var expected = { expected: 'fileContents' };

  proxyquireWrt({
    'untildify': sinon.stub().withArgs(configPath).returns(resolvedPath),
    'jsonfile': {
      'readFileAsync': sinon.stub().withArgs(resolvedPath).resolves(expected)
    }
  });

  wrt.getConfig(configPath)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

tape('getConfig rejects if file read rejects', function(t) {
  var configFile = '/abs/path/to/config';
  var expected = { err: 'trouble reading file' };

  proxyquireWrt({
    'jsonfile': {
      'readFileAsync': sinon.stub().withArgs(configFile).rejects(expected)
    }
  });

  wrt.getConfig(configFile)
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

tape('getNotebooks resolves paths and adds aliases', function(t) {
  var config = {
    notebooks: {
      journal: {
        path: '~/path/to/journal',
        aliases: [ 'j', 'jrnl' ]
      },
      notes: {
        path: '/abs/path/to/notes'
      }
    }
  };

  var expectedJournal = { path: '/abs/path/to/journal' };
  var expectedNotes = { path: '/abs/path/to/notes' };

  var untildifyStub = sinon.stub();
  untildifyStub.withArgs(config.notebooks.journal.path)
    .returns(expectedJournal.path);
  untildifyStub.withArgs(config.notebooks.notes.path)
    .returns(expectedNotes.path);

  proxyquireWrt({ 'untildify': untildifyStub });

  var expected = {
    journal: expectedJournal,
    j: expectedJournal,
    jrnl: expectedJournal,
    notes: expectedNotes
  };

  var actual = wrt.getNotebooks(config);

  t.deepEqual(actual, expected);
  end(t);
});
