from __future__ import annotations

import sys
from pathlib import Path


if sys.platform == "win32":
    import _pytest.tmpdir

    _BASE_TEMP = Path(__file__).resolve().parents[1] / ".pytest-tmp"
    _TEMP_COUNTERS: dict[str, int] = {}

    def _patched_getbasetemp(self):
        if getattr(self, "_basetemp", None) is None:
            _BASE_TEMP.mkdir(parents=True, exist_ok=True)
            self._basetemp = _BASE_TEMP
        return self._basetemp

    def _patched_mktemp(self, basename: str, numbered: bool = True):
        root = self.getbasetemp()
        if not numbered:
            path = root / basename
            path.mkdir(parents=True, exist_ok=True)
            return path.resolve()

        index = _TEMP_COUNTERS.get(basename, 0)
        while True:
            path = root / f"{basename}{index}"
            if not path.exists():
                path.mkdir(parents=True)
                _TEMP_COUNTERS[basename] = index + 1
                return path.resolve()
            index += 1

    # Python 3.13 on this Windows setup creates tmp directories that pytest
    # cannot scandir again, so we keep tmp paths in a repo-local location.
    _pytest.tmpdir.TempPathFactory.getbasetemp = _patched_getbasetemp
    _pytest.tmpdir.TempPathFactory.mktemp = _patched_mktemp
    _pytest.tmpdir.cleanup_dead_symlinks = lambda root: None
