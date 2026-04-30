from pathlib import Path
import sys


project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from pvt_app.app import app as application


app = application