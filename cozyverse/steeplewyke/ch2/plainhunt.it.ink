// Steeple Wyke, chapter 2: Plain Hunt. A death in the bell tower in ten graphic-novel pages (index.html, pages.json).
// The host and the patterns are chapter 1's (../v2/, and the photo-novel skill): "# page: N" turns the page, "# panel:
// X" moves the view, a tap on a panel diverts to that panel's knot, "# voice: id" plays a take (media/vo/<id>-N.mp3),
// a line that starts "Name:" is that person speaking.
// After the body (page 3) the inquiries knot is a hub: four visits of five places (pages 4 to 8), in any order. Page 9
// is the puzzle: which bell went silent in the dark, and who was ringing it that night. Page 10 is the accusation.
// Two routes prove it, and either is enough: the ringing (rows, swap, lie, dark, the bell found on page 9) and the
// board (proof, quiz, typeface, brush, swapped). evidence() counts both.
// The ringing rows are plain hunt on five; tools/rows.mjs makes them and checks the text here against the rule.
// The canary and the scarecrow in Sam's clothes are the wrong notes (nocliches skill, rule F7): never explained.
VAR rows = false
VAR swap = false
VAR lie = false
VAR dark = false
VAR proof = false
VAR quiz = false
VAR typeface = false
VAR brush = false
VAR text = false
VAR swapped = false
VAR bell4 = false
VAR named4 = false
VAR guesses = 0
VAR asked_dilys = false
VAR asked_band = false
VAR win_phone = false
VAR visits = 0
VAR seen_win = false
VAR seen_barn = false
VAR seen_plough = false
VAR seen_school = false
VAR seen_board = false
VAR accused = ""
VAR ending = ""
// The village remembers (chapter 1's memory, the same key): rel_<who> is your standing now, was_<who> what it was
// when this reading began. Chapter 2 adds Win and Dr Achebe.
VAR rel_toby = 0
VAR rel_margaret = 0
VAR rel_dilys = 0
VAR rel_quaile = 0
VAR rel_win = 0
VAR rel_achebe = 0
VAR was_toby = 0
VAR was_margaret = 0
VAR was_dilys = 0
VAR was_quaile = 0
VAR was_win = 0
VAR was_achebe = 0

-> p1

// ---------------------------------------------------------------- page 1: the tower, Tuesday evening
=== p1 ===
# page: 1
# panel: page
{p1 > 1:
    {p1 > 2:
        # voice: loop-here
        Quaile: Ci siamo già stati, Sam.
    }
    # voice: p1-again
    La torre, martedì sera.
}
{p1 == 1:
    # voice: p1-open
    St Aldhelm's, un martedì di ottobre, le sette e venti. Tre mesi dopo la Mostra delle Zucche, la vicaria ad interim ti ha convinto a imparare a suonare le campane.
}
+ {p1_win == 0} [Conosci la capitana della torre] -> p1_win
+ {p1_win > 0} [Sali nella camera dei campanari] -> p2
+ {p1_tower == 0} [Alza gli occhi alla torre] -> p1_tower

=== p1_tower ===
# panel: tower
# voice: p1a-1
Le cornacchie girano intorno alla guglia. Su nella camera dei campanari c'è una luce accesa.
# voice: p1a-2
La rastrelliera accanto al cancello coperto del sagrato è vuota. Hugh Daventry suona la campana più acuta, cura il bollettino parrocchiale e prepara il quiz del mercoledì al Plough. Di solito lascia lì la bicicletta entro le sette e un quarto.
+ {p1_achebe == 0} [Saluta la reverenda] -> p1_achebe
+ {p1_win == 0} [Conosci la capitana della torre] -> p1_win
+ {p1_win > 0} [Sali nella camera dei campanari] -> p2

=== p1_achebe ===
# panel: achebe
{p1_achebe > 1:
    # voice: p1b-again
    Achebe: Win la aspetta, Sergente.
    -> p1_achebe_choices
}
# voice: p1b-1
Achebe: Sergente Adeyemi. È venuto. Avevo detto a Margaret quaranta per cento.
# voice: p1b-2
Sam: E Margaret cosa ha detto?
# voice: p1b-3
Achebe: Che sarebbe venuto, se aveva detto che veniva.
# voice: p1b-4
La reverenda dottoressa Ruth Achebe è vicaria ad interim da agosto. Prima dell'ordinazione calcolava il rischio pensionistico per un assicuratore di Croydon.
-> p1_achebe_choices
= p1_achebe_choices
+ {p1_win == 0} [Conosci la capitana della torre] -> p1_win
+ {p1_win > 0} [Sali nella camera dei campanari] -> p2

=== p1_win ===
# panel: win
{p1_win > 1:
    # voice: p1c-again
    Win: Panca. Piedi dentro.
    -> p1_win_choices
}
# voice: p1c-1
Win: Lei è il poliziotto. Io sono Win. Capitana della torre.
# voice: p1c-2
Ha settantotto anni. Parla un po' troppo forte, e ti guarda la bocca mentre rispondi. Al collo, appesi a uno spago, un taccuino da cronista e una matita.
# voice: p1c-3
Win: Lei si siede sulla panca, con i piedi dentro, e non tocca le corde. Una campana può sollevare un uomo adulto fino al soffitto.
-> p1_win_choices
= p1_win_choices
+ {p1_napkin == 0} [Chiedi che cos'è il plain hunt] -> p1_napkin
+ {p1_napkin > 0} [Sali nella camera dei campanari] -> p2

=== p1_napkin ===
# panel: napkin
{p1_win == 0: -> p1_win}
# voice: p1d-1
Sul retro di un tovagliolo del Plough scrive la prima cosa che impara ogni campanaro.
# voice: p1d-2
Win: Plain hunt. Cinque campane. In una riga le coppie si scambiano: la prima con la seconda, la terza con la quarta. Nella successiva, la seconda con la terza, la quarta con la quinta. Poi di nuovo la prima.
1 2 3 4 5
2 1 4 3 5
2 4 1 5 3
4 2 5 1 3
4 5 2 3 1
5 4 3 2 1
5 3 4 1 2
3 5 1 4 2
3 1 5 2 4
1 3 2 5 4
1 2 3 4 5
# voice: p1d-3
Win: Dieci righe e si torna all'ordine di partenza. Hugh suona la campana più acuta. Se non è qui per la mezza, suoniamo in cinque.
# voice: p1d-4
Sam: Le corde sono sei.
# voice: p1d-5
Win: Sei campane. In cinque, il tenore resta fermo.
+ [Mettiti in tasca il tovagliolo e sali] -> p2

// ---------------------------------------------------------------- page 2: the ringing chamber
=== p2 ===
# page: 2
# panel: page
{p2 > 1:
    {p2 > 2:
        # voice: loop-here
        Quaile: Ci siamo già stati, Sam.
    }
    # voice: p2-again
    La camera dei campanari.
}
{p2 == 1:
    # voice: p2-open
    La camera dei campanari, quattordici gradini di pietra più su: sei corde con impugnature di lana a righe, una panca, un vassoio del tè e una lavagna. Cinque campanari, e una corda legata in alto, fuori portata.
}
+ {p2_list == 0} [Leggi la lavagna] -> p2_list
+ {p2_ropes == 0} [Siediti sulla panca e guarda] -> p2_ropes
+ {p2_ropes > 0} [Aspetta] -> p2_dark

=== p2_tea ===
# panel: tea
# voice: p2a-1
Margaret Pike versa il tè da un thermos sul davanzale. Tira fuori due tazze, guarda la seconda e la rimette nel cestino.
{was_margaret <= -1:
    # voice: p2a-cold
    Ti porge una tazza senza guardarti.
- else:
    # voice: p2a-2
    Margaret: Sergente. Il latte è nel barattolo della marmellata.
}
+ {p2_list == 0} [Leggi la lavagna] -> p2_list
+ {p2_ropes == 0} [Siediti sulla panca e guarda] -> p2_ropes
+ {p2_ropes > 0} [Aspetta] -> p2_dark

=== p2_list ===
# panel: list
# voice: p2b-1
Sulla lavagna, nelle maiuscole squadrate di Hugh: Martedì. Uno, Hugh. Due, Margaret. Tre, Dilys. Quattro, Win. Cinque, Jeremy. Sei, Ruth.
{was_dilys <= -1:
    # voice: p2b-cold
    Dilys: Hugh non è venuto. Ci pensa Win.
- else:
    ~ swap = true
    # voice: p2b-2
    Dilys: Hugh non è venuto, quindi scaliamo tutti di un posto. Margaret, tu prendi la campana più acuta. Ruth, tu stai fuori da questo giro.
    # voice: p2b-3
    Dilys: Non cambiare la lavagna, tesoro. A Hugh piace cancellarla da sé.
}
+ {p2_ropes == 0} [Siediti sulla panca e guarda] -> p2_ropes
+ {p2_ropes > 0} [Aspetta] -> p2_dark

=== p2_ropes ===
# panel: ropes
{p2_ropes > 1:
    # voice: p2c-again
    Le corde salgono e scendono. Win muove le labbra mentre conta.
    -> p2_ropes_wait
}
# voice: p2c-1
Win: Look to. Parte la campana più acuta. Partita.
# voice: p2c-2
Le campane attaccano sopra di te, abbastanza forte da sentirle attraverso la panca. Cinque persone in cerchio, ognuna guarda la corda di qualcun altro.
# voice: p2c-3
Jeremy Cole, l'antiquario, sta più vicino alla porta, sotto l'interruttore della luce. Alle otto e cinque, tra un pezzo e l'altro, legge il telefono e lo mette via.
-> p2_ropes_wait
= p2_ropes_wait
+ [Aspetta] -> p2_dark

=== p2_dark ===
# panel: dark
{p2_ropes == 0: -> p2_ropes}
# voice: p2d-1
Alle otto e un quarto si spengono le luci.
# voice: p2d-2
Il suono continua al buio, e va storto: nello schema manca una campana, o due. Sotto di te, attraverso il pavimento, un tonfo e un breve tintinnio metallico.
# voice: p2d-3
Quaranta secondi al tuo orologio, e le luci tornano. Sono tutti dov'erano.
# voice: p2d-4
Jeremy: Quell'interruttore lo fa ogni inverno. Bisogna tenerlo su.
# voice: p2d-5
Win chiama Stand, e le campane si fermano. La dottoressa Achebe scende per prima, a mettere su il bollitore.
# voice: p2d-6
Poi grida il tuo nome.
+ [Corri giù per la scala] -> p3

// ---------------------------------------------------------------- page 3: the vestry
=== p3 ===
# page: 3
# panel: page
{p3 > 1:
    {p3 > 2:
        # voice: loop-here
        Quaile: Ci siamo già stati, Sam.
    }
    # voice: p3-again
    La sagrestia, ai piedi della scala.
}
{p3 == 1:
    # voice: p3-open
    Hugh Daventry è ai piedi della scala della torre, dove sbocca nella sagrestia. La dottoressa Achebe è in ginocchio accanto a lui. Alza gli occhi e scuote la testa.
}
+ {p3_stair == 0} [Guarda la scala] -> p3_stair
+ {not proof} [Guardagli la mano] -> p3_proof
+ {p3_quaile == 0} [Aspetta Quaile] -> p3_quaile
+ {p3_quaile > 0} [Torna da Quaile] -> p3_quaile

=== p3_stair ===
# panel: stair
# voice: p3a-1
Ha ancora le mollette da ciclista ai pantaloni. La torcia è sull'ultimo gradino, ancora accesa.
# voice: p3a-2
La scala è di pietra, stretta, e gira a sinistra. Quattordici gradini fino alla porta della camera dei campanari.
{text == false:
    ~ text = true
    # voice: p3a-3
    Achebe: Ha scritto al gruppo alle otto e cinque. Sto salendo. Devo dire una cosa sulla tavola. H.
}
# voice: p3a-4
Achebe: Sono scesa per il bollitore e lui era qui. Non l'ho spostato.
+ {not proof} [Guardagli la mano] -> p3_proof
+ {p3_quaile == 0} [Aspetta Quaile] -> p3_quaile
+ {p3_quaile > 0} [Torna da Quaile] -> p3_quaile

=== p3_proof ===
# panel: proof
{p3_stair == 0: -> p3_stair}
~ proof = true
# voice: p3b-1
La mano destra è chiusa su un angolo di pagina, strappato. Stampato sopra: Tavola del concerto, una corre. E in fondo, H.D.
# voice: p3b-2
Sam: Una bozza. Per il bollettino parrocchiale.
# voice: p3b-3
Sam: Qualcuno ha il resto di quella pagina.
+ {p3_quaile == 0} [Aspetta Quaile] -> p3_quaile
+ {p3_quaile > 0} [Torna da Quaile] -> p3_quaile

=== p3_quaile ===
# panel: quaile
{p3_quaile > 1:
    # voice: p3c-again
    Quaile: Una domanda al gruppo, Sam, poi vanno a casa.
    -> p3_quaile_choices
}
# voice: p3c-1
Quaile arriva undici minuti dopo, con un impermeabile sopra il pigiama.
# voice: p3c-2
Quaile: Ero nella vasca, Sam. Dimmi che è un incidente.
# voice: p3c-3
Sam: Potrebbe esserlo.
# voice: p3c-4
Quaile: Allora perché hai chiamato me e non solo un'ambulanza?
# voice: p3c-5
Sam: Ho chiamato tutte e due, capo.
# voice: p3c-6
Quaile: Un anziano, una scala di pietra, la luce che va via. Il coroner dirà che è caduto, e il coroner si riunisce venerdì. Il gruppo ha freddo e vuole andare a letto. Stasera puoi fare una domanda sola.
-> p3_quaile_choices
= p3_quaile_choices
+ {not asked_band} [Interroga il gruppo] -> p3_band
+ {asked_band} [Lasciali andare a casa] -> p3_home

=== p3_band ===
# panel: band
{p3_quaile == 0: -> p3_quaile}
// revisited once a question has been asked (a tap before Quaile arrives goes through the guard first)
{asked_band:
    # voice: p3d-again
    Il gruppo aspetta con i cappotti addosso. Hanno risposto a una domanda, e vorrebbero andare a casa.
    -> p3_home
}
# voice: p3d-1
Il gruppo aspetta in sagrestia con i cappotti addosso: Win, Dilys, Margaret, Jeremy. Nessuno si siede.
-> p3_band_choices
= p3_band_choices
+ [Chiedi se qualcuno è uscito dalla camera] -> p3_left
+ [Chiedi a Dilys del suo telefono] -> p3_phone
+ [Chiedi chi suonava quale campana] -> p3_which

=== p3_left ===
# panel: band
{p3_band == 0: -> p3_band}
~ asked_band = true
# voice: p3e-1
Dilys: Al buio? Nessuno avrebbe trovato la porta, tesoro.
# voice: p3e-2
Jeremy: Abbiamo suonato senza fermarci, Sergente. Chieda a Win.
# voice: p3e-3
Win: Cosa?
+ [Lasciali andare a casa] -> p3_home

=== p3_phone ===
# panel: band
{p3_band == 0: -> p3_band}
~ asked_band = true
~ asked_dilys = true
# voice: p3f-1
Dilys: Registro ogni prova per mia sorella Glenys. Sta a Perth. Ha suonato qui per trent'anni, prima che le cedessero le ginocchia.
# voice: p3f-2
Dilys: Ci ascolta a colazione e ci dà un voto su dieci.
{was_dilys <= -1:
    # voice: p3f-cold
    Dilys: Lo avrà quando avrò deciso se mi è simpatico. Me lo richieda domani.
- else:
    # voice: p3f-3
    Dilys: Glielo mando stasera. Domattina avrà i suoi voti.
}
+ [Lasciali andare a casa] -> p3_home

=== p3_which ===
# panel: band
{p3_band == 0: -> p3_band}
~ asked_band = true
{was_margaret <= -1:
    # voice: p3g-cold
    Margaret: Chieda a Win, Sergente. Glielo dirà lei. Ad alta voce.
    # voice: p3g-cold2
    Win si sta già mettendo il cappotto.
- else:
    ~ swap = true
    # voice: p3g-1
    Margaret: Abbiamo scalato tutti di un posto, perché Hugh non era venuto. Io avevo la campana più acuta. Era la prima volta che la suonavo.
    # voice: p3g-2
    Margaret: Gerald non mi ha mai lasciato suonare. Diceva che faceva male alle mani.
}
+ [Lasciali andare a casa] -> p3_home

=== p3_home ===
{morning > 0: -> inquiries}
-> morning

// ---------------------------------------------------------------- Wednesday: the inquiries, four visits of five
=== morning ===
# voice: morning
Mercoledì. Dormi quattro ore, e ti sveglia il telefono.
{was_dilys >= 1 || (asked_dilys && was_dilys >= 0):
    ~ rows = true
    # voice: morning-rows
    Una mail di Dilys, inoltrata da Perth, con l'oggetto Non la vostra serata migliore.
}
{was_toby >= 1:
    ~ dark = true
    # voice: morning-drone
    Un video di Toby Pike, mandato alle sei. Martedì sera faceva volare un drone sopra la vecchia scuola, e ha pensato che ti potesse interessare.
}
-> inquiries

=== inquiries ===
{visits >= 4: -> evening}
{visits:
- 0:
    # voice: hub-0
    Quaile: Il coroner si riunisce venerdì. Cinque persone da vedere e tempo per quattro. Da chi cominciamo?
- 3:
    # voice: hub-3
    Quaile: Ancora una, poi la canonica. La dottoressa Achebe dice di aver fatto un foglio di calcolo.
- else:
    # voice: hub-n
    Quaile: E adesso dove?
}
+ {not seen_win} [Va' a casa di Win Haskett] -> p4
+ {not seen_barn} [Passa da Jeremy Cole al suo fienile] -> p5
+ {not seen_plough} [Va' al quiz del Plough] -> p6
+ {not seen_school} [Cerca Toby Pike alla vecchia scuola] -> p7
+ {not seen_board} [Guarda la tavola del concerto nella torre] -> p8
+ {visits >= 2} [Va' in canonica a pensare] -> p9

=== evening ===
# voice: evening
Quaile: La giornata è andata. In canonica, Sam.
+ [Va' in canonica] -> p9

=== function standing(n) ===
{
- n >= 2: ~ return "dalla tua parte"
- n == 1: ~ return "con simpatia"
- n == 0: ~ return "senza un'opinione, per ora"
- n == -1: ~ return "con diffidenza"
- else: ~ return "con freddezza"
}

// the ringing and the board, both counted: either route can hold an accusation
=== function evidence() ===
~ temp n = 0
{rows:
    ~ n += 1
}
{swap:
    ~ n += 1
}
{lie && swap:
    ~ n += 1
}
{dark:
    ~ n += 1
}
{named4:
    ~ n += 2
}
{proof:
    ~ n += 1
}
{quiz && typeface:
    ~ n += 1
}
{typeface:
    ~ n += 1
}
{brush:
    ~ n += 1
}
{swapped:
    ~ n += 1
}
~ return n

// ---------------------------------------------------------------- page 4: Win's cottage
=== p4 ===
# page: 4
# panel: page
{not seen_win:
    ~ visits += 1
    ~ seen_win = true
}
{p4 > 1:
    {p4 > 2:
        # voice: loop-here
        Quaile: Ci siamo già stati, Sam.
    }
    # voice: p4-again
    La casa di Win.
}
{p4 == 1:
    # voice: p4-open
    La casa di Win Haskett, l'ultima di Church Row. Come battente, una campanella d'ottone, che lei non può sentire, e accanto un pulsante che fa lampeggiare una lampada dentro casa.
}
+ {p4_win == 0} [Premi il pulsante] -> p4_win
+ {p4_win > 0} [Lasciala ai suoi fiori] -> inquiries
+ {p4_cottage == 0} [Leggi il cartello sulla porta] -> p4_cottage

=== p4_cottage ===
# panel: cottage
# voice: p4a-1
Un cartoncino alla finestra, in stampatello: Togliersi le scarpe. Vale anche per te.
+ {p4_shoes == 0} [Togliti le scarpe] -> p4_shoes
+ {p4_win == 0} [Premi il pulsante] -> p4_win
+ {p4_win > 0} [Lasciala ai suoi fiori] -> inquiries

=== p4_shoes ===
{p4_shoes == 1:
    ~ rel_win += 1
    # memory: win +1 Ti sei tolto le scarpe alla porta di Win. Se lo ricorderà.
}
-> p4_win

=== p4_win ===
# panel: win4
{p4_win > 1:
    # voice: p4b-again
    Win batte sul taccuino e guarda l'orologio.
    -> p4_win_choices
}
{was_win >= 1 || p4_shoes > 0:
    # voice: p4b-warm
    Win: Calze. Bene. Si sieda lì.
- else:
    # voice: p4b-1
    Win: Entri. Il tè è troppo carico. Si sieda lì, non lì.
}
# voice: p4b-2
Quaile si toglie l'apparecchio acustico e lo posa vicino alla teiera.
# voice: p4b-4
Win stacca un foglio dal taccuino per le vostre domande e lo spinge sul tavolo.
-> p4_win_choices
= p4_win_choices
+ {p4_bell == 0 && p4_tuesday == 0} [Scrivi: Quale campana suona?] -> p4_bell
+ {p4_bell == 0 && p4_tuesday == 0} [Scrivi: Cosa è successo martedì?] -> p4_tuesday
+ {not win_phone} [Guarda il suo telefono] -> p4_phone
+ {p4_bell > 0 || p4_tuesday > 0} [Lasciala ai suoi fiori] -> inquiries

=== p4_bell ===
# panel: notes
{p4_win == 0: -> p4_win}
# voice: p4c-1
Scrive un grande 4, lo sottolinea due volte, e aggiunge: Quarantun anni.
# voice: p4c-3
Sotto, Quaile scrive: Il tè è sempre così? Win scrive: Sì.
+ {not win_phone} [Guarda il suo telefono] -> p4_phone
+ [Lasciala ai suoi fiori] -> inquiries

=== p4_tuesday ===
# panel: notes
{p4_win == 0: -> p4_win}
~ swap = true
# voice: p4d-1
Win scrive a lungo.
# voice: p4d-2
Hugh mai arrivato. Scalati di un posto. Plain hunt in cinque, tenore fermo. Io avevo la 3. Luci spente alle 8.14. Non vedevo le corde, quindi ho tenuto la mia e ho contato.
# voice: p4d-3
Sotto, sottolineato: Qualcuno si è fermato. Chiedete a Dilys il nastro di Glenys.
+ {not win_phone} [Guarda il suo telefono] -> p4_phone
+ [Lasciala ai suoi fiori] -> inquiries

=== p4_phone ===
# panel: phone
{p4_win == 0: -> p4_win}
~ win_phone = true
~ text = true
# voice: p4e-1
Il suo telefono, sulla mensola del camino accanto all'orologio. La chat del gruppo, martedì, otto e cinque. Hugh: Sto salendo. Devo dire una cosa sulla tavola. H.
# voice: p4e-2
Win: L'ho letto quando sono tornata a casa. Nella mia torre i telefoni restano nei cappotti.
+ [Lasciala ai suoi fiori] -> inquiries

// ---------------------------------------------------------------- page 5: Jeremy's barn
=== p5 ===
# page: 5
# panel: page
{not seen_barn:
    ~ visits += 1
    ~ seen_barn = true
}
{p5 > 1:
    {p5 > 2:
        # voice: loop-here
        Quaile: Ci siamo già stati, Sam.
    }
    # voice: p5-again
    Il fienile sulla strada per Cirencester.
}
{p5 == 1:
    # voice: p5-open
    Cole Antiques: un fienile di pietra sulla strada per Cirencester, pieno di sedie di altri. Sopra la porta, un'insegna: Restauri con rispetto.
}
+ {p5_jeremy == 0} [Cerca Jeremy Cole] -> p5_jeremy
+ {p5_jeremy > 0} [Lascialo alla sua credenza] -> inquiries
+ {p5_barn == 0} [Fai un giro nel fienile] -> p5_barn

=== p5_barn ===
# panel: barn
# voice: p5a-1
Ogni sedia ha il prezzo su un'etichetta marrone da bagaglio. La più economica costa quattrocento sterline.
# voice: p5a-2
Una radio sul banco da lavoro trasmette il bollettino del mare.
+ {p5_jeremy == 0} [Cerca Jeremy Cole] -> p5_jeremy
+ {p5_jeremy > 0} [Lascialo alla sua credenza] -> inquiries

=== p5_jeremy ===
# panel: jeremy
{p5_jeremy > 1:
    # voice: p5b-again
    Jeremy: Altro, Sergente? Alle due mi arriva una credenza.
    -> p5_jeremy_choices
}
# voice: p5b-1
Jeremy: Sergente. Ispettrice. L'ho saputo stamattina. Io e Hugh non andavamo sempre d'accordo, ma alle serate del quiz era di buona compagnia.
# voice: p5b-3
Si pulisce le mani con uno straccio sporco d'oro. Ha tempo per una domanda prima della credenza.
-> p5_jeremy_choices
= p5_jeremy_choices
+ {p5_where == 0 && p5_board == 0} [Chiedi dov'era alle otto e un quarto] -> p5_where
+ {p5_where == 0 && p5_board == 0} [Chiedi della tavola del concerto] -> p5_board
+ {not brush} [Guarda il cavalletto in fondo] -> p5_brush
+ {p5_where > 0 || p5_board > 0} [Lascialo alla sua credenza] -> inquiries

=== p5_where ===
# panel: jeremy
{p5_jeremy == 0: -> p5_jeremy}
~ lie = true
# voice: p5c-1
Jeremy: Sulla cinque, a suonare, ogni colpo, dall'inizio alla fine. La cinque è la mia campana. Chieda a chiunque del gruppo.
# voice: p5c-2
Jeremy: Quando è andata via la luce ho continuato. Si fa così. Hai la corda in mano.
+ {not brush} [Guarda il cavalletto in fondo] -> p5_brush
+ {p5_van == 0} [Esci passando accanto al furgone] -> p5_van

+ [Lascialo alla sua credenza] -> inquiries
=== p5_board ===
# panel: jeremy
{p5_jeremy == 0: -> p5_jeremy}
# voice: p5d-1
Jeremy: La tavola del Giubileo? L'ho trovata in un fienile a Bibury, sotto un telone. Era della torre, l'avevano tolta negli anni Sessanta. Restaurata con rispetto.
# voice: p5d-2
Jeremy: La parrocchia l'ha pagata novemila sterline, dal fondo per il tetto. Un pub di Bath me ne offriva dodici.
# voice: p5d-3
Quaile: Il fondo per il tetto ha avuto un anno difficile.
+ {not brush} [Guarda il cavalletto in fondo] -> p5_brush
+ {p5_van == 0} [Esci passando accanto al furgone] -> p5_van

+ [Lascialo alla sua credenza] -> inquiries
=== p5_brush ===
# panel: brush
{p5_jeremy == 0: -> p5_jeremy}
~ brush = true
# voice: p5e-1
Su un cavalletto in fondo, una tavola sotto un telo antipolvere, e un pennello da insegnista appoggiato su un vasetto di missione per doratura. L'oro è ancora umido.
# voice: p5e-2
Sotto il telo: una tavola del concerto, scritta a metà. Giubileo, milleottocentonovantasette. Queste lettere hanno i piedini, come le scritte sulle vecchie insegne delle botteghe.
# voice: p5e-3
Jeremy: Una commissione. Un'altra chiesa. Non posso dire di più.
+ {p5_van == 0} [Esci passando accanto al furgone] -> p5_van

+ [Lascialo alla sua credenza] -> inquiries
=== p5_van ===
# panel: van
{p5_jeremy == 0: -> p5_jeremy}
# voice: p5f-1
Sul suo furgone c'è scritto Cole Antiques in oro, in lettere tonde e semplici, senza piedini.
+ [Lascialo alla sua credenza] -> inquiries

// ---------------------------------------------------------------- page 6: the Plough, quiz night
=== p6 ===
# page: 6
# panel: page
{not seen_plough:
    ~ visits += 1
    ~ seen_plough = true
}
{p6 > 1:
    {p6 > 2:
        # voice: loop-here
        Quaile: Ci siamo già stati, Sam.
    }
    # voice: p6-again
    Il Plough, serata del quiz.
}
{p6 == 1:
    # voice: p6-open
    Il Plough. Il quiz si fa lo stesso: Hugh ha preparato le domande domenica, e l'oste le legge dal suo foglio. Sei squadre e un camino acceso.
}
+ {not quiz} [Ascolta le domande] -> p6_quiz
+ {p6_photo == 0} [Guarda dietro il bancone] -> p6_photo
+ {p6_dilys == 0} [Cerca la squadra di Dilys] -> p6_dilys
+ [Lascia il quiz] -> inquiries

=== p6_fire ===
# panel: fire
# voice: p6a-1
Il fuoco è acceso dalle quattro. Il cane davanti non si muove dalle cinque.
+ {not quiz} [Ascolta le domande] -> p6_quiz
+ {p6_dilys == 0} [Cerca la squadra di Dilys] -> p6_dilys
+ [Lascia il quiz] -> inquiries

=== p6_quiz ===
# panel: quiz
~ quiz = true
# voice: p6b-1
Landlord: Secondo turno. Domanda sette. In che anno Monotype ha pubblicato il carattere Gill Sans?
# voice: p6b-2
Al bancone, l'oste ti mostra il foglio delle risposte di Hugh. Accanto alla domanda sette, a matita: Millenovecentoventotto. E sotto, più piccolo: Poi guardate su nella torre.
# voice: p6b-3
Quaile: Voleva fare la domanda a tutto il paese. Poi dare la risposta stampata.
+ {p6_photo == 0} [Guarda dietro il bancone] -> p6_photo
+ {p6_dilys == 0} [Cerca la squadra di Dilys] -> p6_dilys

+ [Lascia il quiz] -> inquiries
=== p6_photo ===
# panel: photo
# voice: p6c-1
Dietro il bancone, una foto di Hugh al quiz dell'anno scorso, con il papillon e il microfono.
# voice: p6c-2
Landlord: Non lasciava mai vincere la stessa squadra due volte di fila. Diceva che faceva male al paese.
+ {not quiz} [Ascolta le domande] -> p6_quiz
+ {p6_dilys == 0} [Cerca la squadra di Dilys] -> p6_dilys

+ [Lascia il quiz] -> inquiries
=== p6_dilys ===
# panel: dilys
{p6_dilys > 1:
    # voice: p6d-again
    Dilys: Sst, tesoro, è il giro della musica.
    -> p6_dilys_done
}
{rows:
    # voice: p6d-1
    Dilys: Glenys mi ha chiamata alle sei di stamattina per chiedermi se è una prova.
- else:
    {asked_dilys:
        # voice: p6d-2
        Dilys: Ieri sera ero arrabbiata con lei. Adesso meno. Ecco.
        ~ rows = true
        {p6_dilys == 1:
            ~ rel_dilys += 1
            # memory: dilys +1 Hai chiesto a Dilys due volte, e con garbo. Se lo ricorderà.
        }
        # voice: p6d-3
        Ti inoltra una mail da Perth. L'oggetto è Non la vostra serata migliore.
    - else:
        # voice: p6d-4
        Dilys: Mia sorella ha una registrazione di martedì, se a qualcuno fosse venuto in mente di chiederla. A nessuno. Ecco.
        ~ rows = true
        # voice: p6d-3
        Ti inoltra una mail da Perth. L'oggetto è Non la vostra serata migliore.
    }
}
-> p6_dilys_done
= p6_dilys_done
+ [Lascia il quiz] -> inquiries

// ---------------------------------------------------------------- page 7: the old schoolhouse
=== p7 ===
# page: 7
# panel: page
{not seen_school:
    ~ visits += 1
    ~ seen_school = true
}
{p7 > 1:
    {p7 > 2:
        # voice: loop-here
        Quaile: Ci siamo già stati, Sam.
    }
    # voice: p7-again
    La vecchia scuola.
}
{p7 == 1:
    # voice: p7-open
    La vecchia scuola, chiusa dal millenovecentonovantuno, con un cartello Vendesi. Toby Pike ci fa volare sopra un drone per la brochure.
}
+ {p7_toby == 0} [Parla con Toby] -> p7_toby
+ {p7_toby > 0} [Lascialo ai suoi acquirenti] -> inquiries
+ {p7_swing == 0} [Guarda il cortile] -> p7_swing

=== p7_school ===
# panel: school
# voice: p7e-1
Alte finestre da chiesa, un campaniletto senza campana, e un cartello accanto al cancello: Pike and Lowe, Vendesi. Sopra il tetto un drone resta sospeso nel vento, e filma.
+ {p7_toby == 0} [Parla con Toby] -> p7_toby
+ {p7_toby > 0} [Lascialo ai suoi acquirenti] -> inquiries

=== p7_swing ===
# panel: swing
# voice: p7a-1
Nel cortile è rimasta una sola altalena. Le catene sono state verniciate così tante volte che non tintinnano più.
+ {p7_toby == 0} [Parla con Toby] -> p7_toby
+ {p7_toby > 0} [Lascialo ai suoi acquirenti] -> inquiries

=== p7_toby ===
# panel: toby
{p7_toby > 1:
    # voice: p7b-again
    Toby: Sempre qui, Sergente. Sempre a vendere.
    -> p7_toby_choices
}
{was_toby <= -1:
    # voice: p7b-cold
    Toby: Il sergente che mi ha tolto il telefono. Sto lavorando.
- else:
    {was_toby >= 1:
        # voice: p7b-warm
        Toby: Ha visto il video? L'ho mandato alle sei. Io non dormo, sto vendendo una scuola.
    - else:
        # voice: p7b-1
        Toby: Sergente! Viene a comprare una scuola? Quattro camere da letto, elementi originali, una campana che nessuno può suonare.
    }
}
-> p7_toby_choices
= p7_toby_choices
+ {was_toby <= -1 && p7_sorry == 0} [Chiedigli scusa per l'estate scorsa] -> p7_sorry
+ {(was_toby > -1 || p7_sorry > 0) && p7_drone == 0} [Chiedi cosa ha visto il suo drone martedì] -> p7_drone
+ {p7_drone > 0} [Lascialo ai suoi acquirenti] -> inquiries

=== p7_sorry ===
{p7_sorry == 1:
    ~ rel_toby += 1
    # memory: toby +1 Hai chiesto scusa a Toby per l'estate scorsa. Se lo ricorderà.
}
# voice: p7c-1
Toby: Ah. Bene. Be'. Tanto le avrei mandato qualcosa comunque. Probabilmente.
-> p7_toby

=== p7_drone ===
# panel: drone
{p7_toby == 0: -> p7_toby}
~ dark = true
# voice: p7d-1
Sul suo controller, martedì sera, la chiesa vista dall'alto, per la pagina Vita di paese della brochure.
# voice: p7d-2
Otto e tredici: un uomo spinge una bicicletta attraverso il cancello coperto del sagrato. Otto e quattordici: la finestra della camera dei campanari diventa buia. Otto e quindici: si riaccende. Nessuno esce dalla porta della chiesa fino alle otto e venti.
# voice: p7d-3
Sam: Quindi chiunque fosse non è mai uscito dall'edificio.
# voice: p7d-4
Toby: Posso usare lo stesso il pezzo prima delle otto?
+ [Lascialo ai suoi acquirenti] -> inquiries

// ---------------------------------------------------------------- page 8: the peal board
=== p8 ===
# page: 8
# panel: page
{not seen_board:
    ~ visits += 1
    ~ seen_board = true
}
{p8 > 1:
    {p8 > 2:
        # voice: loop-here
        Quaile: Ci siamo già stati, Sam.
    }
    # voice: p8-again
    La camera dei campanari, di giorno.
}
{p8 == 1:
    # voice: p8-open
    La camera dei campanari alla luce del giorno. La dottoressa Achebe aspetta con una lente d'ingrandimento presa in sagrestia, e sul muro c'è la tavola del Giubileo.
}
+ {p8_board == 0} [Guarda la tavola] -> p8_board
+ {p8_achebe == 0} [Parla con la dottoressa Achebe] -> p8_achebe
+ [Lascia la torre] -> inquiries

=== p8_board ===
# panel: board
# voice: p8a-1
Nera, con lettere d'oro. Saint Aldhelm's. Per il Giubileo di Diamante di Sua Maestà la Regina Vittoria, il ventidue giugno milleottocentonovantasette, un concerto di cinquemilaquaranta cambi. Sei nomi.
# voice: p8a-2
Achebe: La parrocchia l'ha comprata a marzo. Il signor Cole l'ha trovata in un fienile. Hugh l'ha inaugurata. C'era qualcosa che a Hugh non andava, e non voleva dire cosa.
+ {not typeface} [Guarda da vicino con la lente] -> p8_glass
+ {p8_achebe == 0} [Parla con la dottoressa Achebe] -> p8_achebe

+ [Lascia la torre] -> inquiries
=== p8_glass ===
# panel: glass
{p8_board == 0: -> p8_board}
~ typeface = true
# voice: p8b-1
Sotto la lente le lettere sono pulite e tonde. La R allunga la gamba dritta. La g minuscola ha due occhielli, come un paio d'occhiali.
# voice: p8b-2
Quaile: Mio padre aveva un orario dei treni scritto con queste lettere. Lo teneva nel bagno di sotto.
{quiz:
    # voice: p8b-3
    Sam: Gill Sans. Millenovecentoventotto. Su una tavola del milleottocentonovantasette.
- else:
    # voice: p8b-4
    Sam: Non sembrano vittoriane.
}
# voice: p8b-5
Achebe: Il signor Cole ci aveva detto di averle ridorate.
+ {p8_achebe == 0} [Parla con la dottoressa Achebe] -> p8_achebe
+ {p8_motes == 0} [Guarda la corda della campana più acuta] -> p8_motes

+ [Lascia la torre] -> inquiries
=== p8_achebe ===
# panel: achebe8
{p8_achebe > 1:
    # voice: p8c-again
    Achebe: Altro, qui sopra, Sergente? Ho un funerale da organizzare.
    -> p8_achebe_choices
}
# voice: p8c-1
Achebe: In base alle frequenze di riferimento, Ispettrice, di solito è la persona che l'ha trovato. Cioè io. Mi darei un undici per cento.
# voice: p8c-2
Quaile: E gli altri?
# voice: p8c-3
Achebe: Erano tutti al buio con me. Non posso dare quote su persone che non vedevo.
-> p8_achebe_choices
= p8_achebe_choices
+ {p8_you == 0} [Chiedile cosa pensa di te] -> p8_you
+ {p8_motes == 0} [Guarda la corda della campana più acuta] -> p8_motes
+ [Lascia la torre] -> inquiries

=== p8_you ===
# panel: achebe8
{p8_achebe == 0: -> p8_achebe}
{p8_you == 1:
    ~ rel_achebe += 1
    # memory: achebe +1 Hai chiesto alla dottoressa Achebe cosa pensava di te. Se lo ricorderà.
}
{was_margaret <= -1:
    # voice: p8d-cold
    Achebe: Lei, Sergente? A Natale sarà ancora qui. Continua a presentarsi a cose a cui l'hanno invitato una volta sola.
- else:
    # voice: p8d-1
    Achebe: Lei, Sergente? A Natale sarà ancora qui. Margaret l'ha invitato a pranzo per domenica, e lei non ha detto di no.
    # voice: p8d-2
    Sam: Come fa a saperlo?
    # voice: p8d-3
    Achebe: Me l'ha detto lei. Ha comprato una seconda sedia.
}
+ {p8_motes == 0} [Guarda la corda della campana più acuta] -> p8_motes
+ [Lascia la torre] -> inquiries

=== p8_motes ===
# panel: motes
# voice: p8e-1
Polvere nella luce che entra dalle persiane del campanile. Le corde sono legate per la settimana, tutte tranne quella della campana più acuta.
# voice: p8e-2
La corda della campana più acuta pende libera, e a tenerla, come in attesa che qualcuno dica Look to, c'è uno spaventapasseri con un impermeabile blu scuro e scarpe marroni da città.
# voice: p8e-3
Achebe: Era qui quando ho aperto stamattina. Pensavo l'avesse portato su qualcuno del gruppo.
+ [Lascia la torre] -> inquiries

// ---------------------------------------------------------------- page 9: the rows (Wednesday night, the vicarage)
=== p9 ===
# page: 9
# panel: page
{p9 > 1:
    {p9 > 2:
        # voice: loop-here
        Quaile: Ci siamo già stati, Sam.
    }
    # voice: p9-again
    La cucina della canonica.
}
{p9 == 1:
    # voice: p9-open
    La cucina della canonica, le undici di sera. La dottoressa Achebe ha un foglio di calcolo aperto e il bollitore acceso. Quaile si è tolta le scarpe.
}
-> p9_choices
= p9_choices
+ {rows && not bell4} [Leggi la mail di Glenys] -> p9_email
+ {bell4 && not named4} [Scopri chi suonava quella campana] -> p9_who
+ {p9_notes == 0} [Ripassa il taccuino] -> p9_notes
+ {p9_quaile == 0} [Chiedi a Quaile cosa ne pensa] -> p9_quaile
+ [Va' a letto. Domenica c'è la funzione] -> p10

=== p9_table ===
# panel: table
# voice: p9a-1
Sul tavolo: il tovagliolo di Win del Plough, tre tazze e un piatto di biscotti che Quaile sta contando.
-> p9.p9_choices

=== p9_window ===
# panel: window
# voice: p9b-1
Fuori dalla finestra, la torre contro la pioggia. Qualcuno ha lasciato la luce accesa nella camera dei campanari.
-> p9.p9_choices

=== p9_email ===
# panel: laptop
{not rows:
    # voice: p9c-none
    Il foglio di calcolo della dottoressa Achebe ha sei colonne intitolate da Uno a Sei, ancora vuote.
    -> p9.p9_choices
}
{p9_email > 1:
    # voice: p9c-again
    Le tre righe di Glenys, sullo schermo: 2 4 1 3. 4 2 3 1. 4 3 2 1.
    -> p9_guess
}
# voice: p9c-1
Achebe: Da Glenys, a Perth. Cara Dilys. Non la vostra serata migliore. Andavate bene in cinque fino alle e quattordici, poi qualcuno dice luci, e una campana si ferma di colpo per quaranta secondi.
# voice: p9c-2
Achebe: Ne sento solo quattro, quindi le ho numerate per nota, dalla più acuta, come le sento. Ecco tre righe.
2 4 1 3
4 2 3 1
4 3 2 1
# voice: p9c-3
Achebe: Poi rientra in ritardo e goffa, come qualcuno senza fiato. Win vi ha fermati alle e sedici. Quattro su dieci. Baci, G.
# voice: p9c-4
Achebe: Non può dire quale campana fosse. Sente solo le note. Ma abbiamo il tovagliolo di Win.
-> p9_guess
= p9_guess
+ {p9_one == 0 && not bell4} [Si è fermata la uno] -> p9_one
+ {p9_two == 0 && not bell4} [Si è fermata la due] -> p9_two
+ {p9_three == 0 && not bell4} [Si è fermata la tre] -> p9_three
+ {not bell4} [Si è fermata la quattro] -> p9_four
+ {p9_five == 0 && not bell4} [Si è fermata la cinque] -> p9_five
+ [Lascia stare per ora] -> p9.p9_choices

// what each silent bell would have sounded like, taken out of the napkin's rows 4 2 5 1 3, 4 5 2 3 1, 5 4 3 2 1 and
// numbered again by note (tools/rows.mjs prints these from the plain hunt rule)
=== p9_one ===
# panel: laptop
~ guesses += 1
# voice: p9d-1
Achebe: Togli la uno, e quella prima riga suonerebbe 3 1 4 2. Glenys ha sentito 2 4 1 3.
-> p9_email.p9_guess

=== p9_two ===
# panel: laptop
~ guesses += 1
# voice: p9d-2
Achebe: Togli la due, e quella prima riga suonerebbe 3 4 1 2. Glenys ha sentito 2 4 1 3.
-> p9_email.p9_guess

=== p9_three ===
# panel: laptop
~ guesses += 1
# voice: p9d-3
Achebe: Togli la tre, e quella prima riga suonerebbe 3 2 4 1. Glenys ha sentito 2 4 1 3.
-> p9_email.p9_guess

=== p9_five ===
# panel: laptop
~ guesses += 1
# voice: p9d-5
Achebe: Togli la cinque, e quella prima riga suonerebbe 4 2 1 3. Ci siamo quasi. Glenys ha sentito 2 4 1 3.
-> p9_email.p9_guess

=== p9_four ===
# panel: laptop
~ bell4 = true
# voice: p9d-4
Achebe: Togli la quattro. 4 2 5 1 3 diventa 2 5 1 3, e per nota fa 2 4 1 3. Poi 4 2 3 1. Poi 4 3 2 1. Ogni riga.
{guesses == 0:
    # voice: p9d-first
    Quaile: Al primo colpo.
}
# voice: p9d-6
Sam: La quattro si è fermata per quaranta secondi, al buio, ed è tornata senza fiato.
-> p9_who

=== p9_who ===
# panel: table
{p9_who > 1:
    # voice: p9e-again
    Sam: Chi aveva la quattro martedì?
}
{p9_who == 1:
    # voice: p9e-1
    Achebe: Non chieda a me chi l'aveva. Era la quarta volta in vita mia che tenevo una corda. Non avrei saputo dire quale fosse la mia.
}
+ {p9_win == 0} [Win] -> p9_win
+ {p9_jeremy == 0} [Jeremy] -> p9_jeremy
+ {p9_dilys == 0} [Dilys] -> p9_dilys
+ {p9_margaret == 0} [Margaret] -> p9_margaret
+ [Lascia stare per ora] -> p9.p9_choices

=== p9_win ===
# panel: table
{swap:
    # voice: p9f-1
    Sam: La lavagna dice Win. Quarantun anni sulla quattro. Ma non martedì. Hugh non è venuto, quindi hanno scalato tutti di un posto. Win aveva la tre.
    -> p9_who
- else:
    # voice: p9f-2
    Sam: La lavagna dice Win. Quattro, Win.
    # voice: p9f-3
    Quaile: Lì di solito c'è lei, Sam. Ma martedì c'era lei?
    -> p9.p9_choices
}

=== p9_jeremy ===
# panel: table
{swap:
    ~ named4 = true
    # voice: p9g-1
    Sam: Hugh non è venuto, quindi hanno scalato tutti di un posto. La campana di Jeremy è la cinque. Martedì ha suonato la quattro, vicino alla porta e all'interruttore della luce.
    {lie:
        # voice: p9g-2
        Sam: E ci ha detto che era sulla cinque, ogni colpo.
    }
    # voice: p9g-3
    Quaile: Scrivilo.
- else:
    # voice: p9g-4
    Sam: Jeremy stava vicino alla porta.
    # voice: p9g-5
    Quaile: La lavagna dice che Jeremy suona la cinque, Sam. Ti serve più di dove stava.
}
-> p9.p9_choices

=== p9_dilys ===
# panel: table
# voice: p9h-1
Sam: Dilys suona la tre, e martedì è passata alla due. Ha parlato con me quasi tutto il tempo.
-> p9_who

=== p9_margaret ===
# panel: table
# voice: p9h-2
Sam: Margaret aveva la campana più acuta. La sua prima volta. Glenys l'avrebbe sentita fermarsi.
-> p9_who

=== p9_quaile ===
# panel: quaile
{p9_quaile == 1 && was_quaile >= 1:
    # voice: p9i-warm
    Quaile: Hai imparato a chiedermi le cose, Sam. Va bene.
}
{evidence() >= 5:
    # voice: p9i-good
    Quaile: Credo che tu lo sappia. Vorrei che lo dicessi domenica, davanti a tutta la parrocchia.
- else:
    {not typeface:
        # voice: p9i-board
        Quaile: Hugh voleva dire qualcosa sulla tavola. Qualcuno l'ha guardata per bene?
    - else:
        {not swap:
            # voice: p9i-swap
            Quaile: Hugh non è venuto. Allora chi era su quale corda?
        - else:
            # voice: p9i-rows
            Quaile: Dilys registra ogni prova. Qualcuno le ha chiesto quella di martedì?
        }
    }
}
-> p9.p9_choices

=== p9_notes ===
# panel: table
{text:
    # voice: p9n-text
    Hugh, alle otto e cinque: sto salendo, devo dire una cosa sulla tavola.
}
{proof:
    # voice: p9n-proof
    Nella sua mano, l'angolo di una bozza: Tavola del concerto, una corre. Il resto della pagina non c'è.
}
{swap:
    # voice: p9n-swap
    Hugh non è venuto, quindi hanno scalato tutti di un posto.
}
{lie && swap:
    # voice: p9n-lie
    Jeremy dice di aver suonato la cinque, ogni colpo.
}
{lie && not swap:
    # voice: p9n-lie-b
    Jeremy dice di aver suonato la cinque, ogni colpo, ed è quello che dice la lavagna.
}
{rows:
    # voice: p9n-rows
    Glenys, da Perth: una campana si è fermata di colpo per quaranta secondi quando è andata via la luce, ed è tornata senza fiato.
}
{named4:
    # voice: p9n-named
    La campana muta era la quattro, e martedì la quattro era Jeremy.
}
{dark:
    # voice: p9n-dark
    Il drone: la camera buia dalle otto e quattordici alle otto e quindici. Nessuno è uscito dalla chiesa.
}
{quiz:
    # voice: p9n-quiz
    La domanda sette di Hugh: Gill Sans, millenovecentoventotto. Poi guardate su nella torre.
}
{typeface:
    # voice: p9n-typeface
    La tavola del Giubileo è scritta in lettere tonde, senza piedini.
}
{brush:
    # voice: p9n-brush
    Nel fienile di Jeremy, una seconda tavola del Giubileo, scritta a metà, l'oro ancora umido.
}
{not (text or proof or swap or rows or dark or quiz or typeface or brush):
    # voice: p9n-empty
    Nel taccuino hai la data, e le parole plain hunt.
}
-> p9.p9_choices

// ---------------------------------------------------------------- page 10: Sunday
=== p10 ===
# page: 10
# panel: page
{p10 > 1:
    {p10 > 2:
        # voice: loop-here
        Quaile: Ci siamo già stati, Sam.
    }
    # voice: p10-again
    La funzione della domenica.
}
{p10 == 1:
    # voice: p10-open
    Domenica, la funzione del raccolto. Zucche sul fonte battesimale, e sul muro la tavola del Giubileo sotto un drappo viola, da benedire dopo gli avvisi. Jeremy Cole è nel primo banco, in completo.
}
-> p10_choices
= p10_choices
+ {p10_cloth == 0} [Solleva il drappo] -> p10_cloth
+ {p10_nave == 0} [Ascolta gli avvisi] -> p10_nave
+ {accused == ""} [Alzati in piedi] -> p10_stand
+ {accused != ""} [Resta per il suono delle campane] -> p10_bell

=== p10_nave ===
# panel: nave
# voice: p10a-1
Achebe: Avvisi. I turni per i fiori sono nel portico. Il fondo per il tetto è a quattromiladuecento sterline.
# voice: p10a-2
Achebe: Il funerale di Hugh Daventry sarà qui giovedì alle undici. I fiori li fa Margaret.
-> p10.p10_choices

=== p10_pew ===
# panel: pew
# voice: p10b-1
Jeremy Cole siede nel primo banco con il libro degli inni chiuso. Non ha guardato il drappo.
-> p10.p10_choices

=== p10_cloth ===
# panel: cloth
~ swapped = true
# voice: p10c-1
Sollevi l'angolo del drappo viola. L'oro sulla data è ancora appiccicoso. Adesso le lettere hanno i piedini.
{brush:
    # voice: p10c-2
    Sam: È la tavola del suo fienile. Le ha scambiate.
- else:
    # voice: p10c-3
    Sam: Non è la tavola che ho visto martedì.
}
# voice: p10c-4
La dottoressa Achebe interrompe gli avvisi e ti guarda da sopra gli occhiali.
-> p10.p10_choices

=== p10_stand ===
# panel: nave
# voice: p10d-1
Quaile: Avanti, allora.
+ [Fai il nome di Jeremy Cole] -> p10_jeremy
+ [Fai il nome di Win Haskett] -> p10_win
+ [Fai il nome di Dilys Rudd] -> p10_dilys
+ [Fai il nome della dottoressa Achebe] -> p10_achebe

=== p10_jeremy ===
# panel: pew
~ accused = "jeremy"
{proof:
    # voice: p10e-proof
    Sam: Hugh è morto stringendo l'angolo di una bozza. Tavola del concerto, una correzione. Il resto di quella pagina ce l'ha lei.
}
{quiz && typeface:
    # voice: p10e-typeface
    Sam: La tavola che ha venduto a questa chiesa per novemila sterline è scritta in Gill Sans. Il Gill Sans è uscito nel millenovecentoventotto.
}
{brush || swapped:
    # voice: p10e-brush
    Sam: Così ne ha scritta una nuova nel suo fienile, e l'ha scambiata questa settimana.
}
{named4:
    # voice: p10e-named
    Sam: Martedì il gruppo ha scalato di un posto, e lei ha suonato la quattro. Quando è andata via la luce, la quattro si è fermata di colpo per quaranta secondi.
- else:
    {rows:
        # voice: p10e-rows
        Sam: Quando è andata via la luce, una campana si è fermata di colpo per quaranta secondi.
    }
}
{dark:
    # voice: p10e-dark
    Sam: E nessuno è uscito dalla chiesa.
}
{evidence() >= 5:
    -> p10_confess
- else:
    # voice: p10e-hunch
    Jeremy: Ho suonato ogni colpo, Sergente. Chieda a chiunque del gruppo.
    # voice: p10e-sit
    Quaile: Siediti, Sam. Non oggi.
    ~ ending = "denied"
    -> p10_after
}

=== p10_win ===
# panel: nave
~ accused = "win"
{p10_win == 1:
    ~ rel_win -= 2
    # memory: win -2 Hai accusato Win Haskett in chiesa. Lei non l'ha sentito, e non lo dimenticherà.
}
# voice: p10f-win
Win: Avevo la tre, Sergente. L'ho tenuta al buio. Chieda a Glenys.
-> p10_quaile

=== p10_dilys ===
# panel: nave
~ accused = "dilys"
{p10_dilys == 1:
    ~ rel_dilys -= 2
    # memory: dilys -2 Hai accusato Dilys Rudd in chiesa. Non lo dimenticherà.
}
# voice: p10f-dilys
Dilys: Ero sulla due, tesoro, e parlavo con lei tutto il tempo. Mi ha sentita.
-> p10_quaile

=== p10_achebe ===
# panel: nave
~ accused = "achebe"
{p10_achebe == 1:
    ~ rel_achebe -= 2
    # memory: achebe -2 Hai accusato la dottoressa Achebe nella sua chiesa. Se lo ricorderà, con due cifre decimali.
}
# voice: p10f-achebe
Achebe: Undici per cento, Sergente. L'avevo detto.
-> p10_quaile

=== p10_quaile ===
# panel: nave
{evidence() >= 5:
    # voice: p10g-1
    Quaile: Siediti, Sam. Signor Cole, Hugh voleva stampare una correzione sulla sua tavola. Lei è sceso per la scala al buio per riprendersi la pagina.
    ~ ending = "quaile"
    -> p10_confess
- else:
    # voice: p10g-2
    Quaile: Siediti, Sam.
    # voice: p10g-3
    La dottoressa Achebe benedice la tavola. Jeremy Cole le tiene il drappo.
    ~ ending = "none"
    -> p10_after
}

=== p10_confess ===
# panel: pew
{ending == "":
    ~ ending = "solved"
    ~ rel_quaile += 1
    # memory: quaile +1 Hai fatto tu il nome di Jeremy Cole. Quaile se lo ricorderà.
}
# voice: p10h-1
Jeremy: Voleva stamparla nel bollettino di novembre. Ne arriva una copia in ogni casa del paese.
# voice: p10h-2
Jeremy: Sono sceso a chiedergli la pagina. Lui l'ha tenuta stretta ed è arretrato di un passo, e lì non c'è nessun gradino.
# voice: p10h-3
Quaile: E poi è tornato su e ha suonato.
# voice: p10h-4
Jeremy: Non sapevo cos'altro fare.
-> p10_after

=== p10_after ===
+ [Resta per il suono delle campane] -> p10_bell

=== p10_bell ===
# panel: bell
{ending == "": -> p10_stand}
# voice: p10i-1
Dopo la funzione il gruppo suona per il raccolto. Cinque corde. Win di nuovo sulla quattro.
{ending == "solved" or ending == "quaile":
    # voice: p10i-2
    La dottoressa Achebe suona la cinque, e per due volte va giusta.
- else:
    # voice: p10i-3
    Jeremy Cole suona la cinque, ogni colpo.
}
# voice: p10i-4
Le corde si fermano. Win appoggia la mano aperta sul muro, poi alza gli occhi alla corda del tenore, ancora legata al suo gancio.
-> credits

=== credits ===
{ending:
- "solved": Hai risolto Plain Hunt.
- "quaile": Quaile ha risolto Plain Hunt. Tu avevi fatto prima il nome sbagliato.
- "denied": Hai fatto il nome dell'uomo giusto, senza abbastanza per trattenerlo.
- else: Nessuno è stato incriminato. La tavola è stata benedetta.
}
Luoghi visitati: {seen_win: la casa di Win, }{seen_barn: il fienile di Jeremy, }{seen_plough: il Plough, }{seen_school: la vecchia scuola, }{seen_board: la tavola del concerto, }e la canonica.
Prove contro Jeremy Cole: {evidence()} su 11.
Il paese si ricorda di te. Toby: {standing(rel_toby)}. Margaret: {standing(rel_margaret)}. Dilys: {standing(rel_dilys)}. Quaile: {standing(rel_quaile)}. Win: {standing(rel_win)}. Dottoressa Achebe: {standing(rel_achebe)}.
+ [Ricomincia] -> restart

=== restart ===
# restart
-> END
