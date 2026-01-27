# Page 35

## Type
Communication Abstract

## Language
French (translated to English)

## Content

F. H. van den DUNGEN


NUMERICAL INTEGRATION OF THE WAVE EQUATION


The numerical integration of the wave equation

sum(i=1 to n) d²u/dx_i² - 1/c² d²u/dt² = 0

from the Cauchy data: for t = 0,

u = f(x_1, ..., x_n),     du/dt = phi(x_1, ..., x_n),

rests upon the essential notion of the domain of dependence determined by the retrograde characteristic cone.

The case of one-dimensional space (plane waves, n = 1) can be studied in an almost elementary manner, as Massau has indicated. If one admits that the x-axis is divided into segments small enough that the components of the gradient of u

du/dx = f     and     du/dt = phi

can be considered constant within each interval, the solution takes a linear form in each part of the plane comprised between the characteristic lines drawn from the extremities of the segments into which the x-axis is decomposed. The matching between the various linear expressions along the characteristics is easy to express. It is well known that one thus arrives at constructing the solution numerically or graphically.

This method of calculation transposes with difficulty to the case where there are several spatial dimensions. Already in the case n = 2, one is led to trace in the initial plane t = 0 small triangles where one supposes that the derivatives

df/du     df/dy     and     df/dt = phi

are constant and the solution does not everywhere have the linear form: from each vertex of the triangles in the initial plane, there emanates a progressive characteristic cone where the solution, depending on the com-

---

## Notes
- Page appears to continue on next page
- Mathematical equations have been represented as closely as possible in plain text
- The partial derivative symbols (d) represent partial derivatives throughout
- [Translation note: This describes numerical methods for solving wave equations - foundational work for what would later become computational physics]
