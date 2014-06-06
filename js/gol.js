function $(s) {
    return document.querySelector(s);
}

/**
 * Game of Life simulation and display.
 * @param {HTMLCanvasElement} canvas Render target
 * @param {number} [scale] Size of each cell in pixels (power of 2)
 * @param {number} [p] Starting probability of a cell being alive
 */
function GOL(canvas, scale, p) {
    var gl = this.gl = Igloo.getContext(canvas);
    if (gl == null) {
        alert('Could not initialize WebGL!');
        throw new Error('No WebGL');
    }
    scale = scale || 4;
    var w = canvas.width, h = canvas.height;
    this.viewsize = vec2(w, h);
    this.statesize = vec2(w / scale, h / scale);
    this.lasttick = GOL.now();
    this.fps = 0;

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
    this.fillRandom(p == null ? 0.5 : p);
}

/**
 * @returns {number} The epoch in integer seconds
 */
GOL.now = function() {
    return Math.floor(Date.now() / 1000);
};

/**
 * @returns {WebGLTexture} A texture suitable for bearing Life state
 */
GOL.prototype.texture = function() {
    var gl = this.gl;
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                  this.statesize.x, this.statesize.y,
                  0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return tex;
};

/**
 * Set the entire simulation state at once.
 * @param {Uint8Array} state An RGBA array
 * @returns {GOL} this
 */
GOL.prototype.fill = function(state) {
    var gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.state]);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0,
                     this.statesize.x, this.statesize.y,
                     gl.RGBA, gl.UNSIGNED_BYTE, state);
    return this;
};

/**
 * Fill the entire state with random values.
 * @param {number} [p] Chance of a cell being alive (0.0 to 1.0)
 * @returns {GOL} this
 */
GOL.prototype.fillRandom = function(p) {
    var gl = this.gl, fs = 4;
    var rand = new Uint8Array(this.statesize.x * this.statesize.y * fs);
    for (var i = 0; i < rand.length; i += fs) {
        var v = Math.random() < p ? 255 : 0;
        rand[i + 0] = rand[i + 1] = rand[i + 2] = v;
        rand[i + 3] = 255;
    }
    this.fill(rand);
    return this;
};

/**
 * @returns {string} The name of the non-current state texture
 */
GOL.prototype.other = function() {
    return this.state == 'a' ? 'b' : 'a';
};

/**
 * Step the Game of Life state on the GPU without rendering anything.
 * @returns {GOL} this
 */
GOL.prototype.step = function() {
    if (GOL.now() != this.lasttick) {
        $('.fps').innerHTML = this.fps + ' FPS';
        this.lasttick = GOL.now();
        this.fps = 0;
    } else {
        this.fps++;
    }
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.step);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.other()]);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                            gl.TEXTURE_2D, this.textures[this.other()], 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.state]);
    gl.viewport(0, 0, this.statesize.x, this.statesize.y);
    this.programs.gol.use()
        .attrib('quad', this.buffers.quad, 2)
        .uniform('state', 0, true)
        .uniform('scale', this.statesize)
        .draw(gl.TRIANGLE_STRIP, 4);
    this.state = this.other();
    return this;
};

/**
 * Render the Game of Life state stored on the GPU.
 * @returns {GOL} this
 */
GOL.prototype.draw = function() {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.state]);
    gl.viewport(0, 0, this.viewsize.x, this.viewsize.y);
    this.programs.copy.use()
        .attrib('quad', this.buffers.quad, 2)
        .uniform('state', 0, true)
        .uniform('scale', this.viewsize)
        .draw(gl.TRIANGLE_STRIP, 4);
    return this;
};

/**
 * Iterate the Game of Life state and then draw.
 * @returns {GOL} this
 */
GOL.prototype.all = function() {
    this.step();
    this.draw();
    return this;
};

/**
 * Reset the state to random values.
 * @param {number} [p] Chance of a cell being alive (0.0 to 1.0)
 * @returns {GOL} this
 */
GOL.prototype.reset = function(p) {
    this.fill(this.state, p == null ? 0.5 : p);
    return this;
};

/**
 * Set the state at a specific position.
 * @param {number} x
 * @param {number} y
 * @param {boolean} state True/false for live/dead
 */
GOL.prototype.set = function(x, y, state) {
    var gl = this.gl,
        v = state * 255;
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.state]);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1,
                     gl.RGBA, gl.UNSIGNED_BYTE,
                     new Uint8Array([v, v, v, 255]));
};

/* Initialize everything. */
var gol = null;
window.addEventListener('load', function() {
    var canvas = $('#life');
    gol = new GOL(canvas).draw();
    setInterval(function(){
        gol.all();
    }, 60);
    canvas.addEventListener('click', function() {
        gol.reset();
    });
});
