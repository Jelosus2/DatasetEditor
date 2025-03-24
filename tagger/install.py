from pathlib import Path
import subprocess
import sys
import os

def install_requirements():
    os.chdir('tagger')

    python = sys.executable
    venv_path = Path('venv')

    if not Path.exists(venv_path):
        print('Creating virtual environment...')
        subprocess.check_call(f'{python} -m venv venv', shell=sys.platform == 'linux')
        venv_pip = venv_path.joinpath('Scripts/pip.exe' if sys.platform == 'win32' else 'bin/pip')
        print('Installing requirements...')
        subprocess.check_call(f'{venv_pip} install -r requirements.txt', shell=sys.platform == 'linux')

install_requirements()