var PREFIX_MENU = "menu";
var PREFIX_NODE = "node";
var PREFIX_LABEL = "label";
var PREFIX_POSTER = "poster";
var PREFIX_CONNECTOR = "cnctr";
var PREFIX_TERTIARY_CONNECTOR = "trtctr";
var PREFIX_POSTER_CONNECTOR = "pcnctr";
var EXCLUDE_MESH_NAME = PREFIX_MENU + "_exclude";
var EXCLUDE_MESH_INNER_NAME = EXCLUDE_MESH_NAME + "_inner";
var nodeLevels = {};

var nonSingleClickFired = false;
var pointerDown = false;
var dragStarted = false;
var pickedMesh = null;
var pickedText = null;
var pickedTextPosition = null;
var draggedMeshInfo = null;
var currentMeshPoint = null;

var mouseDownEvent = null;
var mouseUpEvent = null;
var mouseMoveEvent = null;
var clickEvent = null;
var dblClickEvent = null;
var mouseWheelEvent = null;

/***********************************************************************************
 * Handle all of the display for visual search results
 ***********************************************************************************/
angular.module('analyticsApp').service('VSRenderer', 
    function($rootScope, Resources, DisplayHelper) {

    this._shapeMesh;
    this._textMesh;
    this._engine = null;
    this._scene = null;
    nodeLevels = null;
    
    this.initialise = function() {
        if (nodeLevels === null)
            nodeLevels = {
                PRIMARY: new NodeLevelInfo("PRIMARY",
                    DisplayHelper.hexToRgb(Resources.getProperties().VS_PRIMARY_NODE_OUTER_COLOUR), 
                    DisplayHelper.hexToRgb(Resources.getProperties().VS_PRIMARY_NODE_INNER_COLOUR), 
                    true, Resources.getProperties().VS_NODE_TEXT_COLOUR, true, true),
                SECONDARY: new NodeLevelInfo("SECONDARY",
                    DisplayHelper.hexToRgb(Resources.getProperties().VS_SECONDARY_NODE_OUTER_COLOUR),
                    DisplayHelper.hexToRgb(Resources.getProperties().VS_SECONDARY_NODE_INNER_COLOUR),  
                    true, Resources.getProperties().VS_NODE_TEXT_COLOUR, true, true),
                TERTIARY: new NodeLevelInfo("TERTIARY",
                    DisplayHelper.hexToRgb(Resources.getProperties().VS_TERTIARY_NODE_OUTER_COLOUR), 
                    DisplayHelper.hexToRgb(Resources.getProperties().VS_TERTIARY_NODE_INNER_COLOUR), 
                    false, Resources.getProperties().VS_NODE_TEXT_COLOUR, false, false),
                POSTER: new NodeLevelInfo("POSTER",
                    DisplayHelper.hexToRgb(Resources.getProperties().VS_POSTER_NODE_OUTER_COLOUR), 
                    DisplayHelper.hexToRgb(Resources.getProperties().VS_POSTER_NODE_INNER_COLOUR), 
                    true, Resources.getProperties().VS_POSTER_TEXT_COLOUR, true, true)
            };
    };
    
    // Main function to call to display the results of the graph
    this.display = function (results, isRetreat) {
        
        var canvas = document.getElementById('vs-canvas');
            
        // Create the engine if it has not already been created
        if (this._engine === null) {
            this._engine = new BABYLON.Engine(canvas, true);
        }
        
        // If the scene already exists, then displose it before creating a new one
        if (this._scene !== null) {
            this._engine.stopRenderLoop();
            this._scene.dispose();
        }
        
        var engine = this._engine;
        var scene = setUpScene(canvas, this._engine);
        this._scene = scene;
        
        createExcludeNode(scene);
        drawGraph(scene, results);

        this._engine.runRenderLoop(function() {
            
            // Ensure that the exclude node stays static on the screen
            var excludeNode = scene.getMeshByID(EXCLUDE_MESH_NAME);
            var innerNode = scene.getMeshByID(EXCLUDE_MESH_INNER_NAME);
            var dir = BABYLON.Vector3.TransformNormal(
                new BABYLON.Vector3(0, 0, 1), scene.activeCamera.getWorldMatrix());
            excludeNode.position = innerNode.position = scene.activeCamera.position.add(dir.scale(10));
            excludeNode.rotationQuaternion = innerNode.rotationQuaternion = BABYLON.Quaternion.FromRotationMatrix(
                scene.activeCamera.getWorldMatrix());
            scene.render();
        });
        
        window.addEventListener('resize', function() {
            engine.resize();
        });

        if (isRetreat) {
            addZoomFromAnimation(scene, 150); 

            scene.beginAnimation(scene.activeCamera, 0, 100, false, 1, function() {

                // Tell the app that the animation has finished and to load other stuff
                $rootScope.$broadcast(events.SUMMARY_READY);

                scene.activeCamera.fov = 0.8;
                scene.activeCamera.setPosition(new BABYLON.Vector3(0, 0, 10));

                scene.activeCamera.animations.pop();
                toggleExcludeNodeDisplay(scene, true);
            }); 
        }
        else {
            addZoomToAnimation(scene, 150);
        
            scene.beginAnimation(scene.activeCamera, 0, 100, false, 1, function() {

                // Tell the app that the animation has finished and to load other stuff
                $rootScope.$broadcast(events.SUMMARY_READY);

                scene.activeCamera.fov = 0.8;
                scene.activeCamera.setPosition(new BABYLON.Vector3(0, 0, 10));

                scene.activeCamera.animations.pop();
                toggleExcludeNodeDisplay(scene, true);
            }); 
        }
    };
    
    this.retreatToNavigationLevel = function(position) {
        
        var scene = this._scene;
        
        // Tell the rest of the app we are starting to filter
        $rootScope.$broadcast(events.SEARCH_FILTER_STARTED);
        
        addRetreatAnimation(scene, 150);
        scene.beginAnimation(scene.activeCamera, 0, 100, false, 1, function() {
            
            scene.activeCamera.animations.pop();
            $rootScope.$broadcast(events.SUBMIT_NAVIGATION_RETREAT, position);
        });
    };
    
    this.hideMainDisplay = function() {
        var scene = this._scene;
        if (scene !== null) {
            for (var mesh in scene.meshes.reverse()) {
                scene.meshes[mesh].isVisible = false;
            }
        }
    };

    // Set up the Babylon scene, camera position, light etc
    function setUpScene(canvas, engine) {

        // Create the basic scene object
        var scene = new BABYLON.Scene(engine);

        // Background colour
        var bgColour = DisplayHelper.hexToRgb(Resources.getProperties().VS_BACKGROUND_COLOR);
        scene.clearColor = new BABYLON.Color4(
            bgColour.r / 255, bgColour.g / 255, bgColour.b / 255, 1);

        // Create a camera with position directly facing the clusters
        var camera = new BABYLON.ArcRotateCamera('Camera', 1, 0.8, 28, new BABYLON.Vector3(0, 0, 0), scene);
        camera.wheelPrecision = 10;
        camera.pinchPrecision = 7;
        camera.panningSensibility = 70;
        camera.setTarget(BABYLON.Vector3.Zero());
        camera.setPosition(new BABYLON.Vector3(0, 0, 1000));
        camera.attachControl(canvas, false);
        camera.lowerRadiusLimit = 0.5;

        // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
        var light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(-30, 30, 0), scene);
        
        // Dim the light a small amount
        light.intensity = 0.1;
        
        // Create a background mesh for mouse wheel interaction
        var material = new BABYLON.StandardMaterial("bgmaterial", scene);
        material.emissiveColor = new BABYLON.Color3(
            bgColour.r / 255, bgColour.g / 255, bgColour.b / 255);
        material.alpha = 0;
        var background = BABYLON.Mesh.CreateGround("ground", 50, 50, 2, scene);
        background.rotation = new BABYLON.Vector3(1.5, 0, 0);
        background.material = material;
        background.isVisible = true;
        background.isPickable = false;

        return scene;
    };
    
    function createExcludeNode(scene) {
        
        var vsNodeShape = new VSNodeShape(
            Resources.getExcludeIconPoints(), 0.7, 0, -3.5, 0);

        var excludeColour = DisplayHelper.hexToRgb(
            Resources.getProperties().VS_EXCLUDE_MESH_OUTER_COLOUR);
        var innerColour = DisplayHelper.hexToRgb(
            Resources.getProperties().VS_EXCLUDE_MESH_INNER_COLOUR);
    
        var excludeMaterial = new BABYLON.StandardMaterial(
            "pmi-exclude", scene);
        excludeMaterial.emissiveColor = new BABYLON.Color3(
            excludeColour.r / 255, excludeColour.g / 255, excludeColour.b / 255);
        excludeMaterial.backFaceCulling = false;

        var pathExclude = [
            BABYLON.Vector3.Zero(),
            new BABYLON.Vector3(0, 0, -0.05)
        ];

        var excludeMesh = BABYLON.Mesh.ExtrudeShape(
            EXCLUDE_MESH_NAME, 
            vsNodeShape.getVectors()[0], 
            pathExclude, 1, 0, BABYLON.Mesh.CAP_END, scene, true, "double");
        excludeMesh.material = excludeMaterial;
        excludeMesh.isPickable = true;
        
        for (var i = 1; i < vsNodeShape.getVectors().length; i++) {
            
            var innerMaterial = new BABYLON.StandardMaterial(
                "pmi-exclude-inner", scene);
            innerMaterial.emissiveColor = new BABYLON.Color3(
                innerColour.r / 255, innerColour.g / 255, innerColour.b / 255);
            innerMaterial.backFaceCulling = false;

            var pathInner = [
                BABYLON.Vector3.Zero(),
                new BABYLON.Vector3(0, 0, -0.1)
            ];

            var excludeInner = BABYLON.Mesh.ExtrudeShape(
                EXCLUDE_MESH_INNER_NAME, 
                vsNodeShape.getVectors()[i], 
                pathInner, 1, 0, BABYLON.Mesh.CAP_END, scene, true, "double");
            excludeInner.material = innerMaterial;
            excludeInner.isPickable = false;
        }
        
        // Hide them both
        toggleExcludeNodeDisplay(scene, false);
    };

    // Draw the graph itself - layout top n elements, and after secondary
    function drawGraph(scene, results) {

        var vsNodes = new Array();
        var displayedPosters = new Array();

        var clusters = new Array();
        
        for (var key in results.graph) {

            var edgeAdded = false;
            for (var addedKey in clusters) {
                if (results.graph[clusters[addedKey]].containsEdge(results.graph[key])) {
                    edgeAdded = true;
                }
            }
            
            if (! edgeAdded || results.graph[key].getWeight() / results.maxWeight >= 0.7)                    
                  clusters.push(key);
                    
            if (clusters.length >= Resources.getProperties().MAX_NO_PRIMARY_NODES)
                break;
        }

        var eachSegment = 360 / clusters.length;
        var radius = 2;
        var angle = 0;

        for (var i = 0; i < clusters.length; i++) {
      
            // Create the primary node
            var normalisedWeight = results.graph[clusters[i]].getWeight() / results.maxWeight;
            vsNodes[clusters[i]] = createNode(
                scene, 
                results.graph[clusters[i]], 
                nodeLevels.PRIMARY, 
                angle, 
                radius, 
                normalisedWeight, 
                null, 
                1);

            // Display the tweeters/ posters
            createPosterNodes(
                scene, vsNodes[clusters[i]], results.maxFollowers, displayedPosters, clusters.length);

            // Now display the children
            var edges = results.graph[clusters[i]].getEdges();

            // Break the edges down into various categories (
            var primaryEdges = [];
            var secondaryEdges = [];
            var tertiaryEdges = [];
            for (var edgeKey in edges) {
                if (clusters.indexOf(edgeKey) > -1)
                    primaryEdges.push(results.graph[edgeKey]);
                else if (results.graph[edgeKey].getWeight() > results.primaryEdgeWeightThreshold)
                    secondaryEdges.push(results.graph[edgeKey]);
                else
                    tertiaryEdges.push(results.graph[edgeKey]);
            }
            
            // Add links between first order nodes
            for (var j in primaryEdges) {
                
                var edgeKey = primaryEdges[j].getTerm();
                var edgeStart = vsNodes[clusters[i]];
                var edgeEnd = vsNodes[edgeKey];
                
                // Add a line if the node exists
                if (typeof(edgeEnd) === "undefined") continue;

                // Add lines between the nodes
                createConnectingLine(scene, edgeStart, edgeEnd, PREFIX_CONNECTOR, 
                    Resources.getProperties().VS_CONNECT_LINE_COLOUR, nodeLevels.PRIMARY);
            }

            // Create the secondary nodes
            var secondaryEdgeAngle = 0;
            var secondaryEdgeRadius = 1;
            for (var j in secondaryEdges) {

                // Only show n nodes, otherwise add secondary as tertiary
                if (j >= Resources.getProperties().MAX_NO_SECONDARY_NODES) {
                    tertiaryEdges.splice(0, secondaryEdges[j]);
                    continue;
                }
                    
                var edgeKey = secondaryEdges[j].getTerm();
                var edgeStart = vsNodes[clusters[i]];
                var edgeEnd = vsNodes[edgeKey];

                // Check if this already exists
                if (typeof(edgeEnd) === "undefined") {

                    // Add second order nodes
                    secondaryEdgeAngle += 360 / 
                        Math.min(secondaryEdges.length, Resources.getProperties().MAX_NO_SECONDARY_NODES);
                    var normalisedEdgeWeight = results.graph[edgeKey].getWeight() / results.maxWeight;

                    // Create the node itself
                    edgeEnd = createNode(
                        scene, 
                        results.graph[edgeKey],
                        nodeLevels.SECONDARY,
                        secondaryEdgeAngle, 
                        secondaryEdgeRadius, 
                        normalisedEdgeWeight, 
                        edgeStart, 
                        edges[edgeKey].getWeight());
                    vsNodes[edgeKey] = edgeEnd;
                }

                // Add lines between the nodes
                createConnectingLine(scene, edgeStart, edgeEnd, PREFIX_CONNECTOR, 
                    Resources.getProperties().VS_CONNECT_LINE_COLOUR, nodeLevels.SECONDARY);
            }
            
            // Create the tertiary nodes
            var tertiaryEdgeAngle = 15;
            var tertiaryEdgeRadius = 0.7;
            for (var j in tertiaryEdges) {
                
                if (j >= Resources.getProperties().MAX_NO_TERTIARY_NODES)
                    break;
                
                var edgeKey = tertiaryEdges[j].getTerm();
                var edgeStart = vsNodes[clusters[i]];

                // Add thrid order nodes - more than once for any given primary node
                tertiaryEdgeAngle += 360 / 
                    Math.min(tertiaryEdges.length, Resources.getProperties().MAX_NO_TERTIARY_NODES);
                var normalisedEdgeWeight = 
                    (results.graph[edgeKey].getWeight() / results.maxWeight);

                // Create the node itself
                edgeEnd = createNode(
                    scene, 
                    results.graph[edgeKey], 
                    nodeLevels.TERTIARY,
                    tertiaryEdgeAngle, 
                    tertiaryEdgeRadius, 
                    normalisedEdgeWeight * 0.6, 
                    edgeStart, 
                    edges[edgeKey].getWeight());
                vsNodes[edgeKey] = edgeEnd;

                // Add lines between the nodes
                createConnectingLine(scene, edgeStart, edgeEnd, PREFIX_TERTIARY_CONNECTOR, 
                    Resources.getProperties().VS_CONNECT_LINE_COLOUR, nodeLevels.TERTIARY);
            }

            angle += eachSegment;
        }

        // Handle the click events to show the posts
        addClickEvents(scene, vsNodes, results);

        return scene;
    };
    
    function createNode(
        scene, node, nodeLevelInfo, angle, radius, normalisedWeight, baseNode, relevanceWeight, zOverride) {
        
        var nodeDec = 0.8;
        var nodeOuterColour = nodeLevelInfo.getNodeOuterColour();
        var nodeInnerColour = nodeLevelInfo.getNodeInnerColour();
        var isHashtag = node.getTerm().indexOf('#') === 0;

        var vsNodeShape = new VSNodeShape(
            (isHashtag) ? Resources.getHashtagIconPoints() : Resources.getTopicIconPoints(),
            normalisedWeight * nodeDec, 
            ((baseNode === null) ? 0 : baseNode.getX()) + radius * Math.cos(angle * Math.PI / 180), 
            ((baseNode === null) ? 0 : baseNode.getY()) + radius * Math.sin(angle * Math.PI / 180), 
            ((baseNode === null) ? 0 : baseNode.getZ()) - (1 - relevanceWeight));

        var path = [
            BABYLON.Vector3.Zero(),
            new BABYLON.Vector3(0, 0, -0.1)
        ];

        var material = new BABYLON.StandardMaterial("nmo-" + node.getTerm(), scene);
        material.emissiveColor = new BABYLON.Color3(
            nodeOuterColour.r / 255, nodeOuterColour.g / 255, nodeOuterColour.b / 255);
        material.backFaceCulling = false;

        var primaryNode = BABYLON.Mesh.ExtrudeShape(
            PREFIX_NODE + "_" + nodeLevelInfo.getLevelName() + "_" + node.getTerm(), 
            vsNodeShape.getVectors()[0], 
            path, 1, 0, BABYLON.Mesh.CAP_END, scene, true, "double");
        primaryNode.material = material;
        primaryNode.isVisible = nodeLevelInfo.getIsNodeDisplayed();

        for (var i = 1; i < vsNodeShape.getVectors().length; i++) {
            
            var innerMaterial = new BABYLON.StandardMaterial(
                "pmi-" + i + node.getTerm(), scene);
            innerMaterial.emissiveColor = new BABYLON.Color3(
                nodeInnerColour.r / 255, nodeInnerColour.g / 255, nodeInnerColour.b / 255);
            innerMaterial.backFaceCulling = false;

            var pathInner = [
                BABYLON.Vector3.Zero(),
                new BABYLON.Vector3(0, 0, -0.05)
            ];

            var nodeInner = BABYLON.Mesh.ExtrudeShape(
                PREFIX_NODE + "_" + nodeLevelInfo.getLevelName() + "_" + i + node.getTerm(), 
                vsNodeShape.getVectors()[i], 
                pathInner, 1, 0, BABYLON.Mesh.CAP_END, scene, true, "double");
            nodeInner.material = innerMaterial;
            nodeInner.isVisible = nodeLevelInfo.getIsNodeDisplayed();
            nodeInner.isPickable = false;
        }

        if (typeof(zOverride) !== "undefined" && zOverride !== null) {
            primaryNode.position.z = zOverride;
        }

        var vsNode = new VSNode(node, 
            vsNodeShape.getX(),
            vsNodeShape.getY(),
            vsNodeShape.getZ());
            
        createNodeLabel(scene, 
            vsNode.getNode().getTerm(), 
            vsNode.getNode().getDisplayTerm(), 
            nodeLevelInfo,
            vsNode.getX(), 
            vsNode.getY(), 
            vsNode.getZ(), 
            normalisedWeight);
            
        return vsNode;
    };
      
    function createConnectingLine(scene, nodeStart, nodeEnd, connectorPrefix, hexColour, endNodeInfo) {
        
        var nodeId = connectorPrefix + "_" + 
            nodeStart.getNode().getTerm() + "~" + nodeEnd.getNode().getTerm();
        var lineColour = DisplayHelper.hexToRgb(hexColour);
        var babylonColour = new BABYLON.Color3(
            lineColour.r / 255, lineColour.g / 255, lineColour.b / 255);
    
        createConnectingLineWithPoints(scene, 
            nodeId, 
            babylonColour, 
            nodeStart.getX(), 
            nodeStart.getY(), 
            nodeStart.getZ(), 
            nodeEnd.getX(), 
            nodeEnd.getY(), 
            nodeEnd.getZ(),
            endNodeInfo);
    };
    
    function createConnectingLineWithPoints(scene, id, colour, x1, y1, z1, x2, y2, z2, endNodeInfo) {
               
        var shapeDepth = 0.15;
        var line = BABYLON.Mesh.CreateLines(id, [
            new BABYLON.Vector3(x1, y1, (z1 >= z2) ? z1 - shapeDepth : z1),
            new BABYLON.Vector3(x2, y2, (z2 >= z1) ? z2 - shapeDepth : z2)
        ], scene);
        line.color = colour;
        line.isVisible = endNodeInfo.getIsConnectorsDisplayed();
    };
    
    function createPosterNodes(scene, vsNode, maxFollowers, displayedPosters, noClusters) {
        
        // Calculate the actual number of posters to show
        var posts = new Array();
        for (var i = 0; i < vsNode.getNode().getPosts().length; i++) {
            if (displayedPosters.indexOf(vsNode.getNode().getPosts()[i].getPoster()) === -1) {
                posts.push(vsNode.getNode().getPosts()[i]);
                displayedPosters.push(vsNode.getNode().getPosts()[i].getPoster());
            }
        }
        
        var parentNodeDegrees = Math.atan2(vsNode.getY(), vsNode.getX()) * (180 / Math.PI);
        var noPostersToShow = Math.min(noClusters <= 5 ? 5 : noClusters >= 6 ? 3 : 4, posts.length);
        var posterIncrement = (360 / (noClusters * 0.6)) / noPostersToShow;
        var posterAngle = parentNodeDegrees - ((360 / (noClusters * 0.6)) / 2) + (posterIncrement / 2);
        var posterRadius = 2.3;
        
        for (var j = 0; j < noPostersToShow; j++) {

            // Calculate the normalised weighting
            var weightedFollowers = Math.max(posts[j].getNoFollowers() / maxFollowers, 0.4);
            
            var vsNodeShape = new VSNodeShape(
                Resources.getPosterIconPoints(),
                weightedFollowers, 
                vsNode.getX() + posterRadius * Math.cos(posterAngle * Math.PI / 180), 
                vsNode.getY() + posterRadius * Math.sin(posterAngle * Math.PI / 180), 
                vsNode.getZ() - 1);
        
            var path = [
                BABYLON.Vector3.Zero(),
                new BABYLON.Vector3(0, 0, -0.1)
            ];
            
            var extrudeColour = DisplayHelper.hexToRgb(
                Resources.getProperties().VS_POSTER_NODE_OUTER_COLOUR);
            var material = new BABYLON.StandardMaterial(
                "pmo-" + vsNode.getNode().getPosts()[j].getPoster(), scene);
            material.emissiveColor = new BABYLON.Color3(
                extrudeColour.r / 255, extrudeColour.g / 255, extrudeColour.b / 255);
            material.backFaceCulling = false;
            
            var extruded = BABYLON.Mesh.ExtrudeShape(
                PREFIX_POSTER + "_" + posts[j].getPoster(), 
                vsNodeShape.getVectors()[0], 
                path, 1, 0, BABYLON.Mesh.CAP_END, scene, true, "double");
            extruded.material = material;
            
            for (var i = 1; i < vsNodeShape.getVectors().length; i++) {
                var innerExtrudeColour = DisplayHelper.hexToRgb(
                    Resources.getProperties().VS_POSTER_NODE_INNER_COLOUR);
                var innerMaterial = new BABYLON.StandardMaterial(
                    "pmi-" + i + vsNode.getNode().getPosts()[j].getPoster(), scene);
                innerMaterial.emissiveColor = new BABYLON.Color3(
                    innerExtrudeColour.r / 255, innerExtrudeColour.g / 255, innerExtrudeColour.b / 255);
                innerMaterial.backFaceCulling = false;

                var pathInner = [
                    BABYLON.Vector3.Zero(),
                    new BABYLON.Vector3(0, 0, -0.05)
                ];

                var extrudedInner = BABYLON.Mesh.ExtrudeShape(
                    PREFIX_POSTER + "_inner_" + i + posts[j].getPoster(), 
                    vsNodeShape.getVectors()[i], 
                    pathInner, 1, 0, BABYLON.Mesh.CAP_END, scene, true, "double");
                extrudedInner.material = innerMaterial;
                extrudedInner.isPickable = false;
            }

            // Text to be added on top
            createNodeLabel(scene, 
                "@" + posts[j].getPoster(), 
                "@" + posts[j].getPoster(), 
                nodeLevels.POSTER,
                vsNode.getX() + posterRadius * Math.cos(posterAngle * Math.PI / 180), 
                vsNode.getY() + posterRadius * Math.sin(posterAngle * Math.PI / 180), 
                vsNode.getZ() - 1, 
                weightedFollowers * 0.9);
                
            posterAngle += posterIncrement;
            
            // Create the line between the main node and the poster
            var lineColour = DisplayHelper.hexToRgb(Resources.getProperties().VS_POSTER_LINE_COLOUR);
            var babylonColour = new BABYLON.Color3(
                lineColour.r / 255, lineColour.g / 255, lineColour.b / 255);
        
            createConnectingLineWithPoints(scene, 
                PREFIX_POSTER_CONNECTOR + "_" + posts[j].getPoster() + "~" + vsNode.getNode().getTerm(), 
                babylonColour, 
                vsNodeShape.getX(), 
                vsNodeShape.getY(), 
                vsNodeShape.getZ(), 
                vsNode.getX(), 
                vsNode.getY(), 
                vsNode.getZ(),
                nodeLevels.POSTER);
        }
    };

    // Create the labels for the nodes
    function createNodeLabel(scene, text, displayText, nodeLevelInfo, x, y, z, normalisedWeight) {
        
        var textSize = 20 + (40 * normalisedWeight);
        
        var outputplane = BABYLON.Mesh.CreatePlane(
            PREFIX_LABEL + "_" + nodeLevelInfo.getLevelName() + "_" + text, 2.5, scene, false);
	outputplane.material = new BABYLON.StandardMaterial("sm-" + text, scene);
	outputplane.position = new BABYLON.Vector3(x, y, z + 0.1);
        outputplane.rotation = new BABYLON.Vector3(0, 3.15, 0);
        outputplane.isPickable = false;
        outputplane.isVisible = nodeLevelInfo.getIsTextDisplayed();

        var displayTexts = null;
        if (displayText.length > 16) {
            displayTexts = displayText.split(" ");
            displayText = displayTexts[0];
        }
        
	var outputplaneTexture = new BABYLON.DynamicTexture("nt-" + text, 512, scene, true);        
	outputplane.material.opacityTexture = outputplaneTexture;
	outputplane.material.diffuseTexture = outputplaneTexture;
	outputplane.material.specularColor = new BABYLON.Color3(0, 0, 0);
	outputplane.material.emissiveColor = new BABYLON.Color3(1, 1, 1);
	outputplane.material.backFaceCulling = false;

	outputplaneTexture.drawText(
            displayText, null, 280, textSize + "px Helvetica", nodeLevelInfo.getTextColour());
        
        //If the test is > 16 characters, then split it by using 2 textures
        if (displayTexts !== null && displayTexts.length > 1) {
            outputplaneTexture.drawText(
                displayTexts[1], null, 280 + textSize, 
                textSize + "px Helvetica", nodeLevelInfo.getTextColour());
        }
        
        outputplaneTexture.update(true);
    };

    // Handle user interaction for click and double click
    function addClickEvents(scene, vsNodes, results) {

        var canvas = scene.getEngine().getRenderingCanvas();
        var camera = scene.activeCamera;

        // Remove the event listeners if required
        canvas.removeEventListener("pointerdown", mouseDownEvent);
        canvas.removeEventListener("pointerup", mouseUpEvent);
        canvas.removeEventListener("pointermove", mouseMoveEvent);
        canvas.removeEventListener("click", clickEvent);
        canvas.removeEventListener("dblclick", dblClickEvent);
        canvas.removeEventListener("mousewheel", mouseWheelEvent);
        
        mouseDownEvent = function(evt) {

            toggleConnectorPickability(scene, false);
            var pickInfo = scene.pick(evt.clientX, evt.clientY);
            toggleConnectorPickability(scene, true);
            
            // Check we have something interesting...
            if (pickInfo.hit) {
                
                if (getPickedItemInfo(pickInfo).type !== PREFIX_NODE) {
                    return;
                }
                
                pickedMesh = pickInfo.pickedMesh;
                pickedText = scene.getMeshByName(pickedMesh.id.replace(PREFIX_NODE, PREFIX_LABEL));
                pickedTextPosition = pickedText.position.clone();
                currentMeshPoint = pickInfo.pickedPoint;
                draggedMeshInfo = getPickedItemInfo(pickInfo);
                pointerDown = true;
                pickedMesh.isPickable = false;
                pickedMesh.material.alpha = 0.5;
                
                // Detach the camera
                setTimeout(function () { camera.detachControl(canvas); }, 0);
            }
        };
        
        mouseUpEvent = function(evt) {
  
            camera.attachControl(canvas, true);
            pointerDown = false;
            
            var pickInfo = scene.pick(evt.clientX, evt.clientY);
            if (pickInfo.hit) { 
                
                if (dragStarted) {                    
                    // Check if this is the exclude icon...if so, start a new search
                    var pickedItem = getPickedItemInfo(pickInfo);
                    var meshName = draggedMeshInfo.name;
                    draggedMeshInfo = null;
                    pickedMesh.isPickable = true;
                    if (PREFIX_MENU + "_" + pickedItem.name === EXCLUDE_MESH_NAME) {

                        // Fade everythign out
                        for (var mesh in scene.meshes.reverse()) {
                            BABYLON.Animation.CreateAndStartAnimation(
                                "fade-mesh", 
                                scene.meshes[mesh], 
                                'visibility', 150, 90, 1, 0, 0 );
                        }
 
                        $rootScope.$broadcast(events.SEARCH_FILTER_STARTED);
                        $rootScope.$broadcast(events.SUBMIT_SEARCH, "-" + meshName);
                        dragStarted = false;
                        pickedMesh.isPickable = true;
                        return;
                    }
                }
            }
            
            if (dragStarted) {
                // Send the mesh back to its original place
                pickedMesh.position.x = 0;
                pickedMesh.position.y = 0;
                pickedMesh.position.z = 0;
                
                pickedText.position = pickedTextPosition;
                pickedMesh.material.alpha = 1;
                dragStarted = false;
            }
            
            pickedMesh.isPickable = true;
        };
        
        mouseMoveEvent = function(evt) {
            
            var mouseOutColour = DisplayHelper.hexToRgb(
                Resources.getProperties().VS_EXCLUDE_MESH_OUTER_COLOUR);
            var mouseOverColour = DisplayHelper.hexToRgb(
                Resources.getProperties().VS_EXCLUDE_MOUSEOVER_MESH_COLOUR);
        
            if (pointerDown) {
                dragStarted = true;
                var currentPosition = getMousePointerPosition(scene, evt);
                var diff = currentPosition.subtract(currentMeshPoint);
                
                pickedMesh.position.addInPlace(diff);
                pickedText.position.addInPlace(diff);
                currentMeshPoint = currentPosition;
            
                var pickInfo = scene.pick(evt.clientX, evt.clientY);
                if (pickInfo.hit) { 
                    var pickedItem = getPickedItemInfo(pickInfo);
                    if (PREFIX_MENU + "_" + pickedItem.name === EXCLUDE_MESH_NAME) {
                        pickInfo.pickedMesh.material.emissiveColor = new BABYLON.Color3(
                            mouseOverColour.r / 255, mouseOverColour.g / 255, mouseOverColour.b / 255);
                    }
                }
                else {
                    scene.getMeshByName(EXCLUDE_MESH_NAME).material.emissiveColor = new BABYLON.Color3(
                        mouseOutColour.r / 255, mouseOutColour.g / 255, mouseOutColour.b / 255);
                }
            }
        };
        
        clickEvent = function (evt) {
            
            // Put into timout so that this does not get called before double click
            setTimeout(function() {
                
                if (nonSingleClickFired === true) return;
                if (pointerDown === true) return;
                
                var pickInfo = scene.pick(evt.clientX, evt.clientY);

                // Ensure that this is an object
                if (pickInfo.hit) {
                    
                    var pickedItemInfo = getPickedItemInfo(pickInfo);
                    
                    switch(pickedItemInfo.type) {
                        
                        // Show posts for a given node
                        case PREFIX_NODE:
                            var posts = vsNodes[pickedItemInfo.name].getNode().getPosts();
                            posts = posts.filter(function(item, pos) {
                                return posts.indexOf(item) === pos;
                            });
                            $rootScope.$broadcast(events.NODE_CLICKED, posts);
                            break;
                            
                        // Show posts for posters
                        case PREFIX_POSTER:
                            var posts = results.posters[pickedItemInfo.name].getPosts();
                            posts = posts.filter(function(item, pos) {
                                return posts.indexOf(item) === pos;
                            });
                            $rootScope.$broadcast(events.NODE_CLICKED, posts);
                            break;
                            
                        // Show posts for connecting line between nodes
                        case PREFIX_CONNECTOR:
                        case PREFIX_TERTIARY_CONNECTOR:
                            var nodeNames = pickedItemInfo.name.split("~");
                            var node1Posts = vsNodes[nodeNames[0]].getNode().getPosts();
                            var node2Posts = vsNodes[nodeNames[1]].getNode().getPosts();
                            var filteredPosts = node1Posts.filter(function(n) {
                                return node2Posts.indexOf(n) !== -1;
                            });
                            $rootScope.$broadcast(events.NODE_CLICKED, filteredPosts);
                            break;
                            
                        // Show posts for connecting line between posters
                        case PREFIX_POSTER_CONNECTOR:
                            var nodeNames = pickedItemInfo.name.split("~");
                            var node1Posts = results.posters[nodeNames[0]].getPosts();
                            var node2Posts = vsNodes[nodeNames[1]].getNode().getPosts();
                            var filteredPosts = node1Posts.filter(function(n) {
                                return node2Posts.indexOf(n) !== -1;
                            });
                            $rootScope.$broadcast(events.NODE_CLICKED, filteredPosts);
                            break;
                    };
                }
                else {
                    $rootScope.$broadcast(events.NODE_UNCLICKED, posts);
                }
            }, 200);
        };
        
        dblClickEvent = function (evt) {
            
            // Ignore all connectors for double clicks
            toggleConnectorPickability(scene, false);
            
            var timing = 150;
            nonSingleClickFired = true;
            var pickInfo = scene.pick(evt.clientX, evt.clientY);
            
            // Restore connectors
            toggleConnectorPickability(scene, true);
            
            // This needs to be called once the new search has been started
            setTimeout(function() { nonSingleClickFired = false; }, 300);
            
            // If we have clicked on a node or a poster, then edit the search
            if (pickInfo.hit) {
          
                var pickedItemInfo = getPickedItemInfo(pickInfo);
                
                // Only do stuff for filterabe nodes
                if (pickedItemInfo.type !== PREFIX_NODE) {
                    return;
                }
                
                // Tell the rest of the app we are starting to filter
                $rootScope.$broadcast(events.SEARCH_FILTER_STARTED);
                
                // Add the position and zoom animations
                addCameraPositionAnimation(
                    scene, pickInfo.pickedPoint.x, pickInfo.pickedPoint.y, 0, 150);
                addZoomToAnimation(scene, 150);
                scene.beginAnimation(scene.activeCamera, 0, 100, false, 1, function() {
                    
                    // Now submit the new search
                    $rootScope.$broadcast(events.SUBMIT_SEARCH, pickedItemInfo.name);
                    scene.activeCamera.animations.pop();
                    scene.activeCamera.animations.pop();
                });
                
                // Hide all connectors during transition
                toggleConnectorDisplay(scene, false);
                
                // Fade out the chart as we go
                for (var mesh in scene.meshes.reverse()) {
                    if (scene.meshes[mesh].name.indexOf(PREFIX_NODE + "_") > -1 ||
                        scene.meshes[mesh].name.indexOf(PREFIX_LABEL + "_") > -1) {
                        
                        BABYLON.Animation.CreateAndStartAnimation(
                        "fade-label", 
                        scene.meshes[mesh], 
                        'visibility', timing, 90, 1, 0, 0 );
                    }
                }
            }
        };
        
        mouseWheelEvent = function (evt) {
            
            var newZPosition = (evt.deltaY < 0) ? 
                scene.activeCamera.position.z - 3 : scene.activeCamera.position.z + 3;
            if (newZPosition < 6.5) {
                toggleGranularDisplay(scene, true);
            }
            else {
                toggleGranularDisplay(scene, false);
            }
            
            if (evt.deltaY < 0) {

                var pickedPoint = getMousePointerPosition(scene, evt);
                addCameraPositionAnimation(scene, pickedPoint.x, pickedPoint.y, 0, 250);
                scene.beginAnimation(scene.activeCamera, 0, 100, false, 1, function() {

                    scene.activeCamera.animations.pop();
                });
            }
            else {
                var xPoint = scene.activeCamera.position.x - (
                    scene.activeCamera.position.x * (scene.activeCamera.position.z / 10));
                var yPoint = scene.activeCamera.position.y - (
                    scene.activeCamera.position.y * (scene.activeCamera.position.z / 10));
                
                addCameraPositionAnimation(scene, xPoint, yPoint, 0, 250);
                scene.beginAnimation(scene.activeCamera, 0, 100, false, 1, function() {

                    scene.activeCamera.animations.pop();
                });
            }
        };
        
        // Add all of the event listeners
        canvas.addEventListener("pointerdown", mouseDownEvent);
        canvas.addEventListener("pointerup", mouseUpEvent);
        canvas.addEventListener("pointermove", mouseMoveEvent);
        canvas.addEventListener("click", clickEvent);
        canvas.addEventListener("dblclick", dblClickEvent);
        canvas.addEventListener("mousewheel", mouseWheelEvent);
    };
    
    function addCameraPositionAnimation(scene, xPoint, yPoint, zPoint, timing) {
        
        var newPoint = new BABYLON.Vector3(xPoint, yPoint, zPoint);
        var animationForCameraTarget = new BABYLON.Animation(
            "cameraTargetAnimation",
            "target",
            timing,
            BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        var keysCameraTarget = [];
        keysCameraTarget.push({
            frame: 0,
            value: scene.activeCamera.target
        });
        keysCameraTarget.push({
            frame: 100,
            value: newPoint
        });
        animationForCameraTarget.setKeys(keysCameraTarget);
        scene.activeCamera.animations.push(animationForCameraTarget);
    };
    
    function addZoomToAnimation(scene, timing) {
        
        // Animate to the front
        var animationBox = new BABYLON.Animation(
            "tutoAnimation", "fov", timing, BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);

        var keys = [];
        keys.push({
            frame: 0,
            value: scene.activeCamera.fov
        });
        keys.push({
            frame: 100,
            value: 0.01
        });

        animationBox.setKeys(keys);
        scene.activeCamera.animations.push(animationBox);  
    };
    
    function addZoomFromAnimation(scene, timing) {
        
        scene.activeCamera.setPosition(new BABYLON.Vector3(0, 0, 10));
        var animationBox = new BABYLON.Animation(
            "tutoAnimation", "fov", timing, BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);

        var keys = [];
        keys.push({
            frame: 0,
            value: 0.01
        });
        keys.push({
            frame: 100,
            value: 0.8
        });

        animationBox.setKeys(keys);
        scene.activeCamera.animations.push(animationBox);     
    };
    
    function addRetreatAnimation(scene, timing) {
        
        // Animate the results back into the distance
        var animationBox = new BABYLON.Animation(
            "tutoAnimation", "fov", timing, BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);

        var keys = [];
        keys.push({
            frame: 0,
            value: 1
        });
        keys.push({
            frame: 100,
            value: 3.2
        });

        animationBox.setKeys(keys);
        scene.activeCamera.animations.push(animationBox);  
    };
    
    function getMousePointerPosition(scene, evt) {
        
        var ground = scene.getMeshByID("ground");
        ground.isPickable = true;
        pickInfo = scene.pick(evt.clientX, evt.clientY);
        var pickedPoint = pickInfo.pickedPoint;
        ground.isPickable = false; 
        
        return pickedPoint;
    };
    
    function getPickedItemInfo(pickInfo) {
        
        var nodeNameParts = pickInfo.pickedMesh.name.split("_");
        if (nodeNameParts.length <= 1) {
            console.log("Unrecognised node name: " + pickInfo.pickedMesh.name);
            return null;
        }
        
        var nodeType = nodeNameParts[0];
        var nodeName = pickInfo.pickedMesh.name.substring(
            pickInfo.pickedMesh.name.indexOf("_") + 1);
    
        if (nodeType === PREFIX_NODE) {
            nodeName = nodeName.substring(nodeName.indexOf("_") + 1);
        }
    
        return {
            type: nodeType,
            name: nodeName
        };
    };
    
    function toggleExcludeNodeDisplay(scene, isDisplayed) {
        var excludeNode = scene.getMeshByID(EXCLUDE_MESH_NAME);
        excludeNode.isVisible = isDisplayed;
        var innerNode = scene.getMeshByID(EXCLUDE_MESH_INNER_NAME);
        innerNode.isVisible = isDisplayed;
    }
    
    function toggleConnectorDisplay(scene, isDisplayed) {
        for (var mesh in scene.meshes.reverse()) {
            if (scene.meshes[mesh].name.indexOf(PREFIX_CONNECTOR) > -1 ||
                scene.meshes[mesh].name.indexOf(PREFIX_POSTER_CONNECTOR) > -1 ||
                scene.meshes[mesh].name.indexOf(PREFIX_TERTIARY_CONNECTOR) > -1) {
                scene.meshes[mesh].isVisible = isDisplayed;
            }
        }
    };
    
    function toggleConnectorPickability(scene, isPickable) {
        for (var mesh in scene.meshes.reverse()) {
            if (scene.meshes[mesh].name.indexOf(PREFIX_CONNECTOR) > -1 ||
                scene.meshes[mesh].name.indexOf(PREFIX_POSTER_CONNECTOR) > -1 ||
                scene.meshes[mesh].name.indexOf(PREFIX_TERTIARY_CONNECTOR) > -1) {
                scene.meshes[mesh].isPickable = isPickable;
            }
        }
    };
    
    function toggleGranularDisplay(scene, isGranular) {
        
        var primaryNodeName = PREFIX_NODE + "_" + nodeLevels.PRIMARY.getLevelName() + "_";
        var secondaryNodeName = PREFIX_NODE + "_" + nodeLevels.SECONDARY.getLevelName() + "_";
        var tertiaryNodeName = PREFIX_NODE + "_" + nodeLevels.TERTIARY.getLevelName() + "_";
        var tertiaryPosterName = PREFIX_LABEL + "_" + nodeLevels.TERTIARY.getLevelName() + "_";
        for (var mesh in scene.meshes.reverse()) {
            
            // Toggle the connecting lines
            if (scene.meshes[mesh].name.indexOf(PREFIX_CONNECTOR) > -1 ||
                scene.meshes[mesh].name.indexOf(PREFIX_POSTER_CONNECTOR) > -1) {
                scene.meshes[mesh].isVisible = ! isGranular;
            }
            else if (scene.meshes[mesh].name.indexOf(PREFIX_TERTIARY_CONNECTOR) > -1) {
                scene.meshes[mesh].isVisible = isGranular;
            }
            
            // Now toggle the tertiary nodes
            if (scene.meshes[mesh].name.indexOf(tertiaryNodeName) > -1) {
                scene.meshes[mesh].isVisible = isGranular;
            }
            
            // Toggle the labels
            if (scene.meshes[mesh].name.indexOf(tertiaryPosterName) > -1) {
                scene.meshes[mesh].isVisible = isGranular;
            }
            
            // Fade the primary nodes
            if (scene.meshes[mesh].name.indexOf(primaryNodeName) > -1 ||
                scene.meshes[mesh].name.indexOf(secondaryNodeName) > -1) {
                scene.meshes[mesh].material.alpha = (isGranular) ? 0.5 : 1;
            }
        }
    };
});

/***********************************************************************************
 * An visual search node
 ***********************************************************************************/
var VSNode = function (node, x, y, z) {
    this._node = node;
    this._x = x;
    this._y = y;
    this._z = z;
};

VSNode.prototype.getNode = function() {
    return this._node;
};

VSNode.prototype.getX = function() {
    return this._x;
};

VSNode.prototype.getY = function() {
    return this._y;
};

VSNode.prototype.getZ = function() {
    return this._z;
};

/***********************************************************************************
 * Speech bubble for the poster node shapes
 ***********************************************************************************/
var VSNodeShape = function(points, normalisedWeight, x, y, z) {
    
    this._x = x;
    this._y = y;
    this._z = z;
    
    y = y + (normalisedWeight / 2);
    x = (x * -1) - (normalisedWeight / 2);
    z = z * -1;
    
    this._shape = [];
    for (var i = 0; i < points.length; i++) {
        this._shape[i] = [];
        for (var j = 0; j < points[i].length; j++) {
            this._shape[i].push(new BABYLON.Vector3((points[i][j][0] * normalisedWeight) + x, 
                (points[i][j][1] * normalisedWeight) + y, 
                (points[i][j][2] * normalisedWeight) + z));
        }
    }
};

VSNodeShape.prototype.getVectors = function() {
    return this._shape;
};

VSNodeShape.prototype.getX = function() {
    return this._x;
};

VSNodeShape.prototype.getY = function() {
    return this._y;
};

VSNodeShape.prototype.getZ = function() {
    return this._z;
};

/***********************************************************************************
 * An object to hold display information about a node/ nodel label
 ***********************************************************************************/
var NodeLevelInfo = function (levelName, nodeOuterColour, nodeInnerColour, 
    isNodeDisplayed, textColour, isTextDisplayed, isConnectorsDisplayed) {

    this._levelName = levelName;
    this._nodeOuterColour = nodeOuterColour;
    this._nodeInnerColour = nodeInnerColour;
    this._isNodeDisplayed = isNodeDisplayed;
    this._textColour = textColour;
    this._isTextDisplayed = isTextDisplayed;
    this._isConnectorsDisplayed = isConnectorsDisplayed;
};

NodeLevelInfo.prototype.getLevelName = function() {
    return this._levelName;
};

NodeLevelInfo.prototype.getNodeOuterColour = function() {
    return this._nodeOuterColour;
};

NodeLevelInfo.prototype.getNodeInnerColour = function() {
    return this._nodeInnerColour;
};

NodeLevelInfo.prototype.getIsNodeDisplayed = function() {
    return this._isNodeDisplayed;
};

NodeLevelInfo.prototype.getTextColour = function() {
    return this._textColour;
};

NodeLevelInfo.prototype.getIsTextDisplayed = function() {
    return this._isTextDisplayed;
};

NodeLevelInfo.prototype.getIsConnectorsDisplayed = function() {
    return this._isConnectorsDisplayed;
};