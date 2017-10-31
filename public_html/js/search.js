/***********************************************************************************
 * Search controller - responsible for allowing users to submit new/ saves searches
 ***********************************************************************************/
angular.module('ncapsulateApp').controller('SearchController', function (
    $scope, $location, $timeout, TwitterMgr, Resources) {
    
    $scope.queryStack = [];
    $scope.trends = ["Loading trends..."];
    $scope.showLoading = false;
    $scope.collectionPercentage = 0;
    this.query = "";
    
    this.selectNavigation = function selectNavigation(queryElement) {
        
        for (var i = $scope.queryStack.length - 1; i >= 0; i--) {
            if ($scope.queryStack[i] === queryElement) break;
            $scope.queryStack.pop();
        }
        
        $scope.$broadcast(events.SEARCH_NAVIGATION_CLICKED, $scope.queryStack.length - 1);
    };
    
    this.submitSearch = function submitSearch() {
        if (this.query.length <= 0) return;
        submitNewSearch(this.query);
    };
    
    this.submitTrendSearch = function submitTrendSearch(trend) {
        submitNewSearch(trend);
    };
    
    this.loadTwitterTrends = function() {
        var userLocationId = Resources.getProperties().DEFAULT_TREND_LOCATION_ID;
        TwitterMgr.getTrends(
            userLocationId,
            function(response) {
                $scope.trends = [];
                var trends = response[0].trends;
                for (var i = 0; i < 10 && i < trends.length; i++) {
                    $scope.trends.push(trends[i].name);
                }
            },
            function(error) {
                console.log(error);
            }
        );
    };
    
    $scope.$on(events.SUBMIT_SEARCH, function(event, query) {
        
        $scope.queryStack.push(parseQuery(query));
        performSearch();
    });
    
    $scope.$on(events.RESULTSET_COLLECTED, function(event) {
        $timeout(function() { 
            $scope.collectionPercentage += 100 / Resources.getProperties().MAXIMUM_TWEET_PAGE_COLLECTION; 
        }, 0);
    });
    
    $scope.$on(events.RESULTSET_COMPLETED, function(event) {
        $scope.showLoading = false;
    });
    
    function submitNewSearch(query) {
        
        if ($location.path() !== "/results") {
            $location.path("/results");
        }
        
        $scope.queryStack = [];
        $scope.queryStack.push(parseQuery(query.toLowerCase()));
        $scope.$broadcast(events.SUBMIT_NEW_SEARCH);
        $scope.$broadcast(events.SEARCH_FILTER_STARTED);
        
        $timeout(function() {
            performSearch();
        }, 0);
    }
    
    function performSearch() {
        
        $scope.collectionPercentage = 0;
        $scope.showLoading = true;
        $scope.$broadcast(events.ANALYTICS_RESET, $scope.queryStack);
        
        var searchFunction = (Resources.getProperties().TESTING_MODE) ? 
            TwitterMgr.testSearch : TwitterMgr.search;
        searchFunction($scope.queryStack, 
            Resources.getProperties().MAXIMUM_TWEET_PAGE_COLLECTION,
            function() {
                // Currently do nothing...
                $scope.$broadcast(events.RESULTSET_COMPLETED);
            },
            function(error) {
                // Need to look here for a 429 - rate limited. What info can we give the user?
                // Rate is 180 every 15 minutes
                console.log(error);
            }
        );
    }
    
    function parseQuery(query) {
        if (query.indexOf(" ") !== -1) {
            //query = "\"" + query.replace("\"") + "\"";
            query = query.replace("\"");
        }
        return query;
    }
});