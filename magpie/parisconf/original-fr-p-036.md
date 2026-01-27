# Page 36

- 2 -

posantes du gradient dans les six triangles réunis par la pointe au
sommet considéré, ne peut être linéaire.

La méthode proposée ici consiste en la détermination des
valeurs de u et ∂u/∂t dans un plan parallèle au plan initial. En pre-
nant ce plan comme nouveau plan initial, on peut à nouveau résoudre
le problème de Cauchy de façon à passer dans un troisième plan et
ainsi de suite.

Le procédé s'étend au cas où l'équation comporte un second
membre , ainsi que des termes en

∂² u/∂xᵢ∂nⱼ,     ∂² u/∂xᵢ ∂t,     ∂u/∂nᵢ,     ∂u/∂t     et     u

Lorsque les coefficients sont variables, on est ramené au cas précé-
dent en divisant le domaine d'intégration en régions assez petites.

Dans ce résumé, nous nous bornerons à indiquer le type de
solution auquel on arrive dans le cas des ondes planes

∂²u/∂n² = 1/c² ∂²u/∂t²

à intégrer à partir de t = 0 où

u = f(x)     et     ∂u/∂t = φ(x)

On a

[DIAGRAM: A triangle with vertices labeled K, k, A, l, L at bottom, and T at top, with t = h marked on vertical axis and t = 0 marked at base]

uT = ½(fK + fL)
   + h/6(φK + 4φA + φL)

(∂u/∂t)T = 1/h(fK - 2fA + fL)
         + ½(φK + φL)

KA = AL = c·h

Ces formules sont obtenues en interpolant f et φ entre leurs valeurs
en K, A et L au moyen de relations paraboliques. Une meilleure ap-
proximation est obtenue aux moyen de formules à cinq termes

uT = ½(fK + fL) + h/90(7φK + 32φk + 12φA + 32φl + 7φL)

---
[Note: The diagram shows a characteristic triangle used in numerical integration. Mathematical notation preserved as closely as possible in plain text.]
