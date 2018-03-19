'use strict';

var proxyquire = require('proxyquire');
var sinon = require('sinon');
var test = require('tape');
require('sinon-as-promised');

var util = require('../../lib/util');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function reset() {
  delete require.cache[
    require.resolve('../../lib/util')
  ];
  util = require('../../lib/util');
}

function proxyquireUtil(proxies) {
  util = proxyquire('../../lib/util', proxies);
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  t.end();
  reset();
}

test('getLastModifiedFile resolves null if no files', function(t) {
  var getFileStub = sinon.stub().resolves([]);
  util.getFilesInDirectory = getFileStub;
  util.getLastModifiedFile('', [])
  .then(actual => {
    t.equal(actual, null);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getLastModifiedFile rejects if a stat promise rejects', function(t) {
  var statStub = sinon.stub();
  var expected = { err: 'expected failure' };
  statStub.onCall(0).returns(Promise.resolve('foo'));
  statStub.onCall(1).returns(Promise.reject(expected));
  statStub.onCall(2).returns(Promise.resolve('bar'));

  var files = ['a', 'b', 'c'];
  var getFilesInDirectoryStub = sinon.stub().resolves(files);

  util.getFilesInDirectory = getFilesInDirectoryStub;
  util.statPromisified = statStub;

  util.getLastModifiedFile('', [])
  .then(success => {
    t.fail(success);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expected);
    end(t);
  });
});

test('getLastModifiedFile correctly filters based on mtime', function(t) {
  var dir = '/Users/jonsnow/emo-journal';
  var suffixes = ['.md', '.txt'];

  var files = ['foo.md', 'bar.md', 'cat.md'];
  // We want bar.md to be the most recent.
  var expected = files[1];
  // We can compare these using < >, so we'll use ints for simplicity here.
  var fooStats = {
    mtime: 100
  };
  var barStats = {
    mtime: 500
  };
  var catStats = {
    mtime: 250
  };

  var statStub = sinon.stub();
  statStub.withArgs(files[0]).returns(Promise.resolve(fooStats));
  statStub.withArgs(files[1]).returns(Promise.resolve(barStats));
  statStub.withArgs(files[2]).returns(Promise.resolve(catStats));

  util.getFilesInDirectory = sinon.stub().withArgs(dir, suffixes)
    .resolves(files);
  util.statPromisified = statStub;

  util.getLastModifiedFile(dir, suffixes)
  .then(actual => {
    t.equal(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getFilesInDirectory correct pattern for multiple suffix', function(t) {
  var dir = '/Users/tyrion/scheme-journal';
  var suffixes = ['.md', '.txt'];
  var globStub = sinon.stub().callsArgWith(2, null, []);
  proxyquireUtil({ 'glob': globStub });

  util.getFilesInDirectory(dir, suffixes)
  .then(() => {
    var globArgs = globStub.args[0];
    t.equal(globArgs[0], '**/*{.md,.txt}');
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getFilesInDirectory resolves all files', function(t) {
  // This will also handle the one suffix pattern case
  var dir = '/Users/tyrion/scheme-journal';
  var suffixes = ['.md'];
  var expected = ['foo.md', 'my-secret-journal.md'];
  var globStub = sinon.stub().callsArgWith(2, null, expected);
  proxyquireUtil({ 'glob': globStub });

  util.getFilesInDirectory(dir, suffixes)
  .then(actual => {
    t.equal(actual, expected);
    var globArgs = globStub.args[0];
    t.equal(globArgs[0], '**/*.md');
    t.deepEqual(globArgs[1], { cwd: dir, absolute: true });
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getFilesInDirectory rejects if error', function(t) {
  // This will also handle the one suffix pattern case
  var expected = { err: 'so trouble' };
  var globStub = sinon.stub().callsArgWith(2, expected, []);
  proxyquireUtil({ 'glob': globStub });

  util.getFilesInDirectory('', [])
  .then(success => {
    t.fail(success);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expected);
    end(t);
  });
});
