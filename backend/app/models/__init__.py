"""Importing this package imports every model module in it.

Alembic's `env.py` does `import app.models` so that `Base.metadata` knows every table
before autogenerate runs. Importing the package alone does not pull in its submodules,
so a new model file that nobody remembered to list here would produce a silently empty
migration. Discovering the modules keeps that impossible to forget.
"""

from importlib import import_module
from pkgutil import iter_modules

for _module in iter_modules(__path__):
    if not _module.name.startswith("_"):
        import_module(f"{__name__}.{_module.name}")

del import_module, iter_modules
