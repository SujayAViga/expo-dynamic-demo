#version 330 core

in vec2 texCoord;  // Texture coordinates

uniform sampler2D pointCloudTexture;  // Point cloud texture
uniform float threshold;              // Threshold for outlier detection

out vec4 fragColor;  // Output color

void main() {
    vec3 centerPoint = texture(pointCloudTexture, texCoord).xyz;
    int count = 0;
    float thresholdSquared = threshold * threshold;

    for (int i = -1; i <= 1; i++) {
        for (int j = -1; j <= 1; j++) {
            vec3 neighborPoint = texture(pointCloudTexture, texCoord + vec2(float(i), float(j)) / textureSize(pointCloudTexture, 0)).xyz;
            float distanceSquared = dot(neighborPoint - centerPoint, neighborPoint - centerPoint);
            
            if (distanceSquared <= thresholdSquared) {
                count++;
            }
        }
    }

    if (count >= 5) {
        fragColor = vec4(centerPoint, 1.0);  // Keep the point
    } else {
        fragColor = vec4(0.0, 0.0, 0.0, 0.0);  // Discard the point
    }
}
