/*global window, document, console, THREE, CANNON, SimplexNoise */

/*
 * TODO :
 * 
 * - polar equation tracks
 */


// Moves center of mass

var setCOM = function( body, com ) {

	if (!com) {
		//first calculate the center of mass
		com = new CANNON.Vec3();

		body.shapeOffsets.forEach( function( offset ) {
			com.vadd( offset, com );
		});

		com.scale( 1/body.shapes.length, com );
	}

	//move the shapes so the body origin is at the COM
	body.shapeOffsets.forEach( function( offset ) {
		offset.vsub( com, offset );
	});

	//now move the body so the shapes' net displacement is 0
	var worldCOM = new CANNON.Vec3();
	body.vectorToWorldFrame( com, worldCOM );
	body.position.vadd( worldCOM, body.position );
};


// CONFIGURATION

var config = {
	chassisWidth: 										3.5,
	chassisLength: 										6.5,
	chassisHeight: 										2.5,
	chassisMass: 											300,
	chassisCOM:												new CANNON.Vec3(-0.5,0,-0.5),	// Center of mass offset from center

	wheelRadius: 											0.6,
	wheelWidth: 											0.5,
	wheelMass: 												0,
	wheelBaseWidth: 									3,
	wheelBaseLength: 									4,
	wheelBaseOffset: 									-0.15,		// Vertical suspension upper attachment

	wheelFrictionSlip: 								0.75,
	wheelSteeringRollInfluence: 			0.02,

	wheelSteeringMax: 								0.75,
	wheelSteeringSpeed:								1.5,
	wheelIsSteeringBack:							true,
	wheelSteeringBackRatio:						0.5,

	wheelTransmissionType: 						"4WD",	// "FWD", "RWD" or "4WD"

	brakeForce: 											25,

	engineForceMax: 									7000,

	suspensionRestLength: 						1,
	suspensionTravelMax: 							0.75,
	suspensionForceMax: 							2000,
	suspensionStiffness: 							30,
	suspensionDampingRelaxation: 			2.3,
	suspensionDampingCompression: 		4.4,

	customSlidingRotationalSpeed: 		-30,	// ???
	useCustomSlidingRotationalSpeed: 	true,
};


var nPlayers = 2;
var racers = [];

var demo = new CANNON.Demo();
var camera = demo.camera;	// Get the camera
var cameraMode = "static";



// RACER OBJECT

var Racer = function(id, demo, config) {

	this.id = id;
	this.config = config;
	this.demo = demo;
	this.world = this.demo.getWorld();

	this.steeringDirection = 0;
	this.steering = 0;

	this.vehicle = {};
	this.velocity = 0;

	// CHASSIS

	// Chassis material
	var playerColors = [0x80ff00, 0xffff00, 0xff8000, 0xff0000];

	this.demo.currentMaterial = new THREE.MeshLambertMaterial({ color: new THREE.Color( playerColors[this.id] ) });

	this.chassisShape = new CANNON.Box(new CANNON.Vec3(
		this.config.chassisLength/2, 
		this.config.chassisWidth/2, 
		this.config.chassisHeight/2
	));

	this.chassisBody = new CANNON.Body({ mass: this.config.chassisMass });
	this.chassisBody.addShape(this.chassisShape);

	setCOM(this.chassisBody, this.config.chassisCOM);	// Set center of mass

	var posX, posY;
	var posOffsetX = 3.5,
			posOffsetY = 5;

	if (this.id % 2 === 0) {
		posX = -posOffsetX;
	} else {
		posX = posOffsetX;
	}

	if (this.id > 1) {
		posY = posOffsetY;
	} else {
		posY = -posOffsetY;
	}

	this.chassisBody.position.set(0 + posY, 40 + posX, 10);	// a bit above the ground
//	this.demo.addVisual(this.chassisBody);

	// Create the vehicle
	this.vehicle = new CANNON.RaycastVehicle({
		chassisBody: this.chassisBody,
	});

	// The physical mesh
	this.buggy = new THREE.Mesh( buggyModel, new THREE.MeshLambertMaterial( { color: new THREE.Color( playerColors[this.id] ) } ) );
	this.buggy.matrixAutoUpdate = true;
	this.buggy.scale = new THREE.Vector3( 10, 10, 10 );
	var quaternion = new THREE.Quaternion();
	quaternion.setFromAxisAngle( new THREE.Vector3( 0, 0, 1 ), Math.PI / 2 );
	this.buggy.rotation = quaternion;
	this.buggy.updateMatrix();
	this.buggy.updateMatrixWorld();
	this.demo.scene.add( this.buggy );


	// WHEELS

	var wheelOptions = {
		radius: 													this.config.wheelRadius,
		suspensionRestLength: 						this.config.suspensionRestLength,
		suspensionStiffness: 							this.config.suspensionStiffness,
		dampingRelaxation: 								this.config.suspensionDampingRelaxation,
		dampingCompression: 							this.config.suspensionDampingCompression,
		frictionSlip: 										this.config.wheelFrictionSlip,
		rollInfluence: 										this.config.wheelSteeringRollInfluence,
		maxSuspensionTravel: 							this.config.suspensionTravelMax,
		maxSuspensionForce: 							this.config.suspensionForceMax,
		customSlidingRotationalSpeed: 		this.config.customSlidingRotationalSpeed,
		useCustomSlidingRotationalSpeed: 	this.config.useCustomSlidingRotationalSpeed,
		directionLocal: 									new CANNON.Vec3(0, 0, -1),
		axleLocal: 												new CANNON.Vec3(0, 1, 0),
		chassisConnectionPointLocal: 			new CANNON.Vec3() // will vary for each wheel
	};

	// Add logical wheels
	var wheelX = this.config.wheelBaseLength/2,
			wheelY = this.config.wheelBaseWidth/2,
			wheelZ = this.config.wheelBaseOffset - this.config.chassisCOM.z;

	wheelOptions.chassisConnectionPointLocal.set(wheelX - this.config.chassisCOM.x, wheelY - this.config.chassisCOM.y, wheelZ);
	this.vehicle.addWheel(wheelOptions);

	wheelOptions.chassisConnectionPointLocal.set(wheelX - this.config.chassisCOM.x, -wheelY - this.config.chassisCOM.y, wheelZ);
	this.vehicle.addWheel(wheelOptions);

	wheelOptions.chassisConnectionPointLocal.set(-wheelX - this.config.chassisCOM.x, wheelY - this.config.chassisCOM.y, wheelZ);
	this.vehicle.addWheel(wheelOptions);

	wheelOptions.chassisConnectionPointLocal.set(-wheelX - this.config.chassisCOM.x, -wheelY - this.config.chassisCOM.y, wheelZ);
	this.vehicle.addWheel(wheelOptions);

	this.vehicle.addToWorld(this.world);

	// Add physical wheels
	this.wheelBodies = [];

	// Wheel material
	this.demo.currentMaterial = new THREE.MeshLambertMaterial({ color: new THREE.Color( 0x333333 ) });

	for(var i=0; i<this.vehicle.wheelInfos.length; i++){
		var wheel = this.vehicle.wheelInfos[i];
		var cylinderShape = new CANNON.Cylinder(wheel.radius, wheel.radius, this.config.wheelWidth, 20);
		var wheelBody = new CANNON.Body({
			mass: this.config.wheelMass
		});
		wheelBody.type = CANNON.Body.KINEMATIC;
		wheelBody.collisionFilterGroup = 0; // turn off collisions
		var q = new CANNON.Quaternion();
		q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
		wheelBody.addShape(cylinderShape, new CANNON.Vec3(), q);
		this.wheelBodies.push(wheelBody);
		this.demo.addVisual(wheelBody);
		this.world.addBody(wheelBody);
	}


	// UPDATE

	this.update = function(delta) {

		this.updateSteering(delta);
		this.updateVelocity();

		// Update physical chassis
		var staticQuat = new CANNON.Quaternion();
		staticQuat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);

		this.buggy.quaternion.copy(this.vehicle.chassisBody.quaternion);
		this.buggy.position.copy(this.vehicle.chassisBody.position);
//		this.buggy.updateMatrix();
//		this.buggy.updateMatrixWorld();
	};

	this.updateVelocity = function() {

		var simpleVelocity = Math.sqrt(Math.pow(this.vehicle.chassisBody.velocity.x, 2) + Math.pow(this.vehicle.chassisBody.velocity.y,2));

		simpleVelocity = simpleVelocity - 10;
		if (simpleVelocity < 0) {
			simpleVelocity = 0;
		}

		this.velocity = simpleVelocity;

	};

	// Update steering

	this.updateSteering = function(delta) {

		if (this.steeringDirection !== 0) {	// We wanna turn

			if (this.steeringDirection === 1) { // Turn right
				if (this.steering < this.config.wheelSteeringMax) {
					this.steering += this.config.wheelSteeringSpeed * delta;	
				}

			} else {	// Turn left
				if (this.steering > -this.config.wheelSteeringMax) {
					this.steering -= this.config.wheelSteeringSpeed * delta;	
				}
			}

		} else {	// Idle.

			if (this.steering < 0) {
				this.steering += this.config.wheelSteeringSpeed * delta * 2;	

			} else {
				this.steering -= this.config.wheelSteeringSpeed * delta * 2;	
			}
		}

		this.vehicle.setSteeringValue(this.steering, 0);
		this.vehicle.setSteeringValue(this.steering, 1);

		if (config.wheelIsSteeringBack) {
			var steerBack = -this.steering * this.config.wheelSteeringBackRatio;
			this.vehicle.setSteeringValue(steerBack, 2);
			this.vehicle.setSteeringValue(steerBack, 3);
		}

		// Update physical wheels
		for (var i = 0; i < this.vehicle.wheelInfos.length; i++) {
			this.vehicle.updateWheelTransform(i);
			var t = this.vehicle.wheelInfos[i].worldTransform;
			var wheelBody = this.wheelBodies[i];
			wheelBody.position.copy(t.position);
			wheelBody.quaternion.copy(t.quaternion);
		}
	};


	// EVENTED

	this.gaz = function(up) {
		if (this.config.wheelTransmissionType === "FWD") {
			this.vehicle.applyEngineForce(up ? 0 : -this.config.engineForceMax/2, 0);
			this.vehicle.applyEngineForce(up ? 0 : -this.config.engineForceMax/2, 1);

		} else if (this.config.wheelTransmissionType === "RWD") {
			this.vehicle.applyEngineForce(up ? 0 : -this.config.engineForceMax/2, 2);
			this.vehicle.applyEngineForce(up ? 0 : -this.config.engineForceMax/2, 3);

		} else if (this.config.wheelTransmissionType === "4WD") {
			this.vehicle.applyEngineForce(up ? 0 : -this.config.engineForceMax/4, 0);
			this.vehicle.applyEngineForce(up ? 0 : -this.config.engineForceMax/4, 1);
			this.vehicle.applyEngineForce(up ? 0 : -this.config.engineForceMax/4, 2);
			this.vehicle.applyEngineForce(up ? 0 : -this.config.engineForceMax/4, 3);
		}
	};

	this.brake = function(up) {
		this.vehicle.setBrake(up ? 0 : this.config.brakeForce, 0);
		this.vehicle.setBrake(up ? 0 : this.config.brakeForce, 1);
		this.vehicle.setBrake(up ? 0 : this.config.brakeForce, 2);
		this.vehicle.setBrake(up ? 0 : this.config.brakeForce, 3);
	};


	console.log(this);
//	return this;
};




// INIT

demo.addScene("car",function(){

	// WORLD

	var world = demo.getWorld();
	world.broadphase = new CANNON.SAPBroadphase(world);
	world.gravity.set(0, 0, -15);
	world.defaultContactMaterial.friction = 0.0;

	// LIGHTS

	var light = new THREE.HemisphereLight( 0xffffdd, 0x080820, 1 );
	demo.scene.add(light);

	var lightAmbient = new THREE.AmbientLight( 0x222222 );
	demo.scene.add(lightAmbient);

	// RACER(S)

	for (var p = 0; p < nPlayers; p++) {
		racers[p] = new Racer(p, demo, config);
	}

	// GROUND

	var matrix = [];
	var sizeX = 64,
			sizeY = 64;

	var NoiseGen = new SimplexNoise();

	for (var i = 0; i < sizeX; i++) {
		matrix.push([]);
		for (var j = 0; j < sizeY; j++) {

			// transform cartesian to polar TODO !

			// todo : center offset ?
			var x = sizeX/2 - i;
			var y = sizeY/2 - j;

//			var alpha = Math.atan(i / j);
			var radius = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));

			// Simplex noise height map
			var height = 
					NoiseGen.noise( i / 25, j / 25 ) * 2 + 2 + 
					NoiseGen.noise( i / 10, j / 10 ) * 1 + 1 + 
					Math.random() * 0.1;

			height = 
				NoiseGen.noise( i / 50, j / 50 ) * 5 + 5 + 
				NoiseGen.noise( i / 25, j / 25 ) * 2 + 2;


			var wallSize = 2;

			// Dig a track
			if (radius > sizeX/2 - wallSize || radius < sizeX/4 - wallSize/2) {
				height = height + 5 + NoiseGen.noise( i / 10, j / 10 ) * 2 + 2 + Math.random() * 1;
			}

			// Walls at map borders
			if(i<wallSize+1 || i>sizeX-(wallSize+2) || j<wallSize+1 || j>sizeY-(wallSize+2)) {
				height = 20;
			}

			matrix[i].push(height);
		}
	}

	// Ground material
	demo.currentMaterial = new THREE.MeshLambertMaterial({ color: new THREE.Color( 0xffeedd ) });

	var hfShape = new CANNON.Heightfield(matrix, {
		elementSize: sizeX * 0.03
	});
	var hfBody = new CANNON.Body({ mass: 0 });
	hfBody.addShape(hfShape);
	hfBody.position.set(-sizeX * hfShape.elementSize / 2, -sizeY * hfShape.elementSize / 2, -5);
	world.addBody(hfBody);
	demo.addVisual(hfBody);


	// WHEEL-GROUND CONTACT MATERIAL

	var groundMaterial = new CANNON.Material("groundMaterial");
	var wheelMaterial = new CANNON.Material("wheelMaterial");
	var wheelGroundContactMaterial = window.wheelGroundContactMaterial = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
		friction: 0.3,
		restitution: 0,
		contactEquationStiffness: 1000
	});

	world.addContactMaterial(wheelGroundContactMaterial);


	// LOOP (TODO better)

	world.addEventListener('postStep', function() {

		var delta = this.dt;

		// Update racers

		for (var p = 0; p < nPlayers; p++) {
			racers[p].update(delta);
		}

		// Update camera

		if (cameraMode === "focus") {
			var simpleVelocity = racers[0].velocity;

			camera.position.set(
				racers[0].vehicle.chassisBody.position.x, 
				racers[0].vehicle.chassisBody.position.y - 30 - simpleVelocity , 
				racers[0].vehicle.chassisBody.position.z + 60 + simpleVelocity * 1.25
			);

			camera.lookAt(racers[0].vehicle.chassisBody.position);

		} else if (cameraMode === "static") {
			camera.position.set(0,90,90);
			camera.lookAt(new THREE.Vector3( 0, 0, -5 ));

		} else if (cameraMode === "racer") {
//			camera.quaternion.copy(racers[0].vehicle.chassisBody.quaternion);
//			camera.position.copy(racers[0].vehicle.chassisBody.position);
			camera.position.set(
				racers[0].vehicle.chassisBody.position.x, 
				racers[0].vehicle.chassisBody.position.y, 
				racers[0].vehicle.chassisBody.position.z + 50
			);
			camera.lookAt(racers[0].vehicle.chassisBody.position);

		} 
	});


	console.log("Enf of init()");

});


// CONTROLS

document.onkeydown = document.onkeyup = handler;

function handler(event){
	var up = (event.type == 'keyup');

	if(!up && event.type !== 'keydown'){
		return;
	}

	switch(event.keyCode){

		// TODO : multiplayer

		// Camera
		case 67: // C key
		// Ugly camera mode switcher (need debounce)
		if (cameraMode === "static") {
			cameraMode = "focus";

		} else if (cameraMode === "focus") {
			cameraMode = "racer";

		} else if (cameraMode === "racer") {
			cameraMode = "static";
		}
		break;

		// Player 1

		case 38: // Up arrow
		racers[0].gaz(up);
		break;

		case 40: // Down arrow
		racers[0].vehicle.applyEngineForce(up ? 0 : racers[0].config.engineForceMax, 2);
		racers[0].vehicle.applyEngineForce(up ? 0 : racers[0].config.engineForceMax, 3);
		break;

		case 76: // M key
		racers[0].brake(up);
		break;

		case 39: // Right arrow
		racers[0].steeringDirection = up ? 0 : -1;
		break;

		case 37: // Reft arrow
		racers[0].steeringDirection =  up ? 0 : 1;
		break;

		// Player 1

		case 90: // Z key
		racers[1].gaz(up);
		break;

		case 83: // S key
		racers[1].vehicle.applyEngineForce(up ? 0 : racers[1].config.engineForceMax, 2);
		racers[1].vehicle.applyEngineForce(up ? 0 : racers[1].config.engineForceMax, 3);
		break;

		case 66: // B key
		racers[1].brake(up);
		break;

		case 81: // Q key
		racers[1].steeringDirection = up ? 0 : 1;
		break;

		case 68: // D key
		racers[1].steeringDirection =  up ? 0 : -1;
		break;
	}
}


// LOADER

var json_loader = new THREE.JSONLoader();

var buggyModel;

//json_loader.load( "../models/buggy.json", function( geometry, materials ) {
json_loader.load( "https://raw.githubusercontent.com/Chmood/cannon-racer/master/src/models/mustang.js", function( geometry, materials ) {
	// var mesh = new Physijs.BoxMesh(
	// 	car,
	// 	Physijs.createMaterial(
	// 		new THREE.MeshFaceMaterial( car_materials ),
	// 		0.125,
	// 		0.8),
	// 	100
	// );
	// mesh.position.y = 4;
	// mesh.castShadow = mesh.receiveShadow = true;

	geometry.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI/2));
	geometry.applyMatrix(new THREE.Matrix4().makeRotationZ(Math.PI/2));
	geometry.applyMatrix(new THREE.Matrix4().makeScale(0.6, 1, 1));
	geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0.5, 0, 0.5));

	buggyModel = geometry;
	
	// Launch magic :)

	demo.start();

});






