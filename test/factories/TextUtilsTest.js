describe ('TextUtils', function() {

    beforeEach(angular.mock.module('ncapsulateApp'));

    var textUtils;

    beforeEach(angular.mock.inject(function(_TextUtils_){
        textUtils = _TextUtils_;
    }));

    describe('tokenize', function () {
        it('Test standard tokenization', function () {
            
            var text = "This is a sentence with many different words";
            var expectedTokens = [
                "This", "is", "a", "sentence", "with", "many", "different", "words"];
            
            var returnedTokens = textUtils.tokenize(text);
            compareTokens(expectedTokens, returnedTokens);
        });
    });

    describe('tokenize', function () {
        it('Test tokenization with clause punctuation', function () {

            var text = "This @is a #long $string. Alright, lets split this.`";
            var expectedTokens = [
                "This", "@is", "a", "#long", "string", "Alright", "lets", "split", "this"];
            
            var returnedTokens = textUtils.tokenize(text);
            compareTokens(expectedTokens, returnedTokens);
        });
    });

    describe('tokenize', function () {
        it('Test tokenization with numbers', function () {

            var text = "This is a string with 2 different numbers b4 and 8ish.";
            var expectedTokens = [
                "This", "is", "a", "string", "with", "2", "different", 
                "numbers", "b4", "and", "8ish"];
            
            var returnedTokens = textUtils.tokenize(text);
            compareTokens(expectedTokens, returnedTokens);
        });
    });

    describe('tokenize', function () {
        it('Test tokenization with multiple spaces/ tabes', function () {

            var text = "This   is a     string with 2 different    spaces.";
            var expectedTokens = [
                "This", "is", "a", "string", "with", "2", "different", "spaces"];
            
            var returnedTokens = textUtils.tokenize(text);
            compareTokens(expectedTokens, returnedTokens);
        });
    });

    describe('isNumber', function () {
        it('Test recognition of numbers', function () {

            expect(textUtils.isNumber("12345")).toBe(true);
            expect(textUtils.isNumber("123.45")).toBe(true);
            expect(textUtils.isNumber("A12345")).toBe(false);
            expect(textUtils.isNumber("123A45")).toBe(false);
            expect(textUtils.isNumber("£12345")).toBe(false);
        });
    });

    describe('isHashtag', function () {
        it('Test recognition of hashtags', function () {

            expect(textUtils.isHashtag("#myhashtag")).toBe(true);
            expect(textUtils.isHashtag("n#hashtag")).toBe(false);
            expect(textUtils.isHashtag("#hash#tag")).toBe(false);
            expect(textUtils.isHashtag("##tag")).toBe(false);
            expect(textUtils.isHashtag("#hash_tag")).toBe(false);
            expect(textUtils.isHashtag("##")).toBe(false);
        });
    });

    describe('isUserHandle', function () {
        it('Test recognition of user handles', function () {

            expect(textUtils.isUserHandle("@hello")).toBe(true);
            expect(textUtils.isUserHandle("@hello_hello")).toBe(true);
            expect(textUtils.isUserHandle("@12345")).toBe(true);
            expect(textUtils.isUserHandle("@hello-hello")).toBe(false);
            expect(textUtils.isUserHandle("@hello@hello")).toBe(false);
        });
    });

    describe('basicSentenceTokenize', function () {
        it('Test sentences correctly split', function () {

            var sentences = textUtils.tokenizeToSentence("This is one. This is another");
            expect(sentences.length).toBe(2);
        });
    });
    
    function compareTokens(expectedTokens, returnedTokens) {
        expect(returnedTokens.length).toBe(expectedTokens.length);
        
        for (var i in expectedTokens) {
            expect(expectedTokens[i]).toBe(returnedTokens[i]);
        }
    };
});
