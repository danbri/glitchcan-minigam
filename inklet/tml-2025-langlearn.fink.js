oooOO`

-> start

VAR correct_answers = 0

=== start ===
Welcome to your Ukrainian Food Words tutorial! Let's learn a few basics. Ready?

+ Yes, let's go!
    -> bread_question
+ Not right now.
    -> end

=== bread_question ===
What is the Ukrainian word for "bread"?

+ Хліб
    ~ correct_answers++
    -> correct_bread
+ Молоко
    -> wrong_bread_1
+ Сир
    -> wrong_bread_2
+ Яблуко
    -> wrong_bread_3

=== correct_bread ===
Correct! "Хліб" means bread.
-> dairy_question

=== wrong_bread_1 ===
Oops! "Молоко" means milk.
-> dairy_question

=== wrong_bread_2 ===
Not quite! "Сир" means cheese.
-> dairy_question

=== wrong_bread_3 ===
Nope! "Яблуко" means apple.
-> dairy_question

=== dairy_question ===
Which of these Ukrainian words refer to **dairy products**? (Choose one for now.)

+ Молоко
    ~ correct_answers++
    -> dairy_correct_milk
+ Сир
    ~ correct_answers++
    -> dairy_correct_cheese
+ Борщ
    -> dairy_wrong_borscht
+ Хліб
    -> dairy_wrong_bread

=== dairy_correct_milk ===
Correct! "Молоко" means milk.
-> match_question

=== dairy_correct_cheese ===
Correct! "Сир" is cheese.
-> match_question

=== dairy_wrong_borscht ===
"Борщ" is a beet soup, not a dairy product.
-> match_question

=== dairy_wrong_bread ===
"Хліб" is bread — not dairy!
-> match_question

=== match_question ===
Now match the Ukrainian word to its English meaning.
-> match_borscht

=== match_borscht ===
What does "Борщ" mean?

+ Beet soup
    ~ correct_answers++
    -> match_varenyky
+ Dumplings
    "Close, but that's 'Вареники'."
    -> match_varenyky
+ Sausage
    "Nope! That's 'Ковбаса'."
    -> match_varenyky

=== match_varenyky ===
What does "Вареники" mean?

+ Dumplings
    ~ correct_answers++
    -> match_sausage
+ Sausage
    "Nope! That's 'Ковбаса'."
    -> match_sausage
+ Beet soup
    "That was 'Борщ'."
    -> match_sausage

=== match_sausage ===
What does "Ковбаса" mean?

+ Sausage
    ~ correct_answers++
    -> fruit_question
+ Dumplings
    "That's 'Вареники'."
    -> fruit_question
+ Beet soup
    "That's 'Борщ'."
    -> fruit_question

=== fruit_question ===
Which one of these is a **fruit**?

+ Яблуко
    ~ correct_answers++
    -> fruit_correct
+ Сир
    -> fruit_wrong_cheese
+ Хліб
    -> fruit_wrong_bread
+ Молоко
    -> fruit_wrong_milk

=== fruit_correct ===
Correct! "Яблуко" is an apple — a fruit.
-> grammar_intro

=== fruit_wrong_cheese ===
Nope! "Сир" means cheese.
-> grammar_intro

=== fruit_wrong_bread ===
"Хліб" means bread, not fruit.
-> grammar_intro

=== fruit_wrong_milk ===
"Молоко" is milk, not a fruit.
-> grammar_intro

=== grammar_intro ===
Awesome! Now that you know some food words, let’s look at a bit of **Ukrainian grammar**.

In Ukrainian, nouns change form depending on their role in a sentence — this is called **case**.

Let’s start with two:
- \*\*Nominative** (subject)
- \*\*Accusative** (object)

-> grammar_case_example

=== grammar_case_example ===
Here are some examples:

🟢 **Nominative** (used for the subject of the sentence):  
- Це **хліб**. (This is bread.)  
- \*\*Сир** смачний. (The cheese is tasty.)  
- \*\*Яблуко** зелене. (The apple is green.)

🔵 **Accusative** (used for the object of the sentence):  
- Я їм **хліб**. (I eat bread.)  
- Вона купує **сир**. (She buys cheese.)  
- Він їсть **ковбасу**. (He eats sausage.)

Now let's practice!
-> case_practice_bread

=== case_practice_bread ===
Choose the correct form of "bread" in this sentence:

"Я їм ___." (I am eating ___.)

+ хліб
    ~ correct_answers++
    -> case_bread_correct
+ хліба
    -> case_bread_wrong
+ хлібом
    -> case_bread_wrong

=== case_bread_correct ===
Correct! "Хліб" remains the same in the accusative case (masculine inanimate nouns often do).
-> case_practice_cheese

=== case_bread_wrong ===
Not quite! The correct form is "хліб".
-> case_practice_cheese

=== case_practice_cheese ===
"Вона купує ___." (She is buying ___ — "cheese")

+ сир
    ~ correct_answers++
    -> case_cheese_correct
+ сиру
    -> case_cheese_wrong
+ сиром
    -> case_cheese_wrong

=== case_cheese_correct ===
Nice! "Сир" doesn't change here in accusative either.
-> case_practice_sausage

=== case_cheese_wrong ===
"Сир" is correct in this sentence. Try to remember how masculine inanimate nouns behave!
-> case_practice_sausage

=== case_practice_sausage ===
"Він їсть ___." (He is eating ___ — "sausage")

+ ковбаса
    -> sausage_wrong_nominative
+ ковбасу
    ~ correct_answers++
    -> sausage_correct
+ ковбасою
    -> sausage_wrong_instrumental

=== sausage_correct ===
Exactly! Feminine nouns ending in "-а" often change to "-у" in the accusative case.
-> grammar_review

=== sausage_wrong_nominative ===
That’s the nominative form. In this sentence, we need the accusative: "ковбасу".
-> grammar_review

=== sausage_wrong_instrumental ===
"Ковбасою" is instrumental case — not used here.
-> grammar_review

=== grammar_review ===
✅ Great job! Here's a quick grammar recap using food:

\*\*Nominative (Subject)**  
- Це хліб.  
- Сир смачний.  
- Яблуко велике.  

\*\*Accusative (Object)**  
- Я їм хліб.  
- Вона купує сир.  
- Він їсть ковбасу.

Remember:
- Masculine inanimate nouns often stay the same.  
- Feminine nouns often change "-а" → "-у" in accusative.

-> tutorial_complete

=== tutorial_complete ===
🎉 Well done! You finished the Ukrainian Food Vocabulary and Grammar Tutorial.

You answered {correct_answers} questions correctly.  
Keep practicing and soon you’ll be ready for more cases like **genitive**, **instrumental**, and **plural declensions**!

-> end

=== end ===
До побачення! (Goodbye!) You've finished this brief Ukrainian food vocabulary tutorial.

-> END
`
