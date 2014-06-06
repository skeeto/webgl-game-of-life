/*global Igloo */

function GOL(canvas, p) {
    var gl = this.gl = Igloo.getContext(canvas);
    if (gl == null) {
        alert('Could not initialize WebGL!');
        throw new Error('No WebGL');
    }
    p = p == null ? 0.5 : p;
    var w = canvas.width, h = canvas.height;

    //gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    this.programs = {
        gol: new Igloo.Program(gl, 'glsl/gol.vert', 'glsl/gol.frag')
    };
    this.buffers = {
        quad: new Igloo.Buffer(gl, new Float32Array([
                -1, -1, 1, -1, -1, 1, 1, 1
        ]))
    };
    this.textures = {
        state: gl.createTexture()
    };
    var rand = new Uint8Array(w * h);
    for (var i = 0; i < rand.length; i++) {
        rand[i] = Math.random() < p ? 255 : 0;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.textures.state);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE,
                  w, h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, rand);
}

GOL.prototype.step = function() {
    var gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.state);
    this.programs.gol.use()
        .attrib('quad', this.buffers.quad, 2)
        .uniform('state', 0, true)
        .draw(gl.TRIANGLE_STRIP, 4);
};

new GOL(life).step();
