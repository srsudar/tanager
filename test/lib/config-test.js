'use strict';

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

tape('getEditorCmd resolves and returns', function(t) {
  var clArg = 'foo';
  var resolvePriorityStub = sinon.stub().returns(clArg);
  config.resolvePriority = resolvePriorityStub;

  var actual = config.getEditorCmd(clArg);
  t.equal(actual, clArg);
  t.equal(resolvePriorityStub.callCount, 1);
  t.equal(resolvePriorityStub.args[0][0].length, 3);
  t.equal(resolvePriorityStub.args[0][0][0], clArg);
  end(t);
});

tape('getEditorCmd calls quit if no editor', function(t) {
  var failAndQuitStub = sinon.stub();
  var resolvePriorityStub = sinon.stub().returns(null);

  proxyquireConfig({
    './util': {
      failAndQuit: failAndQuitStub
    }
  });
  config.resolvePriority = resolvePriorityStub;

  config.getEditorCmd(null);
  t.equal(failAndQuitStub.callCount, 1);
  end(t);
});

tape('getConfig resolves path and returns contents', function(t) {
  var configPath = '~/path/to/config.json';
  var resolvedPath = '/abs/path';

  var expected = { expected: 'fileContents' };

  proxyquireConfig({
    'untildify': sinon.stub().withArgs(configPath).returns(resolvedPath),
    'jsonfile': {
      'readFileAsync': sinon.stub().withArgs(resolvedPath).resolves(expected)
    }
  });

  config.getConfig(configPath)
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

  proxyquireConfig({
    'jsonfile': {
      'readFileAsync': sinon.stub().withArgs(configFile).rejects(expected)
    }
  });

  config.getConfig(configFile)
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});
