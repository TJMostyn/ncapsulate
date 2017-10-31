var stopWords = []

var TextUtils = function() {}

TextUtils.prototype.tokenizeToSentence = function(text) {
    return text.
        replace(/(?:https?|ftp):\/\/[\n\S]+/g, '').
        match(/[^(\.|,|;|:)]+/g);
};

TextUtils.prototype.tokenize = function(text) {
    return text.
        replace(/(?:https?|ftp):\/\/[\n\S]+/g, ''). // Remove the URLs
        replace(/[^0-9a-zA-Z_\s@#]/g, ''). // Get rid of non imp chars
        match(/[^\s]+/g); // Split on string
};

TextUtils.prototype.removeStopwords = function(tokens) {
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

TextUtils.prototype.extractPhrases = function(text) {

    var ngramTokens = [];
    for (var i = 0; i < tokens.length; i++) {
        if (i + 1 < tokens.length)
            ngramTokens[i] = tokens[i] + " " + tokens[i + 1];
        if (i + 2 < tokens.length)
            ngramTokens[i] = tokens[i] + " " + tokens[i + 1] + " " + tokens[i + 2];
    }

    return ngramTokens;
};

TextUtils.prototype.isQueryTerm = function(token, queryTerms) {
    for (var i = 0; i < queryTerms.length; i++) {
        if (queryTerms[i] === token.toLowerCase()) return true;
    }
    return false;
};

TextUtils.prototype.isHashtag = function(token) {
    return token.match(/^#([a-zA-Z0-9]+$)/g) !== null;
};

TextUtils.prototype.isUserHandle = function(token) {
    return token.match(/^(@[a-zA-Z0-9_]+$)/g) !== null;
};

TextUtils.prototype.isNumber = function(token) {
    return ! isNaN(token);
};

TextUtils.prototype.isStopword = function(token) {
    return stopWords.indexOf(token.toLowerCase()) !== -1;
};

TextUtils.prototype.calculateLogLikelihood = function(totalFrequency, freqWordA, freqWordB) {

    // Expected values 2*((a*ln (a/E1)) + (b*ln (b/E2))) 
    var expectedValue = (totalFrequency * (freqWordA + freqWordB)) / 
        (totalFrequency + totalFrequency);
    return 2 * ((freqWordA * Math.log(freqWordA / expectedValue)) + 
        (freqWordB * Math.log(freqWordB / expectedValue)));  
};

TextUtils.prototype.calculatePointwiseMutualInformation = function(
    totalFrequency, nGramFrequency, freqWordA, freqWordB) {

    // This is p(a|b)/ p(b)
    return (nGramFrequency / totalFrequency) / 
        ((freqWordA / totalFrequency) * (freqWordB / totalFrequency));
};

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

function createPosts(statuses) {
    var posts = [];
    
    var textUtils = new TextUtils();
    for (var i in statuses) {
        // Create tokens
        var tokens = textUtils.tokenize(statuses[i].text);
        var cleanTokens = textUtils.removeStopwords(tokens);

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

        posts.push(new Tweet(
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
    
    return posts;
}

function performCorpusCalculations(posts) {
            
    // Generate background statistics for the corpus
    var textUtils = new TextUtils();
    var termFrequencies = [];
    var nGramFrequencies = [];
    var totalFrequency = 0;
    
    for (var i = 0; i < posts.length; i++) {

        var sentences = textUtils.tokenizeToSentence(posts[i].getOriginalText());
        for (var j = 0; j < sentences.length; j++) {

            var tokens = textUtils.tokenize(sentences[j]);
            if (tokens === null) continue;
            for (var k = 0; k < tokens.length; k++) {

                var token = tokens[k].toLowerCase();
                if (textUtils.isStopword(token)) continue;
                if (! termFrequencies.hasOwnProperty(token)) {
                    termFrequencies[token] = 0;
                }
                termFrequencies[token]++;
                totalFrequency++;

                // Get the counts for the bi-grams
                if (k + 1 < tokens.length) {
                    if (! textUtils.isStopword(tokens[k + 1].toLowerCase())) {
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
    
    for (var i = 0; i < posts.length; i++) {
        
        var sentences = textUtils.tokenizeToSentence(posts[i].getOriginalText());
        for (var j = 0; j < sentences.length; j++) {
            
            var tokens = textUtils.tokenize(sentences[j]);
            if (tokens === null) continue;
            var phrases = [];
            for (var k = 0; k < tokens.length; k++) {
                if (k + 1 < tokens.length) {

                    if (textUtils.isStopword(tokens[k])) continue;
                    if (textUtils.isStopword(tokens[k + 1])) continue;
                    
                    var termA = tokens[k].toLowerCase();
                    var termB = tokens[k + 1].toLowerCase();
                    var freqWordA = termFrequencies[termA];
                    var freqWordB = termFrequencies[termB];
                    var nGram = termA + " " + termB;

                    // Calculate the phrase importance
                    var impScore = textUtils.calculatePointwiseMutualInformation(
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


        posts[i].setGraphNGrams(phrases);
    }
};

fs = require('fs')

fs.readFile('../../public_html/resources/stopwords.json', 'utf8', function (err, data) {
    if (err) {
        return console.log(err);
    }
    fileJson = JSON.parse(data);
    stopWords = fileJson.tokens;

    fs.readFile('../../public_html/test/search_response_1.json', 'utf8', function (err,data) {
        if (err) {
                return console.log(err);
        }
        fileJson = JSON.parse(data);
        posts = createPosts(fileJson.statuses);
        performCorpusCalculations(posts);
        
        for (var i = 0; i < posts.length; i++) {
            console.log(posts[i].getOriginalText());
            console.log(posts[i].getGraphNGrams());
        }
    });
});