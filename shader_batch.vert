varying vec2 vUV;
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

//get z-depth data
float getDepth(vec2 uv_depth){
    vec3 rgb = texture2D(colorMap,uv_depth).rgb;
    return (far_plane - near_plane)*((1. - rgb.x));
}

vec3 applyQuaternionToVector( vec4 q, vec3 v ){
    return v + 2.0 * cross( q.xyz, cross( q.xyz, v ) + q.w * v );
}

void main(){
    //liner interpolation formula for seperating the RGBD image from each other 
    vec2 customUV = uv * vec2(colorMap_crop.z - colorMap_crop.x, colorMap_crop.w - colorMap_crop.y) + 
        colorMap_crop.xy;

    vec2 customUV_depth = uv * vec2(colorMap_depth_crop.z - colorMap_depth_crop.x, colorMap_depth_crop.w - colorMap_depth_crop.y) + 
        colorMap_depth_crop.xy;
    
    //over to fragment shader
    vUV = customUV;
    vUV_depth = customUV_depth;

    vec3 new_pos=vec3(position.xy,-(position.z+getDepth(customUV_depth)));
    
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


    new_pos=(rotationMatrixY*rotationMatrixX*rotationMatrixZ*vec4(position.xyz,1.0)).xyz;

    //Reposition Mesh
    vec4 transformedPos=modelMatrix * vec4(new_pos+offset,1.0);

    gl_Position = projectionMatrix * viewMatrix * transformedPos;
    
    gl_PointSize = (100.0/length(gl_Position.xyz))+(getDepth(customUV_depth)*scalingFactor);
    
}