uniform sampler2D colorMap;

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
}