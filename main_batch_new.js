import * as THREE from 'three';
import { CesiumIonTilesRenderer } from '3d-tiles-renderer';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader';
import { Sphere,Vector3,Quaternion } from 'three';
import {PointerLockControls} from 'three/examples/jsm/controls/PointerLockControls';
import { Sky } from 'three/addons/objects/Sky.js';

//Load GLTF Model Into The Scene
// const loader = new GLTFLoader();
// loader.load(
//   "./ModelA.glb",
//   function(glb){
//       const glbModel=glb.scene;
//       glbModel.position.set(0,0,0);
//       glbModel.scale.set(4,4,4);
//       scene.add(glbModel);
//   },
//   function(xhr){console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );},
//   function(error){console.log("ERROR: ",error)}
// );
// loader.load(
//   "./Pav.glb",
//   function(glb){
//       const glbModel=glb.scene;
//       glbModel.position.set(2000,0,-1700);//Unity(x,y,-z)
//       glbModel.rotation.set(0,-90,0);//Unity(x,-y,z)
//       glbModel.scale.set(4,4,4);
//       scene.add(glbModel);
//   },
//   function(xhr){console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );},
//   function(error){console.log("ERROR: ",error)}
// );


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.3, 1000 );

const scene2=new THREE.Scene();
const cameraTop = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.3, 10_000 );
const cameraHelper = new THREE.CameraHelper( camera );
scene.add( cameraHelper );
scene2.add(cameraHelper);
cameraTop.position.set(0,600,0);
cameraTop.lookAt(new THREE.Vector3(0, 0, 0));

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

//Get VERTEX and FRAGMENT Shader
// const vert_shader = await (await fetch('./shader_pers.vert')).text();
// const frag_shader = await (await fetch('./shader.frag')).text();
const vert_shader = `varying vec2 vUV;
varying vec2 vUV_depth;

uniform sampler2D colorMap;

//Attributes
attribute vec3 offset;
attribute float rotationY;
attribute float rotationX;
attribute float rotationZ;
attribute vec4 colorMap_crop;
attribute vec4 colorMap_depth_crop;

attribute float scalingFactor; 
attribute float near_plane;
attribute float far_plane;
attribute float FOV;
attribute float WIDTH;
attribute float HEIGHT;

//get z-depth data
float getDepth(vec2 uv_depth){
    vec4 rgba = texture2D(colorMap,uv_depth);
    return 1.0-rgba.r;
}

#define DEG_TO_RADIANS 0.01745329251

void main(){
    //liner interpolation formula for seperating the RGBD image from each other 
    vec2 customUV = uv * vec2(colorMap_crop.z - colorMap_crop.x, colorMap_crop.w - colorMap_crop.y) + 
        colorMap_crop.xy;

    vec2 customUV_depth = uv * vec2(colorMap_depth_crop.z - colorMap_depth_crop.x, colorMap_depth_crop.w - colorMap_depth_crop.y) + 
        colorMap_depth_crop.xy;
    
    //over to fragment shader
    vUV = customUV;
    vUV_depth = customUV_depth;


    //Calculate points screen space coordinates
    float aspect_ratio = (WIDTH/HEIGHT);
    float fov = (FOV/2.0)*DEG_TO_RADIANS;
    float z = getDepth(customUV_depth);

    float dim_z = near_plane + (far_plane-near_plane) * z;
    float dim_x = dim_z*tan(fov)*aspect_ratio;
    float dim_y = dim_z*tan(fov);

    vec3 new_pos = vec3((uv.x*2.0 - 1.0)*dim_x, (uv.y*2.0 - 1.0)*dim_y, -(dim_z));
    
    //Rotate the mesh
    //-->Y-Rotation
    mat4 rotationMatrixY = mat4(
    cos(rotationY), 0.0, sin(rotationY), 0.0,
    0.0, 1.0, 0.0, 0.0,
    -sin(rotationY), 0.0, cos(rotationY), 0.0,
    0.0, 0.0, 0.0, 1.0);

    //-->X-Rotation
    mat4 rotationMatrixX = mat4(
    1.0, 0.0, 0.0, 0.0,
    0.0, cos(rotationX), -sin(rotationX), 0.0,
    0.0, sin(rotationX), cos(rotationX), 0.0,
    0.0, 0.0, 0.0, 1.0);

    //-->Z-Rotation
    mat4 rotationMatrixZ = mat4(
    cos(rotationZ), -sin(rotationZ), 0.0, 0.0,
    sin(rotationZ), cos(rotationZ), 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0);


    new_pos=(rotationMatrixY*rotationMatrixX*rotationMatrixZ*vec4(new_pos,1.0)).xyz;

    //Reposition Mesh
    vec4 transformedPos=modelMatrix * vec4(new_pos+offset,1.0);

    gl_Position = projectionMatrix * viewMatrix * transformedPos;
    
    gl_PointSize = (100.0/length(gl_Position.xyz))+scalingFactor;
    
    
}`
const frag_shader = `uniform sampler2D colorMap;

varying vec2 vUV;
varying vec2 vUV_depth;

void make_kernel(inout vec4 n[9], sampler2D tex, vec2 coord)
{
	float w = 1.0 / 1920.;
	float h = 1.0 / 1080.;

	n[0] = texture2D(tex, coord + vec2( -w, -h));
	n[1] = texture2D(tex, coord + vec2(0.0, -h));
	n[2] = texture2D(tex, coord + vec2(  w, -h));
	n[3] = texture2D(tex, coord + vec2( -w, 0.0));
	n[4] = texture2D(tex, coord);
	n[5] = texture2D(tex, coord + vec2(  w, 0.0));
	n[6] = texture2D(tex, coord + vec2( -w, h));
	n[7] = texture2D(tex, coord + vec2(0.0, h));
	n[8] = texture2D(tex, coord + vec2(  w, h));
}

void main(){
    if(texture2D(colorMap,vUV_depth).r < 0.01){
        discard;
    }
    else{

        vec4 n[9];
        make_kernel( n, colorMap, vUV_depth );
        vec4 sobel_edge_h = n[2] + (10.0*n[5]) + n[8] - (n[0] + (10.0*n[3]) + n[6]);
        vec4 sobel_edge_v = n[0] + (10.0*n[1]) + n[2] - (n[6] + (10.0*n[7]) + n[8]);
        vec4 sobel = sqrt((sobel_edge_h * sobel_edge_h) + (sobel_edge_v * sobel_edge_v));
        if(sobel.r > 0.0)
        {
            discard;
        }

        gl_FragColor = texture2D(colorMap,vUV);
    }
}`

    // sky
  let sky, sun;
	// Add Sky
	sky = new Sky();
	sky.scale.setScalar( 450000 );
	// scene.add( sky );

	sun = new THREE.Vector3();
	const effectController = {
		turbidity: 10,
		rayleigh: 3,
		mieCoefficient: 0.005,
		mieDirectionalG: 0.7,
		elevation: 2,
		azimuth: 180,
		exposure: renderer.toneMappingExposure
	};
	const uniforms = sky.material.uniforms;
					uniforms[ 'turbidity' ].value = effectController.turbidity;
					uniforms[ 'rayleigh' ].value = effectController.rayleigh;
					uniforms[ 'mieCoefficient' ].value = effectController.mieCoefficient;
					uniforms[ 'mieDirectionalG' ].value = effectController.mieDirectionalG;

					const phi = THREE.MathUtils.degToRad( 90 - effectController.elevation );
					const theta = THREE.MathUtils.degToRad( effectController.azimuth );

					sun.setFromSphericalCoords( 1, phi, theta );

					uniforms[ 'sunPosition' ].value.copy( sun );

					renderer.toneMappingExposure = effectController.exposure;

scene.add(sky)

const cubeGeo = new THREE.BoxGeometry( 10, 10, 10 );
const cubeMat = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( cubeGeo, cubeMat );
// scene.add( cube );

//FPS controller
const FPScontrols = new PointerLockControls(camera,renderer.domElement);
document.addEventListener('click',function(){FPScontrols.lock();})
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const onKeyDown = function ( event ) {

    switch ( event.code ) {

        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;

        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;

        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;

        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;

        case 'Space':
            if ( canJump === true ) velocity.y += 350;
            canJump = false;
            break;

    }

};

const onKeyUp = function ( event ) {

    switch ( event.code ) {

        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;

        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;

        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;

        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;

    }

};
document.addEventListener( 'keydown', onKeyDown );
document.addEventListener( 'keyup', onKeyUp );

function updateFPSControls(){
    const time = performance.now();
    const delta = ( time - prevTime ) / 1000;

	velocity.x -= velocity.x * 10.0 * delta;
	velocity.z -= velocity.z * 10.0 * delta;

	velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

	direction.z = Number( moveForward ) - Number( moveBackward );
	direction.x = Number( moveRight ) - Number( moveLeft );
	direction.normalize(); // this ensures consistent movements in all directions

	if ( moveForward || moveBackward ) velocity.z -= direction.z * 4000.0 * delta;//intial value 300
	if ( moveLeft || moveRight ) velocity.x -= direction.x * 4000.0 * delta;//initial value 300

  FPScontrols.moveRight( - velocity.x * delta );
	FPScontrols.moveForward( - velocity.z * delta );
    
    prevTime = time;
}


//Set Ambient light to see model
//Ambient Light
const light = new THREE.AmbientLight( 0x404040 ,1);
scene.add(light);
const directionalLight = new THREE.DirectionalLight( 0xffffff, 1 );

directionalLight.position.x = 100
directionalLight.position.y = 500
scene.add( directionalLight );

// Create a Video player geometry
const videoPlayerGeo = new THREE.PlaneGeometry(100, 50);
const videoMat = new THREE.MeshBasicMaterial({ map: new THREE.Texture() });
const videoPlayer = new THREE.Mesh(videoPlayerGeo, videoMat);
videoPlayer.position.y = 120
scene.add(videoPlayer);

// Load the video
const video = document.createElement('video');
video.src = './expoTrailer.mp4'; // Replace with the path to your WebM video
video.load();
document.addEventListener('keydown',e=>{
	if(e.key=='e' || e.key=='E')
    	video.play();
	else if(e.key=='q' || e.key=="Q")
		video.pause()
})


// Create a texture and update it with the video frames
const texture = new THREE.VideoTexture(video);
videoMat.map = texture;


// image as texture from url
// Create a Plane geometry
const planeGeometry = new THREE.PlaneGeometry(100, 50);

// Load the image texture
const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = 'anonymous';
const imageTexture = textureLoader.load('https://www.archpaper.com/wp-content/uploads/2020/02/expo2020-1-3200-x-1800.jpg'); // Replace with the actual path to your image

// Create a material with the loaded texture
const material = new THREE.MeshBasicMaterial({ map: imageTexture });


// Create a mesh with the geometry and material
const mesh = new THREE.Mesh(planeGeometry, material);
mesh.material.needsUpdate = true
// Set the position of the mesh
mesh.position.y = 100;
mesh.position.x = 100;

// Add the mesh to the scene
scene.add(mesh);



//Setup Cesium
//Setup CESIUM ION
const params = {
	'errorTarget': 500,
	'ionAssetId': ['2345660','2345660','2345660','2345660'],
	'ionAccessToken': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxYzE4YmMwZi1lODMyLTQyN2MtODY3Yy1mODliN2M0ZTBmOGUiLCJpZCI6MTcyNDY0LCJpYXQiOjE2OTc2MDgzMTZ9.u7HknZNbhLfwFPtZwh7pf4DbbejRKnLI13Mmqd-cVNY',
	'displayBoxBounds': true,
	'reload': reinstantiateTiles,

};
//-------------CESIUM ION tiles setup-----------------//

function rotationBetweenDirections( dir1, dir2 ) {

	const rotation = new Quaternion();
	const a = new Vector3().crossVectors( dir1, dir2 );
	rotation.x = a.x;
	rotation.y = a.y;
	rotation.z = a.z;
	rotation.w = 1 + dir1.clone().dot( dir2 );
	rotation.normalize();

	return rotation;

}

let tiles = []; // Initialize an array to store multiple tiles

function setupTiles() {
    tiles.forEach(tile => {
        tile.fetchOptions.mode = 'cors';

        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://unpkg.com/three@0.153.0/examples/jsm/libs/draco/gltf/');

        const loader = new GLTFLoader(tile.manager);
        loader.setDRACOLoader(dracoLoader);

        tile.manager.addHandler(/\.gltf$/, loader);
        scene.add(tile.group);
    });
}

const positions = [
    {"x": 269, "y": 95, "z": 534 },
    {"x": 269, "y": 95, "z": 10000},
    {"x": 10000, "y": 95, "z": 534},
    {"x": 10000, "y": 95, "z": 10000}
    // Add more positions as needed
]

function reinstantiateTiles() {
    // Remove and dispose of all existing tiles
    tiles.forEach(tile => {
        scene.remove(tile.group);
        tile.dispose();
    });

    // Clear the array
    tiles.length = 0;

    // Add new tiles
    
    for (let i = 0; i < params.ionAssetId.length; i++) {
        const tile = new CesiumIonTilesRenderer(params.ionAssetId[i], params.ionAccessToken);
        // Use the positions from the JSON file
        const position = positions[i];

        tile.onLoadTileSet = () => {
            const sphere = new Sphere();
            tile.getBoundingSphere(sphere);

            tile.lruCache.maxSize = 1000;
            tile.lruCache.minSize = 400;
            tile.lruCache.unloadPercent = 10;

            

            const sphereCenter = sphere.center.clone();
            const distanceToEllipsoidCenter = sphereCenter.length();

            const surfaceDirection = sphereCenter.normalize();
            const up = new Vector3(0, 1, 0);
            const rotationToNorthPole = rotationBetweenDirections(surfaceDirection, up);

           
            tile.group.quaternion.x = rotationToNorthPole.x;
            tile.group.quaternion.y = rotationToNorthPole.y;
            tile.group.quaternion.z = rotationToNorthPole.z;
            tile.group.quaternion.w = rotationToNorthPole.w;

            tile.group.position.x = position.x;
            tile.group.position.y = -distanceToEllipsoidCenter + position.y;
            tile.group.position.z = position.z;
            

        };

        tiles.push(tile); // Add the new tile to the array
    }

    setupTiles();
}

//-------------CESIUM ION tiles setup-----------------//

//NEEEEWWWWW
var offset=[];
var rotationY=[];
var rotationX=[];
var rotationZ=[];
var far_plane=[];
var near_plane=[];
var FOV=[];
var render_width=[];
var render_height=[];
var scaling_factor=[];

var colorMap_crop=[];
var colorMap_depth_crop=[];

var MESH=[];
var MESH_CLONE=[];
var HELPER_MESH=[];
var HELPER_MESH_CLONE=[];

function addMeshFromStream(video_element_id,near_plane_val,far_plane_val,fov,rotateY,rotateX,rotateZ,position,     image_width,image_height,atlas_width,atlas_height,posX,posY){
  offset=[];
  rotationY=[];
  rotationX=[];
  rotationZ=[];
  far_plane=[];
  near_plane=[];
  FOV=[];
  render_width=[];
  render_height=[];
  scaling_factor=[];

  colorMap_crop=[];
  colorMap_depth_crop=[];

  const video=document.getElementById(video_element_id);
  video.onloadeddata=function(){video.play();}

  const texture=new THREE.VideoTexture(video);
  texture.needsUpdate = true;

  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  const shader_mat=new THREE.ShaderMaterial({
    uniforms:{
      colorMap:{value:texture}},
    vertexShader:vert_shader,
    fragmentShader:frag_shader,
    side:THREE.FrontSide,
  });
  shader_mat.needsUpdate=true;

  const geometry=new THREE.PlaneGeometry(1,1,300,150);
  geometry.scale(image_width/fov,image_height/fov,1);

  const instancedGeometry=new THREE.InstancedBufferGeometry();
  instancedGeometry.index=geometry.index;
  instancedGeometry.attributes.position=geometry.attributes.position;
  instancedGeometry.attributes.uv=geometry.attributes.uv;

  addNewMeshFromImageData(instancedGeometry,near_plane_val,far_plane_val,fov,rotateY,rotateX,rotateZ,position,     image_width,image_height,atlas_width,atlas_height,posX,posY);
  const mesh=new THREE.Points(instancedGeometry,shader_mat);
  const meshClone=mesh.clone();
  scene.add(mesh);
  scene2.add(meshClone)
  MESH.push(mesh);
  MESH_CLONE.push(meshClone);
  //Add Helper Mesh
  const helperMesh=new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshBasicMaterial({color: 0xffff00, wireframe:true}));
  helperMesh.position.x=position.x;
  helperMesh.position.y=position.y;
  helperMesh.position.z=position.z;
  const helperMeshClone=helperMesh.clone();
  HELPER_MESH.push(helperMesh);
  HELPER_MESH_CLONE.push(helperMeshClone);
  scene.add(helperMesh);
  scene2.add(helperMeshClone);
  helperMesh.visible=false;
  helperMeshClone.visible=false;
}

function addNewMeshFromImageData(instancedGeometry,near_plane_val,far_plane_val,fov,rotateY,rotateX,rotateZ,position,     image_width,image_height,atlas_width,atlas_height,posX,posY){
  meshPositionData(near_plane_val,far_plane_val,fov,image_width,image_height,(rotateY)* (Math.PI / 180.0),(rotateX)* (Math.PI / 180.0),(rotateZ)* (Math.PI / 180.0),position);
  imageCropData(image_width,image_height,atlas_width,atlas_height,posX,posY);
  
  //set the Attributes for the Instanced Buffer Geometry
  var offsetAttr=new THREE.InstancedBufferAttribute(new Float32Array(offset),3,false);
  var rotationYAttr=new THREE.InstancedBufferAttribute(new Float32Array(rotationY),1);
  var rotationXAttr=new THREE.InstancedBufferAttribute(new Float32Array(rotationX),1);
  var rotationZAttr=new THREE.InstancedBufferAttribute(new Float32Array(rotationZ),1);
  var farPlaneAttr=new THREE.InstancedBufferAttribute(new Float32Array(far_plane),1);
  var nearPlaneAttr=new THREE.InstancedBufferAttribute(new Float32Array(near_plane),1);
  var fovAttr=new THREE.InstancedBufferAttribute(new Float32Array(FOV),1);
  var renderWidthAttr=new THREE.InstancedBufferAttribute(new Float32Array(render_width),1);
  var renderHeightAttr=new THREE.InstancedBufferAttribute(new Float32Array(render_height),1);
  var scalingFactorAttr=new THREE.InstancedBufferAttribute(new Float32Array(scaling_factor),1);

  var colorMap_cropAttr=new THREE.InstancedBufferAttribute(new Float32Array(colorMap_crop),4);
  var colorMap_depth_cropAttr=new THREE.InstancedBufferAttribute(new Float32Array(colorMap_depth_crop),4);

  instancedGeometry.setAttribute("offset",offsetAttr);
  instancedGeometry.setAttribute("rotationY",rotationYAttr);
  instancedGeometry.setAttribute("rotationX",rotationXAttr);
  instancedGeometry.setAttribute("rotationZ",rotationZAttr);
  instancedGeometry.setAttribute("near_plane",nearPlaneAttr);
  instancedGeometry.setAttribute("far_plane",farPlaneAttr);
  instancedGeometry.setAttribute("FOV",fovAttr);
  instancedGeometry.setAttribute("WIDTH",renderWidthAttr);
  instancedGeometry.setAttribute("HEIGHT",renderHeightAttr);
  instancedGeometry.setAttribute("scalingFactor",scalingFactorAttr);
  instancedGeometry.setAttribute("colorMap_crop",colorMap_cropAttr);
  instancedGeometry.setAttribute("colorMap_depth_crop",colorMap_depth_cropAttr);
}

function meshPositionData(near_plane_val,far_plane_val,fov,width,height,rotateY,rotateX,rotateZ,position){
  offset.push(position.x,position.y,position.z);

  rotationY.push(rotateY);
  rotationX.push(rotateX);
  rotationZ.push(rotateZ);

  far_plane.push(far_plane_val);
  near_plane.push(near_plane_val);

  FOV.push(fov);
  render_width.push(width);
  render_height.push(height);

  scaling_factor.push(4.0);
}

function imageCropData(image_width,image_height,atlas_width,atlas_height,posX,posY){
  const img_color_bottom = new THREE.Vector2((image_width*posX)/atlas_width,((image_height*posY)+(image_height/2))/atlas_height);
  const img_color_top_right = new THREE.Vector2(((image_width*posX)+image_width)/atlas_width,((image_height*posY)+image_height)/atlas_height);

  const depth_color_bottom = new THREE.Vector2((image_width*posX)/atlas_width,(image_height*posY)/atlas_height);
  const depth_color_top_right = new THREE.Vector2(((image_width*posX)+image_width)/atlas_width,((image_height*posY)+(image_height/2))/atlas_height);

  colorMap_crop.push(img_color_bottom.x,img_color_bottom.y,img_color_top_right.x,img_color_top_right.y);
  colorMap_depth_crop.push(depth_color_bottom.x,depth_color_bottom.y,depth_color_top_right.x,depth_color_top_right.y);
}

function loadMeshOnFrustum(){
  camera.updateMatrix();
  camera.updateMatrixWorld();
  var frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    )
  );

  for(let i=0;i<MESH.length;i++){
    if(frustum.intersectsObject(HELPER_MESH[i])){
      MESH[i].frustumCulled=false;
      HELPER_MESH.frustumCulled=false;
    }else{
      MESH[i].frustumCulled=true;
      HELPER_MESH.frustumCulled=true;
    }
  }
}
function updateCameraInfo(){
  for(let i=0;i<MESH.length;i++){
    if(MESH[i].frustumCulled===true){
      MESH_CLONE[i].visible=false
      if(i>=0&&i<=7){
        for(let i=0;i<=7;i++){
          HELPER_MESH_CLONE[i].visible=false;
        }
      }
      if(i>=8&&i<=15){
        for(let i=8;i<=15;i++){
          HELPER_MESH_CLONE[i].visible=false;
        }
      }
      if(i>=16&&i<=23){
        for(let i=16;i<=23;i++){
          HELPER_MESH_CLONE[i].visible=false;
        }
      }
    }else{
      MESH_CLONE[i].visible=true;
      if(i>=0&&i<=7){
        for(let i=0;i<=7;i++){
          HELPER_MESH_CLONE[i].visible=true;
        }
      }
      if(i>=8&&i<=15){
        for(let i=8;i<=15;i++){
          HELPER_MESH_CLONE[i].visible=true;
        }
      }
      if(i>=16&&i<=23){
        for(let i=16;i<=23;i++){
          HELPER_MESH_CLONE[i].visible=true;
        }
      }
    }
  }
}

const jsonData=[
  {
      "streamName": "FrontCam",
      "streamLink": "./Videos/FrontTarget.mp4",
      "fov": 60.0,
      "near_plane": 0.3,
      "far_plane": 1000.0,
      "rotateY": 0.0,
      "rotateX": 0.0,
      "rotateZ": 0.0,
      "position": [
          17.8,
          36.6,
          -125
      ],
      "width": 1920.0,
      "height": 1080.0
  },
  {
      "streamName": "BackCam",
      "streamLink": "./Videos/BackTarget.mp4",
      "fov": 60.0,
      "near_plane": 0.3,
      "far_plane": 1000.0,
      "rotateY": -180.0,
      "rotateX": 0.0,
      "rotateZ": 0.0,
      "position": [
          1.9,
          40.4,
          142.3
      ],
      "width": 1920.0,
      "height": 1080.0
  },
  {
      "streamName": "LeftCam",
      "streamLink": "./Videos/LeftTarget.mp4",
      "fov": 60.0,
      "near_plane": 0.3,
      "far_plane": 1000.0,
      "rotateY": 90.0,
      "rotateX": 0.0,
      "rotateZ": 0.0,
      "position": [
          -100.5,
          29.2,
          0.0
      ],
      "width": 1920.0,
      "height": 1080.0
  },
  {
      "streamName": "RightCam",
      "streamLink": "./Videos/RightTarget.mp4",
      "fov": 60.0,
      "near_plane": 0.3,
      "far_plane": 1000.0,
      "rotateY": -90,
      "rotateX": 0.0,
      "rotateZ": 0.0,
      "position": [
          125.5,
          41.1,
          0.0
      ],
      "width": 1920.0,
      "height": 1080.0
  }
  ,
  {
      "streamName": "LeftCamTop",
      "streamLink": "./Videos/LeftTargetTop.mp4",
      "fov": 60.0,
      "near_plane": 0.3,
      "far_plane": 1000.0,
      "rotateY": 131.878,
      "rotateX": 2.727,
      "rotateZ": 0.0,
      "position": [
          -76.5,
          36.2,
          76.1
      ],
      "width": 1920.0,
      "height": 1080.0
  }
  ,
  {
      "streamName": "BackCamTop",
      "streamLink": "./Videos/BackTargetTop.mp4",
      "fov": 60.0,
      "near_plane": 0.3,
      "far_plane": 1000.0,
      "rotateY": 45.901,
      "rotateX": 0.0,
      "rotateZ": 0.0,
      "position": [
          -62.5,
          31.9,
          -63.7
      ],
      "width": 1920.0,
      "height": 1080.0
  },
  {
      "streamName": "RightCamTop",
      "streamLink": "./Videos/RightTargetTop.mp4",
      "fov": 60.0,
      "near_plane": 0.3,
      "far_plane": 1000.0,
      "rotateY": 0.0,
      "rotateX": 90.0,
      "rotateZ": 0.0,
      "position": [
          8.8,
          168.7,
          3.9
      ],
      "width": 1920.0,
      "height": 1080.0
  },
  {
      "streamName": "FrontCamTop",
      "streamLink": "./Videos/FrontTargetTop.mp4",
      "fov": 60.0,
      "near_plane": 0.3,
      "far_plane": 1000.0,
      "rotateY": 113.992,
      "rotateX": 0.0,
      "rotateZ": 0.0,
      "position": [
          -109.3156,
          31.7,
          32.72234
      ],
      "width": 1920.0,
      "height": 1080.0
  }
];

const data=JSON.parse(JSON.stringify(jsonData));

//Add Mesh From JSON data
for(let i=0;i<data.length;i++){
  addMeshFromStream(data[i].streamName,data[i].near_plane,data[i].far_plane,data[i].fov,data[i].rotateY,data[i].rotateX,data[i].rotateZ,new THREE.Vector3(data[i].position[0],data[i].position[1],data[i].position[2]*(-1)+100),data[i].width,data[i].height,data[i].width,data[i].height,0,0);
}
for(let i=0;i<data.length;i++){
  addMeshFromStream(data[i].streamName,data[i].near_plane,data[i].far_plane,data[i].fov,data[i].rotateY,data[i].rotateX,data[i].rotateZ,new THREE.Vector3(data[i].position[0]+100,data[i].position[1],data[i].position[2]*(-1)-100),data[i].width,data[i].height,data[i].width,data[i].height,0,0);
}

for(let i=0;i<data.length;i++){
  addMeshFromStream(data[i].streamName,data[i].near_plane,data[i].far_plane,data[i].fov,data[i].rotateY,data[i].rotateX,data[i].rotateZ,new THREE.Vector3(data[i].position[0]-400,data[i].position[1],(data[i].position[2]*(-1))+200),data[i].width,data[i].height,data[i].width,data[i].height,0,0);
}

// for(let i=0;i<data.length;i++){
//   addMeshFromStream(data[i].streamName,data[i].near_plane,data[i].far_plane,data[i].fov,data[i].rotateY,data[i].rotateX,data[i].rotateZ,new THREE.Vector3(data[i].position[0],data[i].position[1],(data[i].position[2]*(-1))+400),data[i].width,data[i].height,data[i].width,data[i].height,0,0);
// }
// for(let i=0;i<data.length;i++){
//   addMeshFromStream(data[i].streamName,data[i].near_plane,data[i].far_plane,data[i].fov,data[i].rotateY,data[i].rotateX,data[i].rotateZ,new THREE.Vector3(data[i].position[0]+(20*5),data[i].position[1],data[i].position[2]*(-1)),data[i].width,data[i].height,data[i].width,data[i].height,0,0);
// }
// for(let i=0;i<data.length;i++){
//   addMeshFromStream(data[i].streamName,data[i].near_plane,data[i].far_plane,data[i].fov,data[i].rotateY,data[i].rotateX,data[i].rotateZ,new THREE.Vector3(data[i].position[0]+(20*5),data[i].position[1],data[i].position[2]*(-1)),data[i].width,data[i].height,data[i].width,data[i].height,0,0);
// }

//ADD Cesium Ion Tile
reinstantiateTiles();
camera.position.y=45
camera.position.x=0
camera.position.z=250

let gltfModel
// load static gltf
function addStaticGLTFModel() {
    const loader = new GLTFLoader();

    loader.load("./MobilityPav.glb", (gltf) => {
        gltfModel = gltf.scene;
        gltfModel.position.x = 520
        gltfModel.position.y = -10
        gltfModel.position.z = 110

        scene.add(gltfModel);
    });
}
addStaticGLTFModel()

// animated 3js object
let npc,mixer,numAnimations
function setupAnimatedObjects(){
	const loader = new GLTFLoader();
	loader.load( './remy.glb', function ( gltfModel ) {
		npc = gltfModel.scene;
		npc.scale.set(10,10,10,)
		npc.position.set(41, 0, 244)
		console.log(npc.position);
		scene.add(npc)
		npc.traverse( function ( object ) {
			if ( object.isMesh ) object.castShadow = true;
		} );
		const animations = gltfModel.animations;
		mixer = new THREE.AnimationMixer( npc );

		 // Add all animations to the mixer
		 animations.forEach((clip) => {
            mixer.clipAction(clip).play();
        });

		numAnimations = animations.length;
		console.log(numAnimations);
	})
	
}
setupAnimatedObjects()

// Define an array of checkpoints
const checkpoints = [
    new THREE.Vector3(41, 0, 244),
    new THREE.Vector3(-180, 0, 116),
    new THREE.Vector3(-18, 0, -217),
    new THREE.Vector3(202, 0, -32),
    new THREE.Vector3(31, 0, 213)
  ];
let currentCheckpointIndex = 0;
// Function to update the character's position and rotation
function updateCharacterPosition() {
    const targetCheckpoint = checkpoints[currentCheckpointIndex];

    const direction = new THREE.Vector3().subVectors(targetCheckpoint, npc.position);
    
    direction.normalize();
    
    // Define a distance threshold for reaching a checkpoint
    const distanceThreshold = 1;

    // Move the character towards the checkpoint
    npc.position.add(direction.multiplyScalar(0.5));
  
    // Rotate the character to look at the checkpoint
    npc.lookAt(targetCheckpoint);
  
    // Check if the character has reached the checkpoint
    if (npc.position.distanceTo(targetCheckpoint) < distanceThreshold) {
        currentCheckpointIndex = (currentCheckpointIndex + 1) % checkpoints.length;
      }
  }
  

let clock = new THREE.Clock();

const width=window.innerWidth;
const height=window.innerHeight;
var shouldSplitScreen=false;
document.addEventListener('keydown',function(event){
  if(event.key === 'i'){
    for(let i=0;i<HELPER_MESH.length;i++){
      HELPER_MESH[i].visible=!HELPER_MESH[i].visible;
      HELPER_MESH_CLONE[i].visible=!HELPER_MESH_CLONE[i].visible;
    }
  }
  if(event.key==='k'){
    shouldSplitScreen=!shouldSplitScreen;
  }
});

function animate() {
	requestAnimationFrame( animate );
  updateFPSControls();

  if (mixer) {
    mixer.update(clock.getDelta()); // Update the animations
  }

  // Update the video texture
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    texture.needsUpdate = true;
}

if (tiles.length === 0) return; // Check if there are any tiles in the array

tiles.forEach(tile => {
    tile.errorTarget = params.errorTarget;
    tile.errorThreshold = 1
    tile.maxDepth = 4
    tile.autoDisableRendererCulling = false
    tile.loadSiblings = true
    tile.setCamera(camera);
    tile.setResolutionFromRenderer(camera, renderer);

    // update tiles
    tile.update();
});

  if(shouldSplitScreen===true){
    //USER Cam
  renderer.setScissorTest(true);
  renderer.setScissor(0,0,width/2,height);
  renderer.setViewport(0,0,width/2,height);
  camera.aspect = (width/2)/height;
  renderer.render(scene,camera);

  //TOP VIEW CAM
  renderer.setScissorTest(true);
  renderer.setScissor(width/2,0,width/2,height);
  renderer.setViewport(width/2,0,width/2,height);
  cameraTop.aspect = (width/2)/height;
  renderer.render(scene2,cameraTop);
  }else{
    renderer.setScissorTest(true);
    renderer.setScissor(0,0,width,height);
    renderer.setViewport(0,0,width,height);
    camera.aspect = (width)/height;
    renderer.render(scene,camera);
  }
  if(npc){
    updateCharacterPosition();
  }
  videoPlayer.lookAt(camera.position)
  loadMeshOnFrustum();
  updateCameraInfo();
  cameraTop.position.x = camera.position.x
  cameraTop.position.z = camera.position.z
}

animate();