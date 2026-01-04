# Space Invader SDF - Pixel-Perfect GLSL Implementation

This GLSL code renders a classic Space Invader sprite using signed distance fields (SDFs). The invader is constructed from 13 rectangular regions mapped to an 11×8 pixel grid.

## Key Features

- **Pixel-perfect reproduction** of the iconic 8-bit sprite
- **Coordinate space mapping** from normalized [-1,1]×[-1,1] to discrete [0,11]×[0,8] pixel grid
- **Efficient rectangle packing** using a preprocessor macro for clean, maintainable code
- **True SDF representation** enabling smooth scaling, outlining, and distance-based effects

## GLSL Implementation

```glsl
float boxSDF(vec2 p, vec2 center, vec2 halfSize) {
    vec2 d = abs(p - center) - halfSize;
    vec2 dmax = max(d, 0.0);
    return length(dmax) + min(max(d.x, d.y), 0.0);
}

float invaderSDF(vec2 p) {
    // Map p from [-1,1]x[-1,1] to [0,11]x[0,8]
    vec2 pix = vec2(
        (p.x * 0.5 + 0.5) * 11.0,
        (p.y * 0.5 + 0.5) *  8.0
    );

    float d = 1e9;

    // Helper macro: rectangle [x0,x1) x [y0,y1)
    #define RECT(x0,x1,y0,y1) \
        d = min(d, boxSDF(pix, vec2((x0 + x1)*0.5, (y0 + y1)*0.5), vec2((x1 - x0)*0.5, (y1 - y0)*0.5)));

    RECT(2.0,3.0, 0.0,1.0);  RECT(8.0,9.0, 0.0,1.0);
    RECT(3.0,4.0, 1.0,2.0);  RECT(6.0,7.0, 1.0,2.0);
    RECT(2.0,9.0, 2.0,3.0);
    RECT(1.0,3.0, 3.0,4.0);  RECT(4.0,7.0, 3.0,4.0);  RECT(8.0,10.0, 3.0,4.0);
    RECT(0.0,11.0,4.0,5.0);
    RECT(0.0,1.0, 5.0,6.0);  RECT(2.0,9.0, 5.0,6.0);  RECT(10.0,11.0,5.0,6.0);
    RECT(0.0,1.0, 6.0,7.0);  RECT(2.0,3.0, 6.0,7.0);  RECT(8.0,9.0, 6.0,7.0);  RECT(10.0,11.0,6.0,7.0);
    RECT(3.0,5.0, 7.0,8.0);  RECT(6.0,8.0, 7.0,8.0);

    #undef RECT

    return d;
}
```

## Usage Notes

This SDF can be:
- **Rendered directly** with `step(d, 0.0)` for sharp edges
- **Smoothed** with `smoothstep()` for anti-aliased rendering
- **Outlined** by checking distance thresholds
- **Animated** by passing transformed coordinates (rotation, scaling, translation)
- **Combined** with other SDFs using union/subtract/intersect operations

The function returns the signed distance in pixel space, where negative values are inside the shape and positive values are outside.
