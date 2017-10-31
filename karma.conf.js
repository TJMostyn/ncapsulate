module.exports = function (config) {
    config.set({
        basePath: '.',
        
        exclude: [
        ],
        
        autoWatch: true,
        
        frameworks: [
            'jasmine',
            //'chai'
        ],
        
        browsers: [
            'Chrome'
        ],
        
        plugins: [
            'karma-jasmine',
            //'karma-chai',
            'karma-chrome-launcher'
        ],
        
        files: [           
            // paths loaded via module imports
            'test/libs/angular.js',
            'test/libs/angular-mocks.js',
            'public_html/js/libs/*.js',
            'test/libs/jasmine-html.min.js',
            'public_html/js/*.js',
            'test/controllers/*.js',
            'test/services/*.js',
            'test/factories/*.js',
            'test/classes/*.js'
        ]
    });
};
