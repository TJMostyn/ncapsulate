describe ('ResponseHelper', function() {

    beforeEach(angular.mock.module('ncapsulateApp'));

    var responseHelper;

    beforeEach(angular.mock.inject(function(_ResponseHelper_){
      responseHelper = _ResponseHelper_;
    }));

    describe('getParameterByName', function () {
        it('Test getting params from URL', function () {
            
            var noParams = 10;
            var url = "http://test.com/testing?";
            var testKey, testValue;
            
            var params = {};
            for (var i = 0; i < noParams; i++) {
                var key = Math.random().toString(36).substring(5);
                var value = Math.random().toString(36).substring(5);
                params[key] = value;
                url += key + "=" + value + "&";
                
                if (i === noParams / 2) {
                    testKey = key;
                    testValue = value;
                }
            }
            
            var paramValue = responseHelper.getParameterByName(testKey, url);
            expect(paramValue).toBe(testValue);
        });
    });

    describe('getParameterByName not exists', function () {
        it('Test getting params from URL', function () {
            
            var noParams = 10;
            var url = "http://test.com/testing?";
            var testKey, testValue;
            
            var params = {};
            for (var i = 0; i < noParams; i++) {
                var key = Math.random().toString(36).substring(5);
                var value = Math.random().toString(36).substring(5);
                params[key] = value;
                url += key + "=" + value + "&";
                
                if (i === noParams / 2) {
                    testKey = key;
                    testValue = value;
                }
            }
            
            var paramValue = responseHelper.getParameterByName("thisisnotakey", url);
            expect(paramValue).toBe(null);
        });
    });

    describe('getParameterByName poorly formed URL', function () {
        it('Test getting params from incorrect URL', function () {
            
            var noParams = 10;
            var url = "http://test.com/testing?dsof=?fdsfds=";
            var testKey, testValue;
            
            var params = {};
            for (var i = 0; i < noParams; i++) {
                var key = Math.random().toString(36).substring(5);
                var value = Math.random().toString(36).substring(5);
                params[key] = value;
                url += key + "=" + value + "&";
                
                if (i === noParams / 2) {
                    testKey = key;
                    testValue = value;
                }
            }
            
            var paramValue = responseHelper.getParameterByName(testKey, url);
            expect(paramValue).toBe(testValue);
        });
    });

    describe('getParameterAsAssociativeArray', function () {
        it('Test getting params as associative array', function () {
            
            var noParams = 10;
            var url = "http://test.com/testing?";
            var testKey, testValue;
            
            var params = {};
            for (var i = 0; i < noParams; i++) {
                var key = Math.random().toString(36).substring(5);
                var value = Math.random().toString(36).substring(5);
                params[key] = value;
                url += key + "=" + value + "&";
                
                if (i === noParams / 2) {
                    testKey = key;
                    testValue = value;
                }
            }
            
            var assocArray = responseHelper.getParameterAsAssociativeArray(url);
            expect(assocArray.length).toBe(params.length);
            
            for (var key in params) {
                expect(assocArray[key]).toBe(params[key]);
            }
        });
    });
});
