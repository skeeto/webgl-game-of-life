/*global Igloo */

function GOL(canvas, p) {
    var gl = this.gl = Igloo.getContext(canvas);
    if (gl == null) {
        alert('Could not initialize WebGL!');
        throw new Error('No WebGL');
    }
    var w = this.w = canvas.width, h = this.h = canvas.height;

    gl.disable(gl.DEPTH_TEST);
    this.programs = {
        copy: new Igloo.Program(gl, 'glsl/quad.vert', 'glsl/copy.frag'),
        gol: new Igloo.Program(gl, 'glsl/quad.vert', 'glsl/gol.frag')
    };
    this.buffers = {
        quad: new Igloo.Buffer(gl, new Float32Array([
                -1, -1, 1, -1, -1, 1, 1, 1
        ]))
    };
    this.textures = {
        a: this.texture(),
        b: this.texture()
    };
    this.framebuffers = {
        step: gl.createFramebuffer()
    };
    this.state = 'a';
    this.fill(this.state, p == null ? 0.5 : p);
}

GOL.prototype.texture = function() {
    var gl = this.gl;
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.w, this.h, 0,
                  gl.RGBA, gl.UNSIGNED_BYTE, null);
    return tex;
};

GOL.prototype.fill = function(name, p) {
    var gl = this.gl, w = this.w, h = this.h, fs = 4;
    var rand = new Uint8Array(w * h * fs);
    for (var i = 0; i < rand.length; i += fs) {
        var v = Math.random() < p ? 255 : 0;
        rand[i + 0] = rand[i + 1] = rand[i + 2] = v;
        rand[i + 3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.textures[name]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.w, this.h, 0,
                  gl.RGBA, gl.UNSIGNED_BYTE, rand);
    gl.bindTexture(gl.TEXTURE_2D, null);
};

GOL.prototype.other = function() {
    return this.state == 'a' ? 'b' : 'a';
};

GOL.prototype.step = function() {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.step);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.other()]);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                            gl.TEXTURE_2D, this.textures[this.other()], 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.state]);
    gl.viewport(0, 0, this.w, this.h);
    this.programs.gol.use()
        .attrib('quad', this.buffers.quad, 2)
        .uniform('state', 0, true)
        .uniform('scale', this.w)
        .draw(gl.TRIANGLE_STRIP, 4);
    this.state = this.other();
    return this;
};

GOL.prototype.draw = function() {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.state]);
    gl.viewport(0, 0, this.w, this.h);
    this.programs.copy.use()
        .attrib('quad', this.buffers.quad, 2)
        .uniform('state', 0, true)
        .uniform('scale', this.w)
        .draw(gl.TRIANGLE_STRIP, 4);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return this;
};

GOL.prototype.all = function() {
    this.step();
    this.draw();
    return this;
};

// gol = new GOL(life).draw();
// gol.step();
// gol.draw();
// gol.all();
