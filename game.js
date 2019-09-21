const log = console.log;

const cw = 1000;
const ch = 600;

const make_ctx = () => {
    const can = document.createElement("canvas");
    can.width = cw;
    can.height = ch;
    const ctx = can.getContext("2d");

    return [can, ctx];
};

const disp = make_ctx();
const disp_main_menu = make_ctx();
const disp_play = make_ctx();

document.body.appendChild(disp[0]);

muted = false;
unitTesting = false;

masterVolume = .25;
let volume_t = 1;

let prev_time = 0;

let STATE_MAIN_MENU = 0;
let STATE_PLAY = 1;

let state_disp_blend_weight = 1;
let state_disp_blend_time_left = 0;
let state_disp_blend_time_max = 0;
let num_apples = 0;

let current_state = STATE_MAIN_MENU;

let keys = {};
const KEY_SPACE = 0;

let ground_y = 0;
let ground_y_max = 0;

const guy_min_size = [30, 30];

const guy = {
    rect: [50,ground_y, guy_min_size[0], guy_min_size[1]],
    vel: [0, 0],
    is_grounded: true,
};

let obstacles = [];
let apples = [];
let time_to_apple = 0;
let time_to_obstacle = 0;
let extra_velocity = 0;

function update(time) {

    let dt = (time - prev_time) / 1000;

    if(prev_time === 0) {
        dt = 1/60;
    }

    prev_time = time;

    volume_t = clamp(volume_t, 0, 1);
    masterVolume = volume_t * .25;
    if(masterVolume <= 0) {
        muted = true;
    }
    else {
        muted = false;
    }

    log(masterVolume);

    if(state_disp_blend_time_left > 0) {
        state_disp_blend_time_left -= dt;
        state_disp_blend_weight = (state_disp_blend_time_left / state_disp_blend_time_max);
        state_disp_blend_weight = smoothstep(state_disp_blend_weight);
    }
    else {
        if(current_state == STATE_MAIN_MENU) {
            state_disp_blend_weight = 1;
        }
        else if(current_state == STATE_PLAY) {
            state_disp_blend_weight = 0;
        }
    }

    if(current_state == STATE_PLAY) {
        extra_velocity += 5 * dt;
        ground_y -= 2 * dt;

        volume_t = ground_y / ground_y_max;
        volume_t = smoothstep(volume_t);


        const old_grounded = guy.is_grounded;

        if(!guy.is_grounded) {

            if(!keys[KEY_SPACE]) {
                guy.vel[1] -= Math.abs(guy.vel[1]) * .3;
                guy.vel[1] -= 4000 * dt;
            }
            else {
                guy.vel[1] -= Math.abs(guy.vel[1]) * .1;
                guy.vel[1] -= 500 * dt;
            }
        }
        else {
            guy.rect[1] = ground_y;
        }

        if(keys[KEY_SPACE] && guy.is_grounded) {
            guy.is_grounded = false;
            guy.vel[1] = 1000;
        }

        guy.rect[1] += guy.vel[1] * dt;

        if(guy.rect[1] <= ground_y) {
            guy.vel[1] = 0;
            guy.is_grounded = true;
            guy.rect[1] = ground_y;
        }

        if(guy.is_grounded && !old_grounded) {
            playSound(15646307);
        }
        else if(!guy.is_grounded && old_grounded) {
            playSound(38656907);
        }


        time_to_apple -= dt;
        if(time_to_apple <= 0) {
            time_to_apple = 5;

            const a = {
                rect: [cw, ch* .8, 30, 30],
                vel: [450+ extra_velocity * .5]
            };

            apples.push(a);
        }

        time_to_obstacle -= dt;

        if(time_to_obstacle <= 0) {
            time_to_obstacle = 1;

            const obs = {
                rect: [cw, ground_y, 30, 30],
                vel: [400 + extra_velocity, 0],
                deadly: true
            };

            if(rng.uniform() > .5) {
                obs.rect[3] *= 2;
            }
            else {
                obs.rect[2] *= 2;
            }

            if(rng.uniform() > .5) {
                obs.vel[0] *= 1.5;
            }

            const reward = {
                rect: [obs.rect[0], obs.rect[1] + obs.rect[3] + 30, 30, 30],
                vel: vec_copy(obs.vel),
                deadly: false,
            };

            obstacles.push(obs);
            obstacles.push(reward);
        }

        {
            let i = obstacles.length - 1;
            while(i >= 0) {
                const obs = obstacles[i];

                obs.rect[0] -= obs.vel[0] * dt;

                if(obs.rect[0] <= -50) {
                    obstacles.splice(i, 1);
                }

                if(do_rects_intersect(guy.rect, obs.rect)) {

                    if(obs.deadly) {

                        guy.rect[2] -= 40;
                        guy.rect[3] -= 40;
                        obstacles.splice(i, 1);

                        if(guy.rect[2] <= 0) guy.rect[2] = 1;
                        if(guy.rect[3] <= 0) guy.rect[3] = 1;

                        playSound(91715303);
                    }
                    else {
                        playSound(64483703);

                        obstacles.splice(i, 1);

                        guy.rect[2] += 10;
                        guy.rect[3] += 10;

                    }
                }

                i -= 1;
            }
        }

        {
            let i = apples.length - 1;
            while(i >= 0) {
                const a = apples[i];

                a.rect[0] -= a.vel[0] * dt;

                if(a.rect[0] <= -50) {
                    apples.splice(i, 1);
                }


                if(do_rects_intersect(guy.rect, a.rect)) {
                    extra_velocity -= extra_velocity * .7;
                    apples.splice(i, 1);
                    num_apples += 1;

                    playSound(94576700);
                }


                i -= 1;
                
            }
        }
    }

    const blit_blob= (d, style, x, y, sx, sy, r) => {
        d[1].save();
        d[1].translate(x, y);

        if(r != 0) {
            d[1].translate(sx * .5, sy * .5);
            d[1].rotate(r);
            d[1].translate(-sx * .5, -sy * .5);
        }

        d[1].fillStyle = style;
        d[1].fillRect(0, 0, sx, sy);

        d[1].restore();
    };

    if(state_disp_blend_weight < 1) {
        const d = disp_play;

        d[1].fillStyle = "#181426";
        d[1].clearRect(0, 0, d[0].width, d[0].height);
        d[1].fillRect(0, 0, d[0].width, d[0].height);

        d[1].save();

        d[1].scale(1, -1);
        d[1].translate(0, -d[0].height);

        blit_blob(d, "#201831", 0, 0, d[0].width, ground_y, 0);
        
        blit_blob(d, "#488bcb",
            guy.rect[0], guy.rect[1],
            guy.rect[2], guy.rect[3],
            0
        );

        for(const apple of apples) {
            blit_blob(d, "#e9b724",
                apple.rect[0], apple.rect[1],
                apple.rect[2], apple.rect[3],
                0
            );
        }

        for(const obs of obstacles) {
            blit_blob(d, obs.deadly ? "#fa506f" : "#488bcb",
                obs.rect[0], obs.rect[1],
                obs.rect[2], obs.rect[3],
                0
            );
        }

        document.body.style.cursor = "";
        d[1].restore();

        d[1].font = '32px m6x11';
        d[1].fillStyle = "white";
        d[1].fillText(String(num_apples), cw * .96, 30);
    }

    if(state_disp_blend_weight > 0) {
        const d = disp_main_menu;

        d[1].fillStyle = "rgba(32, 32, 32, .8)";
        d[1].fillRect(0, 0, d[0].width, d[0].height);

        d[1].font = '48px m6x11';
        d[1].fillStyle = "white";
        d[1].fillText("HEIGHT", d[0].width * .5 - 70, d[0].height * .5 - 40);


        d[1].font = '32px m6x11';
        d[1].fillText('CLICK TO BEGIN', d[0].width * .5 - 90, d[0].height * .5 + 80);
        document.body.style.cursor = "pointer";
    }

    const d = disp;

    d[1].globalAlpha = state_disp_blend_weight;
    d[1].drawImage(disp_main_menu[0], 0, 0, disp_main_menu[0].width, disp_main_menu[0].height);
    d[1].globalAlpha = 1 - state_disp_blend_weight;
    d[1].drawImage(disp_play[0], 0, 0, disp_play[0].width, disp_play[0].height);
    d[1].globalAlpha = 1;

    requestAnimationFrame(update);
}

function update_key(e, state) {
    let ret = true;
    if(e.key == " " || e.key == "Space") {
        keys[KEY_SPACE] = state;
        e.preventDefault();
        ret = false;
    }

    return ret;
}

function keyup(e) {
    update_key(e, false);
}

function keydown(e) {
    update_key(e, true);
}

function reset_game() {
    obstacles = [];
    apples = [];
    time_to_apple = 2;
    time_to_obstacle = 1;
    extra_velocity = 0;
    guy.rect = [50,ground_y, guy_min_size[0], guy_min_size[1]];
    guy.is_grounded = true;
    guy.vel = [0, 0];
    ground_y = ch * .3;
    ground_y_max = ch * .3;
    num_apples = 0;
}

function on_pointer_up(e) {
    if(current_state == STATE_MAIN_MENU) {
        current_state = STATE_PLAY;
        state_disp_blend_time_left = 1;
        state_disp_blend_time_max = 1;
    }
}

document.body.addEventListener("keyup",keyup);
document.body.addEventListener("keydown",keydown);
document.body.addEventListener("pointerup",on_pointer_up);

reset_game();
requestAnimationFrame(update);
