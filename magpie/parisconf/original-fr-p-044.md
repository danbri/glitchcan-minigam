# Page 44

Göran KJELLBERG


QUELQUES PROBLEMES TRAITES AVEC LE BARK


CARACTERISTIQUES DU BARK. Construit exclusivement de relais,
au nombre de 5 200 (depuis janvier 1951 : 8 000).

Mémoire ; 50 nombres variables, 100 nombres constants (depuis
janvier 1951 : 100 nombres variables, 200 constants).

Représentation des nombres :
2ᴾ . q
|p| < 64 , 6 chiffres binaires
|q| < 1 ,24 chiffres binaires

Avec signes de p et de q, ceci donne un total de 32 informations
binaires pour la représentation d'un nombre.

Entrée et sortie des nombres : 5 stations (transmetteurs télé-
graphiques ordinaires) peuvent lire des bandes perforées en système déci-
mal. 2 stations peuvent lire des bandes en système binaire.

Egalement, 5 stations peuvent perforer des bandes en système
décimal, et 2 stations peuvent perforer en système binaire. En plus, on
dispose d'un imprimeur (télétype) capable d'imprimer des chiffres en sys-
tème décimal ou octal.

Une instruction a la forme
N     A     op     signes     B     C     D
N est le numéro de l'instruction, A et B les adresses des nombres qui de-
vront être combinés par l'opération "op", avec les signes indiqués par
"signes", C est l'adresse du résultat et D le numéro de la prochaine ins-
truction.

Les instructions sont communiquées à la machine en faisant les
couplages correspondants sur les 5 panneaux d'instructions : panneau A,
panneau B, panneau C, panneau des opérations et des signes, et panneau
des sauts. Chaque instruction exige normalement une connexion sur chaque
panneau (2 sur le panneau d'opérations et de signes).

Opérations :  Transfert                100 ms
              Addition                 150 ms
              Multiplication           250 ms
              Divers                   variable

---
[Note: Author name appears as "Göran KJELLBERG". BARK refers to the Swedish relay computer "Binär Aritmetisk Relä-Kalkylator".]
