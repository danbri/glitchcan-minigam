
Experiment towards validation of Ink and Fink files.

node --enable-source-maps checkfink.mjs --max-lines 5 ../riverbend.ink

danbri@tincan:~/working/glitchcan-minigam/inklet/validation$ find ..  -name \*.ink
../riverbend.ink

find .  -name \*.fink.js
./toc.fink.js
./riverbend.fink.js
./validation/tests/test-variables.fink.js
./jungle2.fink.js
./tml-2025-langlearn.fink.js
./hampstead1.fink.js
./bagend1.fink.js


 node --enable-source-maps checkfink.mjs ../riverbend.fink.js
