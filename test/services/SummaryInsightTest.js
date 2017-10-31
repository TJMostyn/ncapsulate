describe ('SummaryInsight', function() {
    
    beforeEach(angular.mock.module('ncapsulateApp'));
    
    var summaryInsight;
    var resources;

    beforeEach(angular.mock.inject(function(_Resources_, _SummaryInsight_){
        resources = _Resources_;
        summaryInsight = _SummaryInsight_;
    }));
    
    describe('calculateCorrelation', function () {
        it('Ensure correlation correctly calculated', function () {
            
            var edges1 = [];
            var edges2 = [];
            
            for (var i = 0; i < 5; i++) {
                var name = "abcd" + i;
                var weight = (i + 5) * 2;
                edges1.push([name, weight]);
                edges2.push([name, weight]);
            }
            
            var correlation = summaryInsight.calculateCorrelation(edges1, edges2);
            expect(correlation).toBe(1);
        });
    });
    
    describe('calculateCorrelation unequal moments edge 1', function () {
        it('Ensure correlation correctly calculated', function () {
            
            var edges1 = [];
            var edges2 = [];
            
            for (var i = 0; i < 4; i++) {
                var name = "abcd" + i;
                var weight = (i + 5) * 2;
                edges1.push([name, weight]);
                edges2.push([name, weight]);
            }
            edges1.push(["abcd" + i, 18]);
            
            var correlation = summaryInsight.calculateCorrelation(edges1, edges2);
            expect(correlation).toBe(-0.4061384660534476);
        });
    });
    
    describe('calculateCorrelation unequal moments edge 2', function () {
        it('Ensure correlation correctly calculated', function () {
            
            var edges1 = [];
            var edges2 = [];
            
            for (var i = 0; i < 4; i++) {
                var name = "abcd" + i;
                var weight = (i + 5) * 2;
                edges1.push([name, weight]);
                edges2.push([name, weight]);
            }
            edges2.push(["abcd" + i, 18]);
            
            var correlation = summaryInsight.calculateCorrelation(edges1, edges2);
            expect(correlation).toBe(-0.4061384660534476);
        });
    });
});