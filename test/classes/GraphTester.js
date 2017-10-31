describe ('GraphTesting', function() {
    
    describe('addOrIncrementEdge', function () {
        it('Test ensures that edges are correctly incremented', function () {
        
            var node1 = new GraphNode("node1");
            var node2 = new GraphNode("node2");
            
            node1.addOrIncrementEdge(node2, 10);
            node2.addOrIncrementEdge(node1, 10);
            
            expect(node1.getEdge(node2).getWeight()).toBe(20);
            expect(node2.getEdge(node1).getWeight()).toBe(20);
        });
    });
});

