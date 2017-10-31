angular.module('analyticsApp').controller('ChartRenderer', function ChartRenderer(
    $scope, $rootScope, Resources) {
    
    // Global chart options
    var defaultTextColour = Resources.getProperties().CHART_TEXT_COLOR;
    var defaultLineColour = Resources.getProperties().CHART_LINE_COLOR;
    Chart.defaults.global.colors = Resources.getProperties().CHART_FILL_COLOR;
    Chart.defaults.global.defaultFontColor = defaultTextColour;
    Chart.defaults.global.scaleShowVerticalLines = false;
    
    // "Controller level" variables
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var controllerInstance = this;
    $scope.hideCharts = true;
    $scope.hidePhotos = true;
    $scope.hideTaxonomyChart = true;
    $scope.photosMaximised = false;
    
    $scope.$on(events.SENTIMENT_DATA_READY, function(event, sentimentArray) {
        controllerInstance.displaySentimentChart(sentimentArray);
    });
    
    $scope.$on(events.VOLUME_DATA_READY, function(event, volumeArray) {
        controllerInstance.displayVolumeChart(volumeArray);
    });
    
    $scope.$on(events.LOCATION_DATA_READY, function(event, locationArray) {
        controllerInstance.displayLocationChart(locationArray);
    });
    
    $scope.$on(events.PHOTO_DATA_READY, function(event, photoArray) {
        controllerInstance.displayPhotos(photoArray);
    });
    
    $scope.$on(events.TAXONOMY_DATA_READY, function(event, taxonomyArray) {
        controllerInstance.displayTaxonomyChart(taxonomyArray);
    });
    
    $scope.$on(events.SEARCH_FILTER_STARTED, function(event) {
        controllerInstance.clearAndHideAll();
    });
    
    $scope.$on(events.SUMMARY_READY, function(event) {
        controllerInstance.displayAll();
    });
    
    this.displaySentimentChart = function(sentimentResults) {
        
        $scope.$evalAsync(function() { 
            
            // Note - this variable should not be scoped with "var"
            innerSentimentResults = sentimentResults;
            
            $scope.coloursSentiment = ["#009933", "#FF6666", "#FFFFFF"];
            $scope.labelsSentiment = new Array();
            $scope.dataSentiment = new Array();
            for (var i in sentimentResults.classes) {
                var score = sentimentResults.classes[i].score;
                $scope.labelsSentiment.push(sentimentResults.classes[i].class);
                $scope.dataSentiment.push(score);
            }
            
            $scope.optionsSentiment = {
                legend: {
                    display: false
                },
                onClick: function(evt, points) {
                    if (points.length > 0) {
                        $rootScope.$broadcast(
                            events.CHART_CLICKED, 
                            innerSentimentResults.classes[points[0]["_index"]].posts);
                    }
                }
            }
        });
    };
    
    this.displayVolumeChart = function(volumeByDay) {
        $scope.$evalAsync(function() { 
            
            var innerVolumeByDay = volumeByDay;
            $scope.labelsVolume = new Array();
            $scope.dataVolume = new Array();
            for (var i = 0; i < volumeByDay.length; i++) {
                $scope.labelsVolume.push(volumeByDay[i].day.getDate() + "-" + 
                    months[volumeByDay[i].day.getMonth()]);
                $scope.dataVolume.push(volumeByDay[i].count);
            }
            $scope.seriesVolume = ['# posts per day'];
            
            $scope.optionsVolume = {
                showTooltips: true,
                showXLabels: 10,
                legend: {
                    display: false
                },
                elements: {
                    point: {
                        radius: 1
                    }
                },
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero:true
                        },
                        gridLines: {
                            color: defaultLineColour
                        }
                    }],
                    xAxes: [{
                        gridLines: {
                            lineWidth: 0,
                            color: "rgba(255,255,255,0)"
                        }
                    }]
                },
                onClick: function(evt, points) {
                    if (points.length > 0) {
                        $rootScope.$broadcast(events.CHART_CLICKED, 
                        innerVolumeByDay[points[0]["_index"]].posts);
                    }
                }
            };
        });
    };
    
    this.displayLocationChart = function(locations) {
         
        $scope.$evalAsync(function() { 
        
            var innerLocations = locations;
            $scope.labelsLocation = new Array();
            $scope.dataLocation = new Array();
            for (var i = 0; i < locations.length; i++) {
                $scope.labelsLocation.push(locations[i].location);
                $scope.dataLocation.push(locations[i].count);
            }
            
            $scope.optionsLocation = {
                scales: {
                    yAxes: [{
                        gridLines: {
                            color: defaultLineColour
                        }
                    }],
                    xAxes: [{
                        gridLines: {
                            lineWidth: 0,
                            color: "rgba(255,255,255,0)"
                        }
                    }]
                },
                onClick: function(evt, points) {
                    if (points.length > 0) {
                        $rootScope.$broadcast(events.CHART_CLICKED, 
                            innerLocations[points[0]["_index"]].posts);
                    }
                }
            }
        });
    };
    
    this.displayTaxonomyChart = function(taxonomyResults) {
        
        $scope.$evalAsync(function() { 
        
            // Get the max value
            var maxScore = 0;
            for (var i in taxonomyResults.classes) {
                maxScore = Math.max(maxScore, taxonomyResults.classes[i].score);
            }
            
            var innerTaxonomyResults = taxonomyResults;
            $scope.taxonomyTitle = "Taxonomy topic densities: " + taxonomyResults.taxonomyName;
            $scope.labelsTaxonomy = new Array();
            $scope.dataTaxonomy = new Array();
            for (var i in taxonomyResults.classes) {
                var score = (taxonomyResults.isWeighted) ? 
                    taxonomyResults.classes[i].score / maxScore : taxonomyResults.classes[i].score;
                $scope.labelsTaxonomy.push(taxonomyResults.classes[i].class);
                $scope.dataTaxonomy.push(score);
            }
            
            $scope.optionsTaxonomy = {
                scales: {
                    yAxes: [{
                        gridLines: {
                            color: defaultLineColour
                        }
                    }],
                    xAxes: [{
                        gridLines: {
                            lineWidth: 0,
                            color: "rgba(255,255,255,0)"
                        }
                    }]
                },
                onClick: function(evt, points) {
                    if (points.length > 0) {
                        $rootScope.$broadcast(
                            events.CHART_CLICKED, 
                            innerTaxonomyResults.classes[points[0]["_index"]].posts);
                    }
                }
            }
            
            $scope.hideTaxonomyChart = false;
        });
    };
    
    this.hideTaxonomyChartAndPosts = function() {
        
        $scope.hideTaxonomyChart = true;
        $rootScope.$broadcast(events.NODE_UNCLICKED);
    };
     
    this.displayPhotos = function(photos) {
        $scope.photos = photos;
    };
     
    this.displayAll = function() {
           
       $scope.$evalAsync(function() { 
           $scope.hideCharts = false;
           $scope.hidePhotos = false;
       });
    };
     
    this.clearAndHideAll = function() {
 
       $scope.$evalAsync(function() { 
           $scope.photos = []; 
           $scope.hideCharts = true;
           $scope.hidePhotos = true;
           $scope.hideTaxonomyChart = true;
           
           $scope.labelsVolume = new Array();
           $scope.dataVolume = new Array();
           $scope.labelsLocation = new Array();
           $scope.dataLocation = new Array();
       });       
    };
});

angular.module('analyticsApp').directive('fallbackSrc', function () {
    var fallbackSrc = {
        link: function postLink(scope, iElement, iAttrs) {
            iElement.bind('error', function() {
                angular.element(this).attr("src", iAttrs.fallbackSrc);
            });
        }
    }
    return fallbackSrc;
});