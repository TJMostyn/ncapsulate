angular.module('authenticateApp', []);

/***********************************************************************************
 * Login controller. Attempts to log the user into Twitter and thereby grant
 * API access to the various resources
 ***********************************************************************************/
angular.module('authenticateApp').controller('LoginController', 
    function ($scope, $location, AuthenticationMgr, ResponseHelper, TwitterMgr) {
    
    // Check if the user has been sent back here after rejection by twitter
    var deniedParam = ResponseHelper.getParameterByName("denied", $location.url());
    if (deniedParam !== undefined && deniedParam !== null) {
        $scope.$emit(events.ERROR, {}, 
            "You cannot be logged in because you have chosen not to authorize the app", 
            true);
    }
    
    this.callTwitterOAuth = function callTwitterOAuth() {
        
        // Don't do this if already logged in....
        if (AuthenticationMgr.isLoggedIn()) {
            $location.path( "/home" );
            return;
        }
        
        TwitterMgr.obtainRequestToken(
            function(response) {
                var oauthToken = ResponseHelper.getParameterByName("oauth_token", response);
                if (oauthToken === undefined || oauthToken === null) {
                    $scope.$emit(
                        events.ERROR, {}, "Error obtaining oauth token from Twitter", true);
                }
                
                window.location = TwitterMgr.obtainAuthenticateUrl(oauthToken);
            },
            function(error) {
                $scope.$emit(events.ERROR, 
                    error, 
                    "Unable to authenticate with Twitter", 
                    true);
            });
    };
    
    this.logout = function logout() {
        AuthenticationMgr.logout();
        $location.path( "/login" );
    };
});

/***********************************************************************************
 * Authentication controller. Recieves the results from the Twitter api calls and
 * either stores the appropriate tokens, or tells the user of their failure
 ***********************************************************************************/
angular.module('authenticateApp').controller('AuthController', 
    function ($scope, $location, TwitterMgr, AuthenticationMgr, ResponseHelper) {

    var oauthToken = ResponseHelper.getParameterByName(
        "oauth_token", $location.absUrl());
    var oauthVerifier = ResponseHelper.getParameterByName(
        "oauth_verifier", $location.absUrl());

    // Check that the URL params are set, otherwise error
    if (oauthToken === undefined || oauthToken === null) {
        $location.path("/login");
        $scope.$emit(events.ERROR, {}, "Illegal authentication call", true);
        return;
    }
    
    // Now get the access token using this response
    TwitterMgr.obtainAccessToken(oauthToken, oauthVerifier, 
    
        // Success - set the token and secret for further use
        function(response) {
            var oauthToken = ResponseHelper.getParameterByName(
                "oauth_token", response);
            var oauthTokenSecret = ResponseHelper.getParameterByName(
                "oauth_token_secret", response);
            AuthenticationMgr.setAuthDetails(oauthToken, oauthTokenSecret);
        
            // Now redirect to the main home page
            $location.path("/home");
        }, 
        function(error) {
            $scope.$emit(events.ERROR, 
                error, 
                "Error getting access token from Twitter", 
                true);
        });
});

/***********************************************************************************
 * Authorization service to hold access tokens etc after login
 ***********************************************************************************/
angular.module('authenticateApp').service('AuthenticationMgr', function() {
    
    this._isLoggedIn = false;
    this._oauthToken = "";
    this._oauthTokenSecret = "";
    this._isAuthenticationAttempted = false;
    
    this.isLoggedIn = function() {
        return this._isLoggedIn;
    };
    
    this.setAuthDetails = function(oauthToken, oauthTokenSecret) {
        this._oauthToken = oauthToken;
        this._oauthTokenSecret = oauthTokenSecret;
        this._isLoggedIn = true;
    };
    
    this.getOAuthToken = function() {
        return this._oauthToken;
    };
    
    this.getOAuthTokenSecret = function() {
        return this._oauthTokenSecret;
    };

    this.logout = function() {
        this._isLoggedIn = false;
        this._oauthToken = "";
        this._oauthTokenSecret = "";
        this._isAuthenticationAttempted = false;
    };
    
    this.setIsAuthenticationAttempted = function(isAttempted) {
        this._isAuthenticationAttempted = isAttempted;
    }
    
    this.isAuthenticationAttempted = function() {
        return this._isAuthenticationAttempted;
    }
});

/***********************************************************************************
 * Class to handle interaction with Twitter
 ***********************************************************************************/
angular.module('authenticateApp').factory('TwitterMgr', 
    function($rootScope, $http, RequestHelper, ResponseHelper, AuthenticationMgr, Resources) {
    
    var _maxNumberPages = 0;
    var _noPagesCollected = 0;
    
    return {
        obtainRequestToken:function(onSuccess, onFailure) {
            var url_api = Resources.getProperties().API_OAUTH_URL_ROOT + "request_token";
            var url_proxy = Resources.getProperties().PROXY_OAUTH_URL_ROOT + "request_token";

            var authorizationParams = new Array();
            authorizationParams["oauth_callback"] = Resources.getProperties().OAUTH_API_CALLBACK;

            var authorizationHeader = generateAuthorizationHeader(
                url_api, 
                Resources.getProperties().APP_AUTH_TOKEN, 
                Resources.getProperties().APP_AUTH_TOKEN_SECRET, 
                authorizationParams, 
                POST_METHOD);
            var request = RequestHelper.getRequest(
                url_proxy, "", POST_METHOD, authorizationHeader);

            RequestHelper.makeRequest($http, request,
                function(response) {
                    onSuccess(response);
                },
                function(error) {
                    onFailure(error);
                }
            );   
        },
        
        obtainAuthenticateUrl:function(oauthToken) {
            return Resources.getProperties().API_OAUTH_URL_ROOT + "authenticate?oauth_token=" + oauthToken;
        },
        
        obtainAccessToken:function(oauthToken, oauthVerifier, onSuccess, onFailure) {
            
            var url_api = Resources.getProperties().API_OAUTH_URL_ROOT + "access_token";
            var url_proxy = Resources.getProperties().PROXY_OAUTH_URL_ROOT + "access_token";

            var authorizationParams = new Array();
            authorizationParams["oauth_verifier"] = oauthVerifier;
            
            var authorizationHeader = generateAuthorizationHeader(
                url_api, 
                oauthToken, 
                Resources.getProperties().APP_AUTH_TOKEN_SECRET, 
                authorizationParams, 
                POST_METHOD);
            var request = RequestHelper.getRequest(
                url_proxy, "oauth_verifier=" + oauthVerifier, POST_METHOD, authorizationHeader);

            RequestHelper.makeRequest($http, request,
                function(response) {
                    onSuccess(response);
                },
                function(error) {
                    onFailure(error);
                }
            );   
        },
        
        search:function(queryStack, maxNumberPages, onFailure) {
            
            _maxNumberPages = maxNumberPages;
            _noPagesCollected = 0;
            
            var urlParams = "?lang=en&count=100&result_type=mixed&q=";
            for (var i in queryStack) {
                urlParams += encodeURIComponent(queryStack[i]) + " ";
            }
            
            paginateThroughTweets(urlParams.trim(), onFailure);
        },
        
        getTrends:function(locationId, onSuccess, onFailure) {
            
            collectTrends(locationId, onSuccess, onFailure);
        },
        
        testSearch:function(urlParams, onFailure) {
            
            var iterationCounter = 0;
            var delayCounter = 0;
            for (var i = 0; i < 5; i++) {
                var testRequest = {
                    url: "test/search_response_" + (i + 1) + ".json",
                    dataType: "json",
                    method: "GET",
                    headers: {
                        "Accept": "application/json"
                    }
                };

                $http(testRequest).
                success(function (response) {
                    setTimeout(function() {
                        $rootScope.$broadcast(events.RESULTSET_COLLECTED, response['statuses'], ["mostyn"]);
                    
                        if (++iterationCounter === 5) {
                            $rootScope.$broadcast(events.RESULTSET_COMPLETED);
                        }
                    }, delayCounter++ * 1000);
                }).
                error(function (error) {
                    onFailure(error);
                });
            }
        }
    };
    
    function paginateThroughTweets(urlParams, onFailure) {
        
        collectTweets(urlParams, 
            function(response) {
                
                // Throw event that some results have been received
                $rootScope.$broadcast(events.RESULTSET_COLLECTED, response['statuses']);
                
                // Call the next page if appropriate
                var urlParamsNextPage = response['search_metadata']['next_results'];
                if (urlParamsNextPage !== undefined && urlParamsNextPage !== null &&
                    ++_noPagesCollected < _maxNumberPages) {
                    paginateThroughTweets(urlParamsNextPage);
                }
                else {
                    $rootScope.$broadcast(events.RESULTSET_COMPLETED);
                }
            },
            function(error) {
                onFailure(error);
            }
        );
    }
   
    function collectTweets(urlParams, onSuccess, onFailure) {

        var url_api = Resources.getProperties().API_SEARCH_URL_ROOT + urlParams;
        var url_proxy = Resources.getProperties().PROXY_SEARCH_URL_ROOT + urlParams;

        var authorizationHeader = generateAuthorizationHeader(
            url_api, 
            AuthenticationMgr.getOAuthToken(),  
            AuthenticationMgr.getOAuthTokenSecret(), 
            new Array(), 
            GET_METHOD);
        var request = RequestHelper.getRequest(
            url_proxy, "", GET_METHOD, authorizationHeader);

        RequestHelper.makeRequest($http, request,
            function(response) {
                onSuccess(response);
            },
            function(error) {
                onFailure(error);
            }
        );   
    }
    
    function collectTrends(locationId, onSuccess, onFailure) {
        
        var urlParams = "?id=" + locationId;
        var url_api = Resources.getProperties().API_TREND_URL_ROOT + urlParams;
        var url_proxy = Resources.getProperties().PROXY_TREND_URL_ROOT + urlParams;
        
        var authorizationHeader = generateAuthorizationHeader(
            url_api, 
            AuthenticationMgr.getOAuthToken(),  
            AuthenticationMgr.getOAuthTokenSecret(), 
            new Array(), 
            GET_METHOD);
        var request = RequestHelper.getRequest(
            url_proxy, "", GET_METHOD, authorizationHeader);

        RequestHelper.makeRequest($http, request,
            function(response) {
                onSuccess(response);
            },
            function(error) {
                onFailure(error);
            }
        );   
    }
        
    function generateAuthorizationHeader(
        url, oauthToken, oauthTokenSecret, additionalAuthParams, httpMethod) {

        var oauthNonce = generateNonce();
        var timestamp = Math.floor(Date.now() / 1000);

        // Set the standard, known authorization objects
        var basicAuthParams = new Array();
        basicAuthParams["oauth_consumer_key"] = Resources.getProperties().API_KEY;
        basicAuthParams["oauth_nonce"] = oauthNonce;
        basicAuthParams["oauth_signature_method"] = Resources.getProperties().OAUTH_SIGNATURE_METHOD;
        basicAuthParams["oauth_timestamp"] = timestamp;
        basicAuthParams["oauth_token"] = oauthToken;
        basicAuthParams["oauth_version"] = Resources.getProperties().API_VERSION;
        
        // Add any url params to the additionalAuthParams
        var urlParams = ResponseHelper.getParameterAsAssociativeArray(url);
        for (var key in urlParams) {
            additionalAuthParams[key] = urlParams[key];
        }
                
        // Add any aditional params and ensure they are correctly ordered
        var authorizationParams = mergeAssociativeArrays(
            basicAuthParams, additionalAuthParams);
        var sortedKeys = Object.keys(authorizationParams).sort();

        // Create the signature base string
        var authorizationParamsSigString = "";
        for (var key in sortedKeys) {
            authorizationParamsSigString += encodeURIComponent(sortedKeys[key]) + "=" + 
                encodeURIComponent(authorizationParams[sortedKeys[key]]) + "&";
        }
        authorizationParamsSigString = authorizationParamsSigString.slice(0, -1);
        var signatureBaseString = httpMethod + "&" + 
            encodeURIComponent(url.split('?')[0]) + "&" +
            encodeURIComponent(authorizationParamsSigString);

        // Create signing key
        var signingKey = encodeURIComponent(Resources.getProperties().API_KEY_SECRET) + "&" + 
            encodeURIComponent(oauthTokenSecret);
        var hmacObj = new jsSHA("SHA-1", "TEXT");
        hmacObj.setHMACKey(signingKey,"TEXT");
        hmacObj.update(signatureBaseString);
        var oauthSignature = encodeURIComponent(hmacObj.getHMAC("B64"));

        // Add this to the array of params to be set in the header
        authorizationParams["oauth_signature"] = oauthSignature;
        sortedKeys = Object.keys(authorizationParams).sort();

        // Now create the full Authorization HTTP header using standard params..
        var authorizationHeader = "OAuth ";
        for (var key in sortedKeys) {
            authorizationHeader += sortedKeys[key] + "=\"" + 
                (additionalAuthParams.hasOwnProperty(sortedKeys[key]) ?
                    encodeURIComponent(authorizationParams[sortedKeys[key]]) :
                    authorizationParams[sortedKeys[key]]) + "\",";
        }
        authorizationHeader = authorizationHeader.slice(0, -1);

        // Return this for use by the app
        return authorizationHeader;
    }

    // Internal fuction to generate unique nonce
    function generateNonce() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    }

    // Internal function to merge the arrays of params as simply as possible
    function mergeAssociativeArrays(array1, array2) {
        var newArray = new Array();
        for (var key in array1) {
            newArray[key] = array1[key];
        }
        for (var key in array2) {
            newArray[key] = array2[key];
        }
        return newArray;
    }
});