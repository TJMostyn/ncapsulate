describe ('AuthenticationMgr', function() {
    
    beforeEach(angular.mock.module('ncapsulateApp'));
    
    var authenticationService;

    beforeEach(angular.mock.inject(function(_AuthenticationMgr_){
      authenticationService = _AuthenticationMgr_;
    }));
    
    describe('isLoggedIn', function () {
        it('Test setting oauth details sets logged in', function () {
            var inputToken = Math.random().toString(36).substring(7);
            var inputSecret = Math.random().toString(36).substring(7);
            expect(authenticationService.isLoggedIn()).toBe(false);
            
            authenticationService.setAuthDetails(inputToken, inputSecret);
            expect(authenticationService.isLoggedIn()).toBe(true);
        });
    });
    
    describe('getOAuthToken', function () {
        it('Test token corretly saved', function () {
            var inputToken = Math.random().toString(36).substring(7);
            var inputSecret = Math.random().toString(36).substring(7);
            authenticationService.setAuthDetails(inputToken, inputSecret);
            
            var outputToken = authenticationService.getOAuthToken();
            expect(outputToken).toBe(inputToken);
        });
    });
    
    describe('getOAuthSecret', function () {
        it('Test secret corretly saved', function () {
            var inputToken = Math.random().toString(36).substring(7);
            var inputSecret = Math.random().toString(36).substring(7);
            authenticationService.setAuthDetails(inputToken, inputSecret);
            
            var outputSecret = authenticationService.getOAuthTokenSecret();
            expect(outputSecret).toBe(inputSecret);
        });
    });
    
    describe('logout', function () {
        it('Test logout clears settings', function () {
            var inputToken = Math.random().toString(36).substring(7);
            var inputSecret = Math.random().toString(36).substring(7);
            
            authenticationService.setAuthDetails(inputToken, inputSecret);
            expect(authenticationService.isLoggedIn()).toBe(true);

            authenticationService.logout();
            expect(authenticationService.isLoggedIn()).toBe(false);
        });
    });
});