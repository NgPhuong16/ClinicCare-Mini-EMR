"""LIKE-pattern helpers shared by the repositories.

User input reaches `LIKE` in more than one repository now. Unescaped, a term of `%`
matches every row and defeats the blank-term guard, so every such filter goes through
`contains_pattern`.
"""

ESCAPE = "\\"


def escape_like(term: str) -> str:
    # `%` and `_` are LIKE wildcards; a user typing "E11_" should match literally.
    return term.replace(ESCAPE, ESCAPE * 2).replace("%", f"{ESCAPE}%").replace("_", f"{ESCAPE}_")


def contains_pattern(term: str) -> str:
    return f"%{escape_like(term)}%"
