#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D state;

void main() {
    gl_FragColor = texture2D(state, gl_FragCoord.xy / 512.0);
    //gl_FragColor = vec4(gl_FragCoord.rgb / 600.0, 1.0);
}
