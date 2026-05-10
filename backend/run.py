import os
import sys
from pathlib import Path

try:
    import uvicorn
except ModuleNotFoundError as exc:
    if exc.name != "uvicorn":
        raise

    venv_python = Path(__file__).resolve().parent / "venv" / "bin" / "python"
    in_virtualenv = sys.prefix != sys.base_prefix
    if venv_python.exists() and not in_virtualenv:
        os.execv(str(venv_python), [str(venv_python), *sys.argv])

    raise ModuleNotFoundError(
        "uvicorn is not installed for this Python. Run "
        "`python3 -m venv venv && ./venv/bin/pip install -r requirements.txt` "
        "from the backend directory, or start with `../agent-board.sh start`."
    ) from exc

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    reload = os.getenv("UVICORN_RELOAD", "false").lower() == "true"
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=reload)
