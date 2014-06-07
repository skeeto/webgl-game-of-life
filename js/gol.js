/**
 * Game of Life simulation and display.
 * @param {HTMLCanvasElement} canvas Render target
 * @param {number} [scale] Size of each cell in pixels (power of 2)
 */
function GOL(canvas, scale) {
    var gl = this.gl = Igloo.getContext(canvas);
    if (gl == null) {
        alert('Could not initialize WebGL!');
        throw new Error('No WebGL');
    }
    scale = this.scale = scale || 4;
    var w = canvas.width, h = canvas.height;
    this.viewsize = vec2(w, h);
    this.statesize = vec2(w / scale, h / scale);
    this.timer = null;
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
        front: this.texture(),
        back: this.texture()
    };
    this.framebuffers = {
        step: gl.createFramebuffer()
    };
    this.setRandom();
}

/**
 * @returns {number} The epoch in integer seconds
 */
GOL.now = function() {
    return Math.floor(Date.now() / 1000);
};

/**
 * Compact a simulation state into a bit array.
 * @param {Object} state Array-like state object
 * @returns {Uint8Array} Compacted bit array
 */
GOL.compact = function(state) {
    var compact = new Uint8Array(state.length / 8);
    for (var i = 0; i < state.length; i++) {
        var ii = Math.floor(i / 8),
            shift = i % 8,
            bit = state[i] ? 1 : 0;
        compact[ii] |= bit << shift;
    }
    return compact;
};

/**
 * Expand a simulation state from a bit array.
 * @param {Uint8Array} compact Compacted bit array
 * @returns {Object} Array-like state object
 */
GOL.expand = function(compact) {
    var state = new Uint8Array(compact.length * 8);
    for (var i = 0; i < state.length; i++) {
        var ii = Math.floor(i / 8),
            shift = i % 8;
        state[i] = (compact[ii] >> shift) & 1;
    }
    return state;
};

/**
 * @returns {WebGLTexture} A texture suitable for bearing Life state
 */
GOL.prototype.texture = function() {
    /* LUMINANCE textures would have been preferable (one byte per
     * cell), but, unlike RGBA, LUMINANCE is not a complete color
     * attachment for a framebuffer.
     */
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
 * @param {Object} state Boolean array-like
 * @returns {GOL} this
 */
GOL.prototype.set = function(state) {
    var gl = this.gl;
    var rgba = new Uint8Array(this.statesize.x * this.statesize.y * 4);
    for (var i = 0; i < state.length; i++) {
        var ii = i * 4;
        rgba[ii + 0] = rgba[ii + 1] = rgba[ii + 2] = state[i] ? 255 : 0;
        rgba[ii + 3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.textures.front);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0,
                     this.statesize.x, this.statesize.y,
                     gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    return this;
};

/**
 * Fill the entire state with random values.
 * @param {number} [p] Chance of a cell being alive (0.0 to 1.0)
 * @returns {GOL} this
 */
GOL.prototype.setRandom = function(p) {
    var gl = this.gl, size = this.statesize.x * this.statesize.y;
    p = p == null ? 0.5 : p;
    var rand = new Uint8Array(size);
    for (var i = 0; i < size; i++) {
        rand[i] = Math.random() < p ? 1 : 0;
    }
    this.set(rand);
    return this;
};

/**
 * Clear the simulation state to empty.
 * @returns {GOL} this
 */
GOL.prototype.setEmpty = function() {
    this.set(new Uint8Array(this.statesize.x * this.statesize.y));
    return this;
};

/**
 * Swap the texture buffers.
 * @returns {GOL} this
 */
GOL.prototype.swap = function() {
    var tmp = this.textures.front;
    this.textures.front = this.textures.back;
    this.textures.back = tmp;
    return this;
};

/**
 * Step the Game of Life state on the GPU without rendering anything.
 * @returns {GOL} this
 */
GOL.prototype.step = function() {
    if (GOL.now() != this.lasttick) {
        $('.fps').text(this.fps + ' FPS');
        this.lasttick = GOL.now();
        this.fps = 0;
    } else {
        this.fps++;
    }
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.step);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                            gl.TEXTURE_2D, this.textures.back, 0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.front);
    gl.viewport(0, 0, this.statesize.x, this.statesize.y);
    this.programs.gol.use()
        .attrib('quad', this.buffers.quad, 2)
        .uniform('state', 0, true)
        .uniform('scale', this.statesize)
        .draw(gl.TRIANGLE_STRIP, 4);
    this.swap();
    return this;
};

/**
 * Render the Game of Life state stored on the GPU.
 * @returns {GOL} this
 */
GOL.prototype.draw = function() {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.front);
    gl.viewport(0, 0, this.viewsize.x, this.viewsize.y);
    this.programs.copy.use()
        .attrib('quad', this.buffers.quad, 2)
        .uniform('state', 0, true)
        .uniform('scale', this.viewsize)
        .draw(gl.TRIANGLE_STRIP, 4);
    return this;
};

/**
 * Set the state at a specific position.
 * @param {number} x
 * @param {number} y
 * @param {boolean} state True/false for live/dead
 * @returns {GOL} this
 */
GOL.prototype.poke = function(x, y, state) {
    var gl = this.gl,
        v = state * 255;
    gl.bindTexture(gl.TEXTURE_2D, this.textures.front);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1,
                     gl.RGBA, gl.UNSIGNED_BYTE,
                     new Uint8Array([v, v, v, 255]));
    return this;
};

/**
 * @returns {Object} Boolean array-like of the simulation state
 */
GOL.prototype.get = function() {
    var gl = this.gl, w = this.statesize.x, h = this.statesize.y;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.step);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                            gl.TEXTURE_2D, this.textures.front, 0);
    var rgba = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    var state = new Uint8Array(w * h);
    for (var i = 0; i < w * h; i++) {
        state[i] = rgba[i * 4] > 128 ? 1 : 0;
    }
    return state;
};

/**
 * Run the simulation automatically on a timer.
 * @returns {GOL} this
 */
GOL.prototype.start = function() {
    if (this.timer == null) {
        this.timer = setInterval(function(){
            gol.step();
            gol.draw();
        }, 60);
    }
    return this;
};

/**
 * Stop animating the simulation.
 * @returns {GOL} this
 */
GOL.prototype.stop = function() {
    clearInterval(this.timer);
    this.timer = null;
    return this;
};

/**
 * Toggle the animation state.
 * @returns {GOL} this
 */
GOL.prototype.toggle = function() {
    if (this.timer == null) {
        this.start();
    } else {
        this.stop();
    }
};

/**
 * Find simulation coordinates for event.
 * This is a workaround for Firefox bug #69787 and jQuery bug #8523.
 * @returns {vec2} target-relative offset
 */
GOL.prototype.eventCoord = function(event) {
    var $target = $(event.target),
        offset = $target.offset(),
        border = 1,
        x = event.pageX - offset.left - border,
        y = $target.height() - (event.pageY - offset.top - border);
    return vec2(Math.floor(x / this.scale), Math.floor(y / this.scale));
};

/**
 * Manages the user interface for a simulation.
 */
function Controller(gol) {
    this.gol = gol;
    var _this = this,
        $canvas = $(gol.gl.canvas);
    this.drag = null;
    $canvas.on('mousedown', function(event) {
        _this.drag = event.which;
        var pos = gol.eventCoord(event);
        gol.poke(pos.x, pos.y, _this.drag == 1);
        gol.draw();
    });
    $canvas.on('mouseup', function(event) {
        _this.drag = null;
    });
    $canvas.on('mousemove', function(event) {
        if (_this.drag) {
            var pos = gol.eventCoord(event);
            gol.poke(pos.x, pos.y, _this.drag == 1);
            gol.draw();
        }
    });
    $canvas.on('contextmenu', function(event) {
        event.preventDefault();
        return false;
    });
    $(document).on('keyup', function(event) {
        switch (event.which) {
        case 82: /* r */
            gol.setRandom();
            gol.draw();
            break;
        case 46: /* [delete] */
            gol.setEmpty();
            gol.draw();
            break;
        case 32: /* [space] */
            gol.toggle();
            break;
        case 83: /* s */
            if (event.shiftKey) {
                if (this._save) gol.set(this._save);
            } else {
                this._save = gol.get();
            }
            break;
        };
    });
}

/* Initialize everything. */
var gol = null, controller = null;
$(document).ready(function() {
    var $canvas = $('#life');
    gol = new GOL($canvas[0]).draw().start();
    controller = new Controller(gol);
});

/* Don't scroll on spacebar. */
$(window).on('keydown', function(event) {
    return !(event.keyCode === 32);
});
