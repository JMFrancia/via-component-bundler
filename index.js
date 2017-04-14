#!/usr/bin/env node
console.log('Hello World');

var prompt = require('prompt');

var queries = {
  properties: {
    componentDir: {
      description: 'Directory location of your component',
      type: 'string',
      pattern: /^[^\\/?%*:|"<>\.]+$/gi,
      message: 'Invalid directory name, please try again',
      required: true
    }
    /*
    ,
    targetDir: {
      description: 'Target directory for output',
      type: 'string',
      pattern: /^[^\\/?%*:|"<>\.]+$/gi,
      message: 'Invalid directory name, please try again',
      required: true
    },
    packageName: {
      description: 'Name of your package',
      type: 'string',
      pattern: /^(?!\.)^(?!node_modules)([^@\s+%]+)/gi,
      message: 'Invalid package name, please try again',
      required: true
    },
    devName: {
      description: 'Your name',
      type: 'string',
      pattern: /(([a-z]+)\s*)/gi,
      message: 'Letters and spaces only, please',
      required: true
    },
    devEmail: {
      description: 'Your email',
      type: 'string',
      pattern: /[a-z0-9]+\@[a-z0-9]+\.([a-z]{3}|[a-z]{2)/gi,
      message: 'Invalid email, please try again',
      required: true
    },
    startingVersion: {
      description: 'Initial component version (semver)',
      type: 'string',
      pattern: /\d+\.\d+\.\d+/g,
      default: '0.1.0',
      message: 'Semver versioning requires 3 numbers separated by dots: 0.1.0',
      required: false
    },
    repo: {
      description: 'URL of the VSC Stash repo',
      type: 'string',
      required: false
    }
    */
  }
};

prompt.start();
prompt.get(queries, function(err, result) {
  activate(Object.assign({}, result));
});

function activate(inputs) {
  console.log(JSON.stringify(inputs, 2, null));
}
