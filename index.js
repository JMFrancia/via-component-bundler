#!/usr/bin/env node
console.log('Starting component bundler...');

//Imports
var prompt = require('prompt');
var shell = require('shelljs');
var fs = require('fs-extra');
var readline = require('readline');

//Check for debug mode
var flag = process.argv[2];
var debug = (flag == '-d' || flag == '-debug');

//Prompts for user input
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

//Automated user inputs for debugging
var debugQueries = {
    componentDir: './testComponent',
    targetDir: '.',
    packageName: 'test',
    devName: 'Joe Shmoe',
    devEmail: 'JShmoe@viacom.com',
    startingVersion: '0.1.0'
};

//Procedure activation
if (!debug) {
    prompt.start();
    prompt.get(queries, function(err, result) {
        activate(Object.assign({}, result));
    });
} else {
    activate(debugQueries);
}

/**
 * Activates the bundler procedure using given set of inputs
 * @param  {object} inputs Object of query options and their values
 */
function activate(inputs) {

    var templateDefs = {
      '<package-name>': inputs.packageName,
      '<package-version>': inputs.startingVersion,
      '<dev-name>': inputs.devName,
      '<dev-email>': inputs.devEmail
    };

    console.log('Creating new bundle directory at ' + inputs.targetDir + '/' + inputs.packageName + '...');

    //Target directories to create
    var mainDir = inputs.targetDir + '/' + inputs.packageName;
    var srcDir = mainDir + '/src';
    var testsDir = mainDir + '/tests';
    var compIndex = srcDir + '/index.ts';

    //Regex to match file types
    var specRegex = /.+\.spec\.ts$/i;
    var moduleRegex = /(.+\.module\.ts)|(index\.ts)/i;

    //Complete list of files being copied
    var fileNames = getFileNames(inputs.componentDir);

    //Step 1: Create directories ---------------
    var makeMainDir = makeDirectory(inputs.targetDir, inputs.packageName).catch(function(err) {
        handleError(err);
    });

    var makeSrcDir = makeMainDir.then(function() {
      return makeDirectory(mainDir, 'src');
    }).catch(function(err) {
        handleError(err);
    });

    var makeTestDir = makeMainDir.then(function() {
      return makeDirectory(mainDir, 'tests');
    }).catch(function(err) {
        handleError(err);
    });

    //Step 2: Copy component files ---------------
    Promise.all([makeSrcDir, makeTestDir]).then(function() {
      fileNames.forEach(function(fileName){
        var dest = specRegex.test(fileName) ? testsDir : srcDir;
        var fileLoc = inputs.componentDir + '/' + fileName;
        copyToNewFile(fileLoc, dest, fileName).catch(function(err) {
            handleError(err);
        });
        //Step 3: Create index files ---------------
        if(moduleRegex.test(fileName)){
          makeIndexFiles(fileName, fileLoc, compIndex, mainDir);
        }
      });
    });

    //Step 4: Generate package bundle files ---------------
    console.log('Creating bundle files...');
    //Create .npmIgnore, .gitIgnore, and typings file
    makeMainDir.then(function(){
      copyToNewFile('./baseFiles/npmIgnore', mainDir, '.npmIgnore').catch(function(err) {
          handleError(err);
      });
      copyToNewFile('./baseFiles/index.d.ts', mainDir, 'index.d.ts').catch(function(err) {
          handleError(err);
      });
      copyToNewFile('./baseFiles/gitignore', mainDir, '.gitignore').catch(function(err) {
          handleError(err);
      });
    });

    //Create README
    var createReadMe = makeMainDir.then(function() {
      return copyToNewFile('./baseFiles/README.md', mainDir, 'README.md').catch(function(err) {
        handleError(err);
      });
    });
    createReadMe.then(function(targetFile) {
      fillOutBaseFile(targetFile, templateDefs).catch(function(err) {
          handleError(err);
      });
    });

    //Create Package.json
    var createPackageJson = makeMainDir.then(function() {
      return copyToNewFile('./baseFiles/package.json', mainDir, 'package.json').catch(function(err) {
          handleError(err);
      });
    });
    createPackageJson.then(function(packageFile){
      fillOutBaseFile(packageFile, templateDefs).catch(function(err) {
          handleError(err);
      })
    });
}

/**
 * Takes a component's module file as input and uses it to generate index files for export
 * @param  {string} file    The directory address of the module file
 * @param  {string} fileLoc The target directory which will hold the component files in the package
 */
function makeIndexFiles(moduleFile, fileLoc, compIndex, mainDir){
  var append = 'export * from \'./' + moduleFile+ '\';\n';
  var newIndex;

  fs.appendFile(compIndex, append, function(err) {
      if (err) {
          var errMsg = 'Error appending "' + append + '" to file' + compIndex + ': ' + err;
          handleError(errMsg);
      }
  });

  var copyPackageIndexFile = copyToNewFile('./baseFiles/packageIndex.js', mainDir, 'index.js').catch(function(err) {
      handleError(err);
  });

  var getPackageExports = copyPackageIndexFile.then(function(index) {
    newIndex = index;
    return getExports(fileLoc);
  }).catch(function(err) {
      handleError(err);
  });

  var addPackageExports = getPackageExports.then(function(moduleExports) {
    moduleExports.forEach(function(exp) {
        var exportLine = 'exports.' + exp + ' = require(\'' + moduleFile + '\').' + exp + ';\n';
        fs.appendFile(newIndex, exportLine, function(err) {
            if (err) {
                var errMsg = 'Error appending "' + append + '" to moduleFile' + newIndex + ': ' + err
                handleError(errMsg);
            }
        });
    });
  }).catch(function(err) {
      handleError(err);
  });
}

/**
 * Asynchronously retrieves all exports from a module file
 * @param  {string} moduleFile The directory address of the module file
 * @return {Promise<Array<string>>} A promise resolving to an array of export names
 */
function getExports(moduleFile) {
    var matchPatterns = [
        /export class (.*?)\s+{/i, //case: "Export class <export> {}"
        /export {\s*(.*?)\s*}/i, //case: "Export {<export>, <export>*} from '...'"
        /export\s+([^{]*?)\s+from/i //case: "Export <export> from '...'"
    ];
    return new Promise(function(resolve, reject) {
        var result = [];
        var lineReader = readline.createInterface({
            input: fs.createReadStream(moduleFile)
        });
        lineReader.on('line', function(line) {
            matchPatterns.forEach(function(pattern) {
                if (pattern.test(line)) {
                    var match = pattern.exec(line)[1];
                    if (/,/.test(match)) {
                        var allMatches = match.replace(/\s/g, '').split(',');
                        result = result.concat(allMatches);
                    } else {
                        result.push(match);
                    }
                }
            });
        });
        lineReader.on('error', function(err) {
            var errMsg = 'Error using linereader for file ' + moduleFile + ': ' + err;
            console.error(errMsg);
            reject(errMsg);
        });
        lineReader.on('close', function() {
            resolve(result);
        });
    });
}

/**
 * Asynchronously creates a new directory
 * @param  {string} location The target containing directory of the new directory
 * @param  {string} name     The name of the new directory
 * @return {Promise<string>} A promise resolving to the new directory location
 */
function makeDirectory(location, name) {
    return new Promise(function(resolve, reject) {
        var target = location + '/' + name;
        fs.mkdir(target, function(err) {
            if (err && err.code == 'EEXIST') {
                var errMsg = 'Error: ' + target + ' already exists, please choose another target directory';
                console.error(errMsg);
                reject(errMsg);
            }
            resolve(target);
        });
    });
}

/**
 * Asynchronously copies a file from one location to another
 * @param  {string} sourceFile  The directory address of the source file
 * @param  {string} targetDir   The target directory
 * @param  {string} newFileName The new file name
 * @return {Promise<string>}    A promise resolving to the directory address of the new file
 */
function copyToNewFile(sourceFile, targetDir, newFileName) {
    return new Promise(function(resolve, reject) {
        var targetFile = targetDir + '/' + newFileName;
        var errorMsg = 'Error copying ' + sourceFile + ' to ' + targetDir + newFileName + ': ';
        fs.copy(sourceFile, targetFile, function(err) {
            if (err) {
                console.error(errorMsg + err);
                reject(errorMsg + err);
            }
            resolve(targetFile);
        });
    });
}

/**
 * Asynchronously returns true if a given file contains a string
 * @param  {string} file  The directory address of the file
 * @param  {string} query The string being tested
 * @return {Promise<bool>} A promise that resolves to the result
 */
function fileContainsString(file, query) {
    return new Promise(function(resolve, reject) {
        fs.readFile(file, 'utf8', function(err, data) {
            if (err) {
                var errMsg = 'Error reading ' + baseFile + ': ' + err;
                console.error(errMsg);
                reject(errMsg);
            }
            resolve(data.includes(query));
        });
    });
}

/**
 * Asynchronously takes a files and makes string replacements based on given dictionary object
 * @param  {string} baseFile     The directory location of the "base" file to be filled out
 * @param  {object} templateDefs An object where keys are strings to replace and values are string replacements
 * @return {Promise<string>}     A promise that resolves to the baseFile argument when complete
 */
function fillOutBaseFile(baseFile, templateDefs) {
    return new Promise(function(resolve, reject) {
        fs.readFile(baseFile, 'utf8', function(err, data) {
            if (err) {
                var errMsg = 'Error reading ' + baseFile + ': ' + err;
                console.error(errMsg);
                reject(errMsg);
            }
            Object.keys(templateDefs).forEach(function(def) {
                data = data.split(def).join(templateDefs[def]);
            });
            fs.writeFile(baseFile, data, function(err) {
                if (err) {
                    var errMsg = 'Error writing ' + baseFile + ': ' + err;
                    console.error(errMsg);
                    reject(errMsg);
                }
            });
            resolve(baseFile);
        });
    });
}

/**
 * Writes a new file to directory location with given content
 * @param  {string} location Target directory
 * @param  {string} name     New file name
 * @param  {string} content  New file content
 * @return {string}          New file directory address
 */
function writeFile(location, name, content) {
    var target = location + '/' + name;
    fs.writeFile(target, content, function(err) {
        if (err) {
            console.error('Error: ' + err);
            process.exit();
        }
    });
    return target;
}

/**
 * Retrieves a list of file names from the given directory
 * @param  {string} dir name of directory
 * @return {Array<string>}     list of file names
 */
function getFileNames(dir) {
    return fs.readdirSync(dir);
}

/**
 * Generic error handler
 * @param  {string} err error message
 */
function handleError(err) {
    if (err) {
        console.error('Error: ' + err);
        console.error('Exiting...');
        process.exit();
    }
}
