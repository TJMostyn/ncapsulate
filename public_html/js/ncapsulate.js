var GET_METHOD = "GET";
var POST_METHOD = "POST";

/***********************************************************************************
 * Application wide variables
 ***********************************************************************************/
var events = {
    ERROR: "ERROR_EVENT",
    INFO: "INFO_EVENT",
    RESOURCES_LOADED: "RESOURCES_LOADED",
    ANALYTICS_RESET: "ANALYTICS_RESET",
    SEARCH_FILTER_STARTED: "SEARCH_FILTER_STARTED",
    SUBMIT_NEW_SEARCH: "SUBMIT_NEW_SEARCH",
    SUBMIT_SEARCH: "SUBMIT_SEARCH",
    RESULTSET_COLLECTED: "RESULTSET_COLLECTED",
    RESULTSET_COMPLETED: "RESULTSET_COMPLETED",
    ANALYSIS_READY: "ANALYSIS_READY",
    SUMMARY_READY: "SUMMARY_READY",
    NODE_CLICKED: "NODE_CLICKED",
    CHART_CLICKED: "CHART_CLICKED",
    NODE_UNCLICKED: "NODE_UNCLICKED",
    POSTS_DISPLAY_READY: "POSTS_DISPLAY_READY",
    SEARCH_NAVIGATION_CLICKED: "SEARCH_NAVIGATION_CLICKED",
    SUBMIT_NAVIGATION_RETREAT: "SUBMIT_NAVIGATION_RETREAT",
    SENTIMENT_DATA_READY: "SENTIMENT_DATA_READY",
    VOLUME_DATA_READY: "VOLUME_DATA_READY",
    LOCATION_DATA_READY: "LOCATION_DATA_READY",
    PHOTO_DATA_READY: "PHOTO_DATA_READY",
    TAXONOMY_DATA_READY: "TAXONOMY_DATA_READY"
};

angular.module('ncapsulateApp', [
    'ngRoute', 'resourcesApp', 'utilitiesApp', 'authenticateApp', 'analyticsApp'
]);

/***********************************************************************************
 * Application navigation routing
 ***********************************************************************************/
angular.module('ncapsulateApp')
    .config(['$routeProvider', '$compileProvider', function($routeProvider) {
            
        $routeProvider.
        when('/', {
            templateUrl: 'views/search.html'
        }).
        when('/loading', {
            templateUrl: 'views/loading.html'
        }).
        when('/login', {
            templateUrl: 'views/login.html'
        }).
        when('/authenticated', {
            templateUrl: 'views/authenticated.html'
        }).
        when('/search', {
            templateUrl: 'views/search.html'
        }).
        when('/results', {
            templateUrl: 'views/results.html'
        }).
        otherwise({
            redirectTo: '/'
        });
    }])
    .run(function($rootScope, $location, AuthenticationMgr, Resources) {
        // Redirect to login if the user is not authenticated
        $rootScope.$on("$routeChangeStart", function(event, next, current) {
            if (Resources.getIsLoaded() === false) {
                if ($location.url() === "/authenticated") {
                    AuthenticationMgr.setIsAuthenticationAttempted(true);
                }
                $location.path( "/loading" );
            }
            else if (! AuthenticationMgr.isLoggedIn() && $location.url() !== "/authenticated") {
                //$location.path( "/login" );
            }
        });
    });

/***********************************************************************************
 * Controller set up
 ***********************************************************************************/
angular.module('ncapsulateApp').controller('NCapsulateController', 
    function($scope, $rootScope, $timeout, UserData) {
    
    var controllerInstance = this;
    
    // Check the browser supports local storage
    if (! UserData.isLocalStorageAvailable()) {
        alert("This application is not available because the browser you are " +
            "using is not supported");
        history.back();
    }

    $scope.$on(events.ERROR, function(event, error, message, showUserMessage) {
        this.displayError(error, message, showUserMessage);
    });

    $rootScope.$on(events.ERROR, function(event, error, message, showUserMessage) {
        controllerInstance.displayError(error, message, showUserMessage);
    });

    $scope.$on(events.INFO, function(event, message) {
        this.displayInfo(event, message);
    });

    $rootScope.$on(events.INFO, function(event, message) {
        controllerInstance.displayInfo(event, message);
    });
    
    this.displayError = function(error, message, showUserMessage) {
        
        // Alert in the console
        console.log(message);
        console.log(error);

        // Show the user the error message if requested
        if (showUserMessage) {
            $scope.errorDetails = message;
            $scope.errorClass = "fade-in";
            $timeout(function() {
                $scope.errorClass = "fade-out";
            }, 3000);
        }
    };
    
    this.displayInfo = function(event, message) {
        
        $scope.infoDetails = message;
        $scope.infoClass = "fade-in";
        $timeout(function() {
            $scope.infoClass = "fade-out";
        }, 3000);
    };
});

/***********************************************************************************
 * User search data class holds saved searches, preferences etc
 ***********************************************************************************/
angular.module('ncapsulateApp').service('UserData', function($window) {
    
    this._localStorage = $window.localStorage;  

    this.isLocalStorageAvailable = function() {
        return !(typeof($window.localStorage) === "undefined");
    };
    
    this.saveSearchResults = function(posts) {
        var searchResults = angular.fromJson(this._localStorage.searchResults);
        searchResults.push(posts);
        this._localStorage.searchResults = angular.toJson(searchResults);
    };
    
    this.retrieveResults = function(position) {
        var searchResults = angular.fromJson(this._localStorage.searchResults);
        searchResults = searchResults.slice(0, position + 1);
        this._localStorage.searchResults = angular.toJson(searchResults);
        
        return TweetLoad(searchResults[position]);
    };
    
    this.clearResults = function() {
        this._localStorage.searchResults = "[]";
    };
});