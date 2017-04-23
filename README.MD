# Viacom Component Bundler
Developed by Joe Francia (jordan.francia@viacom.com)

The purpose of the component bundler is to take an existing Angular2 component and generate an NPM-digestible directory that allows it to be easily uploaded to Viacom's Nexus-based private NPM repo and reused on other projects.

Warning: Via-Component-Bundler has only been tested on Mac/Linux based systems and is not guaranteed to work on Windows.

## Instructions

### Installation

1. Log in to the Viacom Nexus NPM repo
2. From your project folder, run the command:

npm install -g via-component-bundler

### Target Component Requirements

In order for a component (referred to as your 'target') to be bundled by via-component-bundler, it must adhere to certain requirements:

* The via-component-bundler is expecting all required files and sub-directories for the target component (including tests, styles, etc.) to exist within in a single directory.

* The via-component-bundler is expecting there to be exactly one NgModule file existing on the topmost level within the component directory, such as an index.ts or <component-name>.module.ts.

* If the component relies on other custom components, those custom components must be bundled and uploaded to Nexus before the target component. For instance, if you have a custom date-range-picker component which relies on a custom single-date-picker component, you must bundle and upload the single-date-picker component to the NPM repo, and then update the dependencies on your date-range-picker so that it is pulling the single-date-picker from NPM rather than searching for it locally.

* The exception to the above rule is if a custom component exists for NO OTHER purpose than supporting your target component, in which case it may be included as a sub-directory within your target component directory. Make certain that all internal references remain consistent - IE your target component knows where to find it.

* The via-component-bundler lists Angular2 and Typescript as peer-dependencies, since it is not configured to transpile JS. In other words, it's designed to be used for Angular2 / typescript files.

### Usage

#### Step 1: Bundle your component

From your console, type "via-bundle"

You will be prompted to input the following information:

* Directory location of your component
(The directory which contains your target component's files)

* Target directory for output
(The directory in which you would like your component-bundle to be generated)

* Name of your package
(The name of your package as it will be represented in the NPM repo)

* Your name
(The name of the package's developer / owner)

* Your email
(The email of the package's developer / owner)

* Starting version
(The initial version of this package to be published)

#### Step 2: Update package.json of your new bundle

Open the package.json file of your newly-generated directory and add any external libraries required for your component to work to your list of dependencies (including the libraries of other components that were uploaded onto the Viacom NPM repo).

#### Step 3: Check that your spec tests still work

All the spec files found within your component's directory will have automatically been moved to the /spec/ folder of your newly generated component directory. These tests will be run automatically upon attempting to publish your component, so it may be worth the time now to run them manually and make sure they still pass. In order to do so, you will need to run 'npm install' in order to install the jasmine & karma dev dependencies. If there are other libraries required to run your tests, be sure to add them to the package.json dev dependencies list before installing.

#### Step 4: Write a README

Your new directory will have a template README document for you to fill out. The categories included are just suggestions - feel free to add as much as you like.

#### (OPTIONAL) Step 5: Create a demo for your component

If you feel it would be helpful (as you feel so inclined), you're encouraged to create and include a small demo of your component in the /demo/ directory. By default, the /demo/ directory will be included in your stash repo for developers to reference, but not as part of the NPM package.

#### Step 6: Connect to the Viacom Shared Component stash repository and push to VSC

If you haven't already, create a new repo in Viacom's VSC Stash project, and attach it to your newly generated directory. Once you Git Push this directory to VSC, Bamboo will automatically run all tests (in the spec) it will automatically NPM Publish the package to the Viacom private repo using Bamboo.

#### Step 7: Test your NPM package

Once your tests have all run and passed, and your package has been published, it's highly recommended to test installing and importing your package as a user would, to make sure that everything is working as expected. In a blank or existing project, add your package as a dependency, and while logged into the Viacom NPM Nexus Repo, run npm install. Import the new package to your app and make sure that it works correctly.
