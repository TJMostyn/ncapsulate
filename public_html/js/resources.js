angular.module('resourcesApp', []);

/***********************************************************************************
 * Loading controller - gets all of the appropriate resources and alters the system
 * that it has finished and is ready for login/ authentication
 ***********************************************************************************/
angular.module('resourcesApp').controller('LoadingController', 
    function($scope, $http, $location, Resources, AuthenticationMgr) {
    
    var noResourcesLoaded = 0;
    var noResources = 6;
    
    // Load the properties file
    loadResource("properties.json", function (response) {
        Resources.setProperties(response);
    });
    
    // Load the stop words file
    loadResource("stopwords.json", function (response) {
        Resources.setStopwords(response.tokens);
    });
    
    // Get the poster shape coordinate
    loadResource("polygons/poster-icon.json", function (response) {
        Resources.setPosterIconPoints(response.points);
    });
    
    // Get the node shape coordinate
    loadResource("polygons/topic-icon.json", function (response) {
        Resources.setTopicIconPoints(response.points);
    });
    
    // Get the hashtag node shape coordinate
    loadResource("polygons/hashtag-icon.json", function (response) {
        Resources.setHashtagIconPoints(response.points);
    });
    
    // Get the exclude node shape coordinate
    loadResource("polygons/exclude-icon.json", function (response) {
        Resources.setExcludeIconPoints(response.points);
    });
    
    // Load the stop words file
    loadResource("sentiment.json", function (response) {
        Resources.setSentiment(response);
    });
    
    function loadResource(fileName, onSuccess) {
        var resourcesRequest = {
            url: "resources/" + fileName,
            dataType: "json",
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        };

        // Load the resources into a variable shared by all controllers
        $http(resourcesRequest).
        success(function (response) {
            onSuccess(response);
            noResourcesLoaded++;
            
            if (noResourcesLoaded >= noResources) {
                $scope.$emit(events.RESOURCES_LOADED);
            }
        }).
        error(function (error) {
            alert("Error loading resource file: resources/" + fileName + ": " + 
                error.error_description);
        });
    };
    
    $scope.$on(events.RESOURCES_LOADED, function(event) {
        
        // Sleep for n seconds to enjoy the loading screen...
        if (AuthenticationMgr.isAuthenticationAttempted()) {
            var now = new Date().getTime();
            while(new Date().getTime() < now + 2000) { /* do nothing */ }
        }
        
        Resources.setIsLoaded(true);
        if (AuthenticationMgr.isAuthenticationAttempted())
            $location.path( "/authenticated" );
        else
            $location.path( "/home" );
    });
});

/***********************************************************************************
 * Resources class holding properties/ model files etc
 ***********************************************************************************/
angular.module('resourcesApp').service('Resources', function() {
    
    this._properties = null;
    this._stopWords = null;
    this._posterIconPoints = null;
    this._topicIconPoints = null;
    this._hashtagIconPoints = null;
    this._excludeIconPoints = null;
    this._sentiment = null;
    this._isLoaded = false;
    
    this.setProperties = function(properties) {
        this._properties = properties;
    };
    
    this.getProperties = function() {
        return this._properties;
    };
    
    this.setStopwords = function(stopWords) {
        this._stopWords = stopWords;
    };
    
    this.getStopwords = function() {
        return this._stopWords;
    };
    
    this.setPosterIconPoints = function(posterIconPoints) {
        this._posterIconPoints = posterIconPoints;
    };
    
    this.getPosterIconPoints = function() {
        return this._posterIconPoints;
    };
    
    this.setTopicIconPoints = function(topicIconPoints) {
        this._topicIconPoints = topicIconPoints;
    };
    
    this.getTopicIconPoints = function() {
        return this._topicIconPoints;
    };
    
    this.setHashtagIconPoints = function(hashtagIconPoints) {
        this._hashtagIconPoints = hashtagIconPoints;
    };
    
    this.getHashtagIconPoints = function() {
        return this._hashtagIconPoints;
    };
    
    this.setExcludeIconPoints = function(excludeIconPoints) {
        this._excludeIconPoints = excludeIconPoints;
    };
    
    this.getExcludeIconPoints = function() {
        return this._excludeIconPoints;
    };
    
    this.setSentiment = function(sentiment) {
        this._sentiment = sentiment;
    };
    
    this.getSentiment = function() {
        return this._sentiment;
    };
    
    this.setIsLoaded = function(isLoaded) {
        this._isLoaded = isLoaded;
    };
    
    this.getIsLoaded = function() {
        return this._isLoaded;
    };
});