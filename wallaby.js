module.exports = function (wallaby) {
  return {
    files: [
      'lib/*.js',
      'index.js',
      'test/*'
    ],

    tests: [
      'test/*.js'
    ],
    testFramework: 'mocha',
    delays: {
      edit: 500,
      run: 150
  },

  env: {
    // use 'node' type to use node.js or io.js
    type: 'node',

    // if runner property is not set, then wallaby.js embedded node/io.js version is used
    // you can specifically set the node version by specifying 'node' (or any other command)
    // that resolves your default node version, or just specify the path
    // to your node installation, like

    // runner: 'node'
    // or
    // runner: 'path to the desired node version'

    // params: {
    //   // node flags
    //   runner: '--harmony --harmony_arrow_functions',
    //   // env vars
    //   env: 'PARAM1=true;PARAM2=false'
    // }
  }

  };
};
