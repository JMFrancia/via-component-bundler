#!/usr/bin/env node
console.log('Starting component bundler...');

var prompt = require('prompt');
var shell = require('shelljs');
var fs = require('fs-extra');
var readline = require('readline');

var flag = process.argv[2];

var debug = (flag == '-d' || flag == '-debug');

var queries = {
  properties: {
    componentDir: {
      description: 'Directory location of your component',
      type: 'string',
      pattern: /^[^\\/?%*:|"<>\.]+$/gi,
      message: 'Invalid directory name, please try again',
      required: true
    },
    targetDir: {
      description: 'Target directory for output',
      type: 'string',
      pattern: /^[^\\/?%*:|"<>]+$/gi,
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
    }
  }
};

var debugQueries = {
  componentDir: './testComponent',
  targetDir: '.',
  packageName: 'test',
  devName: 'Joe Shmoe',
  devEmail: 'JShmoe@viacom.com',
  startingVersion: '0.1.0'
};

if(!debug){
  prompt.start();
  prompt.get(queries, function(err, result) {
    activate(Object.assign({}, result));
  });
} else {
  activate(debugQueries);
}

function handleError(err){
  if(err){
    console.error('Error: ' + err);
    console.error('Exiting...');
    process.exit();
  }
}

var templateDefs;

function activate(inputs) {

  templateDefs = {
    readme: {
      '<package-name>':inputs.packageName,
      '<user-name>':inputs.devName,
      '<dev-email>':inputs.devEmail
    },
    package: {
      '<package-name>':inputs.packageName,
      '<package-version>':inputs.startingVersion,
      '<dev-name>':inputs.devName,
      '<dev-email>':inputs.devEmail
    }
  };

  console.log('Creating new bundle directory at ' + inputs.targetDir + '/' + inputs.packageName + '...');

  var mainDir = inputs.targetDir + '/' + inputs.packageName;
  var srcDir = mainDir + '/src';
  var testsDir = mainDir + '/tests';
  makeDirectory(inputs.targetDir, inputs.packageName).then(function() {
    makeDirectory(mainDir, 'src').then(function(){
      makeDirectory(mainDir, 'tests').catch(function(err){
        handleError(err);
      });
    }).then(function() {
        //Do this once /src directory created
        copyToNewFile('./baseFiles/componentIndex.js', srcDir, 'index.ts').catch(function(err){handleError(err);}).then(function(){
          console.log('Copying component files...');
          var compIndex = srcDir + '/index.ts';
          var specRegex = /.+\.spec\.ts$/i;
          var moduleRegex = /.+\.module\.ts/i;
          getFileNames(inputs.componentDir).forEach(function(file){
            var dest = specRegex.test(file) ? testsDir : srcDir;
            var fileLoc = inputs.componentDir + '/' + file;
            copyToNewFile(fileLoc, dest, file).catch(function(err){handleError(err);});
            if(moduleRegex.test(file)){
              //For component Index
              var append = 'export * from \'./' + file + '\';\n';
              fs.appendFile(compIndex, append, function(err){
                if(err){
                  var errMsg = 'Error appending "' + append + '" to file ' + compIndex + ': ' + err;
                  handleError(errMsg);
                }
              });
              //For package index
              copyToNewFile('./baseFiles/packageIndex.js', mainDir, 'index.js').then(function(newIndex){
                getExports(fileLoc).then(function(moduleExports){
                  moduleExports.forEach(function(exp){
                    var exportLine = 'exports.' + exp + ' = require(\'' + file + '\').' + exp + ';\n';
                    fs.appendFile(newIndex, exportLine, function(err){
                      if(err){
                        var errMsg = 'Error appending "' + append + '" to file ' + newIndex + ': ' + err
                        handleError(errMsg);
                      }
                    });
                  });
                }).catch(function(err){handleError(err);});
              }).catch(function(err){handleError(err);});
            }
          });
        });
    }).catch(function(err){handleError(err);});
    console.log('Creating bundle files...');
    copyToNewFile('./baseFiles/npmIgnore', mainDir, '.npmIgnore').catch(function(err){handleError(err);});
    copyToNewFile('./baseFiles/index.d.ts', mainDir, 'index.d.ts').catch(function(err){handleError(err);});
    copyToNewFile('./baseFiles/README.md', mainDir, 'README.md').catch(function(err){handleError(err);}).then(
      function(targetFile) {
        fillOutBaseFile(targetFile, templateDefs.readme).catch(function(err){handleError(err);});
      }
    );
    copyToNewFile('./baseFiles/gitignore', mainDir, '.gitignore').catch(function(err){handleError(err);});
    copyToNewFile('./baseFiles/package.json', mainDir, 'package.json').catch(function(err){handleError(err);}).then(function(targetFile) {
        fillOutBaseFile(targetFile, templateDefs.package).catch(function(err){handleError(err);});
    });
  }).catch(function(err){handleError(err);});
}

function testGetExports(){
  getExports('../via-date-picker-ts/src/via-datepicker.module.ts');
  getExports('../via-date-range-picker/src/via-daterange.module.ts');
}

function getExports(moduleFile){
  var matchPatterns = [
    /export class (.*?)\s+{/i,     //case: "Export class <export> {}"
    /export {\s*(.*?)\s*}/i,       //case: "Export {<export>, <export>*} from '...'"
    /export\s+([^{]*?)\s+from/i    //case: "Export <export> from '...'"
  ];
  return new Promise(function(resolve, reject){
    var result = [];
    var lineReader = readline.createInterface({
      input: fs.createReadStream(moduleFile)
    });
    lineReader.on('line', function(line){
      matchPatterns.forEach(function(pattern){
        if(pattern.test(line)){
          var match = pattern.exec(line)[1];
          if(/,/.test(match)){
            var allMatches = match.replace(/\s/g, '').split(',');
            result = result.concat(allMatches);
          } else {
            result.push(match);
          }
        }
      });
    //  if(result){console.log('Inside result: ' + result);}
    });
    lineReader.on('error', function(err){
      var errMsg = 'Error using linereader for file ' + moduleFile + ': ' + err;
      console.error(errMsg);
      reject(errMsg);
    });
    lineReader.on('close', function(){
      resolve(result);
    });
  });
}


function makeDirectory(location, name){
  return new Promise(function(resolve, reject){
    var target = location + '/' + name;
    fs.mkdir(target, function(err){
      if(err && err.code == 'EEXIST'){
        var errMsg = 'Error: ' + target + ' already exists, please choose another target directory';
        console.error(errMsg);
        reject(errMsg);
      }
      resolve(target);
    });
  });
}

function copyToNewFile(sourceFile, targetDir, newFileName){
  return new Promise(function(resolve, reject){
    var targetFile = targetDir + '/' + newFileName;
    var errorMsg = 'Error copying ' + sourceFile + ' to ' + targetDir + newFileName + ': ';
    fs.copy(sourceFile, targetFile, function(err){
      if(err){
        console.error(errorMsg + err);
        reject(errorMsg + err);
      }
      resolve(targetFile);
    });
  });
}


function fileContainsString(file, query){
  return new Promise(function(resolve, reject){
    fs.readFile(file, 'utf8', function(err, data){
      if(err){
        var errMsg = 'Error reading ' + baseFile + ': ' + err;
        console.error(errMsg);
        reject(errMsg);
      }
      return data.includes(query);
    });
  });
}

function fillOutBaseFile(baseFile, templateDefs){
  return new Promise(function(resolve, reject){
    fs.readFile(baseFile, 'utf8', function(err, data){
      if(err){
        var errMsg = 'Error reading ' + baseFile + ': ' + err;
        console.error(errMsg);
        reject(errMsg);
      }
      Object.keys(templateDefs).forEach(function(def){
        data = data.replace(def, templateDefs[def]);
      });
      fs.writeFile(baseFile, data, function(err){
        if(err){
          var errMsg = 'Error writing ' + baseFile + ': ' + err;
          console.error(errMsg);
          reject(errMsg);
        }
      });
      resolve(baseFile);
    });
  });
}

function writeFile(location, name, content){
  var target = location + '/' + name;
  fs.writeFile(target, content, function(err){
    if(err) {
      console.error('Error: ' + err);
      process.exit();
    }
  });
  return target;
}

//sync
function getFileNames(dir){
  return fs.readdirSync(dir);
}
