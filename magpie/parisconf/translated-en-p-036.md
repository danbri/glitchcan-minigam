# Page 36

## Type
Communication Abstract (continuation)

## Language
French (translated to English)

## Content

- 2 -

ponents of the gradient in the six triangles joined by the tip at the vertex under consideration, cannot be linear.

The method proposed here consists in the determination of the values of u and du/dt in a plane parallel to the initial plane. Taking this plane as a new initial plane, one can again solve the Cauchy problem so as to pass to a third plane, and so forth.

The procedure extends to the case where the equation contains a second member, as well as terms in

d²u/dx_i dx_j,     d²u/dx_i dt,     du/dx_i,     du/dt     and     u

When the coefficients are variable, one is led back to the preceding case by dividing the domain of integration into sufficiently small regions.

In this abstract, we shall limit ourselves to indicating the type of solution obtained in the case of plane waves

d²u/dx² = 1/c² d²u/dt²

to be integrated from t = 0 where

u = f(x)     and     du/dt = phi(x)

One has

[DIAGRAM: A triangle with vertices labeled K, k, A, l, L at bottom, and T at top, with t = h marked on vertical axis and t = 0 marked at base]

u_T = 1/2(f_K + f_L)
    + h/6(phi_K + 4*phi_A + phi_L)

(du/dt)_T = 1/h(f_K - 2f_A + f_L)
          + 1/2(phi_K + phi_L)

KA = AL = c*h

These formulae are obtained by interpolating f and phi between their values at K, A and L by means of parabolic relations. A better approximation is obtained by means of five-term formulae

u_T = 1/2(f_K + f_L) + h/90(7*phi_K + 32*phi_k + 12*phi_A + 32*phi_l + 7*phi_L)

---

## Notes
- The diagram shows a characteristic triangle used in numerical integration
- Mathematical notation preserved as closely as possible in plain text
- [Translation note: These numerical integration techniques represent the mathematical foundations that would later be implemented on calculating machines]
