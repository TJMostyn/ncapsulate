angular.module('utilitiesApp', []);

/***********************************************************************************
 * Request utilities class
 ***********************************************************************************/
angular.module('utilitiesApp').factory('RequestHelper', function() {
    return {
        getRequest: function (requestUrl, bodyData, method, authorization) {
            return {
                url: requestUrl,
                dataType: "json",
                method: method,
                data: bodyData,
                headers: {
                    "Authorization": authorization,
                    "User'Agent": "NCapsulate application",
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            };
        },

        makeRequest: function(http, url, onSuccess, onFailure) {
            http(url).
            success(function(response) {
                onSuccess(response);
            }).
            error(function(error) {
                onFailure(error);
            });
        }
    };
});

/***********************************************************************************
 * Request utilities class
 ***********************************************************************************/
angular.module('utilitiesApp').factory('ResponseHelper', function() {
    return {
        getParameterByName: function (name, url) {
            name = "?" + name.replace(/[\[\]]/g, "\\$&");
            var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
                results = regex.exec(url);
            if (!results) return null;
            if (!results[2]) return '';
            return decodeURIComponent(results[2].replace(/\+/g, " "));
        },
        
        getParameterAsAssociativeArray: function(url) {
            var request = {};
            if (url.indexOf('?') > 0) {
                var pairs = url.substring(url.indexOf('?') + 1).split('&');
                for (var i = 0; i < pairs.length; i++) {
                    if(! pairs[i]) continue;
                    var pair = pairs[i].split('=');
                    request[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
                }
            }
            return request;
        }
    };
});


/***********************************************************************************
 * Display utilities class
 ***********************************************************************************/
angular.module('utilitiesApp').factory('DisplayHelper', function() {
    return {
        hexToRgb: function(hex) {
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        }
    };
});
