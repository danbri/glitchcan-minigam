// Enhanced Space Invaders Fleet - Shadertoy Ready
// Copy-paste this into https://www.shadertoy.com/new

float boxSDF(vec2 p, vec2 c, vec2 h) {
    vec2 d = abs(p - c) - h;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float invaderSDF(vec2 pix) {
    float d = 1e9;
    #define R(x0,x1,y0,y1) d = min(d, boxSDF(pix, vec2((x0+x1)*0.5,(y0+y1)*0.5), vec2((x1-x0)*0.5,(y1-y0)*0.5)));
    R(2.,3.,0.,1.);  R(8.,9.,0.,1.);
    R(3.,4.,1.,2.);  R(6.,7.,1.,2.);
    R(2.,9.,2.,3.);
    R(1.,3.,3.,4.);  R(4.,7.,3.,4.);  R(8.,10.,3.,4.);
    R(0.,11.,4.,5.);
    R(0.,1.,5.,6.);  R(2.,9.,5.,6.);  R(10.,11.,5.,6.);
    R(0.,1.,6.,7.);  R(2.,3.,6.,7.);  R(8.,9.,6.,7.);  R(10.,11.,6.,7.);
    R(3.,5.,7.,8.);  R(6.,8.,7.,8.);
    #undef R
    return d;
}

// Simple hash for per-invader randomness
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Starfield background
vec3 starfield(vec2 uv, float time) {
    vec3 col = vec3(0.0);

    // Multiple layers for parallax
    for (float layer = 0.0; layer < 3.0; layer++) {
        vec2 st = uv * (50.0 + layer * 30.0);
        st.y += time * (0.1 + layer * 0.05); // Scrolling

        vec2 id = floor(st);
        vec2 gv = fract(st) - 0.5;

        float brightness = hash(id + layer * 100.0);
        if (brightness > 0.95) {
            float size = 0.002 * (1.0 - layer * 0.3);
            float star = smoothstep(size, 0.0, length(gv));
            star *= (0.5 + 0.5 * sin(time * 3.0 + brightness * 20.0)); // Twinkle
            col += vec3(star) * (0.3 + layer * 0.35);
        }
    }

    return col;
}

// CRT scanlines effect
float scanline(vec2 uv, float time) {
    float line = sin(uv.y * 800.0 + time * 10.0) * 0.5 + 0.5;
    return mix(0.8, 1.0, line * 0.3);
}

// Vignette
float vignette(vec2 uv) {
    uv *= 1.0 - uv.xy;
    return pow(uv.x * uv.y * 15.0, 0.2);
}

void mainImage(out vec4 fragColor, vec2 fragCoord) {
    float T = iTime;

    // Normalized coords
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    vec2 screenUV = fragCoord / iResolution.xy;

    // World space
    float worldScale = 0.007;
    vec2 p = uv / worldScale;

    // Fleet configuration
    const int COLS = 11;
    const int ROWS = 5;
    float sx = 18.0;
    float sy = 15.0;

    // Classic arcade oscillation with slight speed variation
    float fleetShift = 8.0 * sin(T * 1.2);

    // Start with starfield
    vec3 col = starfield(uv, T);

    // Add subtle blue nebula gradient
    col += vec3(0.02, 0.02, 0.1) * (1.0 - length(uv) * 0.3);

    bool hitInvader = false;

    for (int r = 0; r < ROWS; r++) {
        for (int c = 0; c < COLS; c++) {
            float cf = float(c);
            float rf = float(r);

            // Per-invader hash for variations
            vec2 invID = vec2(cf, rf);
            float randPhase = hash(invID) * 6.28;

            // Base position with slight per-invader wobble
            vec2 base = vec2(
                (cf - float(COLS - 1) * 0.5) * sx + fleetShift,
                (rf - float(ROWS - 1) * 0.5) * -sy
            );

            // Add subtle individual motion
            base.y += sin(T * 2.0 + randPhase) * 0.5;

            // Local space
            vec2 lp = p - base;
            float d = invaderSDF(lp);

            // Smooth rendering with glow
            float edge = smoothstep(0.5, -0.5, d);

            if (edge > 0.01) {
                hitInvader = true;

                // Row-based color scheme (retro arcade palette)
                vec3 baseColor;
                if (r == 0) baseColor = vec3(1.0, 0.3, 0.3);      // Red (top)
                else if (r == 1) baseColor = vec3(1.0, 0.6, 0.2); // Orange
                else if (r == 2) baseColor = vec3(1.0, 1.0, 0.3); // Yellow
                else if (r == 3) baseColor = vec3(0.3, 1.0, 0.5); // Green
                else baseColor = vec3(0.3, 0.6, 1.0);             // Blue (bottom)

                // Pulsing effect synchronized per row
                float pulse = 0.8 + 0.2 * sin(T * 3.0 + rf * 0.5);
                baseColor *= pulse;

                // Outer glow
                float glow = exp(-8.0 * abs(d)) * 0.4;

                // Combine
                col += baseColor * (edge + glow);

                // Extra bright core
                float core = smoothstep(1.0, -1.0, d);
                col += baseColor * core * 0.3;
            }
        }
    }

    // Post-processing effects

    // CRT scanlines
    col *= scanline(screenUV, T);

    // Vignette
    col *= vignette(screenUV);

    // Slight color aberration for CRT feel
    float aberration = 0.002;
    col.r *= 0.98;
    col.b *= 0.98;

    // Subtle overall glow
    col = pow(col, vec3(0.9));

    // Contrast boost
    col = col * 1.2;

    fragColor = vec4(col, 1.0);
}
