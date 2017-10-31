angular.module('analyticsApp', ['chart.js']);

/***********************************************************************************
 * Analytics controller - this is responsible for submitting searches to Twitter 
 * using the data for analysis/ creating graphs
 ***********************************************************************************/
angular.module('analyticsApp').controller('AnalyticsController', function AnalyticsController(
    $scope, AnalyticsMgr, Resources, UserData) {

    var controllerInstance = this;
    $scope.taxonomies = Resources.getProperties().TAXONOMIES;
    $scope.posts = [];
    $scope.hidePosts = true;
    $scope.tweetPanelClass = "tweet-container-side";

    $scope.$on(events.ANALYTICS_RESET, function(event, query) {
        AnalyticsMgr.resetAnalytics(query);
    });
    
    $scope.$on(events.SUBMIT_NEW_SEARCH, function(event) {
        UserData.clearResults();
    });
    
    $scope.$on(events.RESULTSET_COLLECTED, function(event, statuses) {
        AnalyticsMgr.registerResultSet(statuses);
    });
    
    $scope.$on(events.RESULTSET_COMPLETED, function(event) {
        
        // Now the search collection is complete, save the results
        UserData.saveSearchResults(AnalyticsMgr.getPosts());
        
        // Calculate corpus wide statistics
        AnalyticsMgr.performCorpusCalculations();
        
        // Process/ display the results
        AnalyticsMgr.processResults(false);
    });
    
    $scope.$on(events.NODE_CLICKED, function(event, posts) {
        controllerInstance.displayPosts(posts);
    });
    
    $scope.$on(events.CHART_CLICKED, function(event, posts) {
        controllerInstance.displayPosts(posts);
    });
    
    $scope.$on(events.NODE_UNCLICKED, function(event, posts) {
        controllerInstance.clearPosts();
    });
    
    $scope.$on(events.POSTS_DISPLAY_READY, function(event, posts) {
        controllerInstance.displayPosts(posts);
        $scope.$emit(events.INFO, "No summary available: too few tweets");
    });
    
    $scope.$on(events.SEARCH_FILTER_STARTED, function(event) {
        controllerInstance.clearPosts();
    });
    
    $scope.$on(events.SEARCH_NAVIGATION_CLICKED, function(event, position) {
        AnalyticsMgr.breadcrumbNavigation(position);
    });
    
    $scope.$on(events.SUBMIT_NAVIGATION_RETREAT, function(event, position) {
        
        var posts = UserData.retrieveResults(position);
        AnalyticsMgr.setPosts(posts);
        controllerInstance.processResults();
    });
    
    this.processResults = function() {
        $scope.$evalAsync(function() { 
            AnalyticsMgr.processResults(true); 
        });
    };
    
    this.taxonomySelected = function() {
        var selectedTaxonomy = $scope.selectedTaxonomy;
        if (selectedTaxonomy === undefined) {
            selectedTaxonomy = $scope.taxonomies[0];
        }
        AnalyticsMgr.analyseTaxonomy(selectedTaxonomy);
    };
    
    this.displayPosts = function(posts) {
        $scope.$evalAsync(function() { $scope.posts = posts; });
        $scope.hidePosts = false;
    };
    
    this.clearPosts = function() {
        $scope.$evalAsync(function() { $scope.posts = []; });
        $scope.hidePosts = true;
    };
});

/***********************************************************************************
 * Simple filter to display the post date in the correct format
 ***********************************************************************************/
angular.module('analyticsApp').filter("postDateFilter", function() {
    return function(dateString){
        return dateString.substring(0, 19);
    };
});

/***********************************************************************************
 * Massively overcomplicated error image fall back because Angular is a spaz
 ***********************************************************************************/
angular.module('analyticsApp').directive('fallbackSrc', function () {
    var fallbackSrc = {
        link: function postLink(scope, iElement, iAttrs) {
            iElement.bind('error', function() {
                angular.element(this).attr("src", iAttrs.fallbackSrc);
            });
        }
    };
    return fallbackSrc;
});

/***********************************************************************************
 * Central point of entry for all posts for analysis. This class creates an intermediary
 * object to save work, and then gives to all the registered analysis factories
 ***********************************************************************************/
angular.module('analyticsApp').service('AnalyticsMgr', function(
    TextUtils, SentimentInsight, PostByDayInsight, LocationInsight, PhotoInsight, 
    SummaryInsight, TaxonomyInsight) {

    // Holds the posts for the current analysis
    this._posts = new Array();
    this._currentQuery = [];
    
    // Reset this model for new input    
    this.resetAnalytics = function(query) {
        this._posts = new Array();
        this._currentQuery = query;
    };
    
    this.registerResultSet = function(statuses) {
    
        for (var i in statuses) {
            // Create tokens
            var tokens = TextUtils.tokenize(statuses[i].text);
            var cleanTokens = TextUtils.removeStopwords(tokens);
            
            // Extract hashtags into a simple array
            var hashTags = new Array();
            for (var j in statuses[i].entities.hashtags) {
                hashTags.push("#" + statuses[i].entities.hashtags[j].text);
            }
            
            // Extract user handles into a simple array
            var userHandles = new Array();
            for (var j in statuses[i].entities.user_mentions) {
                userHandles.push(statuses[i].entities.user_mentions[j].screen_name);
            }
            
            // Extract photos
            var photos = new Array();
            if (statuses[i].entities.media !== undefined) {
                for (var j = 0; j < statuses[i].entities.media.length; j++) {
                    if (statuses[i].entities.media[j].type === 'photo') {
                        photos.push(statuses[i].entities.media[j].media_url);
                    }
                }
            }
           
            this._posts.push(new Tweet(
                statuses[i].user.screen_name,
                statuses[i].created_at,
                statuses[i].text, 
                cleanTokens,
                hashTags, 
                userHandles, 
                statuses[i].retweet_count,
                statuses[i].user.followers_count,
                statuses[i].user.location,
                statuses[i].user.profile_image_url,
                photos));
        }
    };
    
    this.performCorpusCalculations = function() {
            
        // Generate background statistics for the corpus
        var termFrequencies = [];
        var nGramFrequencies = [];
        var totalFrequency = 0;
        for (var i = 0; i < this._posts.length; i++) {
            
            var sentences = TextUtils.tokenizeToSentence(this._posts[i].getOriginalText());
            if (sentences === null) continue;
            for (var j = 0; j < sentences.length; j++) {
                
                var tokens = TextUtils.tokenize(sentences[j]);
                if (tokens === null) continue;
                for (var k = 0; k < tokens.length; k++) {
                    
                    var token = tokens[k].toLowerCase();
                    if (! TextUtils.isDictionaryWord(token)) continue;
                    if (! termFrequencies.hasOwnProperty(token)) {
                        termFrequencies[token] = 0;
                    }
                    termFrequencies[token]++;
                    totalFrequency++;

                    // Get the counts for the bi-grams
                    if (k + 1 < tokens.length) {
                        if (TextUtils.isDictionaryWord(tokens[k + 1].toLowerCase())) {
                            var nGram = tokens[k].toLowerCase() + " " + tokens[k + 1].toLowerCase();
                            if (! nGramFrequencies.hasOwnProperty(nGram)) {
                                nGramFrequencies[nGram] = 0;
                            }
                            nGramFrequencies[nGram]++;
                        }
                    }
                }
            }
        }
            
        for (var i = 0; i < this._posts.length; i++) {
            
            var sentences = TextUtils.tokenizeToSentence(this._posts[i].getOriginalText());
            if (sentences === null) continue;
            for (var j = 0; j < sentences.length; j++) {
                
                var tokens = TextUtils.tokenize(sentences[j]);
                if (tokens === null) continue;
                var phrases = [];
                for (var k = 0; k < tokens.length; k++) {
                    if (k + 1 < tokens.length) {

                        if (! TextUtils.isDictionaryWord(tokens[k])) continue;
                        if (! TextUtils.isDictionaryWord(tokens[k + 1])) continue;

                        var termA = tokens[k].toLowerCase();
                        var termB = tokens[k + 1].toLowerCase();
                        var freqWordA = termFrequencies[termA];
                        var freqWordB = termFrequencies[termB];
                        var nGram = termA + " " + termB;

                        // Calculate the phrase importance
                        var impScore = TextUtils.calculatePointwiseMutualInformation(
                            totalFrequency, 
                            nGramFrequencies[nGram], 
                            freqWordA, 
                            freqWordB);
                        phrases.push({ 
                            "phrase" : nGram,
                            "score": impScore
                        });
                    }
                }
            }
            phrases.sort(function(a, b){
                return a.score < b.score ? -1 : (a.score > b.score ? 1 : 0);
            });
            
            this._posts[i].setGraphNGrams(phrases);
        }
    };
    
    this.processResults = function(isRetreat) {
        // Tell all of the various insights about the results
        SentimentInsight.processResults(this._posts);
        PostByDayInsight.processResults(this._posts);
        LocationInsight.processResults(this._posts);
        PhotoInsight.processResults(this._posts);
        TaxonomyInsight.registerResults(this._posts);
        SummaryInsight.processResults(this._posts, isRetreat);
    };
    
    this.analyseTaxonomy = function(taxonomy) {
        TaxonomyInsight.processResults(taxonomy);
    };
    
    // Account for the user clicking on the breadcrumb navigation
    this.breadcrumbNavigation = function(position) {
        SummaryInsight.retreatToNavigationLevel(position);
    };
    
    // Get the posts (for navigaation retreat/ cached results)
    this.getPosts = function() {
        return this._posts;
    };
    
    // Set the posts (for navigaation retreat/ cached results)
    this.setPosts = function(posts) {
        this._posts = posts;
    };
});

/***********************************************************************************
 * Display the most popular photos
 ***********************************************************************************/
angular.module('analyticsApp').service('SentimentInsight', function($rootScope, Resources) {

    this._neutralLabel = "Neutral";
    this._sentimentModel = null;
    this._sentimentClasses = null;
    
    this.initialise = function() {
        if (this._sentimentModel !== null) return;
        
        this._sentimentModel = Resources.getSentiment();
        this._sentimentClasses = [];
        for (var i in this._sentimentModel) {
            this._sentimentClasses[this._sentimentModel[i].class] = [];
            for (var j in this._sentimentModel[i].individuals) {
                this._sentimentClasses[this._sentimentModel[i].class]
                    [this._sentimentModel[i].individuals[j]] = true;
            }
        }
    };
    
    this.processResults = function(posts) {
        
        // Initialise the sentiment model if required
        this.initialise();
        
        // Read the classes into hashset (ish) implementations
        var taxonomyResults = [];
        this._sentimentModel.push({ class: this._neutralLabel, individuals: []});
        for (var i in this._sentimentModel) {
            taxonomyResults[this._sentimentModel[i].class] = {
                class: this._sentimentModel[i].class,
                score: 0,
                posts: []
            };
        }

        // Now categorise each post by class instances
        for (var i in posts) {
            var postResult = [];
            for (var k in this._sentimentClasses) {
                var classResult = {
                    class: k,
                    score: 0
                };
                
                for (var j in posts[i].getTokens()) {
                    if (this._sentimentClasses[k][posts[i].getTokens()[j].toLowerCase()] === true) {
                        classResult.score++;
                    }
                }
                postResult.push(classResult);
            }
            
            var emergentClass = this._neutralLabel;
            if (postResult[0].score > postResult[1].score) 
                emergentClass = postResult[0].class;
            else if (postResult[0].score < postResult[1].score) 
                emergentClass = postResult[1].class;
            
            taxonomyResults[emergentClass].posts.push(posts[i]);
            taxonomyResults[emergentClass].score += 1;
        }

        var sentimentResults = [];
        sentimentResults.taxonomyName = "Sentiment";
        sentimentResults.isWeighted = false;
        sentimentResults.classes = [];
        for (var i in taxonomyResults) {
            sentimentResults.classes.push(taxonomyResults[i]);
        }
        
        $rootScope.$broadcast(events.SENTIMENT_DATA_READY, sentimentResults);
    };
});

/***********************************************************************************
 * Volume by day algorithm
 ***********************************************************************************/
angular.module('analyticsApp').service('PostByDayInsight', function($rootScope) {
    
    this._volumeByDay = new Array();
    
    this.processResults = function(posts) {
        
        this._volumeByDay = new Array();
        var earliestDate = new Date();
        for (var i = 0; i < posts.length; i++) {
            var createdAt  = new Date(posts[i].getCreatedAt());
            createdAt.setHours(0);
            createdAt.setMinutes(0);
            createdAt.setSeconds(0);
            
            if (createdAt < earliestDate) {
                earliestDate = createdAt;
            }
            
            if (! this._volumeByDay.hasOwnProperty(createdAt)) {
                this._volumeByDay[createdAt] = {
                    day: new Date(createdAt.getTime()),
                    count: 0,
                    posts: []
                };
            }
            this._volumeByDay[createdAt].count++;
            this._volumeByDay[createdAt].posts.push(posts[i]);
        }
        
        // Now fill in missing dates
        while (earliestDate < new Date()) {
            if (! this._volumeByDay.hasOwnProperty(earliestDate)) {
                this._volumeByDay[earliestDate] = {
                    day: new Date(earliestDate.getTime()),
                    count: 0,
                    posts: []
                };
            }
            
            earliestDate.setDate(earliestDate.getDate() + 1);
        }
        
        // Convert to standard array
        var volumeArray = [];
        for (var day in this._volumeByDay) {
            volumeArray.push(this._volumeByDay[day]);
        }
        
        // Sort the results
        volumeArray.sort(function(a, b){
           return a.day < b.day ? -1 : (a.day > b.day ? 1 : 0);
        });
        
        $rootScope.$broadcast(events.VOLUME_DATA_READY, volumeArray);
    };
});

/***********************************************************************************
 * Volume by day algorithm
 ***********************************************************************************/
angular.module('analyticsApp').service('LocationInsight', function($rootScope, Resources) {
    
    this._locations = new Array();
    
    this.processResults = function(posts) {
        
        this._locations = new Array();
        for (var i = 0; i < posts.length; i++) {
            var location = posts[i].getLocation();
            if (! this._locations.hasOwnProperty(location)) {
                this._locations[location] = {
                    location: location,
                    count: 0,
                    posts: []
                };
            }
            this._locations[location].count++;
            this._locations[location].posts.push(posts[i]);
        }
        
        // Convert to standard array
        var locationArray = [];
        for (var location in this._locations) {
            if (location.trim().length > 0)
                locationArray.push(this._locations[location]);
        }
        
        // Sort the results
        locationArray.sort(function(a, b){
           return b.count < a.count ? -1 : (b.count > a.count ? 1 : 0);
        });
        
        var noResults = Math.min(locationArray.length, 
            Resources.getProperties().LOCATION_CHART_NO_RESULTS);
        $rootScope.$broadcast(events.LOCATION_DATA_READY, 
            locationArray.slice(0, noResults));
    };
});

/***********************************************************************************
 * Display the most popular photos
 ***********************************************************************************/
angular.module('analyticsApp').service('PhotoInsight', function($rootScope) {
    
    this.processResults = function(posts) {
        
        var pictures = new Array();
        for (var i = 0; i < posts.length; i++) {
            
            var post = posts[i];
            for (var j = 0; j < post.getPhotos().length; j++) {
                if (! pictures.hasOwnProperty(post.getPhotos()[j])) {
                    pictures[post.getPhotos()[j]] = {
                        url: post.getPhotos()[j],
                        count: 0
                    };
                }
                pictures[post.getPhotos()[j]].count++;
            }
        }
            
        // Convert to standard array
        var pictureArray = [];
        for (var url in pictures) {
            pictureArray.push(pictures[url]);
        }
        
        // Sort the results
        pictureArray.sort(function(a, b){
           return b.count < a.count ? -1 : (b.count > a.count ? 1 : 0);
        });
        
        $rootScope.$broadcast(events.PHOTO_DATA_READY, pictureArray);
    };
});

/***********************************************************************************
 * Algorithm to display taxonomy results
 ***********************************************************************************/
angular.module('analyticsApp').service('TaxonomyInsight', function($rootScope, $http) {
    
    this._posts = [];
    
    this.registerResults = function(posts) {
        this._posts = posts;
    };
    
    this.processResults = function(taxonomy) {
        
        // Tell the user what we are doing in case of slow connection
        $rootScope.$emit(events.INFO, "Loading taxonomy file: " + taxonomy.file);
        
        // Load the taxonomy from the file
        var taxonomyRequest = {
            url: "resources/taxonomies/" + taxonomy.file,
            dataType: "json",
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        };

        // Load the resources into a variable shared by all controllers
        var posts = this._posts;
        var calculateFunction = this.calculateTaxonomyDensity;
        $http(taxonomyRequest).
        success(function (response) {
        
            var simpleResults = calculateFunction(taxonomy.name, response, posts, true);
            $rootScope.$broadcast(events.TAXONOMY_DATA_READY, simpleResults);
        }).
        error(function (error) {
            $rootScope.$emit(
                events.ERROR, error, "Failed to load: " + taxonomy.file, true);
        });
    };
    
    this.calculateTaxonomyDensity = function(taxonomyName, taxonomy, posts, isWeighted) {
        
        // Read the classes into hashset (ish) implementations
        var taxonomyClasses = {};
        var taxonomyResults = [];
        for (var i in taxonomy) {
            taxonomyResults[taxonomy[i].class] = {
                class: taxonomy[i].class,
                score: 0,
                posts: []
            };

            taxonomyClasses[taxonomy[i].class] = [];
            for (var j in taxonomy[i].individuals) {
                taxonomyClasses[taxonomy[i].class][taxonomy[i].individuals[j]] = true;
            }
        }

        // Now categorise each post by class instances
        for (var i in posts) {
            for (var j in posts[i].getTokens()) {
                for (var k in taxonomyClasses) {
                    if (taxonomyClasses[k][posts[i].getTokens()[j].toLowerCase()] === true) {
                        
                        if (isWeighted) {                           
                            taxonomyResults[k].score += posts[i].getNoFollowers();
                        }
                        if (taxonomyResults[k].posts.indexOf(posts[i]) === -1) {
                            taxonomyResults[k].posts.push(posts[i]);
                            if (! isWeighted) taxonomyResults[k].score += 1;
                        }
                    }
                }
            }
        }

        var simpleResults = [];
        simpleResults.taxonomyName = taxonomyName;
        simpleResults.isWeighted = isWeighted;
        simpleResults.classes = [];
        for (var i in taxonomyResults) {
            simpleResults.classes.push(taxonomyResults[i]);
        }
        
        return simpleResults;
    };
});

/***********************************************************************************
 * Algorithm to summarise the postings
 ***********************************************************************************/
angular.module('analyticsApp').service('SummaryInsight', function(
    VSRenderer, Resources, $rootScope) {
    
    this._nodes = new Array();
    
    this.retreatToNavigationLevel = function(posts) {
        
        VSRenderer.initialise();
        VSRenderer.retreatToNavigationLevel(posts);
    };
    
    this.processResults = function(posts, isRetreat) {
        
        // If we have less than a certain no tweets, only show posts (not summary)
        if (posts.length < Resources.getProperties().MINIMUM_SUMMARY_POST_LENGTH) {
            
            $rootScope.$broadcast(events.POSTS_DISPLAY_READY, posts);
            $rootScope.$broadcast(events.SUMMARY_READY);
            VSRenderer.hideMainDisplay();
        }
        else {
            this.graphTopicModel(posts, isRetreat);
        }
    };
    
    this.graphTopicModel = function(posts, isRetreat) {
        
        VSRenderer.initialise();
        this._nodes = new Array();
        
        // Results object including some stats
        var results = {
            maxWeight: 0,
            maxFollowers: 0,
            primaryEdgeWeightThreshold: 0,
            graph: new Array(),
            posters: new Array()
        };
        
        // Create a graph of tokens
        for (var i = 0; i < posts.length; i++) {
     
            // Find the poster with the most followers
            results.maxFollowers = Math.max(results.maxFollowers, posts[i].getNoFollowers());
            
            // Create a mixture of phrases and ngrams
            var nodeNGrams = posts[i].getGraphNGrams();
            var graphTokens = [];
            for (var j = 0; j < nodeNGrams.length; j++) {
                graphTokens[j] = nodeNGrams[j].phrase;
            }
            graphTokens = graphTokens.concat(posts[i].getHashTags());
            
            // Now loop through this and create a graph
            for (var j = 0; j < graphTokens.length; j++) {
                
                nodeNGram = graphTokens[j];
                
                // Create a node if required, and increment weighting based on followers
                if (! this._nodes.hasOwnProperty(nodeNGram)) {
                    this._nodes[nodeNGram] = new GraphNode(nodeNGram);
                }
                this._nodes[nodeNGram].incrementWeight(Math.log2(posts[i].getNoFollowers()));
                this._nodes[nodeNGram].addPost(posts[i]);
                
                // Now add/ increment the edges
                for (var k = j - 1; k >= 0; k--) {
                    var edge = this._nodes[graphTokens[k]];
                    this._nodes[nodeNGram].addOrIncrementEdge(edge, 1);
                    this._nodes[nodeNGram].getEdge(edge).addPost(posts[i]);
                }
            }
            
            // Create the posters
            if (! results.posters.hasOwnProperty(posts[i].getPoster())) {
                results.posters[posts[i].getPoster()] = new Poster(
                    posts[i].getPoster(), posts[i].getNoFollowers());
            }
            results.posters[posts[i].getPoster()].addPost(posts[i]);
        }
        
        // Get a list of the nodes ordered by the weight in reverse order
        var nodesByWeight = orderNodesByWeight(this._nodes);
        var orderedNodes = nodesByWeight[0];
        results.primaryEdgeWeightThreshold = math.mean(nodesByWeight[1]) + math.std(nodesByWeight[1]);
        
        // Loop through the nodes and calcuate appropriate edge weights
        for (var i = 0; i < orderedNodes.length; i++) {
            var node = this._nodes[orderedNodes[i].getTerm()];
            
            // Generate required statistics about the graph
            results.maxWeight = Math.max(results.maxWeight, node.getWeight());
            
            // Traverse edges to calculate high k-core/ weight combination
            var edges = node.getEdges();
            var maxEdgeWeight = getMaxEdgeWeight(edges);
            
            var kcoreWeightedTuples = new Array();
            for (var j in edges) {
                
                // Get the node for the edge in question
                var edgeNode = this._nodes[j];
                var edgeNodeEdges = edgeNode.getEdges();
                
                // Calculate k-core number, normalised weigth, and harmonic mean of the two
                var kCore = calculateKCoreNumber(edges, edgeNodeEdges);
                var normalisedWeight = edges[j].getWeight() / maxEdgeWeight;
                var harmonicMean = 2 / ((1 / normalisedWeight) + (1 / kCore));
                
                // Stuff into an array
                kcoreWeightedTuples.push([edgeNode, harmonicMean]);
            }
            
            // Sort the edges by this new score
            kcoreWeightedTuples.sort(function(a, b) {
                a = a[1];
                b = b[1];

                return b < a ? -1 : (b > a ? 1 : 0);
            });
            
            // Now get the node and top n edges and create a sub graph
            var seenGrams = new Array();
            seenGrams[0] = [], seenGrams[1] = [];
            if (! results.graph.hasOwnProperty(node.getTerm())) {
                results.graph[node.getTerm()] = node.shallowCopy();
                splitNGrams(node.getTerm(), seenGrams);
            }
            
            for (var j = 0; j < kcoreWeightedTuples.length; j++) {
                
                var term = kcoreWeightedTuples[j][0].getTerm();
                    
                // Collapse the phrase if we have already seen either part
                var uniGrams = term.split(" ");
                if (isValueInArray(uniGrams[0], seenGrams[seenGrams.length - 1]))
                    kcoreWeightedTuples[j][0].setDisplayTerm(term.replace(uniGrams[0], ""));
                if (isValueInArray(uniGrams[uniGrams.length - 1], seenGrams[0]))
                    kcoreWeightedTuples[j][0].setDisplayTerm(term.replace(uniGrams[1], ""));
                
                if (! results.graph.hasOwnProperty(term)) {
                    results.graph[term] = kcoreWeightedTuples[j][0].shallowCopy();
                    results.graph[term].orderPosts();
                    splitNGrams(results.graph[term].getDisplayTerm(), seenGrams);
                }
                
                // Don't add the node again if we have already added it
                var edgeCopy = results.graph[node.getTerm()].addOrIgnoreEdge(
                    results.graph[term], kcoreWeightedTuples[j][1]);
                edgeCopy.setPosts(node.getEdgeByConnectingTerm(
                    kcoreWeightedTuples[j][0].getTerm()).getPosts());
                edgeCopy.orderPosts();
            }
        }
        
        VSRenderer.display(results, isRetreat);
    };
    
    this.calculateCorrelation = function(edges1, edges2) {
        
        var sumX = 0;
        var sumY = 0;
        var sumXY = 0;
        var sumX2 = 0;
        var sumY2 = 0;
        
        var numberComparisons = 0;
        for (var i = 0; i < edges1.length; i++) {
            
            var isMatched = false;  
            
            for (var j = 0; j < edges2.length; j++) {
                if (edges1[i][0] === edges2[j][0]) {
                    numberComparisons++;
                    isMatched = true;
                    
                    sumX += edges1[i][1];
                    sumY += edges2[j][1];
                    sumXY += edges1[i][1] * edges2[j][1];
                    sumX2 += edges1[i][1] * edges1[i][1];
                    sumY2 += edges2[j][1] * edges2[j][1];
                }
            }
            
            if (! isMatched) {
                numberComparisons++;
                sumX += edges1[i][1];
                sumX2 += edges1[i][1] * edges1[i][1];
            }
        }
        
        for (var i = 0; i < edges2.length; i++) {
            
            var isMatched = false;
            for (var j = 0; j < edges1.length; j++) {
                if (edges2[i][0] === edges1[j][0]) {
                    isMatched = true;
                }
            }
                
            if (! isMatched) {
                numberComparisons++;
                sumY += edges2[i][1];
                sumY2 += edges2[i][1] * edges2[i][1];
            } 
        }
        
        return ((numberComparisons * sumXY) - (sumX * sumY)) / 
            Math.sqrt(
                ((numberComparisons * sumX2) - (sumX * sumX)) * 
                ((numberComparisons * sumY2) - (sumY * sumY))
            );
    };
    
    function calculateKCoreNumber(edges1, edges2) {
        
        var noPossibleEdges = Math.max(
            getAssociativeArrayLength(edges1), getAssociativeArrayLength(edges2)) - 1;
        var noSharedEdges = 0;
        for (var edge1Term in edges1) {
            for (var edge2Term in edges2) {
                if (edge1Term === edge2Term) {
                    noSharedEdges++;
                }
            }
        }
        
        return noSharedEdges / noPossibleEdges;
    };
    
    function getMaxEdgeWeight(edges) {
        
        var maxEdgeWeight = 0;
        for (var j in edges) {
            maxEdgeWeight = Math.max(maxEdgeWeight, edges[j].getWeight());
        }
        return maxEdgeWeight;
    };
    
    function getAssociativeArrayLength(array) {
        var length = 0;
        for (element in array) {
            length++;
        }
        return length;
    };
    
    function splitNGrams(ngram, seenGrams) {
        
        uniGrams = ngram.split(" ");
        for (var i in uniGrams) {
            seenGrams[i].push(uniGrams[i]);
        }
    };
    
    function isValueInArray(value, array) {
        for (var i in array) {
            if (value.toLowerCase() === array[i].toLowerCase()) {
                return true;
            }
        }
        return false;
    }
    
    function orderNodesByWeight(nodes) {
        
        var nodeArray = [];
        var weightArray = [];
        
        // Convert to a non-associative array
        for (var key in nodes) {
            nodeArray.push(nodes[key]);
            weightArray.push(nodes[key].getWeight());
        }

        // Sort the array
        nodeArray.sort(function(a, b) {
            node1Weight = a.getWeight();
            node2Weight = b.getWeight();

            return node2Weight < node1Weight ? -1 : (node2Weight > node1Weight ? 1 : 0);
        });
        
        return [nodeArray, weightArray];
    };
});

/***********************************************************************************
 * Text processing factory class
 ***********************************************************************************/
angular.module('analyticsApp').service('TextUtils', function(Resources) {
    
    var textUtils = {};
    
    textUtils.tokenizeToSentence = function(text) {
        return text.
            replace(/(?:https?|ftp):\/\/[\n\S]+/g, '').
            match(/[^(\.|,|;|:|~)]+/g);
    };
        
    textUtils.tokenize = function(text) {
        return text.
            replace(/(?:https?|ftp):\/\/[\n\S]+/g, ''). // Remove the URLs
            replace(/[^0-9a-zA-Z_\s@#]/g, ''). // Get rid of non imp chars
            match(/[^\s]+/g); // Split on string
    };
        
    textUtils.removeStopwords = function(tokens) {
        var cleanedTokens = new Array();
        if (tokens === null) return cleanedTokens;
        
        for (var i = 0; i < tokens.length; i++) {
            if (this.isStopword(tokens[i])) continue;
            else if (this.isNumber(tokens[i])) continue;
            else if (this.isHashtag(tokens[i])) continue;
            else if (this.isUserHandle(tokens[i])) continue;
            
            cleanedTokens.push(tokens[i]);
        }
        return cleanedTokens;
    };
    
    textUtils.extractPhrases = function(tokens) {
        
        var ngramTokens = [];
        for (var i = 0; i < tokens.length; i++) {
            if (i + 1 < tokens.length)
                ngramTokens[i] = tokens[i] + " " + tokens[i + 1];
            if (i + 2 < tokens.length)
                ngramTokens[i] = tokens[i] + " " + tokens[i + 1] + " " + tokens[i + 2];
        }
        
        return ngramTokens;
    };
    
    textUtils.isQueryTerm = function(token, queryTerms) {
        for (var i = 0; i < queryTerms.length; i++) {
            if (queryTerms[i] === token.toLowerCase()) return true;
        }
        return false;
    };
    
    textUtils.isHashtag = function(token) {
        return token.match(/^#([a-zA-Z0-9]+$)/g) !== null;
    };
    
    textUtils.isUserHandle = function(token) {
        return token.match(/^(@[a-zA-Z0-9_]+$)/g) !== null;
    };
    
    textUtils.isNumber = function(token) {
        return ! isNaN(token);
    };
    
    textUtils.isStopword = function(token) {
        return Resources.getStopwords().indexOf(token.toLowerCase()) !== -1;
    };
    
    textUtils.isDictionaryWord = function(token) {
        return (! this.isStopword(token)) && 
            (! this.isHashtag(token)) && 
            (! this.isNumber(token)) && 
            (! this.isUserHandle(token));
    }
    
    textUtils.calculateLogLikelihood = function(totalFrequency, freqWordA, freqWordB) {
        
        // Expected values 2*((a*ln (a/E1)) + (b*ln (b/E2))) 
        var expectedValue = (totalFrequency * (freqWordA + freqWordB)) / 
            (totalFrequency + totalFrequency);
        return 2 * ((freqWordA * Math.log(freqWordA / expectedValue)) + 
            (freqWordB * Math.log(freqWordB / expectedValue)));  
    };
    
    textUtils.calculatePointwiseMutualInformation = function(
        totalFrequency, nGramFrequency, freqWordA, freqWordB) {
    
        // This is p(a,b)/ p(a)*p(b)
        return (nGramFrequency / totalFrequency) / 
            ((freqWordA / totalFrequency) * (freqWordB / totalFrequency));
    };
    
    return textUtils;
});

/***********************************************************************************
 * An object representing a Post
 ***********************************************************************************/
var Tweet = function(poster, createdAt, originalText, tokens, hashTags, 
    userHandles, noRetweets, noFollowers, location, profileImage, photos) {

    this._poster = poster;
    this._createdAt = createdAt;
    this._originalText = originalText;
    this._tokens = tokens;
    this._hashTags = hashTags;
    this._userHandles = userHandles;
    this._noRetweets = noRetweets;
    this._noFollowers = noFollowers;
    this._location = location;
    this._profileImage = profileImage;
    this._photos = photos;
    this._graphNGrams = [];
};

Tweet.prototype.setGraphNGrams = function(graphNGrams) {
    this._graphNGrams = graphNGrams;
};

Tweet.prototype.getGraphNGrams = function() {
    return this._graphNGrams;
};

Tweet.prototype.getPoster = function() {
    return this._poster;
};

Tweet.prototype.getCreatedAt = function() {
    return this._createdAt;
};

Tweet.prototype.getOriginalText = function() {
    return this._originalText;
};

Tweet.prototype.getTokens = function() {
    return this._tokens;
};

Tweet.prototype.getHashTags = function() {
    return this._hashTags;
};

Tweet.prototype.getUserHandles = function() {
    return this._userHandles;
};

Tweet.prototype.getNoRetweets = function() {
    return this._noRetweets;
};

Tweet.prototype.getNoFollowers = function() {
    return this._noFollowers;
};

Tweet.prototype.getLocation = function() {
    return this._location;
};

Tweet.prototype.getProfileImage = function() {
    return this._profileImage;
};

Tweet.prototype.getPhotos = function() {
    return this._photos;
};

var TweetLoad = function(jsonObj) {

    var posts = [];
    for (var i in jsonObj) {
        posts.push(new Tweet(jsonObj[i]._poster, jsonObj[i]._createdAt, jsonObj[i]._originalText,
            jsonObj[i]._tokens, jsonObj[i]._hashTags, jsonObj[i]._userHandles, jsonObj[i]._noRetweets,
            jsonObj[i]._noFollowers, jsonObj[i]._location, jsonObj[i]._profileImage, jsonObj[i]._photos));
    };
    
    return posts;
};

/***********************************************************************************
 * An graph node
 ***********************************************************************************/
var GraphNode = function(term) {
    this._term = term;
    this._displayTerm = term;
    this._weight = 0;
    this._edges = [];
    this._noEdges = 0;
    this._posts = new Array();
};

GraphNode.prototype.getTerm = function() {
    return this._term;
};

GraphNode.prototype.getDisplayTerm = function() {
    return this._displayTerm;
};

GraphNode.prototype.setDisplayTerm = function(term) {
    this._displayTerm = term;
};

GraphNode.prototype.getWeight = function() {
    return this._weight;
};

GraphNode.prototype.getEdges = function() {
    return this._edges;
};

GraphNode.prototype.getEdge = function(graphNode) {
    return this._edges[graphNode._term];
};

GraphNode.prototype.getEdgeByConnectingTerm = function(term) {
    return this._edges[term];
};

GraphNode.prototype.getNoEdges = function() {
    return this._noEdges;
};

GraphNode.prototype.containsEdge = function(edgeNode) {
    return this._edges.hasOwnProperty(edgeNode._term);
};

GraphNode.prototype.addPost = function(post) {
    this._posts.push(post);
};

GraphNode.prototype.getPosts = function() {
    return this._posts;
};

GraphNode.prototype.addOrIncrementEdge = function(graphNode, edgeWeight) {
    
    if (! this._edges.hasOwnProperty(graphNode._term)) {
        this._edges[graphNode._term] = new GraphEdge();
        this._noEdges++;
    }
    if (! graphNode._edges.hasOwnProperty(this._term)) {
        graphNode._edges[this._term] = this._edges[graphNode._term];
        graphNode._noEdges++;
    }
    this._edges[graphNode._term].incrementWeight(edgeWeight);
};

GraphNode.prototype.addOrIgnoreEdge = function(graphNode, edgeWeight) {
    
    if (! this._edges.hasOwnProperty(graphNode._term)) {
        this._edges[graphNode._term] = new GraphEdge();
        this._edges[graphNode._term].incrementWeight(edgeWeight);
        this._noEdges++;
    }
    if (! graphNode._edges.hasOwnProperty(this._term)) {
        graphNode._edges[this._term] = this._edges[graphNode._term];
        graphNode._noEdges++;
    }
    
    return this._edges[graphNode._term];
};

GraphNode.prototype.incrementWeight = function (weight) {
    this._weight += weight;
};

GraphNode.prototype.orderPosts = function() {
    this._posts.sort(function(a, b) {
        return b.getNoFollowers() < a.getNoFollowers() ? 
            -1 : 
            (b.getNoFollowers() > a.getNoFollowers() ? 1 : 0);
    });
};

GraphNode.prototype.shallowCopy = function() {
    var newNode = new GraphNode(this._term);
    newNode._displayTerm = this._displayTerm;
    newNode._weight = this._weight;
    newNode._posts = this._posts;
    return newNode;
};

/***********************************************************************************
 * An graph node
 ***********************************************************************************/
var GraphEdge = function () {
    this._weight = 0;
    this._posts = new Array();
};

GraphEdge.prototype.incrementWeight = function (weight) {
    this._weight += weight;
};

GraphEdge.prototype.getWeight = function () {
    return this._weight;
};

GraphEdge.prototype.addPost = function(post) {
    this._posts.push(post);
};

GraphEdge.prototype.setPosts = function(posts) {
    this._posts = posts;
};

GraphEdge.prototype.getPosts = function() {
    return this._posts;
};

GraphEdge.prototype.orderPosts = function() {
    this._posts.sort(function(a, b) {
        return b.getNoFollowers() < a.getNoFollowers() ? 
            -1 : 
            (b.getNoFollowers() > a.getNoFollowers() ? 1 : 0);
    });
};

/***********************************************************************************
 * An poster node
 ***********************************************************************************/
var Poster = function(name, noFollowers) {
    this._name = name;
    this._noFollowers = noFollowers;
    this._posts = new Array();
};

Poster.prototype.getName = function() {
    return this._name;
};

Poster.prototype.getNoFollowers = function() {
    return this._noFollowers;
};

Poster.prototype.addPost = function(post) {
    this._posts.push(post);
};

Poster.prototype.setPosts = function(posts) {
    this._posts = posts;
};

Poster.prototype.getPosts = function() {
    return this._posts;
};