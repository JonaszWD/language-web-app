from app.services.vocab import _implied_confidence, _strip_article, normalize, scrambled_letters


def test_normalize_ignores_case_accents_spaces_and_punctuation():
    assert normalize("¿El Café?") == "elcafe"
    assert normalize("  señor!! ") == "senor"


def test_normalize_makes_answers_comparable():
    assert normalize("Cafe") == normalize("café")


def test_strip_article_drops_leading_article_only_when_more_words_follow():
    assert _strip_article("el café") == "café"
    assert _strip_article("Las llaves") == "llaves"
    assert _strip_article("el") == "el"
    assert _strip_article("casa grande") == "casa grande"


def test_scrambled_letters_is_a_permutation_without_spaces():
    letters = scrambled_letters("la casa")
    assert sorted(letters) == sorted("lacasa")


def test_implied_confidence_is_higher_for_correct_answers():
    assert _implied_confidence(True) > _implied_confidence(False)
